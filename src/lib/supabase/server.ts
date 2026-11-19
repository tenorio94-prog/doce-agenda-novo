// src/lib/supabase/server.ts
// Cliente Supabase para Server Components, Server Actions e Route Handlers.
// Crie um cliente novo por request — nunca compartilhe entre requisições.

import { createServerClient as createSupabaseServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { getSupabaseEnv } from "./env";

export type ServerSupabaseClient = SupabaseClient;

/**
 * Cria o cliente Supabase do servidor lendo a sessão dos cookies da request.
 *
 * Use no início do handler (`const supabase = await createServerClient()`),
 * antes de gerar a resposta, para que renovações de token possam ser gravadas
 * nos cookies.
 *
 * Quando chamado em um Server Component, a escrita de cookies é bloqueada pelo
 * Next; nesse caso o `setAll` ignora silenciosamente e a renovação da sessão
 * fica a cargo do middleware.
 *
 * @throws {import("./env").SupabaseEnvError} se as variáveis de ambiente
 * obrigatórias estiverem ausentes.
 */
export async function createServerClient(): Promise<ServerSupabaseClient> {
  const { url, anonKey } = getSupabaseEnv();
  const cookieStore = await cookies();

  return createSupabaseServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components não podem escrever cookies. O middleware
          // (`src/middleware.ts`) é quem renova a sessão nesses casos.
        }
      },
    },
  });
}
