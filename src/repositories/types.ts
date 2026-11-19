// src/lib/repositories/types.ts
// Contratos do Repository Pattern (Doce Agenda v2) — implementados por
// SupabaseRepository (autenticado) e DemoIndexedDBRepository (modo /demo).
// Convenções: leituras devolvem `null` se a entidade não existe; escritas devolvem
// a entidade persistida; `delete` devolve `false` quando o alvo não existe.
// Datas/horas em America/Sao_Paulo; dinheiro sempre inteiro em centavos.

import type { Cents } from "@/domain/currency";
import type { OrderStatus } from "@/domain/orderStatus";
import type { PaymentStatus } from "@/domain/payments";

// Reexporta os tipos de domínio que aparecem nas assinaturas, para que os
// consumidores importem tudo de `@/repositories/types`.
export type { OrderStatus } from "@/domain/orderStatus";
export type { PaymentStatus } from "@/domain/payments";

/** Data no formato `yyyy-mm-dd`. */
export type IsoDate = string;
/** Hora no formato `HH:mm`. */
export type IsoTime = string;
/** Timestamp ISO 8601 com timezone. */
export type IsoTimestamp = string;

export const THEME_STYLES = ["atelie", "doceria", "caseira", "moderna"] as const;
export type ThemeStyle = (typeof THEME_STYLES)[number];
export const DELIVERY_TYPES = ["retirada", "entrega"] as const;
export type DeliveryType = (typeof DELIVERY_TYPES)[number];
export const PUBLIC_SUBMISSION_STATUSES = ["pendente", "aceito", "recusado"] as const;
export type PublicSubmissionStatus = (typeof PUBLIC_SUBMISSION_STATUSES)[number];

/** Semana de segunda a domingo (mesma ordem de src/domain/timezone). */
export const WEEKDAYS = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"] as const;
export type Weekday = (typeof WEEKDAYS)[number];
/** Vagas (1..10) por dia; chaves ausentes caem no padrão da confeiteira. */
export type WeeklyCapacity = Partial<Record<Weekday, number>>;

// ----------------------------------------------------------------- Entidades

export interface Profile {
  id: string;
  userId: string;
  businessName: string | null;
  slug: string | null;
  themeStyle: ThemeStyle | null;
  coverUrl: string | null;
  logoUrl: string | null;
  pixKey: string | null;
  defaultWeeklyCapacity: WeeklyCapacity;
  createdAt: IsoTimestamp;
}

export interface CatalogItem {
  id: string;
  profileId: string;
  name: string;
  description: string | null;
  priceCents: Cents;
  slotsRequired: number; // 1..10
  photoUrl: string | null;
  active: boolean;
}

/** Item congelado no pedido: nome e preço do momento da encomenda. */
export interface OrderItem {
  catalogItemId: string;
  name: string;
  quantity: number;
  unitPriceCents: Cents;
  slotsRequired: number;
  notes?: string | null;
}

export interface Order {
  id: string;
  profileId: string;
  publicCode: string | null;
  customerName: string | null;
  customerWhatsapp: string | null;
  items: readonly OrderItem[];
  deliveryType: DeliveryType | null;
  deliveryAddress: string | null;
  scheduledDate: IsoDate | null;
  scheduledTime: IsoTime | null;
  status: OrderStatus;
  totalCents: Cents;
  notes: string | null;
  capacityOverrideReason: string | null;
  createdAt: IsoTimestamp;
}

export interface OrderPayment {
  id: string;
  orderId: string;
  amountCents: Cents;
  status: PaymentStatus;
  paidAt: IsoTimestamp | null;
}

export interface DateOverride {
  id: string;
  profileId: string;
  targetDate: IsoDate;
  maxSlots: number | null; // null = mantém o limite padrão da semana
  isClosed: boolean;
  reason: string | null;
}

