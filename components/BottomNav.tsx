"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const STATS_ICON = "M4 20h16M7 16v-5M12 16V6M17 16v-8";

// No celular, Ajustes sai da barra (fica na engrenagem do Painel) para caber Estatísticas.
const items: { href: string; label: string; icon: string; primary?: boolean; desktopOnly?: boolean }[] = [
  { href: "/", label: "Painel", icon: "M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10" },
  { href: "/lancamentos", label: "Lançamentos", icon: "M4 6h16M4 12h16M4 18h10" },
  { href: "/novo", label: "Lançar", icon: "M12 5v14M5 12h14", primary: true },
  { href: "/fixos", label: "Fixos", icon: "M7 3v4M17 3v4M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" },
  { href: "/estatisticas", label: "Estatísticas", icon: STATS_ICON },
  { href: "/ajustes", label: "Ajustes", desktopOnly: true, icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" },
];

function useNav() {
  const pathname = usePathname();
  const sp = useSearchParams();
  const m = sp.get("m");
  return items.map((it) => ({
    ...it,
    active: it.href === "/" ? pathname === "/" : pathname.startsWith(it.href),
    href: m && it.href !== "/ajustes" && it.href !== "/estatisticas" ? `${it.href}?m=${m}` : it.href,
  }));
}

/** Celular e tablet: barra fixa embaixo, com o botão de lançar no meio. */
export function BottomNav() {
  const nav = useNav().filter((it) => !it.desktopOnly);
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="mx-auto grid max-w-xl grid-cols-5">
        {nav.map((it) => {
          if (it.primary) {
            return (
              <li key={it.label} className="flex justify-center">
                <Link
                  href={it.href}
                  aria-label="Lançar gasto"
                  className="-mt-5 grid size-14 place-items-center rounded-full bg-brand text-white shadow-[0_6px_16px_-4px_rgba(11,122,107,0.55)] transition-transform active:scale-95"
                >
                  <Icon d={it.icon} className="size-7" width={2.4} />
                </Link>
              </li>
            );
          }
          return (
            <li key={it.label}>
              <Link
                href={it.href}
                aria-current={it.active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 pt-2 pb-1.5 text-[11px] font-medium tracking-[-0.01em] ${it.active ? "text-ink" : "text-ink-3"}`}
              >
                <Icon d={it.icon} className="size-6" width={it.active ? 2.2 : 1.8} />
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Computador: menu lateral fixo, com o botão de lançar em destaque. */
export function SideNav({ email }: { email: string | null }) {
  const nav = useNav();
  const primary = nav.find((it) => it.primary)!;
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-surface px-4 py-6 lg:flex"
    >
      <Link href="/" className="display px-3 text-[22px] font-bold tracking-tight">
        Atlas<span className="text-brand">Financeiro</span>
      </Link>
      <Link
        href={primary.href}
        className="mt-6 flex items-center justify-center gap-2 rounded-full bg-brand px-4 py-3 text-[15px] font-semibold text-white shadow-[0_6px_16px_-6px_rgba(11,122,107,0.6)] hover:brightness-110"
      >
        <Icon d={primary.icon} className="size-5" width={2.4} />
        Lançar gasto
      </Link>
      <ul className="mt-6 space-y-1">
        {nav
          .filter((it) => !it.primary)
          .map((it) => (
            <li key={it.label}>
              <Link
                href={it.href}
                aria-current={it.active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium ${
                  it.active ? "bg-paper text-ink" : "text-ink-2 hover:bg-paper/60"
                }`}
              >
                <Icon d={it.icon} className="size-5" width={it.active ? 2.2 : 1.8} />
                {it.label}
              </Link>
            </li>
          ))}
      </ul>
      {email && <p className="mt-auto truncate px-3 text-[13px] text-ink-3">{email}</p>}
    </nav>
  );
}

function Icon({ d, className, width = 2 }: { d: string; className?: string; width?: number }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}
