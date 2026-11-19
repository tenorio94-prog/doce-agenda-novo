// src/repositories/mappers/order.ts
// orders / order_payments ↔ Order / OrderPayment

import { clampSlots } from "@/domain/capacity";
import type { OrderStatus } from "@/domain/orderStatus";
import { ORDER_STATUSES } from "@/domain/orderStatus";

import { DELIVERY_TYPES } from "../types";
import type {
  DeliveryType,
  NewOrder,
  NewPayment,
  Order,
  OrderItem,
  OrderPatch,
  OrderPayment,
  PaymentStatus,
} from "../types";
import {
  asInt,
  asIsoDate,
  asIsoTime,
  asNullableString,
  asObject,
  asString,
  asTimestamp,
} from "./core";

export interface OrderRow {
  id: string;
  profile_id: string;
  public_code: string | null;
  customer_name: string | null;
  customer_whatsapp: string | null;
  items: unknown;
  delivery_type: string | null;
  delivery_address: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  status: string | null;
  total_cents: number | null;
  notes: string | null;
  capacity_override_reason: string | null;
  created_at: string | null;
}

const STATUS_SET: ReadonlySet<string> = new Set(ORDER_STATUSES);
const DELIVERY_SET: ReadonlySet<string> = new Set(DELIVERY_TYPES);

export const toOrderStatus = (value: unknown): OrderStatus =>
  typeof value === "string" && STATUS_SET.has(value) ? (value as OrderStatus) : "solicitacao";

export const toDeliveryType = (value: unknown): DeliveryType | null =>
  typeof value === "string" && DELIVERY_SET.has(value) ? (value as DeliveryType) : null;

/**
 * Item congelado no pedido. Aceita camelCase (padrão novo) e snake_case
 * (registros antigos) para não perder itens já gravados.
 */
export const toOrderItem = (value: unknown): OrderItem | null => {
  const raw = asObject(value);
  const catalogItemId = asString(raw.catalogItemId ?? raw.catalog_item_id);
  if (catalogItemId.length === 0) return null;
  return {
    catalogItemId,
    name: asString(raw.name),
    quantity: Math.max(1, asInt(raw.quantity, 1)),
    unitPriceCents: Math.max(0, asInt(raw.unitPriceCents ?? raw.unit_price_cents)),
    slotsRequired: clampSlots(asInt(raw.slotsRequired ?? raw.slots_required, 1)),
    notes: asNullableString(raw.notes),
  };
};

export const parseOrderItems = (value: unknown): OrderItem[] =>
  Array.isArray(value)
    ? value.map(toOrderItem).filter((item): item is OrderItem => item !== null)
    : [];

/** Vagas que o pedido ocupa: soma dos itens, limitada a 1..10 por pedido. */
export const orderSlots = (items: readonly OrderItem[]): number =>
  clampSlots(
    items.reduce(
      (acc, item) => acc + clampSlots(item.slotsRequired) * Math.max(1, item.quantity),
      0,
    ),
  );

export const toOrder = (row: OrderRow): Order => ({
  id: asString(row.id),
  profileId: asString(row.profile_id),
  publicCode: asNullableString(row.public_code),
  customerName: asNullableString(row.customer_name),
  customerWhatsapp: asNullableString(row.customer_whatsapp),
  items: parseOrderItems(row.items),
  deliveryType: toDeliveryType(row.delivery_type),
  deliveryAddress: asNullableString(row.delivery_address),
  scheduledDate: asIsoDate(row.scheduled_date),
  scheduledTime: asIsoTime(row.scheduled_time),
  status: toOrderStatus(row.status),
  totalCents: Math.max(0, asInt(row.total_cents)),
  notes: asNullableString(row.notes),
  capacityOverrideReason: asNullableString(row.capacity_override_reason),
  createdAt: asTimestamp(row.created_at),
});

export const orderRow = (data: NewOrder): Record<string, unknown> => ({
  profile_id: data.profileId,
  public_code: data.publicCode ?? null,
  customer_name: data.customerName,
  customer_whatsapp: data.customerWhatsapp,
  items: data.items,
  delivery_type: data.deliveryType,
  delivery_address: data.deliveryAddress ?? null,
  scheduled_date: data.scheduledDate,
  scheduled_time: data.scheduledTime,
  status: data.status ?? "solicitacao",
  total_cents: Math.max(0, data.totalCents),
  notes: data.notes ?? null,
  capacity_override_reason: data.capacityOverrideReason ?? null,
});

export const orderPatchRow = (patch: OrderPatch): Record<string, unknown> => {
  const row: Record<string, unknown> = {};
  if (patch.publicCode !== undefined) row.public_code = patch.publicCode;
  if (patch.customerName !== undefined) row.customer_name = patch.customerName;
  if (patch.customerWhatsapp !== undefined) row.customer_whatsapp = patch.customerWhatsapp;
  if (patch.items !== undefined) row.items = patch.items;
  if (patch.deliveryType !== undefined) row.delivery_type = patch.deliveryType;
  if (patch.deliveryAddress !== undefined) row.delivery_address = patch.deliveryAddress;
  if (patch.scheduledDate !== undefined) row.scheduled_date = patch.scheduledDate;
  if (patch.scheduledTime !== undefined) row.scheduled_time = patch.scheduledTime;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.totalCents !== undefined) row.total_cents = Math.max(0, patch.totalCents);
  if (patch.notes !== undefined) row.notes = patch.notes;
  if (patch.capacityOverrideReason !== undefined) {
    row.capacity_override_reason = patch.capacityOverrideReason;
  }
  return row;
};

// --------------------------------------------------------- order_payments

export interface PaymentRow {
  id: string;
  order_id: string;
  amount_cents: number | null;
  status: string | null;
  paid_at: string | null;
}

const toPaymentStatus = (value: unknown): PaymentStatus =>
  value === "conferido" ? "conferido" : "informado";

export const toOrderPayment = (row: PaymentRow): OrderPayment => ({
  id: asString(row.id),
  orderId: asString(row.order_id),
  amountCents: Math.max(0, asInt(row.amount_cents)),
  status: toPaymentStatus(row.status),
  paidAt: asNullableString(row.paid_at),
});

export const paymentRow = (data: NewPayment): Record<string, unknown> => ({
  order_id: data.orderId,
  amount_cents: Math.max(0, data.amountCents),
  status: data.status ?? "informado",
  paid_at: data.paidAt ?? new Date().toISOString(),
});
