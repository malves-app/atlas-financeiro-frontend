"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { saveEntry, saveIncome, type FormState } from "@/app/actions";
import { formatBRL, formatShortDate, monthLabel, referenceMonth, shiftMonth } from "@/lib/format";
import { centsText, nextCents } from "@/lib/money-mask";
import { LogoLoader } from "./LogoLoader";
import { GoalImpact } from "./GoalImpact";
import type { GoalHint } from "@/lib/goals";

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

function Icon({ d, className = "size-5" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

const ICONS = {
  tag: "M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8zM7.5 7.5h.01",
  calendar: "M7 3v4M17 3v4M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z",
  undo: "M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11",
  x: "M6 6l12 12M18 6L6 18",
  grid: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  chevron: "M6 9l6 6 6-6",
};

/**
 * Controle segmentado com o "fundo" deslizando até a opção escolhida.
 * Usado para Gasto/Entrada e À vista/Parcelada/Fixa.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  role = "radio",
  thumb = "bg-ink",
  track = "bg-paper",
  size = "md",
}: {
  options: readonly (readonly [T, string])[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  role?: "radio" | "tab";
  thumb?: string;
  track?: string;
  size?: "sm" | "md";
}) {
  const i = Math.max(
    0,
    options.findIndex(([v]) => v === value),
  );
  return (
    <div
      role={role === "tab" ? "tablist" : "radiogroup"}
      aria-label={label}
      className={`relative grid rounded-full p-1 ${track}`}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden
        className={`absolute inset-y-1 left-1 rounded-full shadow-[0_2px_8px_-2px_rgba(23,32,51,0.35)] transition-[transform,background-color] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${thumb}`}
        style={{ width: `calc((100% - 0.5rem) / ${options.length})`, transform: `translateX(${i * 100}%)` }}
      />
      {options.map(([v, l]) => {
        const on = v === value;
        return (
          <button
            key={v}
            type="button"
            role={role}
            {...(role === "tab" ? { "aria-selected": on } : { "aria-checked": on })}
            onClick={() => onChange(v)}
            className={`relative z-10 rounded-full font-semibold transition-colors duration-200 ${
              size === "sm" ? "py-1.5 text-[14px]" : "px-4 py-2 text-[15px]"
            } ${on ? "text-white" : "text-ink-2 hover:text-ink"}`}
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Valor com máscara de dinheiro, grande e no centro: você digita só números e os centavos
 * se ajustam sozinhos (4 5 9 0 → 45,90). Abre o teclado numérico no celular.
 * Enter passa para o próximo campo.
 */
export function AmountField({
  cents,
  onChange,
  negative,
  onNegativeChange,
  autoFocus,
  tone = "ink",
  allowNegative = true,
  label,
  onEnter,
}: {
  cents: number;
  onChange: (c: number) => void;
  negative: boolean;
  onNegativeChange: (v: boolean) => void;
  autoFocus?: boolean;
  tone?: "ink" | "brand";
  allowNegative?: boolean;
  label: string;
  onEnter?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  // cursor sempre no fim (inclusive quando o campo já vem focado ao abrir a página)
  useEffect(() => {
    const el = inputRef.current;
    if (el && document.activeElement === el) caretToEnd(el);
  });
  const text = centsText(cents);
  const big = { fontStretch: "85%", fontSize: "clamp(46px, 13vw, 60px)" } as const;
  const color = cents === 0 ? "text-ink-3/35" : negative || tone === "brand" ? "text-brand" : "text-ink";
  return (
    <div className="group px-5 pt-2 pb-5 text-center">
      <label htmlFor="amount-input" className="text-[13px] font-medium text-ink-3">
        {negative ? "Valor do estorno" : label}
      </label>
      <div className="mt-0.5 flex cursor-text items-baseline justify-center gap-1.5" onClick={() => inputRef.current?.focus()}>
        <span className={`display text-[26px] font-semibold ${cents === 0 ? "text-ink-3/50" : "text-ink-3"}`}>{negative ? "−R$" : "R$"}</span>
        {/* o texto invisível dá a largura do campo, para o valor ficar centralizado */}
        <span className="relative inline-grid">
          <span aria-hidden className="display num invisible col-start-1 row-start-1 leading-tight font-bold whitespace-pre" style={big}>
            {text}
          </span>
          <input
            id="amount-input"
            size={1}
            inputMode="numeric"
            autoComplete="off"
            aria-label="Valor em reais"
            value={text}
            ref={inputRef}
            onChange={(e) => onChange(nextCents(cents, e.target.value))}
            onFocus={(e) => caretToEnd(e.currentTarget)}
            onClick={(e) => caretToEnd(e.currentTarget)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.metaKey && !e.ctrlKey && onEnter) {
                e.preventDefault();
                onEnter();
              }
            }}
            autoFocus={autoFocus}
            data-autofocus={autoFocus ? "" : undefined}
            className={`display num col-start-1 row-start-1 w-full min-w-0 bg-transparent p-0 leading-tight font-bold caret-brand outline-none ${color}`}
            style={big}
          />
        </span>
      </div>
      <div
        aria-hidden
        className="mx-auto mt-1 h-[3px] w-10 rounded-full bg-line transition-all duration-300 group-focus-within:w-24 group-focus-within:bg-brand"
      />
      {allowNegative && (
        <button
          type="button"
          aria-pressed={negative}
          onClick={() => onNegativeChange(!negative)}
          className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-medium transition-colors ${
            negative ? "bg-brand-soft text-brand" : "text-ink-3 hover:bg-surface hover:text-ink-2"
          }`}
        >
          <Icon d={ICONS.undo} className="size-3.5" />
          {negative ? "Estorno: entra como valor negativo" : "É um estorno?"}
        </button>
      )}
    </div>
  );
}

/**
 * Escolha da forma de pagamento: botões com a cor de cada uma.
 * `on`: fundo onde fica (no cinza da página os botões são brancos; num bloco branco, cinzas).
 */
export function PaymentPicker({
  methods,
  value,
  onChange,
  on = "paper",
}: {
  methods: PaymentMethodOption[];
  value: number | null;
  onChange: (id: number) => void;
  on?: "paper" | "surface";
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
            className={`flex items-center gap-2 rounded-full px-3.5 py-2 text-[15px] font-semibold transition-all duration-200 ${
              selected
                ? "bg-ink text-white shadow-[0_4px_12px_-6px_rgba(23,32,51,0.6)]"
                : on === "surface"
                  ? "bg-paper text-ink hover:bg-line/70"
                  : "bg-surface text-ink ring-1 ring-line hover:ring-ink-3/40"
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

/** Categorias em grade de ícones (fácil de tocar); as mais usadas primeiro. */
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
  // celular: 7 + "Todas"; computador: 11 + "Todas"
  const MOBILE = 7;
  const DESKTOP = 11;
  const tile = "flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-0.5 py-2.5 transition-all duration-200";
  return (
    <fieldset>
      <legend className="mb-2 flex w-full items-baseline justify-between px-1 text-[13px] font-medium text-ink-3">
        Categoria
      </legend>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {categories.map((c, i) => {
          const on = value === c.id;
          // a escolhida aparece sempre, mesmo fora das primeiras
          if (!all && !on && i >= DESKTOP) return null;
          const hide = !all && !on && i >= MOBILE ? "max-sm:hidden" : "";
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? null : c.id)}
              className={`${tile} ${hide} ${
                on
                  ? "bg-ink text-white shadow-[0_6px_16px_-8px_rgba(23,32,51,0.7)]"
                  : "bg-surface text-ink ring-1 ring-line hover:-translate-y-px hover:ring-ink-3/40"
              }`}
            >
              <span className="text-[22px] leading-none" aria-hidden>
                {c.emoji}
              </span>
              <span className="w-full truncate text-center text-[11.5px] font-medium tracking-[-0.01em]">{c.name}</span>
            </button>
          );
        })}
        {categories.length > MOBILE && (
          <button
            type="button"
            aria-expanded={all}
            onClick={() => setAll(!all)}
            className={`${tile} text-brand ring-1 ring-brand/25 ring-inset hover:bg-brand-soft ${categories.length <= DESKTOP ? "sm:hidden" : ""}`}
          >
            <Icon d={all ? ICONS.x : ICONS.grid} className="size-[20px]" />
            <span className="text-[12px] font-semibold">{all ? "Menos" : "Todas"}</span>
          </button>
        )}
      </div>
    </fieldset>
  );
}

/** Data com atalhos: Hoje, Ontem ou outra (abre o calendário do aparelho). */
export function DateChips({ value, onChange, today }: { value: string; onChange: (v: string) => void; today: string }) {
  const yesterday = shiftDate(today, -1);
  const other = !!value && value !== today && value !== yesterday;
  const chip = (active: boolean) =>
    `relative flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[15px] font-semibold transition-all duration-200 ${
      active ? "bg-ink text-white shadow-[0_4px_12px_-6px_rgba(23,32,51,0.6)]" : "bg-paper text-ink hover:bg-line/70"
    }`;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className={chip(value === today)} onClick={() => onChange(today)} aria-pressed={value === today}>
        Hoje
      </button>
      <button type="button" className={chip(value === yesterday)} onClick={() => onChange(yesterday)} aria-pressed={value === yesterday}>
        Ontem
      </button>
      <span className={chip(other)}>
        <Icon d={ICONS.calendar} className="size-4" />
        {other ? formatShortDate(value) : "Outra data"}
        {/* o campo de data fica por cima, invisível: tocar abre o calendário do aparelho */}
        <input
          type="date"
          aria-label="Escolher outra data"
          value={value}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          onClick={(e) => {
            try {
              e.currentTarget.showPicker?.();
            } catch {
              // navegador sem showPicker: o toque no campo já abre o calendário
            }
          }}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0 [color-scheme:light]"
        />
      </span>
    </div>
  );
}

/** Bloco branco com linhas separadas (Pagamento, Data, Mês...). */
function Group({ children }: { children: React.ReactNode }) {
  return <div className="divide-y divide-line/80 rounded-[20px] bg-surface ring-1 ring-line/80">{children}</div>;
}

function Row({ label, children, className = "" }: { label?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={`px-4 py-3.5 ${className}`}>
      {label && <div className="mb-2.5 text-[13px] font-medium text-ink-3">{label}</div>}
      {children}
    </div>
  );
}

/** Mês em que o lançamento conta. Discreto: só chama atenção quando muda por causa da fatura. */
function MonthRow({
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
    <div className={`flex items-center justify-between gap-3 px-4 py-3 ${hint ? "rounded-b-[20px] bg-brand-soft" : ""}`}>
      <div className="min-w-0">
        <div className="text-[14px] text-ink-2">Conta no mês</div>
        {hint && <div className="text-[12px] font-medium text-brand">{hint}</div>}
      </div>
      <label className="relative flex shrink-0 items-center">
        <select
          aria-label="Mês em que o lançamento conta"
          value={value}
          onChange={(e) => onChange(e.target.value === computed ? null : e.target.value)}
          className="appearance-none rounded-full bg-paper py-1.5 pr-8 pl-3.5 text-[15px] font-semibold outline-none hover:bg-line/70"
        >
          {options.sort().map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </select>
        <Icon d={ICONS.chevron} className="pointer-events-none absolute right-2.5 size-4 text-ink-3" />
      </label>
    </div>
  );
}

/** Interruptor (liga/desliga) com texto, para "Pago" e "Usar nos próximos meses". */
function Switch({ name, defaultChecked, children, hint }: { name: string; defaultChecked?: boolean; children: React.ReactNode; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3.5">
      <span className="text-[15px]">
        {children}
        {hint && <span className="block text-[13px] text-ink-3">{hint}</span>}
      </span>
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="peer sr-only" />
      <span
        aria-hidden
        className="relative h-[26px] w-[44px] shrink-0 rounded-full bg-line transition-colors duration-200 peer-checked:bg-brand peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand after:absolute after:top-[3px] after:left-[3px] after:size-5 after:rounded-full after:bg-white after:shadow after:transition-transform after:duration-200 peer-checked:after:translate-x-[18px]"
      />
    </label>
  );
}

/** Nome com sugestões dos lançamentos anteriores. */
function NameField({
  value,
  onChange,
  placeholder,
  inputRef,
  onFocusChange,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onFocusChange?: (f: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[20px] bg-surface px-4 ring-1 ring-line/80 transition-shadow focus-within:ring-2 focus-within:ring-brand">
      <Icon d={ICONS.tag} className="size-5 shrink-0 text-ink-3" />
      <input
        ref={inputRef}
        id="name"
        name="name"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => onFocusChange?.(true)}
        onBlur={() => setTimeout(() => onFocusChange?.(false), 150)}
        autoComplete="off"
        autoCapitalize="sentences"
        enterKeyHint="done"
        placeholder={placeholder}
        aria-label="Descrição"
        required
        className="min-w-0 flex-1 bg-transparent py-3.5 outline-none placeholder:text-ink-3/80"
      />
      {value && (
        <button
          type="button"
          aria-label="Limpar descrição"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            onChange("");
            inputRef.current?.focus();
          }}
          className="-mr-1.5 grid size-7 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-paper hover:text-ink"
        >
          <Icon d={ICONS.x} className="size-4" />
        </button>
      )}
    </div>
  );
}

