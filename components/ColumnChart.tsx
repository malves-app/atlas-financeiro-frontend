"use client";

import { useId, useRef, useState } from "react";
import { formatBRL, formatCompactBRL } from "@/lib/format";

// Gráfico de colunas em HTML: agrupado ou empilhado, com valores negativos abaixo do zero.
// Passar o mouse, tocar ou usar as setas do teclado mostra os valores de cada coluna.

export interface ChartSeries {
  key: string;
  label: string;
  color: string;
  /** Cor para valores negativos (ex.: saldo no vermelho) */
  negColor?: string;
  values: number[];
}

export interface ChartExtra {
  label: string;
  values: number[];
  format?: "brl" | "count";
}

function niceStep(raw: number) {
  const p = 10 ** Math.floor(Math.log10(raw));
  const f = raw / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}

export function ColumnChart({
  labels,
  titles,
  series,
  layout = "grouped",
  partial = [],
  extra = [],
  showTotal = false,
  height = 200,
  label,
  countWord = ["compra", "compras"],
}: {
  labels: string[];
  titles: string[];
  series: ChartSeries[];
  layout?: "grouped" | "stacked";
  partial?: boolean[];
  extra?: ChartExtra[];
  showTotal?: boolean;
  height?: number;
  label: string;
  countWord?: [string, string];
}) {
  const [active, setActive] = useState<number | null>(null);
  const [focusIdx, setFocusIdx] = useState(0);
  const cols = useRef<(HTMLDivElement | null)[]>([]);
  const id = useId();
  const n = labels.length;

  // Escala: do menor ao maior valor (incluindo o zero), arredondada para números redondos
  let hi = 0;
  let lo = 0;
  for (let i = 0; i < n; i++) {
    if (layout === "stacked") {
      hi = Math.max(hi, series.reduce((a, s) => a + Math.max(s.values[i] ?? 0, 0), 0));
      lo = Math.min(lo, series.reduce((a, s) => a + Math.min(s.values[i] ?? 0, 0), 0));
    } else {
      for (const s of series) {
        hi = Math.max(hi, s.values[i] ?? 0);
        lo = Math.min(lo, s.values[i] ?? 0);
      }
    }
  }
  if (hi === 0 && lo === 0) hi = 10000;
  const step = niceStep((hi - lo) / 4);
  const top = Math.ceil(hi / step) * step;
  const bottom = Math.floor(lo / step) * step;
  const range = top - bottom || 1;
  const ticks: number[] = [];
  for (let t = bottom; t <= top + step / 2; t += step) ticks.push(Math.round(t));
  const y = (v: number) => ((v - bottom) / range) * 100;
  const zero = y(0);

  const fmt = (v: number, f: ChartExtra["format"] = "brl") =>
    f === "count" ? `${v} ${v === 1 ? countWord[0] : countWord[1]}` : formatBRL(v);

  const describe = (i: number) =>
    `${titles[i]}: ` +
    [
      ...series.map((s) => `${s.label} ${formatBRL(s.values[i] ?? 0)}`),
      ...extra.map((e) => `${e.label} ${fmt(e.values[i] ?? 0, e.format)}`),
    ].join(", ");

  const moveFocus = (i: number) => {
    const j = Math.max(0, Math.min(n - 1, i));
    setFocusIdx(j);
    setActive(j);
    cols.current[j]?.focus();
  };

  const bar = (v: number, color: string, extraStyle: React.CSSProperties = {}) => {
    const h = Math.abs(y(v) - zero);
    return {
      position: "absolute" as const,
      left: 0,
      right: 0,
      bottom: `${v >= 0 ? zero : y(v)}%`,
      height: `${h}%`,
      minHeight: v !== 0 ? 2 : 0,
      background: color,
      borderRadius: v >= 0 ? "4px 4px 0 0" : "0 0 4px 4px",
      ...extraStyle,
    };
  };

  const tip = active != null ? active : null;
  const tipLeftSide = tip != null && tip >= n / 2;

  return (
    <figure className="select-none" aria-label={label}>
      {series.length > 1 && (
        <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-2" aria-hidden>
          {series.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-[3px]" style={{ background: s.color }} />
              {s.label}
            </li>
          ))}
        </ul>
      )}

      {/* Em telas largas o gráfico fica mais alto, para as colunas não ficarem achatadas */}
      <div
        className="relative h-[var(--h)] xl:h-[calc(var(--h)*1.3)] 2xl:h-[calc(var(--h)*1.5)]"
        style={{ "--h": `${height}px` } as React.CSSProperties}
        onPointerLeave={(e) => e.pointerType === "mouse" && setActive(null)}
      >
        {/* linhas de grade e valores do eixo */}
        {ticks.map((t) => (
          <div key={t} className="pointer-events-none absolute inset-x-0" style={{ bottom: `${y(t)}%` }} aria-hidden>
            <div className={`ml-12 border-t ${t === 0 ? "border-ink-3/50" : "border-line/80"}`} />
            <span className="num absolute left-0 w-10 translate-y-1/2 text-right text-[11px] leading-none text-ink-3" style={{ bottom: 0 }}>
              {formatCompactBRL(t).replace("R$ ", "")}
            </span>
          </div>
        ))}

        <div className="absolute inset-y-0 right-0 left-12 flex" role="list" aria-label={label}>
          {labels.map((_, i) => {
            const on = active === i;
            const faded = partial[i];
            let acc = 0;
            let stackTop = -1;
            if (layout === "stacked") series.forEach((s, si) => (s.values[i] ?? 0) > 0 && (stackTop = si));
            return (
              <div
                key={i}
                ref={(el) => {
                  cols.current[i] = el;
                }}
                role="listitem"
                tabIndex={i === focusIdx ? 0 : -1}
                aria-label={describe(i)}
                aria-describedby={on ? `${id}-tip` : undefined}
                className="relative h-full flex-1 cursor-default outline-none"
                onPointerEnter={(e) => e.pointerType === "mouse" && setActive(i)}
                onPointerDown={(e) => e.pointerType !== "mouse" && setActive(active === i ? null : i)}
                onFocus={() => {
                  setFocusIdx(i);
                  setActive(i);
                }}
                onBlur={() => setActive(null)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowRight") moveFocus(i + 1);
                  else if (e.key === "ArrowLeft") moveFocus(i - 1);
                  else if (e.key === "Home") moveFocus(0);
                  else if (e.key === "End") moveFocus(n - 1);
                  else return;
                  e.preventDefault();
                }}
              >
                <div className={`absolute inset-y-0 inset-x-[1px] rounded-md transition-colors ${on ? "bg-paper" : ""}`} aria-hidden />
                <div
                  className={`absolute inset-y-0 left-1/2 flex -translate-x-1/2 gap-[2px] ${layout === "stacked" ? "w-[56%] max-w-7" : "w-[78%] max-w-11"}`}
                  style={{ opacity: faded ? 0.5 : 1 }}
                  aria-hidden
                >
                  {layout === "stacked" ? (
                    <div className="relative h-full flex-1">
                      {series.map((s, si) => {
                        const v = Math.max(s.values[i] ?? 0, 0);
                        if (!v) return null;
                        const from = acc;
                        acc += v;
                        const b = y(from);
                        const h = y(acc) - b;
                        return (
                          <div
                            key={s.key}
                            style={{
                              position: "absolute",
                              left: 0,
                              right: 0,
                              bottom: `${b}%`,
                              height: `${h}%`,
                              background: s.color,
                              borderRadius: si === stackTop ? "4px 4px 0 0" : 0,
                              boxShadow: from > 0 ? "inset 0 -2px 0 var(--color-surface)" : undefined,
                            }}
                          />
                        );
                      })}
                    </div>
                  ) : (
                    series.map((s) => {
                      const v = s.values[i] ?? 0;
                      return (
                        <div key={s.key} className="relative h-full flex-1">
                          <div style={bar(v, v < 0 && s.negColor ? s.negColor : s.color)} />
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {tip != null && (
          <div
            id={`${id}-tip`}
            role="tooltip"
            className="pointer-events-none absolute top-1 z-10 rounded-xl bg-surface px-3 py-2.5 shadow-[0_6px_24px_-6px_rgba(23,32,51,0.28)] ring-1 ring-line"
            style={
              tipLeftSide
                ? { right: `calc((100% - 3rem) * ${(n - tip) / n} + 4px)` }
                : { left: `calc(3rem + (100% - 3rem) * ${(tip + 1) / n} + 4px)` }
            }
          >
            <p className="text-[12px] font-semibold text-ink-2">
              {titles[tip]}
              {partial[tip] && <span className="font-normal text-ink-3"> (em andamento)</span>}
            </p>
            <ul className="mt-1 space-y-0.5">
              {series.map((s) => {
                const v = s.values[tip] ?? 0;
                return (
                  <li key={s.key} className="flex items-center gap-2 text-[13px] whitespace-nowrap">
                    <span className="h-[3px] w-3 rounded-full" style={{ background: v < 0 && s.negColor ? s.negColor : s.color }} aria-hidden />
                    <span className="num font-semibold text-ink">{formatBRL(v)}</span>
                    <span className="text-ink-3">{s.label}</span>
                  </li>
                );
              })}
              {showTotal && (
                <li className="flex items-center gap-2 border-t border-line pt-1 text-[13px] whitespace-nowrap">
                  <span className="w-3" aria-hidden />
                  <span className="num font-semibold text-ink">{formatBRL(series.reduce((a, s) => a + (s.values[tip] ?? 0), 0))}</span>
                  <span className="text-ink-3">no total</span>
                </li>
              )}
              {extra.map((e) => (
                <li key={e.label} className="flex items-center gap-2 text-[13px] whitespace-nowrap">
                  <span className="w-3" aria-hidden />
                  <span className="num font-semibold text-ink">{fmt(e.values[tip] ?? 0, e.format)}</span>
                  <span className="text-ink-3">{e.label}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="mt-1.5 ml-12 flex" aria-hidden>
        {labels.map((l, i) => (
          <span key={i} className={`flex-1 text-center text-[11px] ${active === i ? "font-semibold text-ink" : "text-ink-3"}`}>
            {l}
          </span>
        ))}
      </div>
    </figure>
  );
}
