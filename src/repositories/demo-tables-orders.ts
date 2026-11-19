// src/repositories/demo-tables-orders.ts
// Repositórios de pedidos, pagamentos e solicitações públicas no IndexedDB demo.

import type { IDBPDatabase } from "idb";
import { consumesCapacity } from "@/domain/orderStatus";
import type { DemoDB } from "./demo-db";
import { assertDayCapacity, sortOrders, uid } from "./demo-internal";
import type {
  IOrderRepository,
  IPaymentRepository,
  IPublicSubmissionRepository,
  NewOrder,
  NewPayment,
  Order,
  OrderPayment,
  PublicSubmission,
} from "./types";

type GetDb = () => Promise<IDBPDatabase<DemoDB>>;

const now = (): string => new Date().toISOString();

export const createOrderRepository = (getDb: GetDb): IOrderRepository => ({
  listByProfile: async (profileId, filter) => {
    const db = await getDb();
    const all = await db.getAllFromIndex("orders", "by-profile", profileId);
    const statuses =
      filter?.status === undefined
        ? null
        : new Set(Array.isArray(filter.status) ? filter.status : [filter.status]);

    const filtered = all.filter(
      (order) =>
        (!statuses || statuses.has(order.status)) &&
        (!filter?.fromDate || (order.scheduledDate ?? "") >= filter.fromDate) &&
        (!filter?.toDate || (order.scheduledDate ?? "9999") <= filter.toDate),
    );
    return sortOrders(filtered);
  },

  getById: async (id) => (await (await getDb()).get("orders", id)) ?? null,

  create: async (data: NewOrder) => {
    const db = await getDb();
    const order: Order = {
      id: uid("order"),
      profileId: data.profileId,
      publicCode: data.publicCode ?? null,
      customerName: data.customerName,
      customerWhatsapp: data.customerWhatsapp,
      items: [...data.items],
      deliveryType: data.deliveryType,
      deliveryAddress: data.deliveryAddress ?? null,
      scheduledDate: data.scheduledDate,
      scheduledTime: data.scheduledTime,
      status: data.status ?? "solicitacao",
      totalCents: data.totalCents,
      notes: data.notes ?? null,
      capacityOverrideReason: data.capacityOverrideReason ?? null,
      createdAt: now(),
    };
    await db.put("orders", order);
    return order;
  },

  update: async (id, patch) => {
    const db = await getDb();
    const current = await db.get("orders", id);
    if (!current) return null;

    const updated: Order = { ...current, ...patch };
    const becameConsuming =
      consumesCapacity(updated.status) &&
      (!consumesCapacity(current.status) || updated.scheduledDate !== current.scheduledDate);

    if (becameConsuming) {
      await assertDayCapacity(db, {
        profileId: updated.profileId,
        scheduledDate: updated.scheduledDate,
        items: updated.items,
        overrideReason: updated.capacityOverrideReason,
        excludeOrderId: updated.id,
      });
    }

    await db.put("orders", updated);
    return updated;
  },

  delete: async (id) => {
    const db = await getDb();
    if (!(await db.get("orders", id))) return false;
    await db.delete("orders", id);
    return true;
  },
});

export const createPaymentRepository = (getDb: GetDb): IPaymentRepository => ({
  listByOrder: async (orderId) => {
    const db = await getDb();
    const payments = await db.getAllFromIndex("payments", "by-order", orderId);
    return payments.sort((a, b) => (a.paidAt ?? "").localeCompare(b.paidAt ?? ""));
  },

  create: async (data: NewPayment) => {
    const db = await getDb();
    const payment: OrderPayment = {
      id: uid("pay"),
      orderId: data.orderId,
      amountCents: data.amountCents,
      status: data.status ?? "informado",
      paidAt: data.paidAt ?? now(),
    };
    await db.put("payments", payment);
    return payment;
  },

  updateStatus: async (id, status, paidAt) => {
    const db = await getDb();
    const current = await db.get("payments", id);
    if (!current) return null;
    const updated: OrderPayment = {
      ...current,
      status,
      paidAt: paidAt ?? current.paidAt ?? now(),
    };
    await db.put("payments", updated);
    return updated;
  },
});

export const createSubmissionRepository = (getDb: GetDb): IPublicSubmissionRepository => ({
  create: async (data) => {
    const db = await getDb();
    const submission: PublicSubmission = {
      id: uid("sub"),
      profileId: data.profileId,
      payload: data.payload,
      status: data.status ?? "pendente",
      createdAt: now(),
      anonymizeAfter: data.anonymizeAfter ?? null,
    };
    await db.put("submissions", submission);
    return submission;
  },

  listByProfile: async (profileId, filter) => {
    const db = await getDb();
    const all = await db.getAllFromIndex("submissions", "by-profile", profileId);
    const filtered = all
      .filter((submission) => !filter?.status || submission.status === filter.status)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return filter?.limit ? filtered.slice(0, filter.limit) : filtered;
  },

  updateStatus: async (id, status) => {
    const db = await getDb();
    const current = await db.get("submissions", id);
    if (!current) return null;
    const updated: PublicSubmission = { ...current, status };
    await db.put("submissions", updated);
    return updated;
  },
});
