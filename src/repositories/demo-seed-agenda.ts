// src/repositories/demo-seed-agenda.ts
// Agenda fictícia da Doces da Lu: pedidos, pagamentos, exceções e 1 solicitação.

import {
  DAY_MS,
  DEMO_PROFILE_ID,
  daysAgo,
  itemFor,
  makeOrder,
} from "./demo-seed-data";
import type { DateOverride, IsoDate, Order, OrderPayment, PublicSubmission } from "./types";

export interface DemoAgendaDates {
  paidDate: IsoDate;
  freeDate: IsoDate;
  partialDate: IsoDate;
  closedDate: IsoDate;
  fullDate: IsoDate;
  pastDate: IsoDate;
}

export interface DemoAgenda {
  orders: Order[];
  payments: OrderPayment[];
  dateOverrides: DateOverride[];
  submissions: PublicSubmission[];
}

const payment = (
  id: string,
  orderId: string,
  amountCents: number,
  status: OrderPayment["status"],
  paidAt: string,
): OrderPayment => ({ id, orderId, amountCents, status, paidAt });

export const buildDemoAgenda = (now: Date, dates: DemoAgendaDates): DemoAgenda => {
  const orders: Order[] = [
    // Pago e conferido — pronto para retirada.
    makeOrder({
      id: "ord-marina-pago", code: "DA-0101", name: "Marina Alves", whatsapp: "(11) 98888-1010",
      items: [itemFor("bolo-chocolate-morango")],
      date: dates.paidDate, time: "15:00", status: "pronto",
      notes: "Escrever “Parabéns, Marina!” na embalagem.", createdAt: daysAgo(now, 9),
    }),
    // Pagamento parcial — falta R$ 140,00 (conferido: R$ 100,00).
    makeOrder({
      id: "ord-juliana-parcial", code: "DA-0102", name: "Juliana Prado", whatsapp: "(11) 97777-2020",
      items: [itemFor("torta-de-limao"), itemFor("caixa-docinhos")],
      delivery: "entrega", address: "Rua das Acácias, 214 — Jardim Aurora",
      date: dates.partialDate, time: "11:30", status: "confirmado",
      notes: "Entregar na portaria, avisar no WhatsApp.", createdAt: daysAgo(now, 6),
    }),
    // Sábado lotado: 4 + 4 = 8 vagas (limite do dia = 8).
    makeOrder({
      id: "ord-ana-kit", code: "DA-0103", name: "Ana Beatriz", whatsapp: "(11) 96666-3030",
      items: [itemFor("kit-festa")],
      delivery: "entrega", address: "Alameda dos Ipês, 87 — Vila Clara",
      date: dates.fullDate, time: "09:30", status: "em_producao",
      notes: "Tema safari, tons terrosos.", createdAt: daysAgo(now, 12),
    }),
    makeOrder({
      id: "ord-carla-infantil", code: "DA-0104", name: "Carla Menezes", whatsapp: "(11) 95555-4040",
      items: [itemFor("bolo-infantil")],
      date: dates.fullDate, time: "16:00", status: "confirmado",
      notes: "Bolo com o dinossauro favorito do Theo.", createdAt: daysAgo(now, 10),
    }),
    // Aguardando decisão no dia já cheio → confirmação exige override.
    makeOrder({
      id: "ord-pedro-aguardando", code: "DA-0105", name: "Pedro Lima", whatsapp: "(11) 94444-5050",
      items: [itemFor("bolo-de-pote")],
      date: dates.fullDate, time: "10:00", status: "aguardando_confirmacao",
      notes: "Perguntou se dá para escrever o nome.", createdAt: daysAgo(now, 1),
    }),
    // Histórico entregue.
    makeOrder({
      id: "ord-helena-entregue", code: "DA-0095", name: "Helena Castro", whatsapp: "(11) 93333-6060",
      items: [itemFor("caixa-docinhos", 2)],
      delivery: "entrega", address: "Rua Sete de Setembro, 45 — Centro",
      date: dates.pastDate, time: "14:00", status: "entregue", createdAt: daysAgo(now, 20),
    }),
    // Orçamento em aberto (não consome vaga).
    makeOrder({
      id: "ord-bruno-orcamento", code: "DA-0106", name: "Bruno Salles", whatsapp: "(11) 92222-7070",
      items: [itemFor("bolo-aniversario-frutas"), itemFor("brownies")],
      delivery: "entrega", address: "Travessa do Sol, 12 — Bela Vista",
      date: dates.freeDate, time: "18:00", status: "orcamento",
      notes: "Pediu orçamento para 40 pessoas.", createdAt: daysAgo(now, 2),
    }),
  ];

  const payments: OrderPayment[] = [
    payment("pay-marina", "ord-marina-pago", 14500, "conferido", daysAgo(now, 8)),
    payment("pay-juliana-sinal", "ord-juliana-parcial", 10000, "conferido", daysAgo(now, 5)),
    payment("pay-ana-sinal", "ord-ana-kit", 15000, "conferido", daysAgo(now, 11)),
    payment("pay-ana-restante", "ord-ana-kit", 5000, "informado", daysAgo(now, 2)),
    payment("pay-carla", "ord-carla-infantil", 26000, "conferido", daysAgo(now, 9)),
    payment("pay-helena", "ord-helena-entregue", 24000, "conferido", daysAgo(now, 19)),
  ];

  const dateOverrides: DateOverride[] = [
    {
      id: "ovr-sabado-cheio", profileId: DEMO_PROFILE_ID, targetDate: dates.fullDate,
      maxSlots: 8, isClosed: false, reason: "Sábado de festas — limite de 8 vagas",
    },
    {
      id: "ovr-folga-lu", profileId: DEMO_PROFILE_ID, targetDate: dates.closedDate,
      maxSlots: null, isClosed: true, reason: "Folga — aniversário da Lu",
    },
  ];

  // Solicitação pendente vinda do link público (/p/doces-da-lu).
  const submissions: PublicSubmission[] = [
    {
      id: "sub-camila-link",
      profileId: DEMO_PROFILE_ID,
      payload: {
        customerName: "Camila Prado",
        customerWhatsapp: "(11) 91111-8080",
        items: [
          { catalogItemId: "cat-bolo-de-pote", quantity: 1 },
          { catalogItemId: "cat-cupcakes", quantity: 1 },
        ],
        deliveryType: "retirada",
        deliveryAddress: null,
        scheduledDate: dates.freeDate,
        scheduledTime: "17:00",
        notes: "Aniversário de 7 anos da minha filha. Consegue sem lactose?",
        consentVersion: "2026-11",
      },
      status: "pendente",
      createdAt: daysAgo(now, 0),
      anonymizeAfter: new Date(now.getTime() + 180 * DAY_MS).toISOString(),
    },
  ];

  return { orders, payments, dateOverrides, submissions };
};
