// src/repositories/factory.ts
// Ponto único de criação do repositório da aplicação.
//
// - `demo`: `DemoIndexedDBRepository` (IndexedDB, 100% no navegador).
// - `app`: `SupabaseRepository` (Supabase + RLS).
//
// No modo `app` usamos o client do navegador (`@/lib/supabase/client`), que é o
// único viável dentro do `RepositoryProvider` (Client Component). O import e a
// criação do client ficam para a primeira operação — a fábrica é síncrona
// porque o Provider precisa do valor já no primeiro render. Efeito colateral
// desejado: o modo demo nunca carrega o SDK do Supabase.
//
// Server Components/Actions continuam usando `createServerRepository()` de
// `./supabase-repository` (sessão lida dos cookies da request).

import { DemoIndexedDBRepository } from "./demo-indexeddb-repository";
import { RepositoryError } from "./errors";
import type { IDoceRepository } from "./types";

/** Onde os dados vivem: conta real (Supabase) ou sandbox do navegador. */
export type RepositoryMode = "app" | "demo";

export const REPOSITORY_MODES = ["app", "demo"] as const;

/** Rotas sob este prefixo usam o repositório de demonstração. */
export const DEMO_PATH_PREFIX = "/demo";

export function isRepositoryMode(value: unknown): value is RepositoryMode {
  return typeof value === "string" && (REPOSITORY_MODES as readonly string[]).includes(value);
}

/**
 * Modo implícito pela rota: `/demo` e `/demo/...` → demo; todo o resto → app.
 * Aceita `null` (pathname ainda desconhecido) e cai no modo real.
 */
export function repositoryModeForPathname(
  pathname: string | null | undefined,
): RepositoryMode {
  if (!pathname) return "app";
  return pathname === DEMO_PATH_PREFIX || pathname.startsWith(`${DEMO_PATH_PREFIX}/`)
    ? "demo"
    : "app";
}

// ------------------------------------------------------- Envelope preguiçoso

type LazyTarget = Record<string, unknown>;

/**
 * Devolve uma versão de `T` cujas operações só tocam o repositório real quando
 * são chamadas. Chamadas de método recebem o objeto dono como `this`, então
 * métodos que usam estado privado (`this.db`) continuam corretos.
 */
function deferRepository<T extends object>(load: () => Promise<T>): T {
  const makeNode = (path: readonly string[]): unknown => {
    const invoke = (...args: unknown[]): Promise<unknown> =>
      load().then((repository) => {
        let owner = repository as unknown as LazyTarget;
        for (const key of path.slice(0, -1)) {
          const next = owner[key];
          if (next === null || typeof next !== "object") {
            throw new RepositoryError(
              `Operação "${path.join(".")}" indisponível no repositório.`,
              "REPOSITORY_UNAVAILABLE",
            );
          }
          owner = next as LazyTarget;
        }

        const member = owner[path[path.length - 1] ?? ""];
        if (typeof member !== "function") {
          throw new RepositoryError(
            `Operação "${path.join(".")}" não existe no repositório.`,
            "REPOSITORY_UNKNOWN_MEMBER",
          );
        }
        return Reflect.apply(member, owner, args) as unknown;
      });

    return new Proxy(invoke, {
      get(_target, prop) {
        if (typeof prop === "symbol" || prop === "then" || prop === "toJSON") {
          return undefined;
        }
        return makeNode([...path, prop]);
      },
    });
  };

  return makeNode([]) as T;
}

/** Repositório Supabase resolvido no primeiro uso (import + client do navegador). */
function createSupabaseRepository(): IDoceRepository {
  let pending: Promise<IDoceRepository> | null = null;

  const load = (): Promise<IDoceRepository> => {
    pending ??= Promise.all([
      import("./supabase/supabase-repository"),
      import("@/lib/supabase/client"),
    ]).then(([{ SupabaseRepository }, { createBrowserClient }]) =>
      SupabaseRepository.fromClient(createBrowserClient()),
    );
    return pending;
  };

  return deferRepository<IDoceRepository>(load);
}

// ------------------------------------------------------------------- Fábrica

/**
 * Cria o repositório do modo pedido.
 *
 * - `"demo"` → IndexedDB, sincronamente (sem servidor).
 * - `"app"`  → `SupabaseRepository` sobre o client do navegador, resolvido na
 *   primeira operação (import preguiçoso, sem sessão de cookies — a RLS do
 *   usuário logado vale no navegador).
 *
 * Em Server Components/Actions use `createServerRepository()` de
 * `./supabase-repository` para ler a sessão dos cookies da request.
 */
export function createRepository(mode: RepositoryMode): IDoceRepository {
  return mode === "demo" ? new DemoIndexedDBRepository() : createSupabaseRepository();
}
