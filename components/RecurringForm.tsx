"use client";

import { useActionState, useState } from "react";
import { saveRecurring } from "@/app/actions";
import { centsToInput } from "@/lib/format";
import { PaymentPicker, SubcategoryChips, defaultMethodId, type CategoryOption, type PaymentMethodOption } from "./EntryForm";
import { LogoLoader } from "./LogoLoader";

export function RecurringForm({
  categories,
  methods,
  month,
  recurring,
}: {
  categories: CategoryOption[];
  methods: PaymentMethodOption[];
  month: string;
  recurring?: {
    id: number;
    kind: "fixo" | "cartao";
    name: string;
    amountCents: number;
    day: number | null;
    paymentMethodId: number | null;
    categoryId: number | null;
    subcategoryId?: number | null;
    installments: number | null;
  };
}) {
  const [state, action, pending] = useActionState(saveRecurring, undefined);
  const [kind, setKind] = useState<"fixo" | "cartao">(recurring?.kind ?? "fixo");
  const [mode, setMode] = useState<"mensal" | "parcelado">(recurring?.installments ? "parcelado" : "mensal");
  const creditMethods = methods.filter((m) => m.isCredit);
  const methodsFor = (k: "fixo" | "cartao") => (k === "cartao" && creditMethods.length ? creditMethods : methods);
  const firstFor = (k: "fixo" | "cartao") =>
    k === "cartao" ? defaultMethodId(methodsFor(k)) : (methods.find((m) => !m.isCredit) ?? methods[0])?.id ?? null;
  const [paymentId, setPaymentId] = useState<number | null>(recurring ? recurring.paymentMethodId : firstFor("fixo"));
  const [categoryId, setCategoryId] = useState<number | null>(recurring?.categoryId ?? null);
  const [subcategoryId, setSubcategoryId] = useState<number | null>(recurring?.subcategoryId ?? null);
  const selectedCategory = categories.find((c) => c.id === categoryId);
  const [amount, setAmount] = useState(recurring ? centsToInput(recurring.amountCents) : "");

  const input = "w-full rounded-2xl border border-line bg-surface px-4 py-3 outline-none focus:border-brand";
  const seg = (active: boolean) =>
    `rounded-full px-3 py-2 text-center text-[15px] font-semibold ${active ? "bg-surface text-ink shadow-sm" : "text-ink-2"}`;

  return (
    <form action={action} className="space-y-5 px-5 pt-2">
      {recurring && <input type="hidden" name="id" value={recurring.id} />}
      <input type="hidden" name="month" value={month} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="mode" value={mode} />
      {paymentId != null && <input type="hidden" name="paymentMethodId" value={paymentId} />}
      {categoryId != null && <input type="hidden" name="categoryId" value={categoryId} />}
      {categoryId != null && subcategoryId != null && <input type="hidden" name="subcategoryId" value={subcategoryId} />}

      {!recurring && (
        <div>
          <span className="mb-2 block text-[14px] font-medium text-ink-2">Onde entra</span>
          <div className="grid grid-cols-2 gap-1 rounded-full bg-paper p-1">
            <button
              type="button"
              className={seg(kind === "fixo")}
              onClick={() => {
                setKind("fixo");
                setPaymentId(firstFor("fixo"));
              }}
              aria-pressed={kind === "fixo"}
            >
              Conta do mês
            </button>
            <button
              type="button"
              className={seg(kind === "cartao")}
              onClick={() => {
                setKind("cartao");
                setPaymentId(firstFor("cartao"));
              }}
              aria-pressed={kind === "cartao"}
            >
              Cartão de crédito
            </button>
          </div>
          <p className="mt-1.5 text-[13px] text-ink-3">
            {kind === "fixo"
              ? "Aluguel, condomínio, plano de saúde, luz: contas que você paga e marca como pagas."
              : "Assinaturas e compras parceladas que caem na fatura todo mês."}
          </p>
        </div>
      )}

      <label className="block">
        <span className="mb-2 block text-[14px] font-medium text-ink-2">Nome</span>
        <input name="name" defaultValue={recurring?.name} required placeholder="Ex.: Aluguel, Netflix, Ótica" className={input} />
      </label>

      <div className="grid grid-cols-[1fr_7rem] gap-3">
        <label className="block">
          <span className="mb-2 block text-[14px] font-medium text-ink-2">{mode === "parcelado" ? "Valor da parcela" : "Valor por mês"}</span>
          <input
            name="amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d,.\-]/g, ""))}
            required
            placeholder="0,00"
            className={`${input} num`}
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-[14px] font-medium text-ink-2">Dia</span>
          <input name="day" type="number" min={1} max={31} defaultValue={recurring?.day ?? ""} placeholder="10" className={`${input} num`} />
        </label>
      </div>

      <div>
        <span className="mb-2 block text-[14px] font-medium text-ink-2">Repetição</span>
        <div className="grid grid-cols-2 gap-1 rounded-full bg-paper p-1">
          <button type="button" className={seg(mode === "mensal")} onClick={() => setMode("mensal")} aria-pressed={mode === "mensal"}>
            Todo mês
          </button>
          <button type="button" className={seg(mode === "parcelado")} onClick={() => setMode("parcelado")} aria-pressed={mode === "parcelado"}>
            Parcelado
          </button>
        </div>
      </div>

      {mode === "parcelado" && (
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-2 block text-[14px] font-medium text-ink-2">Total de parcelas</span>
            <input
              name="installments"
              type="number"
              min={2}
              max={120}
              defaultValue={recurring?.installments ?? ""}
              required
              placeholder="10"
              className={`${input} num`}
            />
          </label>
          {!recurring && (
            <label className="block">
              <span className="mb-2 block text-[14px] font-medium text-ink-2">Parcela deste mês</span>
              <input name="currentNo" type="number" min={1} max={120} defaultValue={1} className={`${input} num`} />
            </label>
          )}
        </div>
      )}

      <div>
        <span className="mb-2 block text-[14px] font-medium text-ink-2">{kind === "cartao" ? "Cartão" : "Forma de pagamento"}</span>
        <PaymentPicker methods={methodsFor(kind)} value={paymentId} onChange={setPaymentId} />
      </div>

      <fieldset>
        <legend className="mb-2 text-[14px] font-medium text-ink-2">Categoria</legend>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => {
            const selected = categoryId === c.id;
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  setCategoryId(selected ? null : c.id);
                  setSubcategoryId(null);
                }}
                className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-[14px] font-medium ${
                  selected ? "bg-ink text-white" : "border border-line bg-surface hover:border-ink-3"
                }`}
              >
                <span aria-hidden>{c.emoji}</span>
                {c.name}
              </button>
            );
          })}
        </div>
        {selectedCategory && <SubcategoryChips category={selectedCategory} value={subcategoryId} onChange={setSubcategoryId} />}
      </fieldset>

      {state?.error && (
        <p role="alert" className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-[14px] font-medium text-danger">
          {state.error}
        </p>
      )}

      {recurring && (
        <p className="text-[13px] text-ink-3">As mudanças valem a partir deste mês, nos lançamentos ainda não pagos.</p>
      )}

      <button
        type="submit"
        disabled={pending}
        aria-busy={pending || undefined}
        className="flex w-full items-center justify-center gap-2.5 rounded-full bg-ink py-3.5 text-[16px] font-semibold text-white disabled:opacity-90"
      >
        {pending && <LogoLoader className="size-5" />}
        {pending ? "Salvando…" : recurring ? "Salvar fixo" : "Adicionar fixo"}
      </button>
    </form>
  );
}
