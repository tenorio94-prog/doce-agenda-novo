"use client";

import { useState } from "react";
import type { Order } from "@/repositories/types";

interface OrderDrawerProps {
  order: Order | null;
  open: boolean;
  onClose: () => void;
  onReceive: (orderId: string) => void;
  onAdvance: (orderId: string, next: string) => void;
}

const NEXT_STATUS: Record<string, string> = {
  confirmado: "em_producao",
  em_producao: "pronto",
  pronto: "entregue",
};

const NEXT_LABEL: Record<string, string> = {
  confirmado: "Iniciar produção",
  em_producao: "Marcar pronto",
  pronto: "Marcar entregue",
};

export function OrderDrawer({ order, open, onClose, onReceive, onAdvance }: OrderDrawerProps) {
  const [receiving, setReceiving] = useState(false);

  if (!open || !order) return null;

  const total = order.totalCents;
  const received = 0; // payments loaded separately in real app; placeholder
  const pending = Math.max(0, total - received);

  const handleReceive = async () => {
    setReceiving(true);
    try {
      await onReceive(order.id);
    } finally {
      setReceiving(false);
    }
  };

  const next = NEXT_STATUS[order.status];
  const nextLabel = NEXT_LABEL[order.status];

  const whatsappText = encodeURIComponent(
    `Oi! Passando para confirmar o restante do pedido (${(pending / 100).toFixed(2).replace(".", ",")} reais).`,
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-[428px] bg-surface-container-lowest rounded-t-2xl p-5 shadow-xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1.5 bg-outline-variant rounded-full mx-auto mb-3 opacity-60" />
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-headline-lg text-headline-lg text-on-surface leading-tight">
            {order.items?.map((i) => i.name).join(", ") || "Pedido"}
          </h2>
          <button type="button" onClick={onClose} className="w-11 h-11 flex items-center justify-center rounded-full text-on-surface-variant">
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>
        <p className="font-body-sm text-body-sm text-on-surface-variant mb-4">
          {order.customerName ?? "Cliente"} • {order.scheduledDate} {order.scheduledTime ?? ""}
        </p>

        <div className="grid grid-cols-3 gap-2 text-center py-2 bg-surface-container rounded-xl mb-4">
          <div>
            <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">Total</span>
            <p className="font-headline-md text-headline-md text-on-surface font-bold">R$ {(total / 100).toFixed(2).replace(".", ",")}</p>
          </div>
          <div>
            <span className="font-label-caps text-label-caps text-secondary uppercase">Recebido</span>
            <p className="font-headline-md text-headline-md text-secondary font-bold">R$ {(received / 100).toFixed(2).replace(".", ",")}</p>
          </div>
          <div>
            <span className="font-label-caps text-label-caps text-tertiary uppercase">Falta</span>
            <p className="font-headline-md text-headline-md text-tertiary font-bold">R$ {(pending / 100).toFixed(2).replace(".", ",")}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            type="button"
            onClick={handleReceive}
            disabled={receiving}
            className="h-11 rounded-xl bg-secondary text-on-secondary font-label-md text-label-md flex items-center justify-center gap-1.5 min-h-[44px] disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-[18px]">check_circle</span>
            <span>{receiving ? "Salvando..." : "✓ Recebi"}</span>
          </button>
          <a
            href={`https://wa.me/?text=${whatsappText}`}
            target="_blank"
            rel="noopener noreferrer"
            className="h-11 rounded-xl bg-secondary-container text-on-secondary-fixed-variant font-label-md text-label-md flex items-center justify-center gap-1.5 min-h-[44px]"
          >
            <span className="material-symbols-outlined text-[18px]">chat</span>
            <span>WhatsApp</span>
          </a>
        </div>

        {next && nextLabel && (
          <button
            type="button"
            onClick={() => onAdvance(order.id, next)}
            className="w-full h-12 rounded-xl bg-primary text-on-primary font-title-sm text-title-sm flex items-center justify-center gap-2 shadow-md min-h-[44px]"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
            <span>{nextLabel}</span>
          </button>
        )}
      </div>
    </div>
  );
}