function SuggestionChips({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div
      aria-label={label}
      className="-mx-5 mt-2.5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] pointer-fine:flex-wrap pointer-fine:overflow-visible"
    >
      {children}
    </div>
  );
}

const chipClass =
  "flex shrink-0 items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-[14px] ring-1 ring-line/80 transition-all duration-150 hover:-translate-y-px hover:ring-ink-3/40 active:translate-y-0";

function ErrorText({ state }: { state: FormState }) {
  if (!state?.error) return null;
  return (
    <p role="alert" className="mx-5 mt-4 rounded-2xl bg-danger-soft px-4 py-3 text-[14px] font-medium text-danger">
      {state.error}
    </p>
  );
}

function SubmitBar({ mode, children }: { mode: FormMode; children: React.ReactNode }) {
  return (
    <div
      className={
        mode === "modal"
          ? "sticky bottom-0 z-10 mt-6 flex gap-2 border-t border-line/70 bg-paper/90 px-5 pt-3 pb-[max(env(safe-area-inset-bottom),14px)] backdrop-blur-md"
          : "sticky bottom-[calc(76px+env(safe-area-inset-bottom))] z-10 mt-6 flex gap-2 bg-paper/90 px-5 pt-3 pb-3 shadow-[0_-8px_16px_-12px_rgba(23,32,51,0.25)] backdrop-blur-md lg:bottom-0"
      }
    >
      {children}
    </div>
  );
}

