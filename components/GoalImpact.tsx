"use client";

import { formatBRL0, goalImpact, monthNameLower, type GoalHint } from "@/lib/goals";
import { TargetGlyph } from "./PageHeaders";

/**
 * No lançar gasto: como o gasto mexe nas metas do mês (a da categoria, do dia a dia, do cartão e do total).
 * A barra mostra o que já foi usado e, em outra cor, o que este gasto acrescenta. Some sem metas afetadas.
 */
export function GoalImpact({
  hints,
  month,
  categoryId,
  onCard,
  avulso,
  delta,
}: {
  hints: GoalHint[];
  month: string;
  categoryId: number | null;
  onCard: boolean;
  avulso: boolean;
  delta: number;
}) {
  const rows = goalImpact(hints, { month, categoryId, onCard, avulso, delta })
    // sem valor digitado, só a meta da categoria escolhida (como ela está agora)
    .filter((r) => delta !== 0 || r.kind === "categoria")
    .slice(0, 2);
  if (!rows.length) return null;
  return (
    <div aria-live="polite" className="rounded-2xl bg-surface px-4 py-3 ring-1 ring-line/70">
      <p className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold tracking-wide text-ink-3 uppercase">
        <TargetGlyph className="size-3.5" width={2.2} />
        Metas de {monthNameLower(month)}
      </p>
      <ul className="space-y-3">
        {rows.map((r) => {
          const scale = Math.max(r.target, r.after, r.used, 1);
          const used = Math.max(0, Math.min(r.used, r.after)) / scale;
          const added = Math.max(0, r.after - Math.max(r.used, 0)) / scale;
          const color = r.over ? "#c33d4b" : r.ratio >= 0.9 ? "#e39a2d" : "#12a08a";
          return (
            <li key={`${r.kind}${r.categoryId ?? ""}`}>
              <div className="flex items-baseline justify-between gap-3 text-[14px]">
                <span className="min-w-0 truncate font-medium">
                  <span aria-hidden>{r.emoji}</span> {r.name}
                </span>
                <span className={`shrink-0 text-[13px] ${r.over ? "font-semibold text-danger" : r.ratio >= 0.9 ? "font-semibold text-[#8f5208]" : "text-ink-2"}`}>
                  {r.over
                    ? delta > 0 && r.used <= r.target
                      ? `Com este gasto, passa ${formatBRL0(r.after - r.target)}`
                      : `Passou ${formatBRL0(r.after - r.target)}`
                    : `Sobram ${formatBRL0(r.target - r.after)}`}
                </span>
              </div>
              <div className="relative mt-1.5">
                <div className="flex h-2 gap-[2px] overflow-hidden rounded-full bg-paper" aria-hidden>
                  {used > 0 && <span className="h-full rounded-l-full bg-[#5b6b8c]" style={{ width: `${used * 100}%` }} />}
                  {added > 0 && (
                    <span
                      className="h-full rounded-r-full transition-[width] duration-300 motion-reduce:transition-none"
                      style={{ width: `${added * 100}%`, background: color }}
                    />
                  )}
                </div>
                {r.after > r.target && (
                  <span className="absolute inset-y-[-3px] w-[2px] rounded-full bg-ink" style={{ left: `${(r.target / scale) * 100}%` }} aria-hidden />
                )}
              </div>
              <p className="mt-1 text-[12px] text-ink-3">
                <span className="num">{formatBRL0(r.after)}</span> de <span className="num">{formatBRL0(r.target)}</span>
                {delta > 0 && <> · este gasto: <span className="num">{formatBRL0(delta)}</span></>}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
