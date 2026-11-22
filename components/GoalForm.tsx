"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { saveGoal } from "@/app/actions";
import { centsText } from "@/lib/money-mask";
import {
  formatBRL0,
  goalKey,
  GOAL_KINDS,
  KIND_INFO,
  monthNameLower,
  suggestedValue,
  type Averages,
  type GoalKind,
  type GoalPeriod,
} from "@/lib/goals";
import { AmountField, Segmented, type CategoryOption, type FormMode } from "./EntryForm";
import { LogoLoader } from "./LogoLoader";
import { useCloseOnSaved } from "./Modal";

export interface GoalFormGoal {
  id: number;
  kind: GoalKind;
  period: GoalPeriod;
  categoryId: number | null;
  targetCents: number;
  startMonth: string;
  name: string;
  emoji: string;
  sub: string;
}

/** Criar uma meta (tipo, categoria, mês ou ano e o valor) ou mudar o valor de uma meta. */
export function GoalForm({
  month,
  currentYear,
  categories,
  existing,
  avg,
  initialKind = "total",
  goal,
  mode = "page",
}: {
  /** Mês na tela: a meta do mês começa nele. */
  month: string;
  currentYear: number;
  categories: CategoryOption[];
  /** Metas que já valem (chave → id), para não criar outra igual. */
  existing: { id: number; key: string; startMonth?: string }[];
  avg: Averages | null;
  initialKind?: GoalKind;
  goal?: GoalFormGoal;
  /** "modal": aberto na janela (fecha ao criar). */
  mode?: FormMode;
}) {
  const [state, action, pending] = useActionState(saveGoal, undefined);
  useCloseOnSaved(state, "meta");
  const [kind, setKind] = useState<GoalKind>(goal?.kind ?? initialKind);
  const [periodChoice, setPeriod] = useState<GoalPeriod>(goal?.period ?? "mes");
  const monthYear = Number(month.slice(0, 4));
  const [year, setYear] = useState(goal ? Number(goal.startMonth.slice(0, 4)) : Math.max(monthYear, currentYear));
  const [categoryId, setCategoryId] = useState<number | null>(goal?.categoryId ?? null);
  const [cents, setCents] = useState(goal?.targetCents ?? 0);

  const info = KIND_INFO[kind];
  const period: GoalPeriod = info.annual ? periodChoice : "mes";
  const annual = period === "ano";
  const cat = categoryId != null ? categories.find((c) => c.id === categoryId) : undefined;
  const key = goalKey({ kind, period, categoryId: kind === "categoria" ? categoryId : null });
  const conflict = !goal && (kind !== "categoria" || categoryId != null) ? existing.find((e) => e.key === (annual ? `${key}@${year}` : key)) : undefined;
  const takenCategories = new Set(
    existing.filter((e) => e.key.startsWith(`categoria|${period}|`) && (!annual || e.key.endsWith(`@${year}`))).map((e) => Number(e.key.split("|")[2].split("@")[0])),
  );
  const years = [...new Set([currentYear, currentYear + 1, monthYear])].sort();
  const monthName = monthNameLower(month);

  // Sugestão: a média dos últimos meses (e 10% a menos/a mais), para partir de um número real
  const ref = kind === "categoria" && categoryId == null ? null : suggestedValue(avg, kind, categoryId, period);
  const round = (c: number) => Math.max(100, Math.round(c / 10000) * 10000);
  const chips: { label: string; cents: number }[] = [];
  if (ref != null && ref > 0) {
    chips.push({ label: info.saving ? (annual ? "Média de sobra × 12" : "Média que sobrou") : annual ? "Média × 12" : "Média", cents: round(ref) });
    chips.push({ label: info.saving ? "10% a mais" : "10% a menos", cents: round(info.saving ? ref * 1.1 : ref * 0.9) });
  }

  const amountLabel = info.saving
    ? annual
      ? `Quanto guardar em ${year}?`
      : "Quanto guardar por mês?"
    : annual
      ? `Quanto gastar no máximo em ${year}?`
      : "Quanto gastar no máximo por mês?";

  const v = <strong className="num font-semibold text-ink">{formatBRL0(cents)}</strong>;
  const when = annual ? (
    <>em {year}</>
  ) : (
    <>por mês, de {goal && goal.startMonth < month ? monthName : monthNameLower(goal?.startMonth ?? month)} em diante</>
  );
  const preview =
    kind === "guardar" ? (
      <>Guardar {v} {when}: o que sobra depois de todos os gastos.</>
    ) : kind === "categoria" ? (
      cat || goal ? (
        <>
          Gastar até {v} em {goal ? goal.emoji : cat!.emoji} {goal ? goal.name : cat!.name} {when}.
        </>
      ) : (
        <>Escolha a categoria.</>
      )
    ) : kind === "dia_a_dia" ? (
      <>Gastar até {v} no dia a dia {when}, sem contar fixos e parcelas.</>
    ) : kind === "cartao" ? (
      <>Fatura do cartão de até {v} {when}.</>
    ) : (
      <>Gastar no máximo {v} {when}, somando fixos, cartão e dia a dia.</>
    );

  return (
    <form action={action} className={mode === "modal" ? "pb-[calc(env(safe-area-inset-bottom)+24px)]" : "pb-6"}>
      <input type="hidden" name="mode" value={mode} />
      {goal && <input type="hidden" name="id" value={goal.id} />}
      <input type="hidden" name="month" value={month} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="period" value={period} />
      <input type="hidden" name="year" value={year} />
      {kind === "categoria" && categoryId != null && <input type="hidden" name="categoryId" value={categoryId} />}
      <input type="hidden" name="amount" value={centsText(cents)} />

      <div className={goal ? "hidden" : "space-y-6 px-5 pt-2"}>
        {/* Ao editar, o tipo não muda: a página mostra a meta em cima */}
        {!goal && (
          <fieldset>
            <legend className="mb-2 text-[14px] font-medium text-ink-2">Que tipo de meta?</legend>
            <div role="radiogroup" aria-label="Tipo de meta" className="grid grid-cols-2 gap-2 lg:grid-cols-3">
              {GOAL_KINDS.map((k) => {
                const it = KIND_INFO[k];
                const on = k === kind;
                return (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setKind(k)}
                    className={`flex flex-col items-start gap-2 rounded-2xl bg-surface p-3 text-left transition-[box-shadow,transform] duration-200 last:col-span-2 lg:last:col-span-1 ${
                      on ? "shadow-[0_8px_22px_-14px_rgba(23,32,51,0.5)] ring-2 ring-ink" : "ring-1 ring-line hover:ring-ink-3/40"
                    }`}
                  >
                    <span className="flex w-full items-center justify-between">
                      <span className="grid size-9 place-items-center rounded-full text-[18px]" style={{ background: `${it.color}1f` }} aria-hidden>
                        {it.emoji}
                      </span>
                      <span
                        className={`grid size-5 place-items-center rounded-full border-2 transition-colors ${on ? "border-ink bg-ink" : "border-line"}`}
                        aria-hidden
                      >
                        {on && <span className="size-1.5 rounded-full bg-white" />}
                      </span>
                    </span>
                    <span>
                      <span className="block text-[15px] leading-tight font-semibold">{it.title}</span>
                      <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-3">{it.desc}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}

        {!goal && kind === "categoria" && (
          <fieldset>
            <legend className="mb-2 text-[14px] font-medium text-ink-2">Categoria</legend>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => {
                const selected = categoryId === c.id;
                const taken = takenCategories.has(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setCategoryId(selected ? null : c.id)}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-[14px] font-medium transition-colors ${
                      selected ? "bg-ink text-white" : "bg-surface ring-1 ring-line hover:ring-ink-3/40"
                    }`}
                  >
                    <span aria-hidden>{c.emoji}</span>
                    {c.name}
                    {taken && (
                      <span className={`text-[12px] ${selected ? "text-white/70" : "text-brand"}`} title="Já tem meta">
                        ✓<span className="sr-only"> (já tem meta)</span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}

        {!goal && info.annual && (
          <div>
            <span className="mb-2 block text-[14px] font-medium text-ink-2">Período</span>
            <Segmented
              label="Período da meta"
              options={[
                ["mes", "Todo mês"],
                ["ano", "No ano"],
              ]}
              value={period}
              onChange={setPeriod}
              track="bg-surface ring-1 ring-line/80"
            />
            {annual && (
              <div className="mt-2.5 flex gap-2">
                {years.map((y) => (
                  <button
                    key={y}
                    type="button"
                    aria-pressed={year === y}
                    onClick={() => setYear(y)}
                    className={`num rounded-full px-3.5 py-1.5 text-[14px] font-semibold ${year === y ? "bg-ink text-white" : "bg-surface text-ink-2 ring-1 ring-line"}`}
                  >
                    {y}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className={`${goal ? "mt-1" : "mt-6"} mx-3 rounded-[24px] bg-surface/70 pt-4 lg:mx-5`}>
        <AmountField
          cents={cents}
          onChange={setCents}
          negative={false}
          onNegativeChange={() => {}}
          allowNegative={false}
          autoFocus={!!goal}
          tone={info.saving ? "brand" : "ink"}
          label={amountLabel}
        />
        {chips.length > 0 && (
          <div className="-mt-2 flex flex-wrap justify-center gap-2 px-5 pb-5">
            {chips.map((c) => (
              <button
                key={c.label}
                type="button"
                onClick={() => setCents(c.cents)}
                aria-pressed={cents === c.cents}
                className={`rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors ${
                  cents === c.cents ? "bg-ink text-white" : "bg-surface text-ink-2 ring-1 ring-line hover:ring-ink-3/40"
                }`}
              >
                {c.label} <span className="num font-semibold">{formatBRL0(c.cents)}</span>
              </button>
            ))}
            <p className="w-full text-center text-[12px] text-ink-3">
              {avg && `Com base ${avg.months === 1 ? "no último mês fechado" : `nos últimos ${avg.months} meses fechados`}`}
            </p>
          </div>
        )}
      </div>

      <div className="mt-5 space-y-4 px-5">
        {cents > 0 && (
          <p className="rounded-2xl bg-brand-soft/70 px-4 py-3 text-[14px] leading-relaxed text-ink-2">
            {kind !== "categoria" && (
              <span aria-hidden className="mr-1.5">
                {info.emoji}
              </span>
            )}
            {preview}
            {goal && goal.period === "mes" && goal.startMonth < month && (
              <span className="mt-1 block text-[13px] text-ink-3">Os meses antes de {monthName} continuam com o valor antigo.</span>
            )}
          </p>
        )}

        {conflict && (
          <p role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#fcefd9] px-4 py-3 text-[14px] text-[#8f5208]">
            <span>
              Você já tem essa meta
              {annual
                ? ` em ${year}`
                : conflict.startMonth && conflict.startMonth > month
                  ? ` a partir de ${monthNameLower(conflict.startMonth)}${conflict.startMonth.slice(0, 4) !== month.slice(0, 4) ? ` de ${conflict.startMonth.slice(0, 4)}` : ""}`
                  : ` em ${monthName}`}
              .
            </span>
            <Link
              href={`/metas/${conflict.id}?m=${conflict.startMonth && conflict.startMonth > month ? conflict.startMonth : month}`}
              className="font-semibold underline underline-offset-2"
            >
              Abrir para mudar o valor
            </Link>
          </p>
        )}

        {state?.error && (
          <p role="alert" className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-[14px] font-medium text-danger">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending || !!conflict}
          aria-busy={pending || undefined}
          className="flex w-full items-center justify-center gap-2.5 rounded-full bg-ink py-3.5 text-[16px] font-semibold text-white transition-opacity disabled:opacity-50 aria-busy:opacity-90"
        >
          {pending && <LogoLoader className="size-5" />}
          {pending ? "Salvando…" : goal ? "Salvar meta" : "Criar meta"}
        </button>
      </div>
    </form>
  );
}
