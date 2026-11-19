// src/repositories/supabase/orders.ts
// OrderRepository sobre Supabase (RLS: dono via perfil).
// `confirmOrder` (e qualquer update que passe a ocupar vaga) confere a
// capacidade do dia antes de gravar — ver ../capacity-guard.

import { consumesCapacity } from "@/domain/orderStatus";
import type { ServerSupabaseClient } from "@/lib/supabase/server";

import { reserveDayCapacity } from "../capacity-guard";
import { RepositoryError, toRepositoryError } from "../errors";
import { orderPatchRow, orderRow, toOrder } from "../mappers/order";
import type { OrderRow } from "../mappers/order";
import type {
  CapacityOverrideInput,
  IConfirmableOrderRepository,
  IsoDate,
  NewOrder,
  Order,
  OrderFilter,
  OrderItem,
  OrderPatch,
} from "../types";

export function createOrdersRepository(db: ServerSupabaseClient): IConfirmableOrderRepository {
  const getById = async (id: string): Promise<Order | null> => {
    const { data, error } = await db.from("orders").select("*").eq("id", id).maybeSingle();
    if (error) throw toRepositoryError("orders.getById", error);
    return data ? toOrder(data as OrderRow) : null;
  };

  /**
   * Confere a agenda do dia e devolve o motivo de exceção a persistir.
   * Pedido sem data agendada não pode ser confirmado.
   */
  const ensureCapacity = async (
    order: Order,
    items: readonly OrderItem[],
    date: IsoDate | null,
    overrideReason: string | null | undefined,
  ): Promise<string | null> => {
    if (date === null) {
      throw new RepositoryError(
        "Pedido sem data agendada não pode ocupar a agenda.",
        "ORDER_MISSING_DATE",
      );
    }
    return reserveDayCapacity({ db, profileId: order.profileId, date, items, overrideReason });
  };

  const listByProfile = async (profileId: string, filter?: OrderFilter): Promise<Order[]> => {
    let query = db.from("orders").select("*").eq("profile_id", profileId);

    const statusFilter = filter?.status;
    if (typeof statusFilter === "string") query = query.eq("status", statusFilter);
    else if (statusFilter !== undefined) query = query.in("status", [...statusFilter]);

    if (filter?.fromDate !== undefined) query = query.gte("scheduled_date", filter.fromDate);
    if (filter?.toDate !== undefined) query = query.lte("scheduled_date", filter.toDate);

    const { data, error } = await query
      .order("scheduled_date", { ascending: true, nullsFirst: false })
      .order("scheduled_time", { ascending: true, nullsFirst: false });
    if (error) throw toRepositoryError("orders.listByProfile", error);
    return ((data ?? []) as OrderRow[]).map(toOrder);
  };

  const create = async (data: NewOrder): Promise<Order> => {
    const { data: row, error } = await db.from("orders").insert(orderRow(data)).select("*").single();
    if (error) throw toRepositoryError("orders.create", error);
    return toOrder(row as OrderRow);
  };

  const update = async (id: string, patch: OrderPatch): Promise<Order | null> => {
    const current = await getById(id);
    if (current === null) return null;

    const row = orderPatchRow(patch);
    const nextStatus = patch.status ?? current.status;

    // Confirmação via update também passa pelo guard de capacidade.
    if (!consumesCapacity(current.status) && consumesCapacity(nextStatus)) {
      const overrideReason = await ensureCapacity(
        current,
        patch.items ?? current.items,
        patch.scheduledDate ?? current.scheduledDate,
        patch.capacityOverrideReason,
      );
      if (overrideReason !== null) row.capacity_override_reason = overrideReason;
    }

    if (Object.keys(row).length === 0) return current;

    const { data, error } = await db
      .from("orders")
      .update(row)
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) throw toRepositoryError("orders.update", error);
    return data ? toOrder(data as OrderRow) : null;
  };

  const remove = async (id: string): Promise<boolean> => {
    const { data, error } = await db.from("orders").delete().eq("id", id).select("id");
    if (error) throw toRepositoryError("orders.delete", error);
    return (data ?? []).length > 0;
  };

  const confirmOrder = async (
    id: string,
    options?: CapacityOverrideInput,
  ): Promise<Order | null> => {
    const order = await getById(id);
    if (order === null) return null;

    // Já ocupa vaga: nada a recalcular (idempotente).
    if (consumesCapacity(order.status)) return order;

    const overrideReason = await ensureCapacity(
      order,
      order.items,
      order.scheduledDate,
      options?.overrideReason,
    );

    const patch: Record<string, unknown> = { status: "confirmado" };
    if (overrideReason !== null) patch.capacity_override_reason = overrideReason;

    const { data, error } = await db
      .from("orders")
      .update(patch)
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) throw toRepositoryError("orders.confirmOrder", error);
    return data ? toOrder(data as OrderRow) : null;
  };

  return { listByProfile, getById, create, update, delete: remove, confirmOrder };
}
