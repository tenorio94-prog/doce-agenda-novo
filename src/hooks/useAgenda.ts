"use client";

// src/hooks/useAgenda.ts
// Estado da tela Agenda (dia + mês): perfil, pedidos e comandos do drawer.
// O repositório vem de `useRepository()`; nenhum hook fala com Supabase/IndexedDB.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { canTransition } from "@/domain/orderStatus";
import { todayISO } from "@/domain/timezone";
import { useRepository } from "@/repositories";
import { CapacityExceededError, RepositoryError } from "@/repositories/errors";
import type { IsoDate, Order, OrderPayment, OrderStatus, Profile } from "@/repositories/types";

import {
  isIsoDate,
  isMonthKey,
  monthKeyOf,
  monthRange,
  resolveProfile,
  toError,
  type MonthKey,
} from "./agenda-utils";

export interface UseAgendaOptions {
  /** Id do perfil autenticado; omitido, usa o perfil único do modo demo. */
  profileId?: string;
  /** Dia aberto inicialmente (padrão: hoje em America/Sao_Paulo). */
  initialDate?: IsoDate;
  /** Mês inicial `yyyy-mm` (padrão: mês de `initialDate`). */
  initialMonth?: MonthKey;
}

export interface UseAgendaResult {
  profile: Profile | null;
  /** Pedidos do mês selecionado, em ordem cronológica. */
  orders: readonly Order[];
  /** Pedidos do dia selecionado (recorte de `orders`). */
  dayOrders: readonly Order[];
  selectedDate: IsoDate;
  month: MonthKey;
  loading: boolean;
  /** Pedido/pagamento em mutação — útil para desabilitar botões. */
  pendingId: string | null;
  error: Error | null;
  /** Conflito de vagas para a UI abrir o diálogo de justificativa. */
  capacityError: CapacityExceededError | null;
  refresh: () => Promise<void>;
  selectDate: (date: IsoDate) => void;
  goToMonth: (month: MonthKey) => void;
  confirmOrder: (orderId: string, overrideReason?: string) => Promise<Order | null>;
  advanceStatus: (orderId: string, nextStatus: OrderStatus) => Promise<Order | null>;
  markPaymentReceived: (paymentId: string) => Promise<OrderPayment | null>;
  clearCapacityError: () => void;
}

export function useAgenda(options: UseAgendaOptions = {}): UseAgendaResult {
  const { profileId, initialDate, initialMonth } = options;
  const repository = useRepository();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedDate, setSelectedDate] = useState<IsoDate>(() =>
    initialDate !== undefined && isIsoDate(initialDate) ? initialDate : todayISO(),
  );
  const [month, setMonth] = useState<MonthKey>(() =>
    initialMonth !== undefined && isMonthKey(initialMonth)
      ? initialMonth
      : monthKeyOf(
          initialDate !== undefined && isIsoDate(initialDate) ? initialDate : todayISO(),
        ),
  );
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [capacityError, setCapacityError] = useState<CapacityExceededError | null>(null);

  // Invalida respostas em voo quando o componente desmonta ou troca de mês.
  const requestRef = useRef(0);
  useEffect(
    () => () => {
      requestRef.current += 1;
    },
    [],
  );

  const load = useCallback(
    async (targetMonth: MonthKey): Promise<void> => {
      const requestId = ++requestRef.current;
      setLoading(true);
      setError(null);

      try {
        const nextProfile = await resolveProfile(repository, profileId);
        const nextOrders = await repository.orders.listByProfile(
          nextProfile.id,
          monthRange(targetMonth),
        );

        if (requestRef.current !== requestId) return;
        setProfile(nextProfile);
        setOrders(nextOrders);
      } catch (cause) {
        if (requestRef.current !== requestId) return;
        setError(toError(cause));
      } finally {
        if (requestRef.current === requestId) setLoading(false);
      }
    },
    [repository, profileId],
  );

  useEffect(() => {
    void load(month);
  }, [load, month]);

  const refresh = useCallback(async (): Promise<void> => {
    await load(month);
  }, [load, month]);

  const clearCapacityError = useCallback(() => setCapacityError(null), []);

  const fail = useCallback((cause: unknown): never => {
    if (cause instanceof CapacityExceededError) setCapacityError(cause);
    else setError(toError(cause));
    throw toError(cause);
  }, []);

  const selectDate = useCallback((date: IsoDate) => {
    if (!isIsoDate(date)) return;
    setSelectedDate(date);
    setMonth(monthKeyOf(date));
  }, []);

  const goToMonth = useCallback((nextMonth: MonthKey) => {
    if (!isMonthKey(nextMonth)) return;
    setMonth(nextMonth);
    setSelectedDate((current) =>
      current.startsWith(`${nextMonth}-`) ? current : `${nextMonth}-01`,
    );
  }, []);

  const replaceOrder = useCallback((updated: Order) => {
    setOrders((current) => current.map((order) => (order.id === updated.id ? updated : order)));
  }, []);

  const confirmOrder = useCallback(
    async (orderId: string, overrideReason?: string): Promise<Order | null> => {
      setError(null);
      setCapacityError(null);
      setPendingId(orderId);

      try {
        const updated = await repository.orders.confirmOrder(
          orderId,
          overrideReason === undefined ? undefined : { overrideReason },
        );
        if (updated !== null) replaceOrder(updated);
        return updated;
      } catch (cause) {
        return fail(cause);
      } finally {
        setPendingId(null);
      }
    },
    [repository, replaceOrder, fail],
  );

  const advanceStatus = useCallback(
    async (orderId: string, nextStatus: OrderStatus): Promise<Order | null> => {
      setError(null);
      setCapacityError(null);
      setPendingId(orderId);

      try {
        const current = await repository.orders.getById(orderId);
        if (current === null) return null;
        if (!canTransition(current.status, nextStatus)) {
          throw new RepositoryError(
            `Transição inválida: ${current.status} → ${nextStatus}.`,
            "INVALID_STATUS_TRANSITION",
          );
        }

        const updated = await repository.orders.update(orderId, { status: nextStatus });
        if (updated !== null) replaceOrder(updated);
        return updated;
      } catch (cause) {
        return fail(cause);
      } finally {
        setPendingId(null);
      }
    },
    [repository, replaceOrder, fail],
  );

  const markPaymentReceived = useCallback(
    async (paymentId: string): Promise<OrderPayment | null> => {
      setError(null);
      setCapacityError(null);
      setPendingId(paymentId);

      try {
        const updated = await repository.payments.updateStatus(
          paymentId,
          "conferido",
          new Date().toISOString(),
        );
        await refresh();
        return updated;
      } catch (cause) {
        return fail(cause);
      } finally {
        setPendingId(null);
      }
    },
    [repository, refresh, fail],
  );

  const dayOrders = useMemo(
    () => orders.filter((order) => order.scheduledDate === selectedDate),
    [orders, selectedDate],
  );

  return {
    profile,
    orders,
    dayOrders,
    selectedDate,
    month,
    loading,
    pendingId,
    error,
    capacityError,
    refresh,
    selectDate,
    goToMonth,
    confirmOrder,
    advanceStatus,
    markPaymentReceived,
    clearCapacityError,
  };
}
