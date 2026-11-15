"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { saveEntry, saveIncome, type FormState } from "@/app/actions";
import { formatBRL, monthLabel, referenceMonth, shiftMonth } from "@/lib/format";
import { centsText, nextCents } from "@/lib/money-mask";

export interface CategoryOption {
  id: number;
  name: string;
  emoji: string;
}

export interface SuggestionOption {
  name: string;
  categoryId: number | null;
  paymentMethodId: number | null;
}

export interface PaymentMethodOption {
  id: number;
  name: string;
  color: string;
  isCredit: boolean;
  closingDay: number | null;
}

/** "page": tela inteira (redireciona ao salvar). "modal": janela/folha (fecha ao salvar). */
export type FormMode = "page" | "modal";

/** Forma de pagamento padrão para um gasto novo: o primeiro cartão de crédito, senão a primeira. */
export function defaultMethodId(methods: PaymentMethodOption[]): number | null {
  return (methods.find((m) => m.isCredit) ?? methods[0])?.id ?? null;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();


function shiftDate(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/* ---------------- peças ---------------- */

function caretToEnd(el: HTMLInputElement) {
  requestAnimationFrame(() => el.setSelectionRange(el.value.length, el.value.length));
}


/**
 * Valor com máscara de dinheiro: você digita só números e os centavos se ajustam sozinhos
 * (4 5 9 0 → 45,90), como nos apps de banco. Abre o teclado numérico no celular.
 */
function AmountField({
  cents,
  onChange,
  negative,
  onNegativeChange,
  autoFocus,
  accent = "ink",
  allowNegative = true,
}: {
  cents: number;
  onChange: (c: number) => void;
  negative: boolean;
  onNegativeChange: (v: boolean) => void;
  autoFocus?: boolean;
  accent?: "ink" | "brand";
  allowNegative?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  // cursor sempre no fim (inclusive quando o campo já vem focado ao abrir a página)
  useEffect(() => {
    const el = inputRef.current;
    if (el && document.activeElement === el) caretToEnd(el);
  });
  return (
    <div className="px-5 pt-1 pb-4">
      <label className="block">
        <span className="sr-only">Valor</span>
        <span
          className={`flex items-baseline gap-2 border-b-2 pb-1 ${accent === "brand" ? "border-brand" : "border-ink"} focus-within:border-brand`}
        >
          <span className="display text-[26px] font-semibold text-ink-3">{negative ? "−R$" : "R$"}</span>
          <input
            inputMode="numeric"
            autoComplete="off"
            aria-label="Valor em reais"
            value={centsText(cents)}
            ref={inputRef}
            onChange={(e) => onChange(nextCents(cents, e.target.value))}
            onFocus={(e) => caretToEnd(e.currentTarget)}
            onClick={(e) => caretToEnd(e.currentTarget)}
            autoFocus={autoFocus}
            data-autofocus={autoFocus ? "" : undefined}
            className={`display num w-full min-w-0 bg-transparent leading-tight font-bold outline-none ${
              cents === 0 ? "text-line" : negative ? "text-brand" : "text-ink"
            }`}
            style={{ fontStretch: "85%", fontSize: 46 }}
          />
        </span>
      </label>
      {allowNegative && (
        <button
          type="button"
          aria-pressed={negative}
          onClick={() => onNegativeChange(!negative)}
          className={`mt-2 rounded-full px-3 py-1 text-[13px] font-medium ${
            negative ? "bg-brand-soft text-brand" : "text-ink-3 hover:bg-paper"
          }`}
        >
          {negative ? "Estorno: entra como valor negativo" : "É um estorno?"}
        </button>
      )}
    </div>
  );
}

/** Escolha da forma de pagamento: botões com a cor de cada uma. */
export function PaymentPicker({
  methods,
  value,
  onChange,
}: {
  methods: PaymentMethodOption[];
  value: number | null;
  onChange: (id: number) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Forma de pagamento" className="flex flex-wrap gap-2">
      {methods.map((m) => {
        const selected = value === m.id;
        return (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(m.id)}
            className={`flex items-center gap-2 rounded-full px-3.5 py-2 text-[15px] font-semibold transition-colors ${
              selected ? "bg-ink text-white" : "border border-line bg-surface text-ink hover:border-ink-3"
            }`}
          >
            <span
              className="size-2.5 rounded-full"
              style={{ background: m.color, boxShadow: selected ? "0 0 0 2px rgba(255,255,255,.9)" : undefined }}
              aria-hidden
            />
            {m.name}
          </button>
        );
      })}
    </div>
  );
}

/** Categorias em grade de ícones (mais fácil de tocar no celular); as mais usadas primeiro. */
function CategoryGrid({
  categories,
  value,
  onChange,
}: {
  categories: CategoryOption[];
  value: number | null;
  onChange: (id: number | null) => void;
}) {
  const [all, setAll] = useState(false);
  const FIRST = 7;
  const visible = categories.filter((c, i) => all || i < FIRST || c.id === value);
  const tile = "flex min-w-0 flex-col items-center gap-1 rounded-2xl px-1 py-2.5 transition-colors";
  return (
    <fieldset>
      <legend className="mb-2 text-[14px] font-medium text-ink-2">Categoria</legend>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
        {visible.map((c) => {
          const selected = value === c.id;
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(selected ? null : c.id)}
              className={`${tile} ${selected ? "bg-ink text-white" : "bg-surface text-ink hover:bg-white/60 ring-1 ring-line"}`}
            >
              <span className="text-[22px] leading-none" aria-hidden>
                {c.emoji}
              </span>
              <span className="w-full truncate text-center text-[12px] font-medium">{c.name}</span>
            </button>
          );
        })}
        {categories.length > FIRST && (
          <button type="button" onClick={() => setAll(!all)} className={`${tile} border border-dashed border-ink-3/40 text-brand`}>
            <span className="text-[20px] leading-none font-semibold" aria-hidden>
              {all ? "−" : "+"}
            </span>
            <span className="text-[12px] font-semibold">{all ? "Menos" : `Mais ${categories.length - FIRST}`}</span>
          </button>
        )}
      </div>
    </fieldset>
  );
}

