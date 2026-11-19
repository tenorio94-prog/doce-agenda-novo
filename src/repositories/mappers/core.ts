// src/repositories/mappers/core.ts
// Primitivas de conversão entre o Postgres (snake_case, tipos frouxos) e o
// domínio (camelCase, tipos estritos). Tudo que entra do banco passa por aqui.

import { clampSlots } from "@/domain/capacity";

import { WEEKDAYS } from "../types";
import type {
  IsoDate,
  IsoTime,
  IsoTimestamp,
  SubmissionPayload,
  Weekday,
  WeeklyCapacity,
} from "../types";

/** Vagas usadas quando a semana do perfil não define aquele dia da semana. */
export const DEFAULT_DAY_SLOTS = 1;

export const asObject = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

export const asString = (value: unknown): string => (typeof value === "string" ? value : "");

export const asNullableString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  return value.trim().length > 0 ? value : null;
};

export const asNumber = (value: unknown, fallback = 0): number => {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
};

export const asInt = (value: unknown, fallback = 0): number => Math.round(asNumber(value, fallback));

export const asBoolean = (value: unknown, fallback = false): boolean =>
  typeof value === "boolean" ? value : fallback;

export const asTimestamp = (value: unknown): IsoTimestamp => asString(value);

/** `date` do Postgres: `yyyy-mm-dd`. */
export const asIsoDate = (value: unknown): IsoDate | null => {
  const raw = asString(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
};

/** `time` do Postgres vem como `HH:mm:ss`; o contrato expõe `HH:mm`. */
export const asIsoTime = (value: unknown): IsoTime | null => {
  const raw = asString(value);
  return /^\d{2}:\d{2}/.test(raw) ? raw.slice(0, 5) : null;
};

/** jsonb `default_weekly_capacity` → `WeeklyCapacity` (só dias válidos, 1..10). */
export const parseWeeklyCapacity = (value: unknown): WeeklyCapacity => {
  const raw = asObject(value);
  const capacity: WeeklyCapacity = {};
  for (const day of WEEKDAYS) {
    if (!(day in raw)) continue;
    const slots = asNumber(raw[day], Number.NaN);
    if (Number.isFinite(slots)) capacity[day] = clampSlots(slots);
  }
  return capacity;
};

/** Dia da semana (seg..dom) de uma data ISO, em America/Sao_Paulo. */
export const weekdayOf = (isoDate: IsoDate): Weekday => {
  const index = new Date(`${isoDate}T12:00:00Z`).getUTCDay(); // 0 = domingo
  return index === 0 ? "dom" : WEEKDAYS[index - 1];
};

/** jsonb `payload` da submissão pública → `SubmissionPayload` tolerante. */
export const parseSubmissionPayload = (value: unknown): SubmissionPayload => {
  const raw = asObject(value);
  const payload: SubmissionPayload = {};

  const name = asNullableString(raw.customerName);
  if (name !== null) payload.customerName = name;
  const whatsapp = asNullableString(raw.customerWhatsapp);
  if (whatsapp !== null) payload.customerWhatsapp = whatsapp;
  const address = asNullableString(raw.deliveryAddress);
  if (address !== null) payload.deliveryAddress = address;
  const notes = asNullableString(raw.notes);
  if (notes !== null) payload.notes = notes;
  const consentVersion = asNullableString(raw.consentVersion);
  if (consentVersion !== null) payload.consentVersion = consentVersion;

  if (raw.deliveryType === "retirada" || raw.deliveryType === "entrega") {
    payload.deliveryType = raw.deliveryType;
  }
  const scheduledDate = asIsoDate(raw.scheduledDate);
  if (scheduledDate !== null) payload.scheduledDate = scheduledDate;
  const scheduledTime = asIsoTime(raw.scheduledTime);
  if (scheduledTime !== null) payload.scheduledTime = scheduledTime;

  const items = Array.isArray(raw.items)
    ? raw.items
        .map(asObject)
        .map((item) => ({
          catalogItemId: asString(item.catalogItemId),
          quantity: Math.max(1, asInt(item.quantity, 1)),
        }))
        .filter((item) => item.catalogItemId.length > 0)
    : [];
  if (items.length > 0) payload.items = items;

  return payload;
};
