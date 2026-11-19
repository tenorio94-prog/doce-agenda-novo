"use client";

import { useMoney } from "@/hooks/useMoney";

export function MoneyPage() {
  const {
    monthLabel,
    receivedCents,
    pendingCents,
    balances,
    loading,
    previousMonth,
    nextMonth,
    markReceived,
    pendingPaymentId,
  } = useMoney();

  return (
    <div className="max-w-[428px] mx-auto px-4 pt-20 pb-28">
      <h1 className="font-headline-lg text-headline-lg text-on-surface mb-4">Dinheiro</h1>
      <div className="flex items-center justify-between bg-surface-container-lowest p-2 rounded-full shadow-sm mb-4">
        <button type="button" onClick={previousMonth} className="w-10 h-10 flex items-center justify-center rounded-full bg-surface-container hover:bg-surface-container-high min-h-[44px]">
          <span className="material-symbols-outlined text-[20px]">chevron_left</span>
        </button>
        <span className="font-title-sm text-title-sm text-on-surface font-semibold">{monthLabel}</span>
        <button type="button" onClick={nextMonth} className="w-10 h-10 flex items-center justify-center rounded-full bg-surface-container hover:bg-surface-container-high min-h-[44px]">
          <span className="material-symbols-outlined text-[20px]">chevron_right</span>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-secondary-fixed/30 p-4 rounded-xl shadow-sm">
          <span className="font-label-caps text-label-caps text-on-secondary-fixed-variant uppercase tracking-wider">Recebido</span>
          <p className="font-headline-md text-headline-md text-secondary font-bold mt-1">R$ {(receivedCents / 100).toFixed(2).replace(".", ",")}</p>
        </div>
        <div className="bg-tertiary-fixed/30 p-4 rounded-xl shadow-sm">
          <span className="font-label-caps text-label-caps text-tertiary uppercase tracking-wider">Falta receber</span>
          <p className="font-headline-md text-headline-md text-tertiary font-bold mt-1">R$ {(pendingCents / 100).toFixed(2).replace(".", ",")}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {loading && <p className="font-body-sm text-body-sm text-on-surface-variant">Carregando...</p>}
        {balances.map((b) => (
          <div key={b.order.id} className="bg-surface-container-lowest rounded-xl p-3 shadow-sm flex items-center justify-between">
            <div className="flex flex-col min-w-0">
              <span className="font-title-sm text-title-sm text-on-surface truncate">{b.order.customerName ?? "Cliente"}</span>
              <span className="font-body-sm text-body-sm text-on-surface-variant truncate">{b.order.scheduledDate}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-title-sm text-title-sm text-tertiary font-bold">R$ {(b.pendingCents / 100).toFixed(2).replace(".", ",")}</span>
              {b.pendingCents > 0 && (
                <button
                  type="button"
                  onClick={() => markReceived(b.order.id)}
                  disabled={pendingPaymentId === b.order.id}
                  className="px-3 py-1.5 rounded-lg bg-secondary text-on-secondary font-label-md text-label-md min-h-[44px] disabled:opacity-60"
                >
                  Recebi
                </button>
              )}
            </div>
          </div>
        ))}
        {!loading && balances.length === 0 && (
          <p className="font-body-sm text-body-sm text-on-surface-variant">Nenhum pedido neste mês.</p>
        )}
      </div>
    </div>
  );
}
