"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useMemo, useRef, useState } from "react";
import {
  addSubcategoryAction,
  archiveSubcategoryAction,
  importSheetAction,
  renameSubcategoryAction,
  saveCategory,
  savePaymentMethod,
  type FormState,
} from "@/app/actions";
import { monthLabel, PAYMENT_COLORS } from "@/lib/format";
import { BANKS, bankById, guessBank, guessPaymentType, PAYMENT_TYPES, type PaymentType } from "@/lib/payment-icons";
import { CATEGORY_ICON_GROUPS, guessCategoryIcon, searchCategoryIcons, suggestedSubcategories } from "@/lib/category-icons";
import { LogoLoader } from "./LogoLoader";
import { CategoryCircle, methodDescription, PaymentBadge, TypeGlyph } from "./SettingsVisuals";

/* ------------------------------ peças ------------------------------ */

const INPUT =
  "w-full rounded-2xl border border-line bg-surface px-4 py-3 text-[16px] outline-none transition-colors placeholder:text-ink-3/80 focus:border-brand";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
        <span className="text-[13px] font-semibold tracking-[0.01em] text-ink-2">{label}</span>
        {hint && <span className="text-[12.5px] text-ink-3">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function ErrorText({ state }: { state: FormState }) {
  if (!state?.error) return null;
  return (
    <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-[14px] font-medium text-danger">
      {state.error}
    </p>
  );
}

function SaveBar({ pending, label, cancelHref, onCancel }: { pending: boolean; label: string; cancelHref?: string; onCancel?: () => void }) {
  const cancel = "rounded-full border border-line bg-surface px-5 py-3 text-[15px] font-semibold text-ink-2 hover:text-ink";
  return (
    <div className="flex gap-2 pt-1">
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending || undefined}
        className="flex flex-1 items-center justify-center gap-2 rounded-full bg-ink py-3 text-[15px] font-semibold text-white shadow-[0_8px_20px_-12px_rgba(23,32,51,0.7)] disabled:opacity-90"
      >
        {pending && <LogoLoader className="size-[18px]" />}
        {pending ? "Salvando…" : label}
      </button>
      {cancelHref ? (
        <Link href={cancelHref} className={cancel}>
          Cancelar
        </Link>
      ) : onCancel ? (
        <button type="button" onClick={onCancel} className={cancel}>
          Cancelar
        </button>
      ) : null}
    </div>
  );
}