function SaveButton({ pending, tone, children }: { pending: boolean; tone: "ink" | "brand"; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending || undefined}
      className={`flex flex-1 items-center justify-center gap-2.5 rounded-full py-3.5 text-[16px] font-semibold text-white transition-all duration-200 hover:-translate-y-px active:translate-y-0 disabled:translate-y-0 disabled:opacity-90 ${
        tone === "brand"
          ? "bg-brand shadow-[0_10px_24px_-12px_rgba(11,122,107,0.8)] hover:bg-[#0a8a78]"
          : "bg-ink shadow-[0_10px_24px_-12px_rgba(23,32,51,0.8)] hover:bg-[#222c44]"
      }`}
    >
      {pending ? <LogoLoader tone={tone === "brand" ? "brand" : "dark"} className="size-5" /> : null}
      {pending ? "Salvando…" : children}
      {!pending && (
        <kbd className="hidden h-6 place-items-center rounded-md bg-white/15 px-1.5 font-sans text-[12px] font-semibold text-white/70 pointer-fine:grid" title="Enter">
          ↵
        </kbd>
      )}
    </button>
  );
}

function AgainButton({ pending, label, againRef }: { pending: boolean; label: string; againRef: React.RefObject<HTMLButtonElement | null> }) {
  return (
    <button
      ref={againRef}
      type="submit"
      name="again"
      value="1"
      disabled={pending}
      title={`Salvar e lançar ${label} (Ctrl/⌘ + Enter)`}
      className="flex items-center gap-1.5 rounded-full bg-surface px-4 py-3.5 text-[15px] font-semibold ring-1 ring-line transition-colors hover:bg-white hover:ring-ink-3/40 disabled:opacity-60"
    >
      <Icon d="M12 5v14M5 12h14" className="size-4" />
      <span className="sm:hidden">{label === "outra" ? "Outra" : "Outro"}</span>
      <span className="hidden sm:inline">Salvar e lançar {label}</span>
    </button>
  );
}

