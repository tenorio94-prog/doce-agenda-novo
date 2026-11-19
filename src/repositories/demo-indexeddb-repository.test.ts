import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { DemoIndexedDBRepository } from "./demo-indexeddb-repository";
import { CapacityExceededError } from "./errors";
import { buildDemoSeed, DEMO_PROFILE_ID } from "./demo-seed";
import { orderSlots } from "./demo-capacity";
import { consumedSlots } from "@/domain/capacity";

const NOW = new Date("2026-11-19T12:00:00-03:00");
let sequence = 0;
const makeRepo = (): DemoIndexedDBRepository =>
  new DemoIndexedDBRepository({ dbName: `doce-demo-test-${sequence++}`, now: NOW });

describe("DemoIndexedDBRepository — seed", () => {
  it("semeia perfil, catálogo, pedidos, pagamentos e exceções da Doces da Lu", async () => {
    const seed = buildDemoSeed(NOW);
    const repo = makeRepo();

    const profile = await repo.profiles.getById(DEMO_PROFILE_ID);
    expect(profile?.businessName).toBe("Doces da Lu");
    expect(profile?.slug).toBe("doces-da-lu");
    expect(profile?.themeStyle).toBe("caseira");

    const catalog = await repo.catalog.listByProfile(DEMO_PROFILE_ID);
    expect(catalog).toHaveLength(seed.catalog.length);
    expect(catalog.every((item) => item.photoUrl?.startsWith("/images/demo-fotografias/"))).toBe(true);

    const orders = await repo.orders.listByProfile(DEMO_PROFILE_ID);
    expect(orders).toHaveLength(seed.orders.length);
    expect(orders.filter((order) => order.status === "entregue")).toHaveLength(1);
    expect(orders.filter((order) => order.status === "orcamento")).toHaveLength(1);

    const pending = await repo.submissions.listByProfile(DEMO_PROFILE_ID, { status: "pendente" });
    expect(pending).toHaveLength(1);
    expect(pending[0].payload.customerName).toBe("Camila Prado");
    expect(pending[0].payload.consentVersion).toBe("2026-11");

    const overrides = await repo.dateOverrides.listByProfile(DEMO_PROFILE_ID);
    expect(overrides).toHaveLength(seed.dateOverrides.length);
    expect(overrides.some((o) => o.targetDate === seed.handles.fullDate && o.maxSlots === 8)).toBe(true);
    expect(overrides.some((o) => o.targetDate === seed.handles.closedDate && o.isClosed)).toBe(true);
  });

  it("tem pedido pago conferido, pedido parcial e um dia cheio", async () => {
    const seed = buildDemoSeed(NOW);
    const repo = makeRepo();
    const orders = await repo.orders.listByProfile(DEMO_PROFILE_ID);

    const paid = await repo.orders.getById(seed.handles.paidOrderId);
    const paidPayments = await repo.payments.listByOrder(seed.handles.paidOrderId);
    expect(paid?.status).toBe("pronto");
    expect(paidPayments.reduce((acc, p) => acc + p.amountCents, 0)).toBe(paid?.totalCents);

    const partial = await repo.orders.getById(seed.handles.partialOrderId);
    const partialPayments = await repo.payments.listByOrder(seed.handles.partialOrderId);
    const conferred = partialPayments.filter((p) => p.status === "conferido");
    const remaining = (partial?.totalCents ?? 0) - conferred.reduce((acc, p) => acc + p.amountCents, 0);
    expect(remaining).toBe(14000);

    const fullDay = orders.filter(
      (order) =>
        order.scheduledDate === seed.handles.fullDate &&
        (order.status === "confirmado" || order.status === "em_producao"),
    );
    expect(consumedSlots(fullDay.map((order) => ({ slots: orderSlots(order.items) })))).toBe(8);
  });
});

