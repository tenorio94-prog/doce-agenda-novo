// src/domain/capacity.ts
// Motor de vagas por dia. Cada pedido consome slots (1..10). Limite padrão por dia da semana (1..10).
// Datas especiais podem sobrescrever limite ou fechar o dia.

export interface DayCapacity {
  defaultSlots: number; // 1..10
  overrides?: Record<string, DayOverride>; // key: ISO date
}

export interface DayOverride {
  maxSlots: number;
  isClosed: boolean;
  reason?: string;
}

export interface OrderSlot {
  slots: number; // 1..10
}

export const clampSlots = (n: number): number => {
  if (!Number.isFinite(n)) return 1;
  return Math.min(10, Math.max(1, Math.round(n)));
};

export const dayLimit = (cap: DayCapacity, isoDate: string): number => {
  const ov = cap.overrides?.[isoDate];
  if (ov) {
    if (ov.isClosed) return 0;
    return Math.max(0, ov.maxSlots);
  }
  return cap.defaultSlots;
};

export const isDayClosed = (cap: DayCapacity, isoDate: string): boolean => {
  const ov = cap.overrides?.[isoDate];
  if (ov?.isClosed) return true;
  const limit = dayLimit(cap, isoDate);
  return limit === 0;
};

export const consumedSlots = (orders: OrderSlot[]): number =>
  orders.reduce((acc, o) => acc + clampSlots(o.slots), 0);

export const hasCapacity = (cap: DayCapacity, isoDate: string, orders: OrderSlot[], newSlots: number): boolean => {
  const limit = dayLimit(cap, isoDate);
  if (limit === 0) return false;
  return consumedSlots(orders) + clampSlots(newSlots) <= limit;
};

export const capacityStatus = (
  cap: DayCapacity,
  isoDate: string,
  orders: OrderSlot[],
): "livre" | "cheio" | "fechado" => {
  if (isDayClosed(cap, isoDate)) return "fechado";
  const limit = dayLimit(cap, isoDate);
  const consumed = consumedSlots(orders);
  if (consumed >= limit) return "cheio";
  return "livre";
};

export const validateOverrideReason = (reason: string): boolean => {
  const len = reason.trim().length;
  return len >= 4 && len <= 300;
};
