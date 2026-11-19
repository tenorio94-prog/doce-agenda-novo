// src/lib/supabase/env.ts
// Leitura e validação centralizada das variáveis de ambiente do Supabase.

export type SupabaseEnv = {
  readonly url: string;
  readonly anonKey: string;
};

export const SUPABASE_ENV_KEYS = {
  url: "NEXT_PUBLIC_SUPABASE_URL",
  anonKey: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
} as const;

export type SupabaseEnvKey =
  (typeof SUPABASE_ENV_KEYS)[keyof typeof SUPABASE_ENV_KEYS];

/** Erro lançado quando uma ou mais variáveis obrigatórias não estão definidas. */
export class SupabaseEnvError extends Error {
  readonly missing: readonly string[];

  constructor(missing: readonly string[]) {
    super(
      `Variáveis de ambiente do Supabase ausentes: ${missing.join(", ")}. ` +
        "Copie .env.example para .env.local e preencha os valores do projeto Supabase.",
    );
    this.name = "SupabaseEnvError";
    this.missing = missing;
  }
}

function isFilled(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function readEnv(
  key: SupabaseEnvKey,
  value: string | undefined,
  missing: string[],
): string {
  if (isFilled(value)) {
    return value.trim();
  }

  missing.push(key);
  return "";
}

/**
 * Retorna as credenciais públicas do Supabase.
 *
 * A validação é feita sob demanda (e não no import) para não quebrar o
 * build/SSG quando as variáveis ainda não foram configuradas.
 *
 * @throws {SupabaseEnvError} se `NEXT_PUBLIC_SUPABASE_URL` ou
 * `NEXT_PUBLIC_SUPABASE_ANON_KEY` estiverem ausentes/vazias.
 */
export function getSupabaseEnv(): SupabaseEnv {
  // Acesso estático obrigatório: o Next só injeta variáveis NEXT_PUBLIC_* no
  // bundle do navegador quando a referência é literal (`process.env.NOME`),
  // nunca por indexação dinâmica (`process.env[nome]`).
  const missing: string[] = [];
  const url = readEnv(
    SUPABASE_ENV_KEYS.url,
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    missing,
  );
  const anonKey = readEnv(
    SUPABASE_ENV_KEYS.anonKey,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    missing,
  );

  if (missing.length > 0) {
    throw new SupabaseEnvError(missing);
  }

  return Object.freeze({ url, anonKey });
}
