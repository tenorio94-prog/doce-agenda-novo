// src/domain/orderStatus.ts
// 9 situações válidas. Comprometem vaga: confirmado, em_producao, pronto, entregue.

export const ORDER_STATUSES = [
  "solicitacao",
  "orcamento",
  "aguardando_confirmacao",
  "cancelado",
  "recusado",
  "confirmado",
  "em_producao",
  "pronto",
  "entregue",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const CAPACITY_CONSUMING: ReadonlySet<OrderStatus> = new Set([
  "confirmado",
  "em_producao",
  "pronto",
  "entregue",
]);

export const consumesCapacity = (status: OrderStatus): boolean => CAPACITY_CONSUMING.has(status);

export const isTerminal = (status: OrderStatus): boolean =>
  status === "cancelado" || status === "recusado" || status === "entregue";

export const isDecidable = (status: OrderStatus): boolean =>
  status === "solicitacao" || status === "orcamento" || status === "aguardando_confirmacao";

export const GROUP_LABEL: Record<OrderStatus, string> = {
  solicitacao: "Para decidir",
  orcamento: "Para decidir",
  aguardando_confirmacao: "Para decidir",
  cancelado: "Cancelado",
  recusado: "Recusado",
  confirmado: "Confirmado",
  em_producao: "Confirmado",
  pronto: "Confirmado",
  entregue: "Entregue",
};

export const canTransition = (from: OrderStatus, to: OrderStatus): boolean => {
  // Regras simples: não regride entregue; cancelado/recusado são terminais.
  if (from === "entregue" && to !== "entregue") return false;
  if (from === "cancelado" || from === "recusado") return false;
  return true;
};