/** Data com atalhos: Hoje, Ontem ou outra data. */
function DateChips({ value, onChange, today, label }: { value: string; onChange: (v: string) => void; today: string; label: string }) {
  const yesterday = shiftDate(today, -1);
  const chip = (active: boolean) =>
    `rounded-full px-3.5 py-2 text-[15px] font-semibold ${active ? "bg-ink text-white" : "border border-line bg-surface text-ink hover:border-ink-3"}`;
  const other = value !== today && value !== yesterday;
  return (
    <div>
      <span className="mb-2 block text-[14px] font-medium text-ink-2">{label}</span>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={chip(value === today)} onClick={() => onChange(today)} aria-pressed={value === today}>
          Hoje
        </button>
        <button type="button" className={chip(value === yesterday)} onClick={() => onChange(yesterday)} aria-pressed={value === yesterday}>
          Ontem
        </button>
        <label className={`${chip(other)} relative flex items-center gap-1.5`}>
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <rect x="4" y="5" width="16" height="15" rx="2" />
            <path d="M8 3v4M16 3v4M4 10h16" strokeLinecap="round" />
          </svg>
          <input
            type="date"
            aria-label="Escolher outra data"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-[8.6rem] bg-transparent text-[15px] outline-none [color-scheme:light]"
          />
        </label>
      </div>
    </div>
  );
}

function FieldLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-2 block text-[14px] font-medium text-ink-2">
      {children}
    </label>
  );
}

function ErrorText({ state }: { state: FormState }) {
  if (!state?.error) return null;
  return (
    <p role="alert" className="mx-5 mt-4 rounded-xl bg-danger-soft px-3.5 py-2.5 text-[14px] font-medium text-danger">
      {state.error}
    </p>
  );
}

