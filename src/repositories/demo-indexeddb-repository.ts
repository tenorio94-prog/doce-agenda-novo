// src/repositories/demo-indexeddb-repository.ts
// IDoceRepository sobre IndexedDB (idb) para o modo /demo — client-side only.
// Nenhum dado sai do navegador: ao recarregar, a agenda fictícia continua lá.

import type { IDBPDatabase } from "idb";
import { validateOverrideReason } from "@/domain/capacity";
import { consumesCapacity } from "@/domain/orderStatus";
import { DEMO_DB_NAME, DEMO_STORES, openDemoDb, type DemoDB } from "./demo-db";
import { assertDayCapacity, buildOrderItems, normalizeCode, uid } from "./demo-internal";
import { DEMO_PROFILE_ID, DEMO_SEED_VERSION, seedDemoDatabase } from "./demo-seed";
import {
  createCatalogRepository,
  createDateOverrideRepository,
  createProfileRepository,
} from "./demo-tables-catalog";
import {
  createOrderRepository,
  createPaymentRepository,
  createSubmissionRepository,
} from "./demo-tables-orders";
import type {
  AcceptedSubmission,
  CapacityOverrideInput,
  IAcceptingSubmissionRepository,
  ICatalogRepository,
  IConfirmableOrderRepository,
  IDateOverrideRepository,
  IDemoMaintenanceRepository,
  IDoceRepository,
  IPaymentRepository,
  IProfileRepository,
  Order,
  PublicOrderStatus,
  PublicSubmission,
} from "./types";

export interface DemoRepositoryOptions {
  /** Nome do banco — use um valor único por teste para isolar os dados. */
  dbName?: string;
  /** Data de referência do seed (padrão: agora). */
  now?: Date;
}

/** Só persiste o motivo quando ele passa na regra 4..300 (senão mantém o antigo). */
const overrideReasonFor = (reason?: string | null): string | null =>
  typeof reason === "string" && validateOverrideReason(reason) ? reason.trim() : null;

export class DemoIndexedDBRepository implements IDoceRepository, IDemoMaintenanceRepository {
  readonly demoProfileId = DEMO_PROFILE_ID;
  readonly profiles: IProfileRepository;
  readonly catalog: ICatalogRepository;
  readonly orders: IConfirmableOrderRepository;
  readonly payments: IPaymentRepository;
  readonly dateOverrides: IDateOverrideRepository;
  readonly submissions: IAcceptingSubmissionRepository;

  private readonly dbName: string;
  private readonly seedNow: Date;
  private dbPromise: Promise<IDBPDatabase<DemoDB>> | null = null;

  constructor(options: DemoRepositoryOptions = {}) {
    this.dbName = options.dbName ?? DEMO_DB_NAME;
    this.seedNow = options.now ? new Date(options.now.getTime()) : new Date();

    const getDb = () => this.conn();
    this.profiles = createProfileRepository(getDb);
    this.catalog = createCatalogRepository(getDb);
    this.payments = createPaymentRepository(getDb);
    this.dateOverrides = createDateOverrideRepository(getDb);
    this.orders = {
      ...createOrderRepository(getDb),
      confirmOrder: (id, options) => this.confirmOrder(id, options),
    };
    this.submissions = {
      ...createSubmissionRepository(getDb),
      acceptPublicSubmission: (id, options) => this.acceptPublicSubmission(id, options),
    };
  }

  // ---------------------------------------------------------------- conexão

  private async conn(): Promise<IDBPDatabase<DemoDB>> {
    if (typeof indexedDB === "undefined") {
      throw new Error("DemoIndexedDBRepository requer um navegador com IndexedDB.");
    }
    this.dbPromise ??= openDemoDb(this.dbName);
    const db = await this.dbPromise;
    const marker = await db.get("meta", "seed-version");
    if (marker?.value !== String(DEMO_SEED_VERSION)) {
      await seedDemoDatabase(db, this.seedNow);
    }
    return db;
  }

  // ---------------------------------------------------------------- comandos

  /** Confirma o pedido respeitando as vagas do dia (ou a justificativa de override). */
  async confirmOrder(
    orderId: string,
    options: CapacityOverrideInput = {},
  ): Promise<Order | null> {
    const db = await this.conn();
    const order = await db.get("orders", orderId);
    if (!order) return null;
    if (consumesCapacity(order.status)) return order;

    await assertDayCapacity(db, {
      profileId: order.profileId,
      scheduledDate: order.scheduledDate,
      items: order.items,
      overrideReason: options.overrideReason,
      excludeOrderId: order.id,
    });

    const updated: Order = {
      ...order,
      status: "confirmado",
      capacityOverrideReason:
        overrideReasonFor(options.overrideReason) ?? order.capacityOverrideReason,
    };
    await db.put("orders", updated);
    return updated;
  }

