// src/repositories/demo-internal.ts
// Utilidades internas compartilhadas pelo modo demo.

import type { IDBPDatabase } from "idb";
import { consumesCapacity } from "@/domain/orderStatus";
import type { DemoDB } from "./demo-db";
import { dayCapacityFor, requireCapacity } from "./demo-capacity";
import { RepositoryError } from "./errors";
import { orderSlots } from "./mappers/order";
import type { CatalogItem, IsoDate, Order, OrderItem } from "./types";

export const uid = (prefix: string): string =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export const normalizeCode = (code: string): string => code.trim().toUpperCase();

/** Ordena por data/hora agendada; pedidos sem data vão para o fim. */
export const sortOrders = (orders: Order[]): Order[] =>
  [...orders].sort(
    (a, b) =>
      (a.scheduledDate ?? "9999").localeCompare(b.scheduledDate ?? "9999") ||
      (a.scheduledTime ?? "99:99").localeCompare(b.scheduledTime ?? "99:99") ||
      a.createdAt.localeCompare(b.createdAt),
  );

/** Congela nome/preço do catálogo nos itens do pedido (mesmo padrão do banco). */
export const buildOrderItems = (
  selections: readonly { catalogItemId: string; quantity: number }[] | undefined,
  catalog: readonly CatalogItem[],
): OrderItem[] => {
  if (!selections?.length) {
    throw new RepositoryError("Solicitação sem itens.", "INVALID_SUBMISSION");
  }
  return selections.map((selection) => {
    const item = catalog.find((c) => c.id === selection.catalogItemId);
    if (!item) {
      throw new RepositoryError(
        `Item indisponível no catálogo: ${selection.catalogItemId}`,
        "CATALOG_ITEM_UNAVAILABLE",
      );
    }
    return {
      catalogItemId: item.id,
      name: item.name,
      quantity: Math.max(1, Math.round(selection.quantity)),
      unitPriceCents: item.priceCents,
      slotsRequired: item.slotsRequired,
      notes: null,
    };
  });
};

export interface DayCapacityCheck {
  profileId: string;
  scheduledDate: IsoDate | null;
  items: readonly OrderItem[];
  overrideReason?: string | null;
  /** Ignora este pedido no cálculo (ex.: ao remarcar um pedido já confirmado). */
  excludeOrderId?: string;
}

/** Verifica a capacidade do dia somando apenas pedidos que consomem vaga. */
export const assertDayCapacity = async (
  db: IDBPDatabase<DemoDB>,
  { profileId, scheduledDate, items, overrideReason, excludeOrderId }: DayCapacityCheck,
): Promise<void> => {
  if (!scheduledDate) {
    throw new RepositoryError("Escolha uma data antes de confirmar o pedido.", "MISSING_DATE");
  }
  const profile = await db.get("profiles", profileId);
  if (!profile) {
    throw new RepositoryError(`Perfil não encontrado: ${profileId}`, "PROFILE_NOT_FOUND");
  }

  const overrides = await db.getAllFromIndex("dateOverrides", "by-date", [profileId, scheduledDate]);
  const dayOrders = (await db.getAllFromIndex("orders", "by-profile", profileId)).filter(
    (order) =>
      order.id !== excludeOrderId &&
      order.scheduledDate === scheduledDate &&
      consumesCapacity(order.status),
  );

  requireCapacity({
    capacity: dayCapacityFor(profile, overrides, scheduledDate),
    scheduledDate,
    takenSlots: dayOrders.map((order) => orderSlots(order.items)),
    requestedSlots: orderSlots(items),
    overrideReason,
  });
};