/** Dados brutos enviados pelo formulário público, antes de virar pedido. */
export interface SubmissionPayload {
  customerName?: string;
  customerWhatsapp?: string;
  items?: readonly { catalogItemId: string; quantity: number }[];
  deliveryType?: DeliveryType;
  deliveryAddress?: string | null;
  scheduledDate?: IsoDate;
  scheduledTime?: IsoTime;
  notes?: string | null;
  consentVersion?: string;
}

export interface PublicSubmission {
  id: string;
  profileId: string;
  payload: SubmissionPayload;
  status: PublicSubmissionStatus;
  createdAt: IsoTimestamp;
  anonymizeAfter: IsoTimestamp | null;
}

// ------------------------------------------------------------------ Entradas

export interface NewProfile {
  userId: string;
  businessName?: string | null;
  slug?: string | null;
  themeStyle?: ThemeStyle | null;
  coverUrl?: string | null;
  logoUrl?: string | null;
  pixKey?: string | null;
  defaultWeeklyCapacity?: WeeklyCapacity;
}
export type ProfilePatch = Partial<Omit<NewProfile, "userId">>;

export interface NewCatalogItem {
  profileId: string;
  name: string;
  description?: string | null;
  priceCents?: Cents;
  slotsRequired?: number; // padrão 1
  photoUrl?: string | null;
  active?: boolean; // padrão true
}
export type CatalogItemPatch = Partial<Omit<NewCatalogItem, "profileId">>;

export interface NewOrder {
  profileId: string;
  publicCode?: string | null;
  customerName: string;
  customerWhatsapp: string;
  items: readonly OrderItem[];
  deliveryType: DeliveryType;
  deliveryAddress?: string | null;
  scheduledDate: IsoDate;
  scheduledTime: IsoTime;
  status?: OrderStatus; // padrão "solicitacao"
  totalCents: Cents;
  notes?: string | null;
  capacityOverrideReason?: string | null;
}
export type OrderPatch = Partial<Omit<NewOrder, "profileId">>;

export interface NewPayment {
  orderId: string;
  amountCents: Cents;
  status?: PaymentStatus; // padrão "informado"
  paidAt?: IsoTimestamp;
}

export interface NewDateOverride {
  maxSlots: number | null;
  isClosed: boolean;
  reason?: string | null;
}

export interface NewPublicSubmission {
  profileId: string;
  payload: SubmissionPayload;
  status?: PublicSubmissionStatus; // padrão "pendente"
  anonymizeAfter?: IsoTimestamp | null;
}

export interface OrderFilter {
  status?: OrderStatus | readonly OrderStatus[];
  fromDate?: IsoDate;
  toDate?: IsoDate;
}
export interface CatalogFilter { includeInactive?: boolean }
export interface DateOverrideFilter { fromDate?: IsoDate; toDate?: IsoDate }
export interface SubmissionFilter { status?: PublicSubmissionStatus; limit?: number }

// --------------------------------------------------------------- Repositórios

export interface IProfileRepository {
  getById(id: string): Promise<Profile | null>;
  getBySlug(slug: string): Promise<Profile | null>;
  create(data: NewProfile): Promise<Profile>;
  update(id: string, patch: ProfilePatch): Promise<Profile | null>;
}

export interface IOrderRepository {
  listByProfile(profileId: string, filter?: OrderFilter): Promise<Order[]>;
  getById(id: string): Promise<Order | null>;
  create(data: NewOrder): Promise<Order>;
  update(id: string, patch: OrderPatch): Promise<Order | null>;
  delete(id: string): Promise<boolean>;
}

export interface IPaymentRepository {
  listByOrder(orderId: string): Promise<OrderPayment[]>;
  create(data: NewPayment): Promise<OrderPayment>;
  updateStatus(id: string, status: PaymentStatus, paidAt?: IsoTimestamp): Promise<OrderPayment | null>;
}

export interface IDateOverrideRepository {
  listByProfile(profileId: string, filter?: DateOverrideFilter): Promise<DateOverride[]>;
  /** Idempotente por (profileId, targetDate): cria ou substitui a exceção do dia. */
  upsert(profileId: string, targetDate: IsoDate, data: NewDateOverride): Promise<DateOverride>;
  delete(id: string): Promise<boolean>;
}