/** Mês em que o lançamento conta. Discreto: só chama atenção quando muda por causa da fatura. */
function MonthLine({
  value,
  computed,
  onChange,
  hint,
}: {
  value: string;
  computed: string;
  onChange: (m: string | null) => void;
  hint?: string;
}) {
  const options = [-2, -1, 0, 1, 2].map((d) => shiftMonth(computed, d));
  if (!options.includes(value)) options.push(value);
  return (
    <div className={`flex items-center justify-between gap-3 rounded-2xl px-4 py-2.5 ${hint ? "bg-brand-soft" : "bg-surface ring-1 ring-line"}`}>
      <div className="min-w-0 text-[14px]">
        <div className="text-ink-2">Conta no mês</div>
        {hint && <div className="text-[12px] font-medium text-brand">{hint}</div>}
      </div>
      <select
        aria-label="Mês em que o lançamento conta"
        value={value}
        onChange={(e) => onChange(e.target.value === computed ? null : e.target.value)}
        className="rounded-lg bg-transparent px-1 py-1 text-right font-semibold"
      >
        {options.sort().map((m) => (
          <option key={m} value={m}>
            {monthLabel(m)}
          </option>
        ))}
      </select>
    </div>
  );
}

function SubmitBar({ mode, children }: { mode: FormMode; children: React.ReactNode }) {
  return (
    <div
      className={
        mode === "modal"
          ? "sticky bottom-0 z-10 mt-6 flex gap-2 border-t border-line bg-paper/95 px-5 pt-3 pb-[max(env(safe-area-inset-bottom),12px)] backdrop-blur"
          : "sticky bottom-[calc(76px+env(safe-area-inset-bottom))] z-10 mt-6 flex gap-2 bg-paper/95 px-5 pt-3 pb-3 shadow-[0_-8px_16px_-12px_rgba(23,32,51,0.25)] backdrop-blur lg:bottom-0"
      }
    >
      {children}
    </div>
  );
}

/** Chama onDone quando a ação no modo modal termina com sucesso. */
function useDone(state: FormState, onDone?: (again: boolean) => void) {
  const last = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (state?.ok && state.at && state.at !== last.current) {
      last.current = state.at;
      onDone?.(!!state.again);
    }
  }, [state, onDone]);
}

/* ---------------- Gasto ---------------- */

