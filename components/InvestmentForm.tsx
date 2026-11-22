"use client";

import { useActionState, useState } from "react";
import { saveInvestment } from "@/app/actions";
import { centsText, nextCents } from "@/lib/money-mask";
import { INVESTMENT_KINDS, KIND_INFO, type InvestmentKind } from "@/lib/investments";
import { AmountField, type FormMode } from "./EntryForm";
import { LogoLoader } from "./LogoLoader";
import { useCloseOnSaved } from "./Modal";

export interface InvestmentFormValues {
  id: number;
  name: string;
  kind: InvestmentKind;
  institution: string | null;
  targetCents: number | null;
}

const field = "w-full rounded-2xl bg-surface px-4 py-3 ring-1 ring-line outline-none placeholder:text-ink-3/70 focus:ring-2 focus:ring-ink";

/** Criar um investimento (tipo, nome, onde está, quanto tem hoje e uma meta opcional) ou editar os dados dele. */
export function InvestmentForm({
  initialKind = "caixinha",
  institutions,
  investment,
  mode = "page",
}: {
  initialKind?: InvestmentKind;
  /** Bancos/corretoras já usados, para tocar em vez de digitar. */
  institutions: string[];
  investment?: InvestmentFormValues;
  /** "modal": aberto na janela (fecha ao criar). */
  mode?: FormMode;
}) {
  const [state, action, pending] = useActionState(saveInvestment, undefined);
  useCloseOnSaved(state, "investimento");
  const [kind, setKind] = useState<InvestmentKind>(investment?.kind ?? initialKind);
  const [name, setName] = useState(investment?.name ?? "");
  const [institution, setInstitution] = useState(investment?.institution ?? "");
  const [cents, setCents] = useState(0);
  const [hasTarget, setHasTarget] = useState(investment?.targetCents != null);
  const [target, setTarget] = useState(investment?.targetCents ?? 0);
  const info = KIND_INFO[kind];
  const chips = institutions.filter((i) => i.toLowerCase() !== institution.trim().toLowerCase()).slice(0, 8);

  return (
    <form action={action} className={mode === "modal" ? "pb-[calc(env(safe-area-inset-bottom)+24px)]" : "pb-8"}>
      <input type="hidden" name="mode" value={mode} />
      {investment && <input type="hidden" name="id" value={investment.id} />}
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="amount" value={centsText(cents)} />
      <input type="hidden" name="target" value={hasTarget && target > 0 ? centsText(target) : ""} />

      <div className="space-y-6 px-5 pt-2">
        <fieldset>
          <legend className="mb-2 text-[14px] font-medium text-ink-2">Tipo</legend>
          <div role="radiogroup" aria-label="Tipo de investimento" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {INVESTMENT_KINDS.map((k) => {
              const it = KIND_INFO[k];
              const on = k === kind;
              return (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setKind(k)}
                  className={`flex items-center gap-2.5 rounded-2xl bg-surface px-3 py-2.5 text-left transition-[box-shadow] duration-200 ${
                    on ? "shadow-[0_8px_22px_-14px_rgba(23,32,51,0.5)] ring-2 ring-ink" : "ring-1 ring-line hover:ring-ink-3/40"
                  }`}
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl text-[18px]" style={{ background: `${it.color}1f` }} aria-hidden>
                    {it.emoji}
                  </span>
                  <span className="min-w-0 text-[14px] leading-tight font-semibold">{it.label}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[13px] text-ink-3">{info.desc}</p>
        </fieldset>

        <label className="block">
          <span className="mb-2 block text-[14px] font-medium text-ink-2">Nome</span>
          <input
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            required
            autoComplete="off"
            placeholder={info.placeholder}
            className={field}
          />
        </label>

        <div>
          <label className="block">
            <span className="mb-2 block text-[14px] font-medium text-ink-2">
              Onde está <span className="font-normal text-ink-3">(opcional)</span>
            </span>
            <input
              name="institution"
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              maxLength={60}
              autoComplete="off"
              placeholder="Banco, corretora ou carteira"
              className={field}
            />
          </label>
          {chips.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {chips.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setInstitution(c)}
                  className="rounded-full bg-surface px-3 py-1.5 text-[13px] font-medium text-ink-2 ring-1 ring-line hover:ring-ink-3/40"
                >
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {!investment && (
        <div className="mx-3 mt-6 rounded-[24px] bg-surface/70 pt-4 lg:mx-5">
          <AmountField
            cents={cents}
            onChange={setCents}
            negative={false}
            onNegativeChange={() => {}}
            allowNegative={false}
            tone="brand"
            label="Quanto tem aí hoje?"
          />
          <p className="-mt-2 px-5 pb-5 text-center text-[13px] text-ink-3">
            Entra como o primeiro aporte. Daqui em diante, registre aportes, resgates e o saldo de vez em quando.
          </p>
        </div>
      )}

      <div className="mt-5 space-y-4 px-5">
        <div className="rounded-2xl bg-surface ring-1 ring-line">
          <label className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3.5">
            <span>
              <span className="block text-[15px] font-medium">Meta</span>
              <span className="block text-[13px] text-ink-3">Quanto quer juntar aqui (ex.: reserva de emergência)</span>
            </span>
            <input type="checkbox" checked={hasTarget} onChange={(e) => setHasTarget(e.target.checked)} className="peer sr-only" />
            <span
              aria-hidden
              className="relative h-[26px] w-[44px] shrink-0 rounded-full bg-line transition-colors duration-200 peer-checked:bg-brand peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand after:absolute after:top-[3px] after:left-[3px] after:size-5 after:rounded-full after:bg-white after:shadow after:transition-transform after:duration-200 peer-checked:after:translate-x-[18px]"
            />
          </label>
          {hasTarget && (
            <div className="flex items-baseline gap-2 border-t border-line/80 px-4 py-3">
              <span className="text-[15px] font-semibold text-ink-3">R$</span>
              <input
                inputMode="numeric"
                aria-label="Valor da meta"
                autoComplete="off"
                value={centsText(target)}
                onChange={(e) => setTarget(nextCents(target, e.target.value))}
                className="display num w-full bg-transparent text-[24px] font-bold outline-none"
              />
            </div>
          )}
        </div>

        {state?.error && (
          <p role="alert" className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-[14px] font-medium text-danger">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending || !name.trim()}
          aria-busy={pending || undefined}
          className="flex w-full items-center justify-center gap-2.5 rounded-full bg-ink py-3.5 text-[16px] font-semibold text-white transition-opacity disabled:opacity-40 aria-busy:opacity-90"
        >
          {pending && <LogoLoader className="size-5" />}
          {pending ? "Salvando…" : investment ? "Salvar" : "Criar investimento"}
        </button>
      </div>
    </form>
  );
}
