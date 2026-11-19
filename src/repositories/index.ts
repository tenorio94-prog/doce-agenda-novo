// src/repositories/index.ts
// Entrada pública da camada de dados: contratos, erros, fábrica e injeção React.
//
//   import { useRepository } from "@/repositories";          // Client Components
//   import { createRepository, type IDoceRepository } from "@/repositories";
//
// Atenção: este barrel reexporta o módulo de context ("use client"). Em Server
// Components prefira importar `./factory` ou `./types` diretamente para não
// arrastar React/next/navigation para o bundle do servidor.

export * from "./types";
export * from "./errors";
export * from "./factory";
export * from "./repository-context";
