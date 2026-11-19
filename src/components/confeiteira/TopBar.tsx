"use client";

import { useState } from "react";

interface TopBarProps {
  title: string;
  onMenu?: () => void;
  onShareLink?: () => void;
}

export function TopBar({ title, onMenu, onShareLink }: TopBarProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = () => {
    if (onShareLink) onShareLink();
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <header className="fixed top-0 w-full z-50 pt-safe bg-surface/85 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
      <div className="max-w-[428px] mx-auto h-16 px-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Menu"
            onClick={onMenu}
            className="w-11 h-11 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-[22px]">menu</span>
          </button>
          <h1 className="font-headline-md text-headline-md text-on-surface leading-tight">{title}</h1>
        </div>
        <button
          type="button"
          onClick={handleShare}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-low text-primary shadow-sm active:scale-95 transition-all min-h-[44px]"
        >
          <span className="material-symbols-outlined text-[16px]">link</span>
          <span className="font-label-md text-label-md font-semibold">{copied ? "Copiado!" : "Meu link"}</span>
        </button>
      </div>
    </header>
  );
}
