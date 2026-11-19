// src/repositories/demo-seed-data.ts
// Peças base do seed: constantes, datas relativas, catálogo e fábricas.

import type { CatalogItem, DeliveryType, IsoDate, IsoTime, Order, OrderItem } from "./types";
import type { OrderStatus } from "@/domain/orderStatus";

export const DEMO_PROFILE_ID = "profile-doces-da-lu";
export const DAY_MS = 86_400_000;

export const addDays = (isoDate: IsoDate, days: number): IsoDate => {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};

export const daysAgo = (now: Date, days: number): string =>
  new Date(now.getTime() - days * DAY_MS).toISOString();

export const photo = (slug: string): string =>
  `/images/demo-fotografias/originais/${slug}.png`;

interface SeedCatalog {
  slug: string;
  name: string;
  description: string;
  priceCents: number;
  slots: number;
}

const CATALOG: readonly SeedCatalog[] = [
  { slug: "bolo-chocolate-morango", name: "Bolo de chocolate com morango", description: "Massa de cacau, ganache meio amargo e morangos frescos.", priceCents: 14500, slots: 3 },
  { slug: "bolo-aniversario-frutas", name: "Bolo de aniversário com frutas", description: "Pão de ló leve, creme de baunilha e frutas da estação.", priceCents: 18000, slots: 4 },
  { slug: "bolo-infantil", name: "Bolo infantil decorado", description: "Decoração personalizada com tema escolhido pela criança.", priceCents: 26000, slots: 4 },
  { slug: "bolo-pistache", name: "Bolo de pistache", description: "Pistache puro, praliné crocante e chantilly.", priceCents: 18000, slots: 3 },
  { slug: "bolo-cenoura-chocolate", name: "Bolo de cenoura com chocolate", description: "Receita de família, cobertura generosa de brigadeiro.", priceCents: 16000, slots: 3 },
  { slug: "torta-de-limao", name: "Torta de limão", description: "Base amanteigada, creme cítrico e merengue maçaricado.", priceCents: 12000, slots: 2 },
  { slug: "kit-festa", name: "Kit festa (100 docinhos + bolo)", description: "Kit completo para festa de até 30 convidados.", priceCents: 32000, slots: 4 },
  { slug: "caixa-docinhos", name: "Caixa de docinhos (20 un.)", description: "Brigadeiro, beijinho e casadinho na medida certa.", priceCents: 12000, slots: 1 },
  { slug: "brigadeiros-gourmet", name: "Brigadeiros gourmet (12 un.)", description: "Chocolate belga, flor de sal e confeitos variados.", priceCents: 6000, slots: 1 },
  { slug: "bolo-de-pote", name: "Bolo de pote", description: "Camadas de bolo, recheio cremoso e raspas de chocolate.", priceCents: 9000, slots: 1 },
  { slug: "cupcakes", name: "Cupcakes decorados (6 un.)", description: "Baunilha ou chocolate, com buttercream colorido.", priceCents: 5000, slots: 1 },
  { slug: "brownies", name: "Brownies recheados (9 un.)", description: "Casquinha crocante, interior úmido e doce de leite.", priceCents: 7500, slots: 1 },
  { slug: "pudim-de-leite", name: "Pudim de leite condensado", description: "Textura lisinha, calda de caramelo amadeirado.", priceCents: 8000, slots: 1 },
];

export const seedCatalogItems = (): CatalogItem[] =>
  CATALOG.map((c) => ({
    id: `cat-${c.slug}`,
    profileId: DEMO_PROFILE_ID,
    name: c.name,
    description: c.description,
    priceCents: c.priceCents,
    slotsRequired: c.slots,
    photoUrl: photo(c.slug),
    active: true,
  }));

/** Item congelado no pedido, com nome e preço do catálogo do seed. */
export const itemFor = (slug: string, quantity = 1, notes?: string): OrderItem => {
  const found = CATALOG.find((c) => c.slug === slug);
  if (!found) throw new Error(`Item de seed desconhecido: ${slug}`);
  return {
    catalogItemId: `cat-${found.slug}`,
    name: found.name,
    quantity,
    unitPriceCents: found.priceCents,
    slotsRequired: found.slots,
    notes: notes ?? null,
  };
};

export interface SeedOrder {
  id: string;
  code: string;
  name: string;
  whatsapp: string;
  items: readonly OrderItem[];
  delivery?: DeliveryType;
  address?: string;
  date: IsoDate;
  time: IsoTime;
  status: OrderStatus;
  notes?: string;
  createdAt: string;
}

export const makeOrder = (order: SeedOrder): Order => ({
  id: order.id,
  profileId: DEMO_PROFILE_ID,
  publicCode: order.code,
  customerName: order.name,
  customerWhatsapp: order.whatsapp,
  items: order.items,
  deliveryType: order.delivery ?? "retirada",
  deliveryAddress: order.address ?? null,
  scheduledDate: order.date,
  scheduledTime: order.time,
  status: order.status,
  totalCents: order.items.reduce((acc, item) => acc + item.unitPriceCents * item.quantity, 0),
  notes: order.notes ?? null,
  capacityOverrideReason: null,
  createdAt: order.createdAt,
});
