// src/repositories/capacity-guard.ts
// Verificação de vagas antes de gravar um pedido que ocupa agenda.
// Reaproveita o motor de domínio (`@/domain/capacity`) em vez de recriar regra.

import {
  consumedSlots,
  dayLimit,
  hasCapacity,
  validateOverrideReason,
} from "@/domain/capacity";
import type { DayCapacity, OrderSlot } from "@/domain/capacity";
import { CAPACITY_CONSUMING } from "@/domain/orderStatus";
import type { ServerSupabaseClient } from "@/lib/supabase/server";

import { CapacityExceededError, toRepositoryError } from "./errors";
import { DEFAULT_DAY_SLOTS, parseWeeklyCapacity, weekdayOf } from "./mappers/core";
import { orderSlots, parseOrderItems } from "./mappers/order";
import type { IsoDate, OrderItem, WeeklyCapacity } from "./types";

export interface CapacityCheckInput {
  db: ServerSupabaseClient;
  profileId: string;
  /** Dia que o pedido vai ocupar. */
  date: IsoDate;
  /** Itens do pedido em análise (cada item pede `slotsRequired` por unidade). */
  items: readonly OrderItem[];
  /** Motivo de exceção (4–300 chars) — só é aceito se o dia estiver cheio. */
  overrideReason?: string | null;
}

interface OverrideLookup {
  max_slots: number | null;
  is_closed: boolean | null;
}

const weekLimit = (weekly: WeeklyCapacity, date: IsoDate): number =>
  weekly[weekdayOf(date)] ?? DEFAULT_DAY_SLOTS;

/**
 * Confere se o dia comporta os itens e devolve o motivo de exceção a gravar
 * (ou `null` quando há vaga normal).
 *
 * @throws {CapacityExceededError} quando o dia está cheio/fechado e não há
 * `overrideReason` válido.
 */
export async function reserveDayCapacity(input: CapacityCheckInput): Promise<string | null> {
  const { db, profileId, date, items } = input;

  // Sem RPC transacional: leitura + escrita não são atômicas. O uso previsto é
  // uma confeiteira por perfil, e a RLS já a impede de tocar em outra agenda.
  const [profileResult, overrideResult, ordersResult] = await Promise.all([
    db.from("profiles").select("default_weekly_capacity").eq("id", profileId).maybeSingle(),
    db
      .from("date_overrides")
      .select("max_slots,is_closed")
      .eq("profile_id", profileId)
      .eq("target_date", date)
      .maybeSingle(),
    db
      .from("orders")
      .select("items")
      .eq("profile_id", profileId)
      .eq("scheduled_date", date)
      .in("status", [...CAPACITY_CONSUMING]),
  ]);

  if (profileResult.error) throw toRepositoryError("capacity.profile", profileResult.error);
  if (overrideResult.error) throw toRepositoryError("capacity.override", overrideResult.error);
  if (ordersResult.error) throw toRepositoryError("capacity.orders", ordersResult.error);

  const weekly = parseWeeklyCapacity(profileResult.data?.default_weekly_capacity);
  const defaultSlots = weekLimit(weekly, date);
  const override = (overrideResult.data ?? null) as OverrideLookup | null;

  const cap: DayCapacity = {
    defaultSlots,
    overrides: override
      ? {
          [date]: {
            maxSlots: override.max_slots ?? defaultSlots,
            isClosed: override.is_closed === true,
          },
        }
      : undefined,
  };

  const consuming: OrderSlot[] = ((ordersResult.data ?? []) as { items: unknown }[]).map((row) => ({
    slots: orderSlots(parseOrderItems(row.items)),
  }));

  const requested = orderSlots(items);
  if (hasCapacity(cap, date, consuming, requested)) return null;

  const reason = typeof input.overrideReason === "string" ? input.overrideReason.trim() : "";
  if (validateOverrideReason(reason)) return reason;

  throw new CapacityExceededError({
    date,
    limit: dayLimit(cap, date),
    consumedSlots: consumedSlots(consuming),
    requestedSlots: requested,
    overrideReason: reason.length > 0 ? reason : null,
    overrideReasonInvalid: reason.length > 0,
  });
}
