// src/repositories/supabase/payments.ts
// PaymentRepository sobre Supabase (RLS: dono via pedido → perfil).

import type { ServerSupabaseClient } from "@/lib/supabase/server";

import { toRepositoryError } from "../errors";
import { paymentRow, toOrderPayment } from "../mappers/order";
import type { PaymentRow } from "../mappers/order";
import type {
  IPaymentRepository,
  NewPayment,
  OrderPayment,
  PaymentStatus,
  IsoTimestamp,
} from "../types";

export function createPaymentsRepository(db: ServerSupabaseClient): IPaymentRepository {
  const listByOrder = async (orderId: string): Promise<OrderPayment[]> => {
    const { data, error } = await db
      .from("order_payments")
      .select("*")
      .eq("order_id", orderId)
      .order("paid_at", { ascending: true });
    if (error) throw toRepositoryError("payments.listByOrder", error);
    return ((data ?? []) as PaymentRow[]).map(toOrderPayment);
  };

  const create = async (data: NewPayment): Promise<OrderPayment> => {
    const { data: row, error } = await db
      .from("order_payments")
      .insert(paymentRow(data))
      .select("*")
      .single();
    if (error) throw toRepositoryError("payments.create", error);
    return toOrderPayment(row as PaymentRow);
  };

  const updateStatus = async (
    id: string,
    status: PaymentStatus,
    paidAt?: IsoTimestamp,
  ): Promise<OrderPayment | null> => {
    const patch: Record<string, unknown> = { status };
    if (paidAt !== undefined) patch.paid_at = paidAt;

    const { data, error } = await db
      .from("order_payments")
      .update(patch)
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) throw toRepositoryError("payments.updateStatus", error);
    return data ? toOrderPayment(data as PaymentRow) : null;
  };

  return { listByOrder, create, updateStatus };
}