  /** Aceita uma solicitação pública, congelando itens e preços no novo pedido. */
  async acceptPublicSubmission(
    submissionId: string,
    options: CapacityOverrideInput = {},
  ): Promise<AcceptedSubmission | null> {
    const db = await this.conn();
    const submission = await db.get("submissions", submissionId);
    if (!submission || submission.status !== "pendente") return null;

    const payload = submission.payload;
    const catalog = await db.getAllFromIndex("catalog", "by-profile", submission.profileId);
    const items = buildOrderItems(payload.items, catalog);
    await assertDayCapacity(db, {
      profileId: submission.profileId,
      scheduledDate: payload.scheduledDate ?? null,
      items,
      overrideReason: options.overrideReason,
    });

    const order: Order = {
      id: uid("order"),
      profileId: submission.profileId,
      publicCode: await this.nextPublicCode(db),
      customerName: payload.customerName?.trim() || null,
      customerWhatsapp: payload.customerWhatsapp?.trim() || null,
      items,
      deliveryType: payload.deliveryType ?? "retirada",
      deliveryAddress: payload.deliveryAddress ?? null,
      scheduledDate: payload.scheduledDate ?? null,
      scheduledTime: payload.scheduledTime ?? null,
      status: "confirmado",
      totalCents: items.reduce((acc, item) => acc + item.unitPriceCents * item.quantity, 0),
      notes: payload.notes ?? null,
      capacityOverrideReason: overrideReasonFor(options.overrideReason),
      createdAt: new Date().toISOString(),
    };
    const acceptedSubmission: PublicSubmission = { ...submission, status: "aceito" };

    const tx = db.transaction(["orders", "submissions", "meta"], "readwrite");
    void tx.objectStore("orders").put(order);
    void tx.objectStore("submissions").put(acceptedSubmission);
    void tx.objectStore("meta").put({ key: `submission-order:${submission.id}`, value: order.id });
    await tx.done;
    return { submission: acceptedSubmission, order };
  }

  /** Recusa uma solicitação pendente (não mexe em pedidos existentes). */
  async rejectPublicSubmission(submissionId: string): Promise<PublicSubmission | null> {
    const db = await this.conn();
    const submission = await db.get("submissions", submissionId);
    if (!submission || submission.status !== "pendente") return null;
    const updated: PublicSubmission = { ...submission, status: "recusado" };
    await db.put("submissions", updated);
    return updated;
  }

  // --------------------------------------------------------------- acompanhamento

  /** Consulta pública por código: só status, itens, datas e financeiro conferido. */
  async getPublicOrderStatus(publicCode: string): Promise<PublicOrderStatus | null> {
    const db = await this.conn();
    const code = normalizeCode(publicCode);
    const order = await db.getFromIndex("orders", "by-code", code);
    if (!order) return null;

    const payments = await db.getAllFromIndex("payments", "by-order", order.id);
    const paidCents = payments
      .filter((payment) => payment.status === "conferido")
      .reduce((acc, payment) => acc + payment.amountCents, 0);

    return {
      publicCode: order.publicCode ?? code,
      status: order.status,
      items: order.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
      })),
      scheduledDate: order.scheduledDate,
      scheduledTime: order.scheduledTime,
      financials: {
        totalCents: order.totalCents,
        paidCents,
        remainingCents: Math.max(0, order.totalCents - paidCents),
      },
    };
  }

  // ------------------------------------------------------------------- reset

  /** Limpa todos os stores e grava o seed novamente (útil para gravar demos). */
  async resetDemoData(): Promise<void> {
    const db = await this.conn();
    const tx = db.transaction(DEMO_STORES, "readwrite");
    await Promise.all(DEMO_STORES.map((store) => tx.objectStore(store).clear()));
    await tx.done;
    await seedDemoDatabase(db, this.seedNow);
  }

  private async nextPublicCode(db: IDBPDatabase<DemoDB>): Promise<string> {
    const current = Number((await db.get("meta", "order-code-counter"))?.value ?? "100");
    const next = (Number.isFinite(current) ? current : 100) + 1;
    await db.put("meta", { key: "order-code-counter", value: String(next) });
    return `DA-${String(next).padStart(4, "0")}`;
  }
}

/** Instância pronta para o /demo (use dentro de um client component). */
export const createDemoRepository = (options?: DemoRepositoryOptions): DemoIndexedDBRepository =>
  new DemoIndexedDBRepository(options);
