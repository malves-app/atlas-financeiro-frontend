"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { monthLabel, shiftMonth } from "@/lib/format";
import { startNavigation } from "./NavState";

type Range = { from: string; to: string };

/** Link da página de estatísticas para um período (sem parâmetros quando é o padrão). */
function periodHref(p: Range, def: Range) {
  return p.from === def.from && p.to === def.to ? "/estatisticas" : `/estatisticas?de=${p.from}&ate=${p.to}`;
}

/**
 * Filtro de período das estatísticas: mês inicial e final (inclusive).
 * Os dados são organizados por mês (faturas, fixos e entradas), então o intervalo é de meses.
 */
export function PeriodFilter({
  from,
  to,
  firstMonth,
  now,
}: {
  from: string;
  to: string;
  /** Primeiro mês com lançamentos: início da lista */
  firstMonth: string;
  now: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Mostra a escolha na hora, enquanto a página carrega (a página remonta o filtro quando o período muda)
  const [range, setRange] = useState<Range>({ from, to });

  const nowYear = Number(now.slice(0, 4));
  const def: Range = { from: `${nowYear}-01`, to: now };
  const go = (next: Range) => {
    setRange(next);
    const href = periodHref(next, def);
    // o conteúdo abaixo vira skeleton no toque (components/NavState.tsx)
    startNavigation(href);
    startTransition(() => router.push(href, { scroll: false }));
  };

  // Meses disponíveis, do mais recente ao mais antigo, agrupados por ano
  const start = [firstMonth, range.from, `${nowYear}-01`].sort()[0];
  const years: { year: string; months: string[] }[] = [];
  for (let m = now; m >= start; m = shiftMonth(m, -1)) {
    const y = m.slice(0, 4);
    if (years[years.length - 1]?.year !== y) years.push({ year: y, months: [] });
    years[years.length - 1].months.push(m);
  }

  const field = (label: string, value: string, onChange: (m: string) => void) => (
    <label className="relative block min-w-0 px-4 py-2.5 focus-within:bg-paper/60">
      <span className="block text-[12px] text-ink-3">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full cursor-pointer appearance-none truncate bg-transparent pr-6 text-[15px] font-semibold outline-none"
      >
        {years.map((g) => (
          <optgroup key={g.year} label={g.year}>
            {g.months.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <svg
        viewBox="0 0 24 24"
        className="pointer-events-none absolute right-3.5 bottom-3.5 size-4 text-ink-3"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </label>
  );

  return (
    <section aria-label="Período" className="mx-3 mb-3 lg:mx-0" aria-busy={pending || undefined}>
      <div className="grid grid-cols-2 divide-x divide-line overflow-hidden rounded-2xl bg-surface ring-1 ring-line lg:max-w-md">
        {field("De", range.from, (m) => go({ from: m, to: m > range.to ? m : range.to }))}
        {field("Até", range.to, (m) => go({ from: m < range.from ? m : range.from, to: m }))}
      </div>
    </section>
  );
}
