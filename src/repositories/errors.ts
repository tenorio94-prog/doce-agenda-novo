// src/repositories/errors.ts
// Erros da camada de dados, compartilhados pelos repositórios Supabase e demo.
// A UI distingue falha de infraestrutura (`RepositoryError`) de conflito de
// agenda (`CapacityExceededError`).

import type { IsoDate } from "./types";

/** Falha ao falar com a persistência (PostgREST/RLS/rede/IndexedDB). */
export class RepositoryError extends Error {
  readonly code: string;

  constructor(message: string, code = "REPOSITORY_ERROR") {
    super(message);
    this.name = "RepositoryError";
    this.code = code;
  }
}

interface PostgrestLikeError {
  message?: unknown;
  code?: unknown;
  details?: unknown;
}

/** Normaliza um erro do Supabase em `RepositoryError`, preservando o código. */
export function toRepositoryError(context: string, error: unknown): RepositoryError {
  const source = (error ?? {}) as PostgrestLikeError;
  const message = typeof source.message === "string" ? source.message : "erro desconhecido";
  const code =
    typeof source.code === "string" && source.code.length > 0 ? source.code : "REPOSITORY_ERROR";
  return new RepositoryError(`${context}: ${message}`, code);
}

export interface CapacityExceededDetails {
  /** Dia que estourou (`yyyy-mm-dd`). */
  date: IsoDate;
  /** Limite de vagas do dia. */
  limit: number;
  /** Vagas já comprometidas por pedidos que ocupam vaga. */
  consumedSlots: number;
  /** Vagas que o pedido em análise pediria. */
  requestedSlots: number;
  /** Motivo enviado (quando veio algum), já normalizado. */
  overrideReason?: string | null;
  /** `true` quando veio motivo, mas fora do intervalo de 4 a 300 caracteres. */
  overrideReasonInvalid?: boolean;
}

/**
 * O dia não aceita mais vagas. Para prosseguir, a confeiteira precisa enviar
 * um `overrideReason` de 4 a 300 caracteres (vai para `capacity_override_reason`).
 */
export class CapacityExceededError extends RepositoryError {
  readonly date: IsoDate;
  readonly limit: number;
  readonly consumedSlots: number;
  readonly requestedSlots: number;
  readonly overrideReason: string | null;
  readonly overrideReasonInvalid: boolean;

  constructor(details: CapacityExceededDetails) {
    const invalid = details.overrideReasonInvalid ?? false;
    super(
      invalid
        ? `O dia ${details.date} não tem vagas e o motivo de exceção precisa ter de 4 a 300 caracteres.`
        : `O dia ${details.date} não tem vagas suficientes ` +
            `(${details.consumedSlots}/${details.limit} ocupadas, ${details.requestedSlots} pedidas). ` +
            "Informe um motivo de exceção para confirmar mesmo assim.",
      "CAPACITY_EXCEEDED",
    );
    this.name = "CapacityExceededError";
    this.date = details.date;
    this.limit = details.limit;
    this.consumedSlots = details.consumedSlots;
    this.requestedSlots = details.requestedSlots;
    this.overrideReason = details.overrideReason ?? null;
    this.overrideReasonInvalid = invalid;
  }
}
