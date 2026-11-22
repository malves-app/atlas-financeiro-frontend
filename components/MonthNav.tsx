"use client";

import Link from "next/link";
import { currentMonth, monthLabel, shiftMonth } from "@/lib/format";
import { useViewMonth } from "./NavState";

function Arrow({ dir }: { dir: "left" | "right" }) {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={dir === "left" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
    </svg>
  );
}

/** ‹ Mês › — o nome do mês muda no toque, antes de a página responder. */
export function MonthSwitcher({
  month,
  basePath,
  params = {},
}: {
  month: string;
  basePath: string;
  params?: Record<string, string | undefined>;
}) {
  const view = useViewMonth(month);
  const href = (m: string) => {
    const sp = new URLSearchParams();
    sp.set("m", m);
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    return `${basePath}?${sp.toString()}`;
  };
  return (
    <nav aria-label="Mês" className="flex items-center gap-1">
      <Link
        href={href(shiftMonth(view, -1))}
        aria-label={`Ir para ${monthLabel(shiftMonth(view, -1))}`}
        className="grid size-10 place-items-center rounded-full text-ink-2 hover:bg-white/70"
        scroll={false}
      >
        <Arrow dir="left" />
      </Link>
      <span className="min-w-[8.25rem] text-center text-[15px] font-semibold sm:min-w-[9.5rem]" aria-live="polite">
        {monthLabel(view)}
      </span>
      <Link
        href={href(shiftMonth(view, 1))}
        aria-label={`Ir para ${monthLabel(shiftMonth(view, 1))}`}
        className="grid size-10 place-items-center rounded-full text-ink-2 hover:bg-white/70"
        scroll={false}
      >
        <Arrow dir="right" />
      </Link>
    </nav>
  );
}

/** Quando o mês na tela não é o atual, um atalho para voltar a ele. */
export function BackToCurrentMonth({
  month,
  basePath,
  params = {},
}: {
  month: string;
  basePath: string;
  params?: Record<string, string | undefined>;
}) {
  const view = useViewMonth(month);
  const now = currentMonth();
  if (view === now) return null;
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  const q = sp.toString();
  const sameYear = now.slice(0, 4) === view.slice(0, 4);
  const label = monthLabel(now, !sameYear).toLowerCase();
  return (
    <div className="flex justify-end px-4 pb-2 lg:px-0">
      <Link
        href={q ? `${basePath}?${q}` : basePath}
        scroll={false}
        className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3.5 py-1.5 text-[13px] font-semibold text-brand hover:bg-brand hover:text-white"
      >
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M9 14L4 9l5-5" />
          <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
        </svg>
        Voltar para {label}
      </Link>
    </div>
  );
}
