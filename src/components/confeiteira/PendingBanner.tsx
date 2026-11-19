"use client";

interface PendingBannerProps {
  count: number;
  onView: () => void;
}

export function PendingBanner({ count, onView }: PendingBannerProps) {
  if (count <= 0) return null;
  return (
    <div className="relative overflow-hidden rounded-xl bg-surface-container-high p-3.5 shadow-sm active:opacity-90 transition-opacity">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary">
            <span className="material-symbols-outlined text-[18px]">bolt</span>
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-title-sm text-label-md text-on-surface font-bold truncate">
                {count === 1 ? "Camila pediu pelo link" : `${count} pedidos para decidir`}
              </span>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
            </div>
            <span className="font-body-sm text-body-sm text-on-surface-variant truncate">Toque em Ver para aceitar ou recusar</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onView}
          className="flex items-center gap-0.5 px-2.5 py-1 rounded-lg bg-surface-container-lowest text-primary shadow-xs font-label-md text-label-md whitespace-nowrap shrink-0 min-h-[44px]"
        >
          <span>Ver</span>
          <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        </button>
      </div>
    </div>
  );
}
