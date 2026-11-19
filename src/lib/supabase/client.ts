// src/lib/supabase/client.ts
// Cliente Supabase para uso no navegador (Client Components, hooks, event handlers).
// Não importe este módulo em Server Components: use `./server`.

import { createBrowserClient as createSupabaseBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseEnv } from "./env";

export type BrowserSupabaseClient = SupabaseClient;

/**
 * Cria (ou reaproveita, via singleton interno do `@supabase/ssr`) o cliente
 * Supabase do navegador usando as credenciais públicas do projeto.
 *
 * @throws {import("./env").SupabaseEnvError} se as variáveis de ambiente
 * obrigatórias estiverem ausentes.
 */
export function createBrowserClient(): BrowserSupabaseClient {
  const { url, anonKey } = getSupabaseEnv();

  return createSupabaseBrowserClient(url, anonKey);
}
