// src/repositories/demo-seed.ts
// Seed fictício da "Doces da Lu" para o modo /demo (IndexedDB, client-side).
// Datas são relativas a `now` para a agenda parecer viva em qualquer execução.

import type { IDBPDatabase } from "idb";
import { todayISO } from "@/domain/timezone";
import type { DemoDB } from "./demo-db";
import { buildDemoAgenda, type DemoAgendaDates } from "./demo-seed-agenda";
import {
  addDays,
  daysAgo,
  DEMO_PROFILE_ID,
  seedCatalogItems,
} from "./demo-seed-data";
import type {
  CatalogItem,
  DateOverride,
  IsoDate,
  Order,
  OrderPayment,
  Profile,
  PublicSubmission,
} from "./types";

export { DEMO_PROFILE_ID } from "./demo-seed-data";

export const DEMO_SEED_VERSION = 1;

export interface DemoSeedHandles {
  paidOrderId: string;
  partialOrderId: string;
  awaitingOrderId: string;
  pendingSubmissionId: string;
  fullDate: IsoDate;
  closedDate: IsoDate;
  freeDate: IsoDate;
  partialPublicCode: string;
}

export interface DemoSeed {
  profile: Profile;
  catalog: CatalogItem[];
  orders: Order[];
  payments: OrderPayment[];
  dateOverrides: DateOverride[];
  submissions: PublicSubmission[];
  handles: DemoSeedHandles;
}

const buildProfile = (now: Date): Profile => ({
  id: DEMO_PROFILE_ID,
  userId: "demo-user-lu",
  businessName: "Doces da Lu",
  slug: "doces-da-lu",
  themeStyle: "caseira",
  coverUrl: "/images/demo-fotografias/originais/bastidores-confeitaria.png",
  logoUrl: "/images/demo-fotografias/originais/logo-doces-da-lu.png",
  pixKey: "lu@docesdalu.com.br",
  defaultWeeklyCapacity: { seg: 5, ter: 5, qua: 4, qui: 4, sex: 4, sab: 6, dom: 4 },
  createdAt: daysAgo(now, 120),
});

export const buildDemoSeed = (now: Date = new Date()): DemoSeed => {
  const today = todayISO(now);
  const dates: DemoAgendaDates = {
    paidDate: addDays(today, 1),
    freeDate: addDays(today, 2),
    partialDate: addDays(today, 3),
    closedDate: addDays(today, 4),
    fullDate: addDays(today, 5),
    pastDate: addDays(today, -6),
  };
  const agenda = buildDemoAgenda(now, dates);

  return {
    profile: buildProfile(now),
    catalog: seedCatalogItems(),
    ...agenda,
    handles: {
      paidOrderId: "ord-marina-pago",
      partialOrderId: "ord-juliana-parcial",
      awaitingOrderId: "ord-pedro-aguardando",
      pendingSubmissionId: "sub-camila-link",
      fullDate: dates.fullDate,
      closedDate: dates.closedDate,
      freeDate: dates.freeDate,
      partialPublicCode: "DA-0102",
    },
  };
};

/** Grava o seed inteiro em uma única transação, marcando a versão aplicada. */
export const seedDemoDatabase = async (
  db: IDBPDatabase<DemoDB>,
  now: Date = new Date(),
): Promise<DemoSeed> => {
  const seed = buildDemoSeed(now);
  const tx = db.transaction(
    ["profiles", "catalog", "orders", "payments", "dateOverrides", "submissions", "meta"],
    "readwrite",
  );

  void tx.objectStore("profiles").put(seed.profile);
  const catalog = tx.objectStore("catalog");
  for (const item of seed.catalog) void catalog.put(item);
  const orders = tx.objectStore("orders");
  for (const order of seed.orders) void orders.put(order);
  const payments = tx.objectStore("payments");
  for (const p of seed.payments) void payments.put(p);
  const overrides = tx.objectStore("dateOverrides");
  for (const o of seed.dateOverrides) void overrides.put(o);
  const submissions = tx.objectStore("submissions");
  for (const s of seed.submissions) void submissions.put(s);

  const meta = tx.objectStore("meta");
  void meta.put({ key: "seed-version", value: String(DEMO_SEED_VERSION) });
  void meta.put({ key: "order-code-counter", value: "110" });

  await tx.done;
  return seed;
};
