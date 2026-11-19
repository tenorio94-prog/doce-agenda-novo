// src/domain/currency.ts
// Valores monetários sempre em centavos inteiros (BRL).

export type Cents = number;

export const toCents = (reais: number): Cents => Math.round(reais * 100);

export const toReais = (cents: Cents): number => cents / 100;

export const formatBRL = (cents: Cents): string => {
  const value = cents / 100;
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export const sumCents = (values: Cents[]): Cents => values.reduce((a, b) => a + b, 0);

export const isNonNegative = (cents: Cents): boolean => Number.isInteger(cents) && cents >= 0;
