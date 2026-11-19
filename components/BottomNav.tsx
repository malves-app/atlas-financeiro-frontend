"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Logo } from "@/components/Logo";

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

/** Computador: menu lateral fixo. O botão de lançar flutua no canto (LaunchButton). */
export function SideNav({ email }: { email: string | null }) {
  const nav = useNav();
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-surface px-4 py-6 lg:flex"
    >
      <Link href="/" className="px-3 text-[22px]">
        <Logo />
      </Link>
      <ul className="mt-8 space-y-1">
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

/**
 * Computador: botão flutuante no canto de baixo, sempre à mão.
 * Encolhe para um círculo enquanto a página desce e volta a mostrar o texto ao subir.
 * Atalho: tecla N (fora de campos de texto).
 */
export function LaunchButton() {
  const pathname = usePathname();
  const router = useRouter();
  const href = useNav().find((it) => it.primary)!.href;
  const [compact, setCompact] = useState(false);
  const hidden = pathname.startsWith("/novo");

  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (y < 160) setCompact(false);
      else if (y > last + 6) setCompact(true);
      else if (y < last - 6) setCompact(false);
      last = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (hidden) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "n" || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, [contenteditable=true], dialog[open]")) return;
      if (document.querySelector("dialog[open]")) return;
      e.preventDefault();
      router.push(href);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hidden, href, router]);

  if (hidden) return null;
  return (
    <Link
      href={href}
      aria-label="Lançar gasto"
      title="Lançar gasto (N)"
      aria-keyshortcuts="N"
      className="group fixed right-6 bottom-6 z-30 hidden items-center rounded-full bg-ink p-1.5 text-white shadow-[0_14px_34px_-12px_rgba(23,32,51,0.65),0_2px_6px_rgba(23,32,51,0.18)] ring-1 ring-white/10 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-12px_rgba(23,32,51,0.7),0_2px_6px_rgba(23,32,51,0.2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand active:translate-y-0 lg:flex xl:right-8 xl:bottom-8"
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#17b39b] transition-transform duration-300 group-hover:rotate-90 motion-reduce:transition-none">
        <Icon d="M12 5v14M5 12h14" className="size-[22px]" width={2.6} />
      </span>
      <span
        className={`flex items-center gap-2.5 overflow-hidden whitespace-nowrap transition-[max-width,opacity,padding] duration-300 ease-out motion-reduce:transition-none ${
          compact ? "max-w-0 pr-0 pl-0 opacity-0" : "max-w-[14rem] pr-3 pl-3 opacity-100"
        }`}
      >
        <span className="text-[15px] font-semibold">Lançar gasto</span>
        <kbd className="grid size-6 place-items-center rounded-md bg-white/10 font-sans text-[12px] font-semibold text-white/60">
          N
        </kbd>
      </span>
    </Link>
  );
}

function Icon({ d, className, width = 2 }: { d: string; className?: string; width?: number }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}
