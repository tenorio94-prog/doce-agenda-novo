"use client";

// src/hooks/useMoney.ts
// Tela Dinheiro: pedidos do mês, quanto foi conferido e quanto falta receber.
// Regra do domínio: só pagamento `conferido` conta como recebido.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Cents } from "@/domain/currency";
import { informedCents, receivedCents, remainingCents } from "@/domain/payments";
import type { Payment } from "@/domain/payments";
import { TIMEZONE } from "@/domain/timezone";
import { useRepository } from "@/repositories";
import type { Order, OrderPayment, OrderStatus, Profile } from "@/repositories/types";

import {
  currentMonthKey,
  isMonthKey,
  monthRange,
  resolveProfile,
  shiftMonth,
  toError,
  type MonthKey,
} from "./agenda-utils";

/** Situações que não geram cobrança: ficam fora dos totais do mês. */
const NON_BILLABLE: ReadonlySet<OrderStatus> = new Set(["cancelado", "recusado"]);

/** Pedido do mês com o saldo já calculado. */
export interface OrderBalance {
  order: Order;
  payments: readonly OrderPayment[];
  /** Pagamentos conferidos. */
  receivedCents: Cents;
  /** Pagamentos informados, ainda não conferidos. */
  informedCents: Cents;
  /** Total − conferido (nunca negativo). */
  pendingCents: Cents;
  settled: boolean;
}

export interface UseMoneyOptions {
  /** Id do perfil autenticado; omitido, usa o perfil único do modo demo. */
  profileId?: string;
  /** Mês inicial `yyyy-mm` (padrão: mês atual em America/Sao_Paulo). */
  initialMonth?: MonthKey;
}

export interface UseMoneyResult {
  profile: Profile | null;
  month: MonthKey;
  monthLabel: string;
  /** Pedidos do mês (inclui cancelados/recusados, que ficam fora dos totais). */
  orders: readonly Order[];
  /** Pedidos cobráveis com saldo calculado, em ordem cronológica. */
  balances: readonly OrderBalance[];
  totalCents: Cents;
  receivedCents: Cents;
  pendingCents: Cents;
  informedCents: Cents;
  loading: boolean;
  /** Pagamento em processamento — útil para desabilitar o botão "Recebi". */
  pendingPaymentId: string | null;
  error: Error | null;
  refresh: () => Promise<void>;
  goToMonth: (month: MonthKey) => void;
  previousMonth: () => void;
  nextMonth: () => void;
  /** Baixa rápida: marca o pagamento como `conferido` com a data de agora. */
  markReceived: (paymentId: string) => Promise<OrderPayment | null>;
}

const toDomainPayment = (payment: OrderPayment): Payment => ({
  id: payment.id,
  orderId: payment.orderId,
  amountCents: payment.amountCents,
  status: payment.status,
  paidAt: payment.paidAt ?? "",
});

const monthLabelOf = (month: MonthKey): string =>
  new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: TIMEZONE,
  }).format(new Date(`${month}-01T12:00:00Z`));

export function useMoney(options: UseMoneyOptions = {}): UseMoneyResult {
  const { profileId, initialMonth } = options;
  const repository = useRepository();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [month, setMonth] = useState<MonthKey>(() =>
    initialMonth !== undefined && isMonthKey(initialMonth)
      ? initialMonth
      : currentMonthKey(),
  );
  const [orders, setOrders] = useState<Order[]>([]);
  const [paymentsByOrder, setPaymentsByOrder] = useState<Record<string, OrderPayment[]>>({});
  const [loading, setLoading] = useState(true);
  const [pendingPaymentId, setPendingPaymentId] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const requestRef = useRef(0);
  useEffect(() => () => {
    requestRef.current += 1;
  }, []);

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
        const entries = await Promise.all(
          nextOrders.map(async (order): Promise<[string, OrderPayment[]]> => [
            order.id,
            await repository.payments.listByOrder(order.id),
          ]),
        );

        if (requestRef.current !== requestId) return;
        setProfile(nextProfile);
        setOrders(nextOrders);
        setPaymentsByOrder(Object.fromEntries(entries));
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

  const goToMonth = useCallback((nextMonth: MonthKey) => {
    if (isMonthKey(nextMonth)) setMonth(nextMonth);
  }, []);

  const previousMonth = useCallback(() => setMonth((current) => shiftMonth(current, -1)), []);
  const nextMonth = useCallback(() => setMonth((current) => shiftMonth(current, 1)), []);

  const balances = useMemo<OrderBalance[]>(() => {
    return orders
      .filter((order) => !NON_BILLABLE.has(order.status))
      .map((order) => {
        const payments = paymentsByOrder[order.id] ?? [];
        const domainPayments = payments.map(toDomainPayment);
        const received = receivedCents(domainPayments);
        const pending = remainingCents(order.totalCents, domainPayments);

        return {
          order,
          payments,
          receivedCents: received,
          informedCents: informedCents(domainPayments),
          pendingCents: pending,
          settled: pending === 0,
        };
      });
  }, [orders, paymentsByOrder]);

  const totals = useMemo(() => {
    let total: Cents = 0;
    let received: Cents = 0;
    let pending: Cents = 0;
    let informed: Cents = 0;

    for (const balance of balances) {
      total += balance.order.totalCents;
      received += balance.receivedCents;
      pending += balance.pendingCents;
      informed += balance.informedCents;
    }

    return { totalCents: total, receivedCents: received, pendingCents: pending, informedCents: informed };
  }, [balances]);

  const markReceived = useCallback(
    async (paymentId: string): Promise<OrderPayment | null> => {
      setError(null);
      setPendingPaymentId(paymentId);

      try {
        const updated = await repository.payments.updateStatus(
          paymentId,
          "conferido",
          new Date().toISOString(),
        );

        if (updated !== null) {
          setPaymentsByOrder((current) => {
            const list = current[updated.orderId];
            if (list === undefined) return current;
            return {
              ...current,
              [updated.orderId]: list.map((payment) =>
                payment.id === updated.id ? updated : payment,
              ),
            };
          });
        }

        return updated;
      } catch (cause) {
        setError(toError(cause));
        throw toError(cause);
      } finally {
        setPendingPaymentId(null);
      }
    },
    [repository],
  );

  return {
    profile,
    month,
    monthLabel: monthLabelOf(month),
    orders,
    balances,
    ...totals,
    loading,
    pendingPaymentId,
    error,
    refresh,
    goToMonth,
    previousMonth,
    nextMonth,
    markReceived,
  };
}
