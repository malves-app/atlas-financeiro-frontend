"use client";

import { useActionState, useState } from "react";
import { archiveCategoryAction, archivePaymentMethodAction, importSheetAction, saveCategory, savePaymentMethod } from "@/app/actions";
import { centsToInput, formatBRL, monthLabel, PAYMENT_COLORS } from "@/lib/format";

export function CategoryRow({ c }: { c?: { id: number; name: string; emoji: string; budgetCents: number | null } }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(async (prev: Awaited<ReturnType<typeof saveCategory>>, f: FormData) => {
    const r = await saveCategory(prev, f);
    if (!r?.error) setOpen(false);
    return r;
  }, undefined);

  if (!open) {
    return c ? (
      <button type="button" onClick={() => setOpen(true)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-paper/60">
        <span className="grid size-9 place-items-center rounded-full bg-paper text-[17px]" aria-hidden>
          {c.emoji}
        </span>
        <span className="flex-1 text-[15px] font-medium">{c.name}</span>
        <span className="text-[13px] text-ink-3 num">{c.budgetCents != null ? `Previsto ${formatBRL(c.budgetCents)}` : "Sem previsão"}</span>
      </button>
    ) : (
      <button type="button" onClick={() => setOpen(true)} className="w-full px-4 py-3 text-left text-[15px] font-semibold text-brand">
        Nova categoria
      </button>
    );
  }

  const input = "rounded-xl border border-line bg-surface px-3 py-2.5 outline-none focus:border-brand";
  return (
    <div className="bg-paper/60 px-4 py-3">
      <form action={action} className="grid grid-cols-[3.5rem_1fr] gap-2">
        {c && <input type="hidden" name="id" value={c.id} />}
        <input name="emoji" defaultValue={c?.emoji ?? ""} aria-label="Emoji" placeholder="🏷️" className={`${input} text-center`} />
        <input name="name" defaultValue={c?.name ?? ""} aria-label="Nome da categoria" placeholder="Ex.: Pets, Academia" required className={input} autoFocus />
        <label className="col-span-2 block">
          <span className="mb-1 block text-[13px] text-ink-2">Quanto você prevê gastar por mês (opcional)</span>
          <input
            name="budget"
            inputMode="decimal"
            defaultValue={c?.budgetCents != null ? centsToInput(c.budgetCents) : ""}
            placeholder="Ex.: 1.200,00"
            className={`${input} w-full num`}
          />
        </label>
        {state?.error && <p className="col-span-2 text-[14px] font-medium text-danger">{state.error}</p>}
        <div className="col-span-2 flex gap-2">
          <button type="submit" disabled={pending} className="flex-1 rounded-full bg-ink py-2.5 text-[15px] font-semibold text-white">
            Salvar
          </button>
          <button type="button" onClick={() => setOpen(false)} className="rounded-full border border-line bg-surface px-4 py-2.5 text-[15px] font-semibold">
            Cancelar
          </button>
        </div>
      </form>
      {c && (
        <form action={archiveCategoryAction} className="mt-2">
          <input type="hidden" name="id" value={c.id} />
          <button type="submit" className="text-[14px] font-medium text-danger">
            Remover categoria (os lançamentos antigos continuam com ela)
          </button>
        </form>
      )}
    </div>
  );
}

export function PaymentMethodRow({
  m,
  usedColors,
}: {
  m?: { id: number; name: string; isCredit: boolean; closingDay: number | null; color: string };
  usedColors: string[];
}) {
  const [open, setOpen] = useState(false);
  const [isCredit, setIsCredit] = useState(m?.isCredit ?? false);
  const [color, setColor] = useState(m?.color ?? PAYMENT_COLORS.find((c) => !usedColors.includes(c)) ?? PAYMENT_COLORS[0]);
  const [state, action, pending] = useActionState(async (prev: Awaited<ReturnType<typeof savePaymentMethod>>, f: FormData) => {
    const r = await savePaymentMethod(prev, f);
    if (!r?.error) setOpen(false);
    return r;
  }, undefined);

  if (!open) {
    return m ? (
      <button type="button" onClick={() => setOpen(true)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-paper/60">
        <span className="size-3 shrink-0 rounded-full" style={{ background: m.color }} aria-hidden />
        <span className="flex-1 text-[15px] font-medium">{m.name}</span>
        <span className="text-[13px] text-ink-3">
          {m.isCredit ? (m.closingDay ? `Cartão, fecha dia ${m.closingDay}` : "Cartão de crédito") : "Débito na hora"}
        </span>
      </button>
    ) : (
      <button type="button" onClick={() => setOpen(true)} className="w-full px-4 py-3 text-left text-[15px] font-semibold text-brand">
        Nova forma de pagamento
      </button>
    );
  }

  const input = "rounded-xl border border-line bg-surface px-3 py-2.5 outline-none focus:border-brand";
  return (
    <div className="bg-paper/60 px-4 py-3">
      <form action={action} className="space-y-3">
        {m && <input type="hidden" name="id" value={m.id} />}
        <input type="hidden" name="color" value={color} />
        <input
          name="name"
          defaultValue={m?.name ?? ""}
          aria-label="Nome da forma de pagamento"
          placeholder="Ex.: Pix, Nubank, Dinheiro"
          required
          autoFocus
          className={`${input} w-full`}
        />
        <label className="flex items-center gap-3 text-[15px]">
          <input
            type="checkbox"
            name="isCredit"
            checked={isCredit}
            onChange={(e) => setIsCredit(e.target.checked)}
            className="size-5 accent-[#0b7a6b]"
          />
          É cartão de crédito (tem fatura)
        </label>
        {isCredit && (
          <label className="flex items-center gap-2 text-[15px]">
            Fecha no dia
            <input
              name="closingDay"
              type="number"
              min={1}
              max={31}
              defaultValue={m?.closingDay ?? 25}
              className={`${input} num w-20 text-center`}
            />
            <span className="text-[13px] text-ink-3">compras depois entram no mês seguinte</span>
          </label>
        )}
        <fieldset>
          <legend className="mb-1.5 text-[13px] text-ink-2">Cor</legend>
          <div className="flex flex-wrap gap-2">
            {PAYMENT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Cor ${c}`}
                aria-pressed={color === c}
                onClick={() => setColor(c)}
                className={`size-8 rounded-full border-2 ${color === c ? "border-ink" : "border-transparent"}`}
                style={{ background: c }}
              />
            ))}
          </div>
        </fieldset>
        {state?.error && <p className="text-[14px] font-medium text-danger">{state.error}</p>}
        <div className="flex gap-2">
          <button type="submit" disabled={pending} className="flex-1 rounded-full bg-ink py-2.5 text-[15px] font-semibold text-white">
            Salvar
          </button>
          <button type="button" onClick={() => setOpen(false)} className="rounded-full border border-line bg-surface px-4 py-2.5 text-[15px] font-semibold">
            Cancelar
          </button>
        </div>
      </form>
      {m && (
        <form action={archivePaymentMethodAction} className="mt-2">
          <input type="hidden" name="id" value={m.id} />
          <button type="submit" className="text-[14px] font-medium text-danger">
            Remover (os lançamentos antigos continuam com ela)
          </button>
        </form>
      )}
    </div>
  );
}

export function ImportForm() {
  const [state, action, pending] = useActionState(importSheetAction, undefined);
  return (
    <form action={action} className="space-y-3 px-4 pb-4">
      <label className="block">
        <span className="mb-1 block text-[13px] text-ink-2">Link da planilha (compartilhada como “qualquer pessoa com o link”)</span>
        <input
          name="sheet"
          required
          inputMode="url"
          placeholder="https://docs.google.com/spreadsheets/d/…"
          className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-[14px] outline-none focus:border-brand"
        />
      </label>
      <label className="flex items-start gap-3 text-[14px]">
        <input type="checkbox" name="confirm" className="mt-0.5 size-5 accent-[#0b7a6b]" />
        <span>Entendi: isso apaga os lançamentos do site e recria tudo a partir da planilha.</span>
      </label>
      <button type="submit" disabled={pending} className="w-full rounded-full bg-ink py-3 text-[15px] font-semibold text-white disabled:opacity-60 lg:w-auto lg:px-8">
        {pending ? "Importando… (leva alguns segundos)" : "Importar planilha"}
      </button>
      {state?.error && <p role="alert" className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-[14px] font-medium text-danger">{state.error}</p>}
      {state?.report && (
        <div className="rounded-xl bg-brand-soft p-3 text-[14px]">
          <p className="font-semibold">
            Importado: {state.report.months.length} meses, {state.report.recurring} fixos e {state.report.categories} categorias.
          </p>
          <ul className="mt-2 space-y-0.5">
            {state.report.months.map((m) => (
              <li key={m.month} className="flex justify-between gap-2">
                <span>{monthLabel(m.month)}</span>
                <span className={m.ok ? "text-brand" : "text-danger"}>
                  {m.entries} gastos, {m.incomes} entradas {m.ok ? "✓" : "⚠ totais diferentes"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </form>
  );
}
