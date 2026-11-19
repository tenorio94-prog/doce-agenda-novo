// src/repositories/ids.ts
// IDs gerados no servidor para permitir insert sem `select` de retorno:
// a submissão pública entra com a chave anon e a RLS não permite lê-la de volta.

/** Alfabeto sem 0/O/1/I/L — evita troca na leitura do código em voz alta. */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function newId(): string {
  return globalThis.crypto.randomUUID();
}

/** Código público curto usado pelo cliente para acompanhar o pedido. */
export function newPublicCode(length = 6): string {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  let code = "";
  for (const byte of bytes) code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  return code;
}
