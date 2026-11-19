"use client";

// src/hooks/useOrders.ts
// Criação de pedido em `/app/novo`. Antes de gravar, aplica o motor de vagas de
// `@/domain/capacity` (o `create` do repositório não valida capacidade).

import { useCallback, useState } from "react";

import {
  clampSlots,
  consumedSlots,
  dayLimit,
  hasCapacity,
  validateOverrideReason,
} from "@/domain/capacity";
import type { DayCapacity } from "@/domain/capacity";
import { CAPACITY_CONSUMING, consumesCapacity } from "@/domain/orderStatus";
import { useRepository } from "@/repositories";
import { CapacityExceededError, RepositoryError } from "@/repositories/errors";
import type {
  IDoceRepository,
  IsoDate,
  NewOrder,
  Order,
  OrderItem,
  Profile,
  Weekday,
} from "@/repositories/types";

import { isIsoDate, resolveProfile, toError } from "./agenda-utils";

/** Vagas usadas quando a semana do perfil não define o dia. */
const DEFAULT_DAY_SLOTS = 1;
const WEEKDAY_BY_INDEX: readonly Weekday[] = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];

const weekdayOf = (date: IsoDate): Weekday =>
  WEEKDAY_BY_INDEX[new Date(`${date}T12:00:00Z`).getUTCDay()] ?? "seg";

/** Mesma regra de `orderSlots`: itens × quantidade, limitado a 1..10. */
const slotsForItems = (items: readonly OrderItem[]): number =>
  clampSlots(
    items.reduce(
      (total, item) => total + clampSlots(item.slotsRequired) * Math.max(1, item.quantity),
      0,
    ),
  );

/** Dados do formulário; `profileId` é resolvido pelo hook. */
export type CreateOrderInput = Omit<NewOrder, "profileId">;

export interface UseOrdersOptions {
  /** Id do perfil autenticado; omitido, usa o perfil único do modo demo. */
  profileId?: string;
}

export interface UseOrdersResult {
  submitting: boolean;
  error: Error | null;
  /** Dia lotado: a UI deve pedir o motivo e reenviar com `capacityOverrideReason`. */
  capacityError: CapacityExceededError | null;
  createOrder: (input: CreateOrderInput) => Promise<Order>;
  clearCapacityError: () => void;
}

/**
 * Confere as vagas do dia e devolve o motivo de exceção a persistir.
 *
 * @throws {CapacityExceededError} quando o dia está cheio/fechado e o motivo
 * enviado está ausente ou fora de 4..300 caracteres.
 */
async function overrideReasonFor(
  repository: IDoceRepository,
  profile: Profile,
  input: CreateOrderInput,
): Promise<string | null> {
  const date = input.scheduledDate;
  const requestedSlots = slotsForItems(input.items);

  const [overrides, dayOrders] = await Promise.all([
    repository.dateOverrides.listByProfile(profile.id, { fromDate: date, toDate: date }),
    repository.orders.listByProfile(profile.id, {
      fromDate: date,
      toDate: date,
      status: [...CAPACITY_CONSUMING],
    }),
  ]);

  const dayOverride = overrides[0];
  const defaultSlots = clampSlots(
    profile.defaultWeeklyCapacity[weekdayOf(date)] ?? DEFAULT_DAY_SLOTS,
  );

  const capacity: DayCapacity = {
    defaultSlots,
    overrides: dayOverride
      ? {
          [date]: {
            maxSlots: dayOverride.maxSlots ?? defaultSlots,
            isClosed: dayOverride.isClosed,
          },
        }
      : undefined,
  };

  const occupying = dayOrders.map((order) => ({ slots: slotsForItems(order.items) }));
  if (hasCapacity(capacity, date, occupying, requestedSlots)) return null;

  const reason = typeof input.capacityOverrideReason === "string"
    ? input.capacityOverrideReason.trim()
    : "";
  if (validateOverrideReason(reason)) return reason;

  throw new CapacityExceededError({
    date,
    limit: dayLimit(capacity, date),
    consumedSlots: consumedSlots(occupying),
    requestedSlots,
    overrideReason: reason.length > 0 ? reason : null,
    overrideReasonInvalid: reason.length > 0,
  });
}

export function useOrders(options: UseOrdersOptions = {}): UseOrdersResult {
  const { profileId } = options;
  const repository = useRepository();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [capacityError, setCapacityError] = useState<CapacityExceededError | null>(null);

  const clearCapacityError = useCallback(() => setCapacityError(null), []);

  const createOrder = useCallback(
    async (input: CreateOrderInput): Promise<Order> => {
      setSubmitting(true);
      setError(null);
      setCapacityError(null);

      try {
        if (input.items.length === 0) {
          throw new RepositoryError(
            "Inclua pelo menos um doce no pedido.",
            "ORDER_EMPTY_ITEMS",
          );
        }
        if (!isIsoDate(input.scheduledDate)) {
          throw new RepositoryError(
            "Informe uma data válida (yyyy-mm-dd).",
            "ORDER_INVALID_DATE",
          );
        }

        const profile = await resolveProfile(repository, profileId);
        const status = input.status ?? "solicitacao";
        const overrideReason = consumesCapacity(status)
          ? await overrideReasonFor(repository, profile, input)
          : null;

        return await repository.orders.create({
          ...input,
          profileId: profile.id,
          status,
          capacityOverrideReason: overrideReason,
        });
      } catch (cause) {
        if (cause instanceof CapacityExceededError) setCapacityError(cause);
        else setError(toError(cause));
        throw toError(cause);
      } finally {
        setSubmitting(false);
      }
    },
    [repository, profileId],
  );

  return { submitting, error, capacityError, createOrder, clearCapacityError };
}
