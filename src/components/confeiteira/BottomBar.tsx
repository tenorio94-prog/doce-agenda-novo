"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "agenda", label: "Agenda", icon: "calendar_today" },
  { href: "novo", label: "Novo pedido", icon: "add" },
  { href: "dinheiro", label: "Dinheiro", icon: "payments" },
];

interface BottomBarProps {
  basePath: "/app" | "/demo";
}

export function BottomBar({ basePath }: BottomBarProps) {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 w-full z-50 pb-safe bg-surface/90 backdrop-blur-xl shadow-[0_-2px_12px_rgba(44,30,22,0.06)]">
      <div className="max-w-[428px] mx-auto flex items-center justify-around h-16 px-2">
        {ITEMS.map((item) => {
          const href = `${basePath}/${item.href}`;
          const active = pathname === href || pathname === `${href}/`;
          return (
            <Link
              key={item.href}
              href={href}
              className={`flex flex-col items-center justify-center min-w-[56px] min-h-[44px] gap-0.5 transition-colors ${
                active ? "text-primary font-title-sm" : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
              <span className="font-label-caps text-label-caps">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