function Plus({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function SmallIcon({ d, className = "size-[18px]" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

const PENCIL = "M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4zM13.5 6.5l4 4";
const TRASH = "M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3";
const SEARCH = "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4";

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

/* ------------------------- forma de pagamento ------------------------- */

export interface PaymentMethodFormValue {
  id: number;
  name: string;
  isCredit: boolean;
  closingDay: number | null;
  color: string;
  icon: PaymentType;
  bank: string | null;
}

/** Tipo pelo nome digitado (só enquanto a pessoa não escolheu um tipo). */
function typeFromName(name: string): PaymentType | null {
  const n = fold(name);
  if (!n) return null;
  if (/debito/.test(n)) return "debito";
  if (/credito|cartao/.test(n)) return "credito";
  const t = guessPaymentType(name);
  return t === "conta" ? null : t;
}

/** Criar/editar forma de pagamento: prévia ao vivo, nome, tipo, fechamento (crédito), banco e cor. */
export function PaymentMethodForm({
  method,
  usedColors,
  initialType,
}: {
  method?: PaymentMethodFormValue;
  usedColors: string[];
  initialType?: PaymentType;
}) {
  const [state, action, pending] = useActionState(savePaymentMethod, undefined);
  const [name, setName] = useState(method?.name ?? "");
  const [type, setType] = useState<PaymentType>(method?.icon ?? initialType ?? "conta");
  const [bank, setBank] = useState<string | null>(method?.bank ?? null);
  const [closingDay, setClosingDay] = useState(method?.closingDay ?? 25);
  // Sem banco, o selo usa a cor da paleta que a forma já tem (ou a próxima livre); com banco, a cor do banco
  const paletteColor =
    method && !method.bank && PAYMENT_COLORS.includes(method.color)
      ? method.color
      : (PAYMENT_COLORS.find((c) => !usedColors.includes(c)) ?? PAYMENT_COLORS[0]);
  const color = bankById(bank)?.bg ?? paletteColor;
  const touched = useRef({ type: !!method || !!initialType, bank: !!method });
  const isCredit = type === "credito";

  const onName = (v: string) => {
    setName(v);
    if (!touched.current.bank) setBank(guessBank(v));
    if (!touched.current.type) setType(typeFromName(v) ?? "conta");
  };

  return (
    <form action={action} className="space-y-6 px-3 pb-8 lg:px-0">
      {method && <input type="hidden" name="id" value={method.id} />}
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="bank" value={bank ?? ""} />
      {isCredit && <input type="hidden" name="closingDay" value={closingDay} />}

      {/* Prévia: como aparece nas listas e no lançamento */}
      <div className="flex items-center gap-4 rounded-[22px] bg-surface p-4 lg:p-5">
        <PaymentBadge icon={type} bank={bank} color={color} size="lg" />
        <div className="min-w-0">
          <p className={`truncate text-[18px] font-semibold ${name ? "" : "text-ink-3"}`}>{name || "Nova forma de pagamento"}</p>
          <p className="text-[13.5px] text-ink-3">{methodDescription({ name, icon: type, bank, isCredit, closingDay })}</p>
        </div>
      </div>

      <Field label="Nome">
        <input
          name="name"
          value={name}
          onChange={(e) => onName(e.target.value)}
          placeholder="Ex.: Nubank, Pix, Itaú conta"
          required
          maxLength={40}
          autoFocus={!method}
          autoComplete="off"
          className={INPUT}
        />
      </Field>

      <Field label="Tipo">
        <div role="radiogroup" aria-label="Tipo" className="grid grid-cols-5 gap-1.5 sm:gap-2">
          {PAYMENT_TYPES.map((t) => {
            const on = t.id === type;
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={on}
                title={t.label}
                onClick={() => {
                  touched.current.type = true;
                  setType(t.id);
                }}
                className={`flex min-w-0 flex-col items-center gap-1.5 rounded-2xl px-0.5 py-3 text-[11.5px] font-semibold tracking-[-0.01em] transition-all duration-200 sm:text-[12.5px] ${
                  on ? "bg-ink text-white shadow-[0_8px_18px_-10px_rgba(23,32,51,0.8)]" : "bg-surface text-ink-2 ring-1 ring-line hover:text-ink hover:ring-ink-3/40"
                }`}
              >
                <TypeGlyph type={t.id} className="size-6" />
                <span className="w-full truncate text-center">{t.short}</span>
              </button>
            );
          })}
        </div>
      </Field>

      {isCredit && (
        <Field label="Fechamento da fatura">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl bg-surface p-4">
            <div className="flex items-center gap-3">
              <span className="text-[15px] text-ink-2">Fecha no dia</span>
              <div className="flex items-center rounded-full bg-paper">
                <button
                  type="button"
                  aria-label="Um dia antes"
                  onClick={() => setClosingDay((d) => (d <= 1 ? 31 : d - 1))}
                  className="grid size-10 place-items-center rounded-full text-[18px] text-ink-2 hover:bg-line/60"
                >
                  −
                </button>
                <input
                  aria-label="Dia de fechamento"
                  inputMode="numeric"
                  value={closingDay || ""}
                  onChange={(e) => {
                    const n = Number(e.target.value.replace(/\D/g, "").slice(0, 2));
                    setClosingDay(Math.min(31, n));
                  }}
                  onBlur={() => setClosingDay((d) => Math.min(31, Math.max(1, d || 1)))}
                  className="num w-10 bg-transparent text-center text-[17px] font-semibold outline-none"
                />
                <button
                  type="button"
                  aria-label="Um dia depois"
                  onClick={() => setClosingDay((d) => (d >= 31 ? 1 : d + 1))}
                  className="grid size-10 place-items-center rounded-full text-[18px] text-ink-2 hover:bg-line/60"
                >
                  +
                </button>
              </div>
            </div>
            <p className="text-[13px] text-ink-3">Compras depois desse dia entram na fatura do mês seguinte.</p>
          </div>
        </Field>
      )}

      <Field label="Banco ou instituição" hint="Opcional">
        <div role="radiogroup" aria-label="Banco" className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          <BankOption
            on={bank == null}
            label="Nenhum"
            onClick={() => {
              touched.current.bank = true;
              setBank(null);
            }}
          >
            <span className="grid size-8 place-items-center rounded-[10px] border-[1.5px] border-dashed border-ink-3/50 text-ink-3">
              <TypeGlyph type={type} className="size-[18px]" />
            </span>
          </BankOption>
          {BANKS.map((b) => (
            <BankOption
              key={b.id}
              on={bank === b.id}
              label={b.name}
              onClick={() => {
                touched.current.bank = true;
                setBank(b.id);
              }}
            >
              <PaymentBadge icon={type} bank={b.id} color={color} size="sm" corner={false} />
            </BankOption>
          ))}
        </div>
        <p className="mt-2 px-1 text-[12.5px] text-ink-3">A cor do banco vira a cor desta forma de pagamento nos selos e nos gráficos.</p>
      </Field>

      <ErrorText state={state} />
      <SaveBar pending={pending} label={method ? "Salvar alterações" : "Criar forma de pagamento"} cancelHref="/configuracoes/pagamentos" />
    </form>
  );
}

function BankOption({ on, label, onClick, children }: { on: boolean; label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={`flex min-w-0 flex-col items-center gap-1.5 rounded-2xl px-1 pt-2.5 pb-2 transition-all duration-200 ${
        on ? "bg-surface ring-2 ring-ink" : "bg-surface ring-1 ring-line hover:ring-ink-3/40"
      }`}
    >
      {children}
      <span className={`w-full truncate text-center text-[11.5px] ${on ? "font-semibold text-ink" : "font-medium text-ink-2"}`}>{label}</span>
    </button>
  );
}

/* ------------------------------ categoria ------------------------------ */

/** Seletor de ícone: grupos (Alimentação, Casa, Transporte...) e busca por palavra. */
export function IconPicker({
  value,
  onChange,
  noneLabel,
  compact = false,
}: {
  value: string;
  onChange: (emoji: string) => void;
  /** Mostra um botão para ficar sem ícone (onChange("")). */
  noneLabel?: string;
  /** Dentro de listas: mais baixo e sem borda arredondada grande. */
  compact?: boolean;
}) {
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<string>("todos");
  const results = useMemo(() => (q.trim() ? searchCategoryIcons(q) : null), [q]);
  const groups = group === "todos" ? CATEGORY_ICON_GROUPS : CATEGORY_ICON_GROUPS.filter((g) => g.id === group);
  const cell = (e: string) => (
    <button
      key={e}
      type="button"
      role="radio"
      aria-checked={value === e}
      aria-label={e}
      onClick={() => onChange(e)}
      className={`grid aspect-square place-items-center rounded-xl text-[22px] leading-none transition-all duration-150 ${
        value === e ? "bg-ink/[0.07] ring-2 ring-ink" : "hover:scale-110 hover:bg-paper"
      }`}
    >
      {e}
    </button>
  );
  const grid = "grid grid-cols-7 gap-1 sm:grid-cols-10";
  return (
    <div className={`overflow-hidden bg-surface ${compact ? "rounded-2xl ring-1 ring-line" : "rounded-[20px]"}`}>
      <div className="space-y-2.5 border-b border-line p-3">
        <div className="flex gap-2">
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-paper px-3 py-2.5 text-ink-3 focus-within:ring-2 focus-within:ring-brand/40">
            <SmallIcon d={SEARCH} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
              placeholder={noneLabel ? "Buscar ícone" : "Buscar ícone (ex.: mercado, pet, viagem)"}
              aria-label="Buscar ícone"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3"
            />
          </label>
          {noneLabel && (
            <button
              type="button"
              aria-pressed={!value}
              onClick={() => onChange("")}
              className={`shrink-0 rounded-xl px-3 text-[13px] font-semibold transition-colors ${
                !value ? "bg-ink text-white" : "bg-paper text-ink-2 hover:text-ink"
              }`}
            >
              {noneLabel}
            </button>
          )}
        </div>
        {!results && (
          <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-0.5 [scrollbar-width:none]">
            {[{ id: "todos", label: "Todos" }, ...CATEGORY_ICON_GROUPS].map((g) => (
              <button
                key={g.id}
                type="button"
                aria-pressed={group === g.id}
                onClick={() => setGroup(g.id)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                  group === g.id ? "bg-ink text-white" : "bg-paper text-ink-2 hover:text-ink"
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div role="radiogroup" aria-label="Ícone" className={`overflow-y-auto p-2 ${compact ? "max-h-[232px]" : "max-h-[300px] lg:max-h-[340px]"}`}>
        {results ? (
          results.length ? (
            <div className={grid}>{results.map(cell)}</div>
          ) : (
            <p className="px-3 py-6 text-center text-[14px] text-ink-3">Nenhum ícone com “{q}”. Tente outra palavra.</p>
          )
        ) : (
          groups.map((g) => (
            <div key={g.id} className="pb-2">
              {group === "todos" && <p className="px-1.5 pt-1.5 pb-1 text-[12px] font-semibold tracking-[0.02em] text-ink-3 uppercase">{g.label}</p>}
              <div className={grid}>{g.icons.map(([e]) => cell(e))}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

type SubDraft = { name: string; emoji: string };

/** Subcategorias digitadas antes de criar a categoria (viram campos "sub" + "subEmoji"). */
function SubcategoryDraft({
  value,
  onChange,
  suggestions,
  fallbackEmoji,
}: {
  value: SubDraft[];
  onChange: (v: SubDraft[]) => void;
  suggestions: SubDraft[];
  fallbackEmoji: string;
}) {
  const [text, setText] = useState("");
  const add = (raw: string, emoji?: string) => {
    const t = raw.trim().slice(0, 40);
    if (t && !value.some((v) => fold(v.name) === fold(t))) onChange([...value, { name: t, emoji: emoji ?? guessCategoryIcon(t) ?? "" }]);
    setText("");
  };
  const missing = suggestions.filter((s) => !value.some((v) => fold(v.name) === fold(s.name)));
  const guess = guessCategoryIcon(text);
  return (
    <div className="rounded-[20px] bg-surface p-3">
      {value.map((v) => (
        <span key={v.name} hidden>
          <input type="hidden" name="sub" value={v.name} />
          <input type="hidden" name="subEmoji" value={v.emoji} />
        </span>
      ))}
      {value.length > 0 && (
        <ul className="mb-2.5 flex flex-wrap gap-1.5">
          {value.map((v) => (
            <li key={v.name} className="flex items-center gap-1.5 rounded-full bg-paper py-1 pr-1 pl-2.5 text-[14px] font-medium">
              <span aria-hidden className={v.emoji ? "" : "opacity-40"}>
                {v.emoji || fallbackEmoji}
              </span>
              {v.name}
              <button
                type="button"
                aria-label={`Tirar ${v.name}`}
                onClick={() => onChange(value.filter((x) => x !== v))}
                className="grid size-6 place-items-center rounded-full text-ink-3 hover:bg-line hover:text-ink"
              >
                <SmallIcon d="M7 7l10 10M17 7L7 17" className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-paper pr-3 pl-3 focus-within:ring-2 focus-within:ring-brand/40">
          <span aria-hidden className={`text-[18px] leading-none ${guess ? "" : "opacity-40"}`}>
            {guess ?? fallbackEmoji}
          </span>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add(text);
              }
            }}
            placeholder="Ex.: Supermercado, Restaurante"
            aria-label="Nova subcategoria"
            maxLength={40}
            className="min-w-0 flex-1 bg-transparent py-2.5 text-[15px] outline-none placeholder:text-ink-3"
          />
        </label>
        <button
          type="button"
          onClick={() => add(text)}
          disabled={!text.trim()}
          className="flex items-center gap-1 rounded-xl bg-ink px-3.5 text-[14px] font-semibold text-white disabled:bg-line disabled:text-ink-3"
        >
          <Plus />
          Adicionar
        </button>
      </div>
      <p className="mt-2 px-1 text-[12.5px] text-ink-3">O ícone vem pelo nome; dá para trocar depois, na página da categoria.</p>
      {missing.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="mr-0.5 text-[12.5px] text-ink-3">Sugestões:</span>
          {missing.map((s) => (
            <button
              key={s.name}
              type="button"
              onClick={() => add(s.name, s.emoji)}
              className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-medium text-brand ring-1 ring-brand/30 ring-inset hover:bg-brand-soft"
            >
              <span aria-hidden>{s.emoji}</span>
              {s.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Categoria: nome e ícone (lista de ícones, nada de digitar emoji).
 * Nova: já pode levar subcategorias. Editar: aparece como cartão com "Editar" e abre ali mesmo.
 */
export function CategoryForm({ category, subCount }: { category?: { id: number; name: string; emoji: string }; subCount?: number }) {
  const [state, action, pending] = useActionState(saveCategory, undefined);
  const [open, setOpen] = useState(!category);
  const [name, setName] = useState(category?.name ?? "");
  const [emoji, setEmoji] = useState(category?.emoji ?? "🏷️");
  const [subs, setSubs] = useState<SubDraft[]>([]);
  const suggestions = category ? [] : suggestedSubcategories(name);

  if (category && !open) {
    return (
      <div className="mx-3 flex items-center gap-4 rounded-[22px] bg-surface p-4 lg:mx-0 lg:p-5">
        <CategoryCircle emoji={category.emoji} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[19px] font-semibold">{category.name}</p>
          <p className="text-[13.5px] text-ink-3">
            {subCount ? `${subCount} ${subCount === 1 ? "subcategoria" : "subcategorias"}` : "Sem subcategorias"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-paper px-3.5 py-2 text-[14px] font-semibold text-ink hover:bg-line/70"
        >
          <SmallIcon d={PENCIL} className="size-4" />
          Editar
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-6 px-3 lg:px-0">
      {category && <input type="hidden" name="id" value={category.id} />}
      <input type="hidden" name="emoji" value={emoji} />

      <div className="flex items-center gap-4 rounded-[22px] bg-surface p-4 lg:p-5">
        <CategoryCircle emoji={emoji} size="lg" />
        <div className="min-w-0">
          <p className={`truncate text-[18px] font-semibold ${name ? "" : "text-ink-3"}`}>{name || "Nova categoria"}</p>
          <p className="text-[13.5px] text-ink-3">
            {category ? "Escolha o nome e o ícone" : subs.length ? subs.map((x) => x.name).join(", ") : "Escolha um nome, um ícone e, se quiser, subcategorias"}
          </p>
        </div>
      </div>

      <Field label="Nome">
        <input
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex.: Alimentação, Pets, Academia"
          required
          maxLength={40}
          autoFocus
          autoComplete="off"
          className={INPUT}
        />
      </Field>

      <Field label="Ícone">
        <IconPicker value={emoji} onChange={setEmoji} />
      </Field>

      {!category && (
        <Field label="Subcategorias" hint="Opcional">
          <SubcategoryDraft value={subs} onChange={setSubs} suggestions={suggestions} fallbackEmoji={emoji} />
        </Field>
      )}

      <ErrorText state={state} />
      <SaveBar
        pending={pending}
        label={category ? "Salvar alterações" : "Criar categoria"}
        cancelHref={category ? undefined : "/configuracoes/categorias"}
        onCancel={
          category
            ? () => {
                setOpen(false);
                setName(category.name);
                setEmoji(category.emoji);
              }
            : undefined
        }
      />
    </form>
  );
}

/* ---------------------------- subcategorias ---------------------------- */

type SubItem = { id: number; name: string; emoji: string | null };

/** Círculo com o ícone da subcategoria (sem ícone próprio: o da categoria, apagado). */
function SubIcon({ emoji, fallback, className = "size-9 text-[18px]" }: { emoji: string | null; fallback: string; className?: string }) {
  return (
    <span className={`grid shrink-0 place-items-center rounded-full bg-paper leading-none ${className}`} aria-hidden>
      <span className={emoji ? "" : "opacity-35 grayscale"}>{emoji || fallback}</span>
    </span>
  );
}

/** Lista de subcategorias de uma categoria: ícone, renomear, remover e adicionar (salva na hora). */
export function SubcategoryManager({
  categoryId,
  categoryEmoji,
  subs,
  suggestions,
}: {
  categoryId: number;
  categoryEmoji: string;
  subs: SubItem[];
  suggestions: SubDraft[];
}) {
  const missing = suggestions.filter((s) => !subs.some((x) => fold(x.name) === fold(s.name)));
  return (
    <div>
      {subs.length > 0 ? (
        <ul className="divide-y divide-line/70">
          {subs.map((s) => (
            <SubcategoryRow key={s.id} sub={s} categoryEmoji={categoryEmoji} />
          ))}
        </ul>
      ) : (
        <p className="px-4 pb-3 text-[14px] text-ink-3">
          Nenhuma subcategoria ainda. Depois de criadas, elas aparecem no lançamento logo abaixo da categoria.
        </p>
      )}
      <AddSubcategory categoryId={categoryId} categoryEmoji={categoryEmoji} suggestions={missing} />
    </div>
  );
}

function SubcategoryRow({ sub, categoryEmoji }: { sub: SubItem; categoryEmoji: string }) {
  const [mode, setMode] = useState<"view" | "edit" | "remove">("view");
  const [name, setName] = useState(sub.name);
  const [emoji, setEmoji] = useState(sub.emoji ?? "");
  const [picker, setPicker] = useState(false);
  const [state, action, pending] = useActionState(renameSubcategoryAction, undefined);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    if (state?.ok) {
      setMode("view");
      setPicker(false);
    }
  }, [state]);

  const cancel = () => {
    setName(sub.name);
    setEmoji(sub.emoji ?? "");
    setPicker(false);
    setMode("view");
  };

  if (mode === "edit") {
    return (
      <li className="px-3 py-2.5">
        <form action={action}>
          <input type="hidden" name="id" value={sub.id} />
          <input type="hidden" name="emoji" value={emoji} />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPicker((v) => !v)}
              aria-expanded={picker}
              aria-label="Trocar ícone"
              title="Trocar ícone"
              className={`relative rounded-full transition-shadow ${picker ? "ring-2 ring-ink" : "ring-1 ring-line hover:ring-ink-3/50"}`}
            >
              <SubIcon emoji={emoji || null} fallback={categoryEmoji} className="size-10 text-[20px]" />
              <span className="absolute -right-0.5 -bottom-0.5 grid size-4 place-items-center rounded-full bg-ink text-white">
                <SmallIcon d={PENCIL} className="size-2.5" />
              </span>
            </button>
            <input
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && cancel()}
              aria-label="Nome da subcategoria"
              maxLength={40}
              required
              autoFocus={!picker}
              className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-[15px] outline-none focus:border-brand"
            />
            <button
              type="submit"
              disabled={pending}
              className="flex items-center gap-1.5 rounded-xl bg-ink px-3.5 py-2 text-[14px] font-semibold text-white disabled:opacity-90"
            >
              {pending && <LogoLoader className="size-4" />}
              Salvar
            </button>
            <button type="button" onClick={cancel} className="rounded-xl px-2.5 py-2 text-[14px] font-semibold text-ink-2 hover:bg-paper">
              Cancelar
            </button>
          </div>
          {picker && (
            <div className="fm-pop mt-2.5">
              <IconPicker
                value={emoji}
                onChange={(e) => {
                  setEmoji(e);
                  setPicker(false);
                }}
                noneLabel="Sem ícone"
                compact
              />
            </div>
          )}
        </form>
        {state?.error && <p className="mt-1.5 px-1 text-[13px] font-medium text-danger">{state.error}</p>}
      </li>
    );
  }

  if (mode === "remove") {
    return (
      <li className="flex flex-wrap items-center gap-2 bg-danger-soft/60 px-4 py-2.5">
        <span className="min-w-0 flex-1 text-[14px]">
          Remover <strong className="font-semibold">{sub.name}</strong>? Os gastos antigos continuam com ela.
        </span>
        <form
          action={async (f) => {
            setRemoving(true);
            await archiveSubcategoryAction(f);
          }}
        >
          <input type="hidden" name="id" value={sub.id} />
          <button
            type="submit"
            disabled={removing}
            className="flex items-center gap-1.5 rounded-full bg-danger px-3.5 py-1.5 text-[13.5px] font-semibold text-white"
          >
            {removing && <LogoLoader tone="brand" className="size-4" />}
            Remover
          </button>
        </form>
        <button type="button" onClick={() => setMode("view")} className="rounded-full px-3 py-1.5 text-[13.5px] font-semibold text-ink-2 hover:bg-surface">
          Cancelar
        </button>
      </li>
    );
  }

  return (
    <li className="group flex items-center gap-3 py-1.5 pr-2 pl-3">
      <button
        type="button"
        onClick={() => {
          setMode("edit");
          setPicker(true);
        }}
        aria-label={`Trocar ícone de ${sub.name}`}
        title={sub.emoji ? "Trocar ícone" : "Sem ícone próprio (usa o da categoria). Toque para escolher."}
        className="rounded-full transition-transform hover:scale-105"
      >
        <SubIcon emoji={sub.emoji} fallback={categoryEmoji} />
      </button>
      <span className="min-w-0 flex-1 truncate py-1.5 text-[15px]">{sub.name}</span>
      <button
        type="button"
        onClick={() => setMode("edit")}
        aria-label={`Editar ${sub.name}`}
        title="Editar nome e ícone"
        className="grid size-9 place-items-center rounded-full text-ink-3 hover:bg-paper hover:text-ink"
      >
        <SmallIcon d={PENCIL} />
      </button>
      <button
        type="button"
        onClick={() => setMode("remove")}
        aria-label={`Remover ${sub.name}`}
        title="Remover"
        className="grid size-9 place-items-center rounded-full text-ink-3 hover:bg-danger-soft hover:text-danger"
      >
        <SmallIcon d={TRASH} />
      </button>
    </li>
  );
}

function AddSubcategory({ categoryId, categoryEmoji, suggestions }: { categoryId: number; categoryEmoji: string; suggestions: SubDraft[] }) {
  const [state, action, pending] = useActionState(addSubcategoryAction, undefined);
  const [text, setText] = useState("");
  /** Ícone escolhido na mão (null = o que combina com o nome). */
  const [picked, setPicked] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastAt = useRef<number | undefined>(undefined);
  const guess = guessCategoryIcon(text);
  const emoji = picked ?? guess ?? "";

  useEffect(() => {
    if (state?.ok && state.at !== lastAt.current) {
      lastAt.current = state.at;
      setText("");
      setPicked(null);
      setPicker(false);
      inputRef.current?.focus();
    }
  }, [state]);

  const quickAdd = (s: SubDraft) => {
    const f = new FormData();
    f.set("categoryId", String(categoryId));
    f.set("name", s.name);
    f.set("emoji", s.emoji);
    startTransition(() => action(f));
  };

  return (
    <div className="border-t border-line/70 px-3 pt-3 pb-3.5">
      <form action={action}>
        <input type="hidden" name="categoryId" value={categoryId} />
        <input type="hidden" name="emoji" value={emoji} />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPicker((v) => !v)}
            aria-expanded={picker}
            aria-label="Escolher ícone"
            title="Escolher ícone"
            className={`grid size-[44px] shrink-0 place-items-center rounded-xl bg-paper text-[20px] leading-none transition-shadow ${
              picker ? "ring-2 ring-ink" : "hover:ring-1 hover:ring-ink-3/40"
            }`}
          >
            <span className={emoji ? "" : "opacity-35 grayscale"}>{emoji || categoryEmoji}</span>
          </button>
          <input
            ref={inputRef}
            name="name"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Nova subcategoria"
            aria-label="Nova subcategoria"
            maxLength={40}
            autoComplete="off"
            className="min-w-0 flex-1 rounded-xl bg-paper px-3.5 py-2.5 text-[15px] outline-none placeholder:text-ink-3 focus:ring-2 focus:ring-brand/40"
          />
          <button
            type="submit"
            disabled={pending || !text.trim()}
            className="flex items-center gap-1.5 rounded-xl bg-ink px-3.5 text-[14px] font-semibold text-white disabled:bg-line disabled:text-ink-3"
          >
            {pending ? <LogoLoader className="size-4" /> : <Plus />}
            Adicionar
          </button>
        </div>
        {picker && (
          <div className="fm-pop mt-2.5">
            <IconPicker
              value={emoji}
              onChange={(e) => {
                setPicked(e);
                setPicker(false);
                inputRef.current?.focus();
              }}
              noneLabel="Sem ícone"
              compact
            />
          </div>
        )}
      </form>
      {state?.error && <p className="mt-1.5 px-1 text-[13px] font-medium text-danger">{state.error}</p>}
      {suggestions.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="mr-0.5 text-[12.5px] text-ink-3">Sugestões:</span>
          {suggestions.map((s) => (
            <button
              key={s.name}
              type="button"
              disabled={pending}
              onClick={() => quickAdd(s)}
              className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-medium text-brand ring-1 ring-brand/30 ring-inset hover:bg-brand-soft disabled:opacity-60"
            >
              <span aria-hidden>{s.emoji}</span>
              {s.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ importar ------------------------------ */

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
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending || undefined}
        className="flex w-full items-center justify-center gap-2.5 rounded-full bg-ink py-3 text-[15px] font-semibold text-white disabled:opacity-90 lg:w-auto lg:px-8"
      >
        {pending && <LogoLoader className="size-5" />}
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
