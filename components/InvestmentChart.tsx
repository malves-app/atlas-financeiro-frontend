"use client";

import { useId, useState } from "react";
import { formatBRL, formatCompactBRL, monthLabel, monthShort } from "@/lib/format";
import { signedBRL, type SeriesPoint } from "@/lib/investments";

// Evolução dos investimentos mês a mês: área com o saldo e linha tracejada com o que foi aplicado
// (a distância entre as duas é o rendimento). Passar o mouse, tocar ou usar as setas mostra cada mês.

const TONES = {
  dark: {
    line: "#5fd3bf",
    area: "95,211,191",
    ref: "rgba(255,255,255,0.6)",
    grid: "rgba(255,255,255,0.09)",
    text: "text-white/55",
    cursor: "bg-white/35",
    tip: "bg-white text-ink shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)]",
    tipMuted: "text-ink-3",
    dotRing: "#172033",
  },
  light: {
    line: "#12a08a",
    area: "18,160,138",
    ref: "#7a839a",
    grid: "#eef1f5",
    text: "text-ink-3",
    cursor: "bg-ink/25",
    tip: "bg-ink text-white shadow-[0_10px_30px_-12px_rgba(23,32,51,0.7)]",
    tipMuted: "text-white/60",
    dotRing: "#ffffff",
  },
} as const;

export function EvolutionChart({
  points,
  tone = "dark",
  height = 128,
  label = "Evolução do saldo",
}: {
  points: SeriesPoint[];
  tone?: keyof typeof TONES;
  height?: number;
  label?: string;
}) {
  const t = TONES[tone];
  const [active, setActive] = useState<number | null>(null);
  const gid = useId().replace(/:/g, "");
  const n = points.length;
  if (n < 2) return null;

  const values = points.flatMap((p) => [p.balance, p.invested]);
  const lo = Math.min(0, ...values);
  const hi = Math.max(...values, 1) * 1.08;
  const H = 100;
  const x = (i: number) => (i / (n - 1)) * 1000;
  const y = (v: number) => H - ((v - lo) / (hi - lo)) * H;
  const pct = (i: number) => (i / (n - 1)) * 100;
  const line = (key: "balance" | "invested") => points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[key]).toFixed(2)}`).join("");
  const area = `${line("balance")}L1000,${y(lo)}L0,${y(lo)}Z`;
  const last = n - 1;
  const shown = active ?? null;
  const p = shown != null ? points[shown] : null;

  const pick = (clientX: number, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    const i = Math.round(((clientX - r.left) / r.width) * (n - 1));
    setActive(Math.max(0, Math.min(n - 1, i)));
  };

  return (
    <figure className="m-0">
      <figcaption className={`mb-2 flex items-center justify-end gap-3.5 text-[12px] font-medium ${t.text}`}>
        <span className="flex items-center gap-1.5">
          <span className="h-[2px] w-3.5 rounded-full" style={{ background: t.line }} aria-hidden />
          Saldo
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3.5 border-t-2 border-dashed" style={{ borderColor: t.ref }} aria-hidden />
          Aplicado
        </span>
      </figcaption>

      <div className="relative" style={{ height }}>
        <svg viewBox={`0 0 1000 ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
          <defs>
            <linearGradient id={`g${gid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={`rgb(${t.area})`} stopOpacity="0.34" />
              <stop offset="100%" stopColor={`rgb(${t.area})`} stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0.5, 1].map((f) => (
            <line key={f} x1="0" x2="1000" y1={H * f} y2={H * f} stroke={t.grid} strokeWidth="1" vectorEffect="non-scaling-stroke" />
          ))}
          <path d={area} fill={`url(#g${gid})`} />
          <path d={line("invested")} fill="none" stroke={t.ref} strokeWidth="1.5" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          <path d={line("balance")} fill="none" stroke={t.line} strokeWidth="2.25" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
        </svg>

        {/* Marcadores em HTML (o SVG estica na largura; círculos ficariam ovais) */}
        {shown != null && (
          <span className={`pointer-events-none absolute inset-y-0 w-px ${t.cursor}`} style={{ left: `${pct(shown)}%` }} aria-hidden />
        )}
        {[shown ?? last].map((i) => (
          <span
            key={i}
            className="pointer-events-none absolute size-[11px] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ left: `${pct(i)}%`, top: `${(y(points[i].balance) / H) * 100}%`, background: t.line, boxShadow: `0 0 0 2px ${t.dotRing}` }}
            aria-hidden
          />
        ))}

        {p && shown != null && (
          <div
            className={`pointer-events-none absolute -top-2 z-10 w-max min-w-40 rounded-xl px-3 py-2 text-[12.5px] leading-snug ${t.tip}`}
            style={{
              left: `${pct(shown)}%`,
              transform: `translate(${shown === 0 ? "-12px" : shown === last ? "calc(-100% + 12px)" : "-50%"}, -100%)`,
            }}
          >
            <p className="font-semibold">{monthLabel(p.month)}</p>
            <p className="num mt-0.5 flex justify-between gap-4">
              <span className={t.tipMuted}>Saldo</span>
              <span className="font-semibold">
                {formatBRL(p.balance)}
              </span>
            </p>
            <p className="num flex justify-between gap-4">
              <span className={t.tipMuted}>Aplicado</span>
              {formatBRL(p.invested)}
            </p>
            <p className="num flex justify-between gap-4">
              <span className={t.tipMuted}>Rendimento</span>
              {signedBRL(p.balance - p.invested)}
            </p>
          </div>
        )}

        <div
          tabIndex={0}
          role="group"
          aria-label={`${label}. Use as setas para ver cada mês.`}
          className="absolute -inset-x-1 -inset-y-2 cursor-crosshair touch-pan-y rounded-lg outline-offset-4"
          onPointerMove={(e) => pick(e.clientX, e.currentTarget)}
          onPointerDown={(e) => pick(e.clientX, e.currentTarget)}
          onPointerLeave={(e) => e.pointerType === "mouse" && setActive(null)}
          onFocus={() => setActive((a) => a ?? last)}
          onBlur={() => setActive(null)}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") setActive((a) => Math.max(0, (a ?? last) - 1));
            else if (e.key === "ArrowRight") setActive((a) => Math.min(last, (a ?? last) + 1));
            else if (e.key === "Escape") (e.currentTarget as HTMLElement).blur();
            else return;
            e.preventDefault();
          }}
        />
      </div>

      <div className={`mt-2 grid text-center text-[10.5px] font-medium uppercase ${t.text}`} style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, marginInline: `calc(-50% / ${n - 1})` }} aria-hidden>
        {points.map((pt, i) => (
          <span key={pt.month} className={`whitespace-nowrap ${n > 7 && (last - i) % 2 === 1 ? "invisible sm:visible" : ""}`}>
            {monthShort(pt.month)}
            {pt.month.endsWith("-01") && n > 1 ? <span className="normal-case"> {pt.month.slice(2, 4)}</span> : null}
          </span>
        ))}
      </div>

      <table className="sr-only">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th>Mês</th>
            <th>Saldo</th>
            <th>Aplicado</th>
          </tr>
        </thead>
        <tbody>
          {points.map((pt) => (
            <tr key={pt.month}>
              <td>{monthLabel(pt.month)}</td>
              <td>{formatCompactBRL(pt.balance)}</td>
              <td>{formatCompactBRL(pt.invested)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