export interface ICatalogRepository {
  listByProfile(profileId: string, filter?: CatalogFilter): Promise<CatalogItem[]>;
  create(data: NewCatalogItem): Promise<CatalogItem>;
  update(id: string, patch: CatalogItemPatch): Promise<CatalogItem | null>;
  delete(id: string): Promise<boolean>;
}

export interface IPublicSubmissionRepository {
  /** Chamado pela vitrine pública sem sessão autenticada (RLS: insert anon). */
  create(data: NewPublicSubmission): Promise<PublicSubmission>;
  listByProfile(profileId: string, filter?: SubmissionFilter): Promise<PublicSubmission[]>;
  updateStatus(id: string, status: PublicSubmissionStatus): Promise<PublicSubmission | null>;
}

/** Contrato agregado: uma única porta de entrada para a camada de dados. */
export interface IRepository {
  readonly profiles: IProfileRepository;
  readonly orders: IOrderRepository;
  readonly payments: IPaymentRepository;
  readonly dateOverrides: IDateOverrideRepository;
  readonly catalog: ICatalogRepository;
  readonly submissions: IPublicSubmissionRepository;
}

// ------------------------------------------------- Porta estendida (app v2)

/**
 * Motivo que autoriza ultrapassar o limite de vagas do dia.
 * Precisa de 4 a 300 caracteres depois de `trim` (ver domain/capacity).
 */
export interface CapacityOverrideInput {
  overrideReason?: string | null;
}

/** Alias usado pelos comandos do modo demo (mesma semântica). */
export type CapacityOverrideOptions = CapacityOverrideInput;

/** Resultado de aceitar uma submissão pública: ela vira um pedido confirmado. */
export interface AcceptedSubmission {
  submission: PublicSubmission;
  order: Order;
}

/** Item exposto na consulta pública — sem notas internas nem dados pessoais. */
export interface PublicOrderItem {
  name: string;
  quantity: number;
  unitPriceCents: Cents;
}

/** Resumo financeiro conferido: só pagamentos com status "conferido" contam. */
export interface PublicOrderFinancials {
  totalCents: Cents;
  paidCents: Cents;
  remainingCents: Cents;
}

/**
 * Projeção LGPD-safe consultada pelo cliente com o código público.
 * Nunca inclui endereço, telefone, notas do pedido ou itens de nota.
 */
export interface PublicOrderStatus {
  publicCode: string;
  status: OrderStatus;
  items: readonly PublicOrderItem[];
  scheduledDate: IsoDate | null;
  scheduledTime: IsoTime | null;
  financials: PublicOrderFinancials;
}

export interface IConfirmableOrderRepository extends IOrderRepository {
  /**
   * Move o pedido para "confirmado" verificando a capacidade do dia.
   * Sem vagas e sem `overrideReason` válido lança `CapacityExceededError`.
   * Devolve `null` quando o pedido não existe (ou não pertence à usuária).
   */
  confirmOrder(id: string, options?: CapacityOverrideInput): Promise<Order | null>;
}

export interface IAcceptingSubmissionRepository extends IPublicSubmissionRepository {
  /**
   * Aceita uma submissão pendente: confere capacidade, cria o pedido
   * confirmado e marca a submissão como "aceito". `null` quando a submissão
   * não existe ou já foi decidida.
   */
  acceptPublicSubmission(
    id: string,
    options?: CapacityOverrideInput,
  ): Promise<AcceptedSubmission | null>;
}

export interface IDoceRepository extends IRepository {
  readonly orders: IConfirmableOrderRepository;
  readonly submissions: IAcceptingSubmissionRepository;
  /** Consulta pública por código — projeção mínima (LGPD). */
  getPublicOrderStatus(publicCode: string): Promise<PublicOrderStatus | null>;
}

// ------------------------------------------------- Manutenção do modo demo

export interface IDemoMaintenanceRepository {
  /** Limpa todos os stores do IndexedDB e re-semeia os dados fictícios. */
  resetDemoData(): Promise<void>;
}
