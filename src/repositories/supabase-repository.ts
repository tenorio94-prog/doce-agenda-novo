// src/repositories/supabase-repository.ts
// Entrada server-side do repositório Supabase: cria o client com a sessão dos
// cookies desta request (`next/headers`), para uso em Server Components,
// Server Actions e Route Handlers.
//
// Nunca importe este módulo em Client Components — ali use `./factory` ou
// `./repository-context` (hook `useRepository`).
//
// Cada instância pertence a UMA request: a RLS garante que a confeiteira só vê
// os próprios dados.

import { createServerClient } from "@/lib/supabase/server";

import { SupabaseRepository } from "./supabase/supabase-repository";
import type { IDoceRepository } from "./types";

export { SupabaseRepository } from "./supabase/supabase-repository";

/** Cria o repositório com o client do servidor desta request. */
export async function createServerRepository(): Promise<IDoceRepository> {
  return SupabaseRepository.fromClient(await createServerClient());
}

/** @deprecated Prefira `createServerRepository()` — deixa explícito o server-only. */
export const createRepository = createServerRepository;
