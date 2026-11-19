"use client";

// src/repositories/repository-context.tsx
// Injeção do repositório na árvore React.
//
// O modo é decidido assim: prop `mode` (quando informada) > rota atual
// (`/demo...` → demo, resto → app). Componentes nunca importam Supabase nem
// Dexie/IndexedDB diretamente: pedem o repositório pelo hook `useRepository`.

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import {
  createRepository,
  repositoryModeForPathname,
  type RepositoryMode,
} from "./factory";
import type { IDoceRepository } from "./types";

interface RepositoryContextValue {
  repository: IDoceRepository;
  /** Modo efetivamente usado (útil para banners/telemetria do sandbox). */
  mode: RepositoryMode;
}

const RepositoryContext = createContext<RepositoryContextValue | null>(null);

export interface RepositoryProviderProps {
  children: ReactNode;
  /** Força o modo; se omitido, a rota decide. */
  mode?: RepositoryMode;
  /** Repositório pronto (testes, stories ou boundary de servidor). */
  repository?: IDoceRepository;
}

export function RepositoryProvider({
  children,
  mode,
  repository,
}: RepositoryProviderProps) {
  const pathname = usePathname();
  const resolvedMode = mode ?? repositoryModeForPathname(pathname);

  const value = useMemo<RepositoryContextValue>(
    () => ({ repository: repository ?? createRepository(resolvedMode), mode: resolvedMode }),
    [repository, resolvedMode],
  );

  return <RepositoryContext.Provider value={value}>{children}</RepositoryContext.Provider>;
}

/** Repositório do modo atual. Lança fora de um `<RepositoryProvider>`. */
export function useRepository(): IDoceRepository {
  const context = useContext(RepositoryContext);
  if (context === null) {
    throw new Error("useRepository() exige um <RepositoryProvider> acima na árvore.");
  }
  return context.repository;
}

/** Modo ativo (`app` ou `demo`). Lança fora de um `<RepositoryProvider>`. */
export function useRepositoryMode(): RepositoryMode {
  const context = useContext(RepositoryContext);
  if (context === null) {
    throw new Error("useRepositoryMode() exige um <RepositoryProvider> acima na árvore.");
  }
  return context.mode;
}
