"use client";

import { useState } from "react";

interface CapacityDialogProps {
  open: boolean;
  onClose: () => void;
  onAccept: (reason: string) => void;
  error?: Error | null;
}

export function CapacityDialog({ open, onClose, onAccept, error }: CapacityDialogProps) {
  const [reason, setReason] = useState("");
  const [mode, setMode] = useState<"choose" | "reason">("choose");

  if (!open) return null;

  const valid = reason.trim().length >= 4 && reason.trim().length <= 300;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
      <div className="w-full max-w-[428px] bg-surface-container-lowest rounded-t-2xl p-5 shadow-xl">
        <h3 className="font-headline-md text-headline-md text-on-surface mb-2">Dia cheio</h3>
        <p className="font-body-sm text-body-sm text-on-surface-variant mb-4">
          {error?.message ?? "A capacidade deste dia foi atingida. Deseja aceitar mesmo assim?"}
        </p>
        {mode === "choose" ? (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setMode("reason")}
              className="w-full h-11 rounded-xl bg-primary text-on-primary font-title-sm text-title-sm min-h-[44px]"
            >
              Aceitar mesmo assim
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full h-11 rounded-xl bg-surface-container text-on-surface font-title-sm text-title-sm min-h-[44px]"
            >
              Escolher outra data
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Motivo (4 a 300 caracteres)"
              className="w-full bg-surface-container-low rounded-xl p-3 font-body-sm text-body-sm outline-none focus:ring-2 focus:ring-primary/20 resize-none"
              rows={3}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode("choose")}
                className="flex-1 h-11 rounded-xl bg-surface-container text-on-surface font-title-sm text-title-sm min-h-[44px]"
              >
                Voltar
              </button>
              <button
                type="button"
                disabled={!valid}
                onClick={() => onAccept(reason.trim())}
                className="flex-1 h-11 rounded-xl bg-primary text-on-primary font-title-sm text-title-sm min-h-[44px] disabled:opacity-50"
              >
                Confirmar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
