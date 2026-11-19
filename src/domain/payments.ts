// src/domain/payments.ts
import type { Cents } from "./currency";

export type PaymentStatus = "informado" | "conferido";

export interface Payment {
  id: string;
  orderId: string;
  amountCents: Cents;
  status: PaymentStatus;
  paidAt: string;
}

export const isConferred = (p: Payment): boolean => p.status === "conferido";

export const receivedCents = (payments: Payment[]): Cents =>
  payments.filter(isConferred).reduce((acc, p) => acc + p.amountCents, 0);

export const informedCents = (payments: Payment[]): Cents =>
  payments.filter((p) => p.status === "informado").reduce((acc, p) => acc + p.amountCents, 0);

export const remainingCents = (totalCents: Cents, payments: Payment[]): Cents =>
  Math.max(0, totalCents - receivedCents(payments));
