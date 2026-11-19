// src/repositories/supabase/publicStatus.ts
// Consulta pública do pedido por código. Projeção mínima (LGPD): status, itens,
// data/hora e resumo financeiro conferido — nunca endereço, telefone ou notas.

import type { ServerSupabaseClient } from "@/lib/supabase/server";

import { toRepositoryError } from "../errors";
import { asInt, asIsoDate, asIsoTime, asObject, asString } from "../mappers/core";
import { toOrderStatus } from "../mappers/order";
import type { PublicOrderItem, PublicOrderStatus } from "../types";

interface PublicStatusSource {
  public_code: unknown;
  status: unknown;
  items: unknown;
  scheduled_date: unknown;
  scheduled_time: unknown;
  total_cents: unknown;
  paid_cents: unknown;
}

const toPublicStatus = (row: PublicStatusSource): PublicOrderStatus => {
  const totalCents = Math.max(0, asInt(row.total_cents));
  const paidCents = Math.max(0, asInt(row.paid_cents));

  const items: PublicOrderItem[] = Array.isArray(row.items)
    ? row.items.map(asObject).map((item) => ({
        name: asString(item.name),
        quantity: Math.max(1, asInt(item.quantity, 1)),
        unitPriceCents: Math.max(0, asInt(item.unitPriceCents ?? item.unit_price_cents)),
      }))
    : [];

  return {
    publicCode: asString(row.public_code),
    status: toOrderStatus(row.status),
    items,
    scheduledDate: asIsoDate(row.scheduled_date),
    scheduledTime: asIsoTime(row.scheduled_time),
    financials: {
      totalCents,
      paidCents,
      remainingCents: Math.max(0, totalCents - paidCents),
    },
  };
};

/**
 * Busca o pedido pelo código público.
 *
 * Prefere a função `public_order_status` (security definer), que devolve só os
 * campos seguros para o visitante anon; se ela não existir no projeto, cai
 * para uma leitura direta de colunas mínimas (funciona com sessão da dona).
 */
export async function selectPublicOrderStatus(
  db: ServerSupabaseClient,
  code: string,
): Promise<PublicOrderStatus | null> {
  const normalized = code.trim();
  if (normalized.length === 0) return null;

  const rpc = await db.rpc("public_order_status", { p_code: normalized });
  if (rpc.error === null) {
    return rpc.data ? toPublicStatus(rpc.data as PublicStatusSource) : null;
  }

  const fallback = await db
    .from("orders")
    .select("id,public_code,status,items,scheduled_date,scheduled_time,total_cents")
    .ilike("public_code", normalized)
    .maybeSingle();
  if (fallback.error) throw toRepositoryError("publicStatus", fallback.error);
  if (!fallback.data) return null;

  const { data: payments, error: paymentsError } = await db
    .from("order_payments")
    .select("amount_cents")
    .eq("order_id", fallback.data.id)
    .eq("status", "conferido");
  if (paymentsError) throw toRepositoryError("publicStatus.payments", paymentsError);

  const paidCents = ((payments ?? []) as { amount_cents: number | null }[]).reduce(
    (acc, payment) => acc + Math.max(0, asInt(payment.amount_cents)),
    0,
  );

  return toPublicStatus({ ...(fallback.data as Omit<PublicStatusSource, "paid_cents">), paid_cents: paidCents });
}