/** Ctrl/⌘ + Enter: salvar e lançar outro. */
function useAgainShortcut(againRef: React.RefObject<HTMLButtonElement | null>) {
  return (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && againRef.current) {
      e.preventDefault();
      againRef.current.click();
    }
  };
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

const PLANS = [
  ["avista", "À vista"],
  ["parcelado", "Parcelada"],
  ["fixa", "Fixa"],
] as const;

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
  goalHints,
}: {
  categories: CategoryOption[];
  suggestions: SuggestionOption[];
  methods: PaymentMethodOption[];
  today: string;
  back?: string;
  hasRecurring?: boolean;
  mode?: FormMode;
  onDone?: (again: boolean) => void;
  /** Metas do mês atual e do próximo, para mostrar como o gasto mexe nelas (só ao lançar). */
  goalHints?: GoalHint[];
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
  const nameRef = useRef<HTMLInputElement>(null);
  const againRef = useRef<HTMLButtonElement>(null);
  const onFormKey = useAgainShortcut(againRef);
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
  const perInstallment = installments >= 2 ? Math.round(cents / installments) : 0;

  return (
    <form action={action} onKeyDown={onFormKey}>
      {entry && <input type="hidden" name="id" value={entry.id} />}
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="back" value={back ?? ""} />
      <input type="hidden" name="month" value={month} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="amount" value={(negative ? "-" : "") + centsText(cents)} />
      {paymentId != null && <input type="hidden" name="paymentMethodId" value={paymentId} />}
      {categoryId != null && <input type="hidden" name="categoryId" value={categoryId} />}
      <input type="hidden" name="plan" value={activePlan} />
      {activePlan === "parcelado" && <input type="hidden" name="installments" value={installments} />}

      <AmountField
        cents={cents}
        onChange={setCents}
        negative={negative}
        onNegativeChange={setNegative}
        autoFocus={!entry}
        label={activePlan === "parcelado" ? "Valor total da compra" : isFixed ? "Valor" : "Quanto você gastou?"}
        onEnter={() => nameRef.current?.focus()}
      />

      <div className="space-y-5 px-5">
        <div>
          <NameField
            value={name}
            onChange={onNameChange}
            placeholder="Descrição (ex.: Assaí, Uber, farmácia)"
            inputRef={nameRef}
            onFocusChange={setNameFocused}
          />
          {showSuggestions && (
            <SuggestionChips label="Sugestões">
              {matches.map((s) => (
                <button
                  key={s.name}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applySuggestion(s)}
                  className={chipClass}
                >
                  {s.categoryId != null && catById.get(s.categoryId) && <span aria-hidden>{catById.get(s.categoryId)!.emoji}</span>}
                  {s.name}
                </button>
              ))}
            </SuggestionChips>
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

        {!entry && goalHints && goalHints.length > 0 && (
          <GoalImpact
            hints={goalHints}
            month={month}
            categoryId={categoryId}
            onCard={!!method?.isCredit}
            avulso={activePlan === "avista"}
            delta={(negative ? -1 : 1) * (activePlan === "parcelado" ? perInstallment : cents)}
          />
        )}

        <Group>
          <Row label="Pagamento">
            <PaymentPicker methods={methods} value={paymentId} onChange={setPaymentId} on="surface" />
            {canPlan && (
              <div className="mt-3">
                <Segmented options={PLANS} value={plan} onChange={setPlan} label="Tipo de compra no crédito" size="sm" />
                {plan === "parcelado" && (
                  <div className="mt-3 rounded-2xl bg-paper/70 p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center rounded-full bg-surface ring-1 ring-line">
                        <button
                          type="button"
                          aria-label="Menos uma parcela"
                          onClick={() => setInstallments((n) => Math.max(2, n - 1))}
                          className="grid size-9 place-items-center rounded-full text-[18px] text-ink-2 hover:bg-paper"
                        >
                          −
                        </button>
                        <label htmlFor="installments" className="sr-only">
                          Em quantas vezes
                        </label>
                        <input
                          id="installments"
                          inputMode="numeric"
                          value={installments}
                          onChange={(e) => {
                            const n = Number(e.target.value.replace(/\D/g, ""));
                            setInstallments(Number.isFinite(n) ? Math.min(Math.max(n, 0), 72) : 2);
                          }}
                          onBlur={() => setInstallments((n) => Math.max(2, n))}
                          className="num w-9 bg-transparent text-center text-[16px] font-semibold outline-none"
                        />
                        <button
                          type="button"
                          aria-label="Mais uma parcela"
                          onClick={() => setInstallments((n) => Math.min(72, n + 1))}
                          className="grid size-9 place-items-center rounded-full text-[18px] text-ink-2 hover:bg-paper"
                        >
                          +
                        </button>
                      </div>
                      <div className="min-w-0 text-[14px] leading-tight">
                        {cents > 0 && perInstallment > 0 ? (
                          <>
                            <span className="num font-semibold text-ink">
                              {installments}x de {formatBRL(perInstallment)}
                            </span>
                            <span className="block text-[12px] text-ink-3">total de {formatBRL(cents)}</span>
                          </>
                        ) : (
                          <span className="text-ink-3">Digite o valor total da compra</span>
                        )}
                      </div>
                    </div>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {[2, 3, 4, 5, 6, 10, 12].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setInstallments(n)}
                          aria-pressed={installments === n}
                          className={`num rounded-full px-3 py-1 text-[13px] font-semibold transition-colors ${
                            installments === n ? "bg-ink text-white" : "bg-surface text-ink-2 ring-1 ring-line hover:ring-ink-3/40"
                          }`}
                        >
                          {n}x
                        </button>
                      ))}
                    </div>
                    <p className="mt-2.5 text-[12px] text-ink-3">
                      A 1ª parcela entra na fatura de {monthLabel(month, false).toLowerCase()}; as outras ficam em Fixos, na aba Cartão de crédito.
                    </p>
                  </div>
                )}
                {plan === "fixa" && (
                  <p className="mt-2.5 rounded-2xl bg-paper/70 px-3 py-2.5 text-[13px] text-ink-2">
                    Repete todo mês na fatura (assinaturas, por exemplo), a partir de {monthLabel(month, false).toLowerCase()}. Para parar, encerre em
                    Fixos.
                  </p>
                )}
              </div>
            )}
          </Row>
          <Row label={isFixed ? "Vencimento" : "Data"}>
            <DateChips value={date} onChange={setDate} today={today} />
          </Row>
          <MonthRow
            value={month}
            computed={computed}
            onChange={setOverride}
            hint={shifted && !override ? `Depois do fechamento (dia ${method?.closingDay}): entra na próxima fatura` : undefined}
          />
        </Group>

        {isFixed && (entry.installmentTotal != null || showPaid || hasRecurring) && (
          <Group>
            {entry.installmentTotal != null && (
              <div className="flex items-center justify-between px-4 py-3.5 text-[15px]">
                <span className="text-ink-2">Parcela</span>
                <span className="num font-semibold">
                  {entry.installmentNo} de {entry.installmentTotal}
                </span>
              </div>
            )}
            {showPaid && (
              <>
                <input type="hidden" name="hasPaid" value="1" />
                <Switch name="paid" defaultChecked={entry.paid === true}>
                  Pago
                </Switch>
              </>
            )}
            {hasRecurring && (
              <Switch name="applyFuture" hint="Atualiza o fixo e os meses seguintes ainda não pagos.">
                Usar estes dados nos próximos meses
              </Switch>
            )}
          </Group>
        )}
      </div>

      <ErrorText state={state} />

      <SubmitBar mode={mode}>
        <SaveButton pending={pending} tone="ink">
          {entry
            ? "Salvar alterações"
            : activePlan === "parcelado"
              ? "Salvar parcelamento"
              : activePlan === "fixa"
                ? "Salvar compra fixa"
                : "Salvar gasto"}
        </SaveButton>
        {!entry && <AgainButton pending={pending} label="outro" againRef={againRef} />}
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
  const nameRef = useRef<HTMLInputElement>(null);
  const againRef = useRef<HTMLButtonElement>(null);
  const onFormKey = useAgainShortcut(againRef);
  const [cents, setCents] = useState(income ? Math.abs(income.amountCents) : 0);
  const [negative, setNegative] = useState(income ? income.amountCents < 0 : false);
  const [name, setName] = useState(income?.name ?? "");
  const [nameFocused, setNameFocused] = useState(false);
  const [date, setDate] = useState(income ? income.date ?? "" : today);
  const computed = date ? date.slice(0, 7) : income?.month ?? defaultMonth;
  const [override, setOverride] = useState<string | null>(income && income.month !== computed ? income.month : null);
  const month = override ?? computed;

  const matches = useMemo(() => {
    const q = norm(name);
    return suggestions.filter((s) => !q || (norm(s).includes(q) && norm(s) !== q)).slice(0, 6);
  }, [name, suggestions]);
  const showSuggestions = matches.length > 0 && (nameFocused || !name);

  return (
    <form action={action} onKeyDown={onFormKey}>
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
        tone="brand"
        allowNegative={false}
        label="Quanto entrou?"
        onEnter={() => nameRef.current?.focus()}
      />

      <div className="space-y-5 px-5">
        <div>
          <NameField
            value={name}
            onChange={setName}
            placeholder="De onde veio (ex.: Salário, Freela)"
            inputRef={nameRef}
            onFocusChange={setNameFocused}
          />
          {showSuggestions && (
            <SuggestionChips label="Sugestões">
              {matches.map((s) => (
                <button key={s} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setName(s)} className={chipClass}>
                  {s}
                </button>
              ))}
            </SuggestionChips>
          )}
        </div>
        <Group>
          <Row label="Data">
            <DateChips value={date} onChange={setDate} today={today} />
          </Row>
          <MonthRow value={month} computed={computed} onChange={setOverride} />
        </Group>
      </div>

      <ErrorText state={state} />

      <SubmitBar mode={mode}>
        <SaveButton pending={pending} tone="brand">
          {income ? "Salvar alterações" : "Salvar entrada"}
        </SaveButton>
        {!income && <AgainButton pending={pending} label="outra" againRef={againRef} />}
      </SubmitBar>
    </form>
  );
}