describe("DemoIndexedDBRepository — capacidade", () => {
  it("lança CapacityExceededError ao confirmar em dia cheio sem justificativa válida", async () => {
    const seed = buildDemoSeed(NOW);
    const repo = makeRepo();

    await expect(repo.confirmOrder(seed.handles.awaitingOrderId)).rejects.toBeInstanceOf(
      CapacityExceededError,
    );
    await expect(
      repo.confirmOrder(seed.handles.awaitingOrderId, { overrideReason: "ok" }),
    ).rejects.toBeInstanceOf(CapacityExceededError);
    await expect(
      repo.orders.update(seed.handles.awaitingOrderId, { status: "confirmado" }),
    ).rejects.toBeInstanceOf(CapacityExceededError);

    const confirmed = await repo.confirmOrder(seed.handles.awaitingOrderId, {
      overrideReason: "Encaixe combinado com a cliente na sexta",
    });
    expect(confirmed?.status).toBe("confirmado");
    expect(confirmed?.capacityOverrideReason).toContain("Encaixe");

    // Já confirmado: idempotente, não revalida.
    await expect(repo.confirmOrder(seed.handles.awaitingOrderId)).resolves.toMatchObject({
      status: "confirmado",
    });
  });

  it("trata dia fechado como zero vagas, liberável apenas com justificativa", async () => {
    const seed = buildDemoSeed(NOW);
    const repo = makeRepo();
    const order = await repo.orders.create({
      profileId: DEMO_PROFILE_ID,
      customerName: "Visitante",
      customerWhatsapp: "(11) 90000-0001",
      items: [
        {
          catalogItemId: "cat-cupcakes",
          name: "Cupcakes decorados (6 un.)",
          quantity: 1,
          unitPriceCents: 5000,
          slotsRequired: 1,
        },
      ],
      deliveryType: "retirada",
      scheduledDate: seed.handles.closedDate,
      scheduledTime: "10:00",
      totalCents: 5000,
    });

    await expect(repo.confirmOrder(order.id)).rejects.toBeInstanceOf(CapacityExceededError);

    const confirmed = await repo.confirmOrder(order.id, {
      overrideReason: "Encomenda de última hora combinada por telefone",
    });
    expect(confirmed?.status).toBe("confirmado");
  });

  it("aceita solicitação no dia livre e bloqueia no dia cheio", async () => {
    const seed = buildDemoSeed(NOW);
    const repo = makeRepo();

    const accepted = await repo.acceptPublicSubmission(seed.handles.pendingSubmissionId);
    expect(accepted?.submission.status).toBe("aceito");
    expect(accepted?.order.status).toBe("confirmado");
    expect(accepted?.order.totalCents).toBe(14000);
    expect(accepted?.order.publicCode).toBe("DA-0111");
    expect(accepted?.order.items.map((item) => item.name)).toContain("Bolo de pote");
    expect(await repo.submissions.listByProfile(DEMO_PROFILE_ID, { status: "aceito" })).toHaveLength(1);

    const crowded = await repo.submissions.create({
      profileId: DEMO_PROFILE_ID,
      payload: {
        customerName: "Teste Capacidade",
        customerWhatsapp: "(11) 90000-0000",
        items: [{ catalogItemId: "cat-bolo-de-pote", quantity: 1 }],
        deliveryType: "retirada",
        scheduledDate: seed.handles.fullDate,
        scheduledTime: "12:00",
      },
    });

    await expect(repo.acceptPublicSubmission(crowded.id)).rejects.toBeInstanceOf(CapacityExceededError);

    const withOverride = await repo.acceptPublicSubmission(crowded.id, {
      overrideReason: "Cliente recorrente — autorizado pela Lu",
    });
    expect(withOverride?.order.capacityOverrideReason).toContain("autorizado");
  });
});

describe("DemoIndexedDBRepository — acompanhamento público", () => {
  it("expõe apenas status, itens, datas e financeiro conferido (LGPD)", async () => {
    const seed = buildDemoSeed(NOW);
    const repo = makeRepo();

    const view = await repo.getPublicOrderStatus(seed.handles.partialPublicCode.toLowerCase());
    expect(view?.status).toBe("confirmado");
    expect(view?.financials).toEqual({ totalCents: 24000, paidCents: 10000, remainingCents: 14000 });
    expect(view?.items).toHaveLength(2);
    expect(view?.items.every((item) => item.unitPriceCents > 0)).toBe(true);
    expect(view).not.toHaveProperty("customerName");
    expect(view).not.toHaveProperty("customerWhatsapp");
    expect(view).not.toHaveProperty("deliveryAddress");
    expect(view).not.toHaveProperty("notes");
    expect(JSON.stringify(view)).not.toContain("Juliana");

    expect(await repo.getPublicOrderStatus("DA-0000")).toBeNull();
  });
});

describe("DemoIndexedDBRepository — resetDemoData", () => {
  it("restaura o seed mesmo depois de exclusões", async () => {
    const seed = buildDemoSeed(NOW);
    const repo = makeRepo();

    await repo.orders.delete(seed.handles.paidOrderId);
    await repo.catalog.delete("cat-cupcakes");
    await repo.submissions.updateStatus(seed.handles.pendingSubmissionId, "recusado");

    await repo.resetDemoData();

    const orders = await repo.orders.listByProfile(DEMO_PROFILE_ID);
    expect(orders).toHaveLength(seed.orders.length);
    expect(await repo.orders.getById(seed.handles.paidOrderId)).not.toBeNull();
    expect(await repo.catalog.listByProfile(DEMO_PROFILE_ID)).toHaveLength(seed.catalog.length);
    expect(await repo.submissions.listByProfile(DEMO_PROFILE_ID, { status: "pendente" })).toHaveLength(1);

    // Idempotente: resetar duas vezes não duplica nada.
    await repo.resetDemoData();
    expect(await repo.orders.listByProfile(DEMO_PROFILE_ID)).toHaveLength(seed.orders.length);
  });
});
