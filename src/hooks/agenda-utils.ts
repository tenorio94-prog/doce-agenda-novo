// src/hooks/agenda-utils.ts
// Utilidades compartilhadas pelos hooks de Agenda/Dinheiro: meses no fuso de
// São Paulo, normalização de erros e resolução do perfil ativo.

import { todayISO } from "@/domain/timezone";
import { RepositoryError } from "@/repositories/errors";
import type { IDoceRepository, IsoDate, Profile } from "@/repositories/types";

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Mês no formato `yyyy-mm`. */
export type MonthKey = string;

export const isMonthKey = (value: string): boolean => MONTH_PATTERN.test(value);

export const isIsoDate = (value: string): boolean => DATE_PATTERN.test(value);

export const monthKeyOf = (isoDate: IsoDate): MonthKey => isoDate.slice(0, 7);

export const currentMonthKey = (now: Date = new Date()): MonthKey => monthKeyOf(todayISO(now));

/** Primeiro e último dia do mês, no formato `yyyy-mm-dd`. */
export const monthRange = (month: MonthKey): { fromDate: IsoDate; toDate: IsoDate } => {
  const safe = isMonthKey(month) ? month : currentMonthKey();
  const [year, monthNumber] = safe.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return {
    fromDate: `${safe}-01`,
    toDate: `${safe}-${String(lastDay).padStart(2, "0")}`,
  };
};

export const shiftMonth = (month: MonthKey, delta: number): MonthKey => {
  const safe = isMonthKey(month) ? month : currentMonthKey();
  const [year, monthNumber] = safe.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, monthNumber - 1 + delta, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
};

/** Converte qualquer falha em `Error`, preservando a instância original. */
export function toError(cause: unknown): Error {
  if (cause instanceof Error) return cause;
  return new Error(typeof cause === "string" ? cause : "Erro inesperado na agenda.");
}

/**
 * O repositório demo expõe o único perfil semeado; no modo app o id do perfil
 * vem da borda autenticada (opção `profileId`).
 */
const demoProfileIdOf = (repository: IDoceRepository): string | null => {
  const candidate = (repository as unknown as { demoProfileId?: unknown }).demoProfileId;
  return typeof candidate === "string" && candidate.length > 0 ? candidate : null;
};

/**
 * Carrega o perfil ativo. No modo demo resolve o primeiro (e único) perfil do
 * repositório; no modo app usa `profileId` informado pela tela autenticada.
 *
 * @throws {RepositoryError} `PROFILE_REQUIRED` quando não há id disponível e
 * `PROFILE_NOT_FOUND` quando o id não existe mais.
 */
export async function resolveProfile(
  repository: IDoceRepository,
  profileId?: string,
): Promise<Profile> {
  const targetId = profileId ?? demoProfileIdOf(repository);
  if (targetId === null) {
    throw new RepositoryError(
      "Perfil não identificado. Informe profileId para carregar a agenda.",
      "PROFILE_REQUIRED",
    );
  }

  const profile = await repository.profiles.getById(targetId);
  if (profile === null) {
    throw new RepositoryError(`Perfil ${targetId} não encontrado.`, "PROFILE_NOT_FOUND");
  }
  return profile;
}
