// src/repositories/demo-db.ts
// Schema IndexedDB do modo demo. Client-side apenas: nenhum dado sai do navegador.

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type {
  CatalogItem,
  DateOverride,
  Order,
  OrderPayment,
  Profile,
  PublicSubmission,
} from "./types";

export const DEMO_DB_NAME = "doce-agenda-demo";
export const DEMO_DB_VERSION = 1;

export interface DemoMeta {
  key: string;
  value: string;
}

export interface DemoDB extends DBSchema {
  profiles: { key: string; value: Profile };
  catalog: {
    key: string;
    value: CatalogItem;
    indexes: { "by-profile": string };
  };
  orders: {
    key: string;
    value: Order;
    indexes: { "by-profile": string; "by-code": string };
  };
  payments: {
    key: string;
    value: OrderPayment;
    indexes: { "by-order": string };
  };
  dateOverrides: {
    key: string;
    value: DateOverride;
    /** Chave composta [profileId, targetDate] — única por dia. */
    indexes: { "by-profile": string; "by-date": [string, string] };
  };
  submissions: {
    key: string;
    value: PublicSubmission;
    indexes: { "by-profile": string };
  };
  meta: { key: string; value: DemoMeta };
}

/** Todos os stores — usado no reset e nas transações de seed. */
export const DEMO_STORES = [
  "profiles",
  "catalog",
  "orders",
  "payments",
  "dateOverrides",
  "submissions",
  "meta",
] as const;

export type DemoStoreName = (typeof DEMO_STORES)[number];

export const openDemoDb = (name: string = DEMO_DB_NAME): Promise<IDBPDatabase<DemoDB>> =>
  openDB<DemoDB>(name, DEMO_DB_VERSION, {
    upgrade(db) {
      db.createObjectStore("profiles", { keyPath: "id" });

      const catalog = db.createObjectStore("catalog", { keyPath: "id" });
      catalog.createIndex("by-profile", "profileId");

      const orders = db.createObjectStore("orders", { keyPath: "id" });
      orders.createIndex("by-profile", "profileId");
      orders.createIndex("by-code", "publicCode");

      const payments = db.createObjectStore("payments", { keyPath: "id" });
      payments.createIndex("by-order", "orderId");

      const overrides = db.createObjectStore("dateOverrides", { keyPath: "id" });
      overrides.createIndex("by-profile", "profileId");
      overrides.createIndex("by-date", ["profileId", "targetDate"]);

      const submissions = db.createObjectStore("submissions", { keyPath: "id" });
      submissions.createIndex("by-profile", "profileId");

      db.createObjectStore("meta", { keyPath: "key" });
    },
    blocked() {
      console.warn("[demo] Outra aba está com uma versão antiga do banco aberta.");
    },
  });
