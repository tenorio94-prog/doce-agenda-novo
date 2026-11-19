"use client";

import type { Order } from "@/repositories/types";

interface AgendaCardProps {
  order: Order;
  onSelect: (order: Order) => void;
}

const STATUS_LABEL: Record<string, string> = {
  solicitacao: "Para decidir",
  orcamento: "Para decidir",
  aguardando_confirmacao: "Para decidir",
  confirmado: "Confirmado",
  em_producao: "Em produção",
  pronto: "Pronto",
  entregue: "Entregue",
};

const STATUS_COLOR: Record<string, string> = {
  solicitacao: "bg-tertiary-fixed text-on-tertiary-fixed",
  orcamento: "bg-tertiary-fixed text-on-tertiary-fixed",
  aguardando_confirmacao: "bg-tertiary-fixed text-on-tertiary-fixed",
  confirmado: "bg-secondary-container text-on-secondary-container",
  em_producao: "bg-secondary-container text-on-secondary-container",
  pronto: "bg-secondary-container text-on-secondary-container",
  entregue: "bg-surface-container text-on-surface-variant",
};

export function AgendaCard({ order, onSelect }: AgendaCardProps) {
  const items = order.items ?? [];
  const title = items.map((i) => i.name).join(", ") || "Pedido";
  const total = order.totalCents;
  return (
    <button
      type="button"
      onClick={() => onSelect(order)}
      className="w-full text-left rounded-xl bg-surface-container-lowest p-4 shadow-sm active:scale-[0.99] transition-all min-h-[44px]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-label-md text-label-md text-primary font-bold">{order.scheduledTime ?? "--:--"}</span>
            <span className={`px-2 py-0.5 rounded-full font-label-caps text-[10px] ${STATUS_COLOR[order.status] ?? ""}`}>
              {STATUS_LABEL[order.status] ?? order.status}
            </span>
          </div>
          <h4 className="font-headline-md text-headline-md text-on-surface truncate leading-snug">{title}</h4>
          <span className="font-body-sm text-body-sm text-on-surface-variant truncate">
            {order.customerName ?? "Cliente"}
          </span>
        </div>
        <span className="font-currency-lead text-title-sm text-on-surface shrink-0">
          R$ {(total / 100).toFixed(2).replace(".", ",")}
        </span>
      </div>
    </button>
  );
}