export function ExpenseForm({
  categories,
  suggestions,
  methods,
  today,
  entry,
  back,
  hasRecurring,
  mode = "page",
  onDone,
}: {
  categories: CategoryOption[];
  suggestions: SuggestionOption[];
  methods: PaymentMethodOption[];
  today: string;
  back?: string;
  hasRecurring?: boolean;
  mode?: FormMode;
  onDone?: (again: boolean) => void;
  entry?: {
    id: number;
    kind: "fixo" | "cartao" | "avulso";
    name: string;
    amountCents: number;
    date: string | null;
    paymentMethodId: number | null;
    categoryId: number | null;
    month: string;
    paid: boolean | null;
    installmentNo: number | null;
    installmentTotal: number | null;
  };
}) {
  const [state, action, pending] = useActionState(saveEntry, undefined);
  useDone(state, onDone);
  const [cents, setCents] = useState(entry ? Math.abs(entry.amountCents) : 0);
  const [negative, setNegative] = useState(entry ? entry.amountCents < 0 : false);
  const [name, setName] = useState(entry?.name ?? "");
  const [paymentId, setPaymentId] = useState<number | null>(entry ? entry.paymentMethodId : defaultMethodId(methods));
  const method = methods.find((m) => m.id === paymentId);
  const [categoryId, setCategoryId] = useState<number | null>(entry?.categoryId ?? null);
  const [date, setDate] = useState(entry ? entry.date ?? "" : today);
  const [touchedCategory, setTouchedCategory] = useState(!!entry);
  const [nameFocused, setNameFocused] = useState(false);
  // Compra no crédito: à vista, parcelada ou fixa (repete todo mês)
  const [plan, setPlan] = useState<"avista" | "parcelado" | "fixa">("avista");
  const [installments, setInstallments] = useState(2);
  const canPlan = !entry && !!method?.isCredit && !negative;
  const activePlan = canPlan ? plan : "avista";

  const computed = date ? referenceMonth(date, method) : entry?.month ?? today.slice(0, 7);
  const [override, setOverride] = useState<string | null>(entry && entry.month !== computed ? entry.month : null);
  const month = override ?? computed;
  const shifted = method?.isCredit && date && computed !== date.slice(0, 7);

  const matches = useMemo(() => {
    const q = norm(name);
    if (!q) return suggestions.slice(0, 6);
    const starts = suggestions.filter((s) => norm(s.name).startsWith(q) && norm(s.name) !== q);
    const contains = suggestions.filter((s) => !norm(s.name).startsWith(q) && norm(s.name).includes(q));
    return [...starts, ...contains].slice(0, 6);
  }, [name, suggestions]);

  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const applySuggestion = (s: SuggestionOption) => {
    setName(s.name);
    if (s.paymentMethodId != null && methods.some((m) => m.id === s.paymentMethodId)) setPaymentId(s.paymentMethodId);
    if (s.categoryId != null) setCategoryId(s.categoryId);
    setTouchedCategory(true);
  };

  const onNameChange = (v: string) => {
    setName(v);
    if (!touchedCategory) {
      const exact = suggestions.find((s) => norm(s.name) === norm(v));
      if (exact) {
        if (exact.paymentMethodId != null && methods.some((m) => m.id === exact.paymentMethodId)) setPaymentId(exact.paymentMethodId);
        if (exact.categoryId != null) setCategoryId(exact.categoryId);
      }
    }
  };

  const isFixed = entry && entry.kind !== "avulso";
  const showPaid = isFixed && !method?.isCredit;
  const showSuggestions = !isFixed && matches.length > 0 && (nameFocused || !name);

  return (
    <form action={action}>
      {entry && <input type="hidden" name="id" value={entry.id} />}
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="back" value={back ?? ""} />
      <input type="hidden" name="month" value={month} />
      <input type="hidden" name="amount" value={(negative ? "-" : "") + centsText(cents)} />
      {paymentId != null && <input type="hidden" name="paymentMethodId" value={paymentId} />}
      {categoryId != null && <input type="hidden" name="categoryId" value={categoryId} />}
      <input type="hidden" name="plan" value={activePlan} />
      {activePlan === "parcelado" && <input type="hidden" name="installments" value={installments} />}

      <AmountField cents={cents} onChange={setCents} negative={negative} onNegativeChange={setNegative} autoFocus={!entry} />

      <div className="space-y-5 px-5">
        <div>
          <FieldLabel htmlFor="name">Descrição</FieldLabel>
          <input
            id="name"
            name="name"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            onFocus={() => setNameFocused(true)}
            onBlur={() => setTimeout(() => setNameFocused(false), 150)}
            autoComplete="off"
            autoCapitalize="sentences"
            enterKeyHint="done"
            placeholder="Ex.: Assaí, Uber, farmácia"
            required
            className="w-full rounded-2xl border border-line bg-surface px-4 py-3 outline-none focus:border-brand"
          />
          {showSuggestions && (
            <div className="-mx-5 mt-2 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] pointer-fine:flex-wrap pointer-fine:overflow-visible" aria-label="Sugestões">
              {matches.map((s) => (
                <button
                  key={s.name}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applySuggestion(s)}
                  className="flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[14px] hover:border-ink-3"
                >
                  <span aria-hidden>{s.categoryId != null ? catById.get(s.categoryId)?.emoji : "·"}</span>
                  {s.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <CategoryGrid
          categories={categories}
          value={categoryId}
          onChange={(id) => {
            setTouchedCategory(true);
            setCategoryId(id);
          }}
        />

        <div>
          <FieldLabel>Pagamento</FieldLabel>
          <PaymentPicker methods={methods} value={paymentId} onChange={setPaymentId} />
          {canPlan && (
            <div className="mt-3 rounded-2xl bg-surface p-3 ring-1 ring-line">
              <div role="radiogroup" aria-label="Tipo de compra no crédito" className="grid grid-cols-3 gap-1 rounded-full bg-paper p-1">
                {(
                  [
                    ["avista", "À vista"],
                    ["parcelado", "Parcelada"],
                    ["fixa", "Fixa"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={plan === id}
                    onClick={() => setPlan(id)}
                    className={`rounded-full py-2 text-[14px] font-semibold ${plan === id ? "bg-ink text-white" : "text-ink-2"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {plan === "parcelado" && (
                <div className="mt-3">
                  <div className="flex items-center gap-2">
                    <label htmlFor="installments" className="text-[14px] text-ink-2">
                      Em quantas vezes
                    </label>
                    <div className="ml-auto flex items-center rounded-full ring-1 ring-line">
                      <button
                        type="button"
                        aria-label="Menos uma parcela"
                        onClick={() => setInstallments((n) => Math.max(2, n - 1))}
                        className="grid size-9 place-items-center text-[18px] text-ink-2"
                      >
                        −
                      </button>
                      <input
                        id="installments"
                        inputMode="numeric"
                        value={installments}
                        onChange={(e) => {
                          const n = Number(e.target.value.replace(/\D/g, ""));
                          setInstallments(Number.isFinite(n) ? Math.min(Math.max(n, 0), 72) : 2);
                        }}
                        onBlur={() => setInstallments((n) => Math.max(2, n))}
                        className="num w-10 bg-transparent text-center text-[16px] font-semibold outline-none"
                      />
                      <button
                        type="button"
                        aria-label="Mais uma parcela"
                        onClick={() => setInstallments((n) => Math.min(72, n + 1))}
                        className="grid size-9 place-items-center text-[18px] text-ink-2"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {[2, 3, 4, 5, 6, 10, 12].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setInstallments(n)}
                        className={`num rounded-full px-3 py-1 text-[13px] font-medium ring-1 ${installments === n ? "bg-ink text-white ring-ink" : "ring-line text-ink-2"}`}
                      >
                        {n}x
                      </button>
                    ))}
                  </div>
                  <p className="mt-2.5 text-[13px] text-ink-2">
                    {cents > 0 && installments >= 2 ? (
                      <>
                        <span className="num font-semibold text-ink">
                          {installments}x de {formatBRL(Math.round(cents / installments))}
                        </span>{" "}
                        (o valor acima é o total). A 1ª parcela entra na fatura de {monthLabel(month, false).toLowerCase()} e as outras aparecem em
                        Fixos, na aba Cartão de crédito.
                      </>
                    ) : (
                      "Digite o valor total da compra; as parcelas aparecem em Fixos, na aba Cartão de crédito."
                    )}
                  </p>
                </div>
              )}
              {plan === "fixa" && (
                <p className="mt-2.5 text-[13px] text-ink-2">
                  Repete todo mês na fatura (assinaturas, por exemplo), a partir de {monthLabel(month, false).toLowerCase()}. Para parar, encerre em
                  Fixos.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <input type="hidden" name="date" value={date} />
          <DateChips value={date} onChange={setDate} today={today} label={isFixed ? "Vencimento" : "Data"} />
          <MonthLine
            value={month}
            computed={computed}
            onChange={setOverride}
            hint={shifted && !override ? `Depois do fechamento (dia ${method?.closingDay}): entra na próxima fatura` : undefined}
          />
        </div>

        {isFixed && (entry.installmentTotal != null || showPaid || hasRecurring) && (
          <div className="space-y-3 rounded-2xl bg-surface px-4 py-3 ring-1 ring-line">
            {entry.installmentTotal != null && (
              <p className="text-[14px] text-ink-2">
                Parcela {entry.installmentNo} de {entry.installmentTotal}
              </p>
            )}
            {showPaid && (
              <label className="flex items-center gap-3 text-[15px]">
                <input type="hidden" name="hasPaid" value="1" />
                <input type="checkbox" name="paid" defaultChecked={entry.paid === true} className="size-5 accent-[#0b7a6b]" />
                Pago
              </label>
            )}
            {hasRecurring && (
              <label className="flex items-start gap-3 text-[15px]">
                <input type="checkbox" name="applyFuture" className="mt-0.5 size-5 accent-[#0b7a6b]" />
                <span>
                  Usar estes dados nos próximos meses
                  <span className="block text-[13px] text-ink-3">Atualiza o fixo e os meses seguintes ainda não pagos.</span>
                </span>
              </label>
            )}
          </div>
        )}
      </div>

      <ErrorText state={state} />

      <SubmitBar mode={mode}>
        <button
          type="submit"
          disabled={pending}
          className="flex-1 rounded-full bg-ink py-3.5 text-[16px] font-semibold text-white disabled:opacity-60"
        >
          {pending
            ? "Salvando…"
            : entry
              ? "Salvar alterações"
              : activePlan === "parcelado"
                ? "Salvar parcelamento"
                : activePlan === "fixa"
                  ? "Salvar compra fixa"
                  : "Salvar gasto"}
        </button>
        {!entry && (
          <button
            type="submit"
            name="again"
            value="1"
            disabled={pending}
            className="rounded-full border border-line bg-surface px-4 py-3.5 text-[15px] font-semibold disabled:opacity-60"
          >
            <span className="sm:hidden">+ Outro</span>
            <span className="hidden sm:inline">Salvar e lançar outro</span>
          </button>
        )}
      </SubmitBar>
    </form>
  );
}

/* ---------------- Entrada ---------------- */

export function IncomeForm({
  suggestions,
  today,
  income,
  defaultMonth,
  back,
  mode = "page",
  onDone,
}: {
  suggestions: string[];
  today: string;
  defaultMonth: string;
  back?: string;
  mode?: FormMode;
  onDone?: (again: boolean) => void;
  income?: { id: number; name: string; amountCents: number; date: string | null; month: string };
}) {
  const [state, action, pending] = useActionState(saveIncome, undefined);
  useDone(state, onDone);
  const [cents, setCents] = useState(income ? Math.abs(income.amountCents) : 0);
  const [negative, setNegative] = useState(income ? income.amountCents < 0 : false);
  const [name, setName] = useState(income?.name ?? "");
  const [date, setDate] = useState(income ? income.date ?? "" : today);
  const computed = date ? date.slice(0, 7) : income?.month ?? defaultMonth;
  const [override, setOverride] = useState<string | null>(income && income.month !== computed ? income.month : null);
  const month = override ?? computed;

  const matches = useMemo(() => {
    const q = norm(name);
    return suggestions.filter((s) => !q || (norm(s).includes(q) && norm(s) !== q)).slice(0, 6);
  }, [name, suggestions]);

  return (
    <form action={action}>
      {income && <input type="hidden" name="id" value={income.id} />}
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="back" value={back ?? ""} />
      <input type="hidden" name="month" value={month} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="amount" value={(negative ? "-" : "") + centsText(cents)} />

      <AmountField
        cents={cents}
        onChange={setCents}
        negative={negative}
        onNegativeChange={setNegative}
        autoFocus={!income}
        accent="brand"
        allowNegative={false}
      />

      <div className="space-y-5 px-5">
        <div>
          <FieldLabel htmlFor="name">De onde veio</FieldLabel>
          <input
            id="name"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
            enterKeyHint="done"
            placeholder="Ex.: Salário, Freela, Aluguel recebido"
            required
            className="w-full rounded-2xl border border-line bg-surface px-4 py-3 outline-none focus:border-brand"
          />
          {matches.length > 0 && (
            <div className="-mx-5 mt-2 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] pointer-fine:flex-wrap pointer-fine:overflow-visible" aria-label="Sugestões">
              {matches.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setName(s)}
                  className="shrink-0 rounded-full border border-line bg-surface px-3 py-1.5 text-[14px] hover:border-ink-3"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="space-y-3">
          <DateChips value={date} onChange={setDate} today={today} label="Data" />
          <MonthLine value={month} computed={computed} onChange={setOverride} />
        </div>
      </div>

      <ErrorText state={state} />

      <SubmitBar mode={mode}>
        <button
          type="submit"
          disabled={pending}
          className="flex-1 rounded-full bg-brand py-3.5 text-[16px] font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Salvando…" : income ? "Salvar alterações" : "Salvar entrada"}
        </button>
        {!income && (
          <button
            type="submit"
            name="again"
            value="1"
            disabled={pending}
            className="rounded-full border border-line bg-surface px-4 py-3.5 text-[15px] font-semibold disabled:opacity-60"
          >
            <span className="sm:hidden">+ Outra</span>
            <span className="hidden sm:inline">Salvar e lançar outra</span>
          </button>
        )}
      </SubmitBar>
    </form>
  );
}
