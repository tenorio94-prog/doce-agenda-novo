// src/repositories/demo-capacity.ts
// Ponte entre o motor de vagas (src/domain/capacity) e os dados do modo demo.

import {
  clampSlots,
  consumedSlots,
  dayLimit,
  hasCapacity,
  validateOverrideReason,
  type DayCapacity,
} from "@/domain/capacity";
import { CapacityExceededError } from "./errors";
import { DEFAULT_DAY_SLOTS, weekdayOf } from "./mappers/core";
import { orderSlots } from "./mappers/order";
import type { DateOverride, IsoDate, Profile } from "./types";

export { orderSlots };

/** Capacidade efetiva do dia: padrão da semana + exceção da data, se houver. */
export const dayCapacityFor = (
  profile: Pick<Profile, "defaultWeeklyCapacity">,
  overrides: readonly DateOverride[],
  isoDate: IsoDate,
): DayCapacity => {
  const weekly = clampSlots(profile.defaultWeeklyCapacity[weekdayOf(isoDate)] ?? DEFAULT_DAY_SLOTS);
  const override = overrides.find((o) => o.targetDate === isoDate);
  if (!override) return { defaultSlots: weekly };
  return {
    defaultSlots: weekly,
    overrides: {
      [isoDate]: {
        maxSlots: override.maxSlots ?? weekly,
        isClosed: override.isClosed,
        reason: override.reason ?? undefined,
      },
    },
  };
};

export interface CapacityRequest {
  capacity: DayCapacity;
  scheduledDate: IsoDate;
  /** Vagas já consumidas por pedidos do mesmo dia. */
  takenSlots: readonly number[];
  requestedSlots: number;
  overrideReason?: string | null;
}

/**
 * Garante que o dia comporta mais um pedido.
 * Sem vagas e sem justificativa válida (4..300 chars) → CapacityExceededError,
 * no mesmo formato usado pelo repositório Supabase (capacity-guard.ts).
 */
export const requireCapacity = ({
  capacity,
  scheduledDate,
  takenSlots,
  requestedSlots,
  overrideReason,
}: CapacityRequest): void => {
  const taken = takenSlots.map((slots) => ({ slots }));
  if (hasCapacity(capacity, scheduledDate, taken, requestedSlots)) return;

  const reason = typeof overrideReason === "string" ? overrideReason.trim() : "";
  if (validateOverrideReason(reason)) return;

  throw new CapacityExceededError({
    date: scheduledDate,
    limit: dayLimit(capacity, scheduledDate),
    consumedSlots: consumedSlots(taken),
    requestedSlots: clampSlots(requestedSlots),
    overrideReason: reason.length > 0 ? reason : null,
    overrideReasonInvalid: reason.length > 0,
  });
};
