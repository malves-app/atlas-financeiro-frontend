"use client";

// Partes interativas de "Conferir com o banco": enviar o arquivo e aprovar (ou recusar) cada sugestão.

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  fixAction,
  fixAllAction,
  ignoreAction,
  unignoreAction,
  uploadStatement,
  type StatementState,
} from "@/app/statement-actions";
import { LogoLoader } from "./LogoLoader";
import { showToastText } from "./Toast";

function useToast(state: StatementState) {
  useEffect(() => {
    if (state?.ok && state.message) showToastText(state.message);
  }, [state]);
}

function Busy({
  children,
  className,
  tone = "light",
  pendingLabel,
  label,
}: {
  children: React.ReactNode;
  className: string;
  tone?: "light" | "dark" | "brand";
  pendingLabel?: string;
  label?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-label={label} className={`inline-flex items-center justify-center gap-1.5 disabled:opacity-85 ${className}`}>
      {pending ? <LogoLoader tone={tone} className="size-4" /> : null}
      {pending && pendingLabel ? pendingLabel : pending && label ? null : children}
    </button>
  );
}

const Check = ({ className = "size-4" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

const Cross = ({ className = "size-4" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
    <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
  </svg>
);

/* ---------- enviar o arquivo ---------- */

export interface BankOption {
  id: string;
  name: string;
  initials: string;
  bg: string;
  fg: string;
  format: string;
  accept: string;
  howTo: string;
}

export function UploadForm({
  kind,
  banks,
  methods,
  defaultMethodId,
}: {
  kind: "fatura" | "extrato";
  banks: BankOption[];
  methods: { id: number; name: string }[];
  defaultMethodId: number | null;
}) {
  const [state, action, pending] = useActionState<StatementState, FormData>(uploadStatement, undefined);
  const form = useRef<HTMLFormElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [bankId, setBankId] = useState(banks[0]?.id ?? "");
  const bank = banks.find((b) => b.id === bankId) ?? banks[0];
  const what = kind === "fatura" ? "a fatura" : "o extrato";

  return (
    <form ref={form} action={action} className="rounded-[20px] bg-surface p-4">
      <input type="hidden" name="kind" value={kind} />

      <div className="flex flex-wrap items-center gap-2">
        <span className="w-full text-[12.5px] font-semibold tracking-wide text-ink-3 uppercase">Banco</span>
        {banks.map((b) => (
          <label
            key={b.id}
            className={`inline-flex cursor-pointer items-center gap-2 rounded-full py-1 pr-3.5 pl-1 text-[14px] font-semibold ring-1 ${
              b.id === bankId ? "bg-paper ring-ink" : "ring-line"
            }`}
          >
            <input type="radio" name="bank" value={b.id} checked={b.id === bankId} onChange={() => setBankId(b.id)} className="sr-only" />
            <span className="grid size-7 place-items-center rounded-full text-[10.5px] font-bold" style={{ background: b.bg, color: b.fg }} aria-hidden>
              {b.initials}
            </span>
            {b.name}
            {b.id === bankId && <Check className="size-3.5 text-brand" />}
          </label>
        ))}
        <span className="rounded-full border border-dashed border-line px-3 py-1.5 text-[13px] text-ink-3" title="Outros bancos vão entrar aqui">
          Outros bancos em breve
        </span>
      </div>

      {methods.length > 1 && (
        <label className="mt-3 flex items-center gap-2 text-[13.5px] text-ink-2">
          {kind === "fatura" ? "Cartão no Atlas" : "Conta no Atlas"}
          <select name="paymentMethodId" defaultValue={defaultMethodId ?? undefined} className="rounded-xl border border-line bg-surface px-2.5 py-1.5 text-[14px] text-ink">
            {methods.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {methods.length === 1 && <input type="hidden" name="paymentMethodId" value={methods[0].id} />}

      <label
        className={`mt-3 inline-flex cursor-pointer items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-[14.5px] font-semibold text-white ${pending ? "pointer-events-none opacity-85" : ""}`}
      >
        {pending ? (
          <LogoLoader tone="dark" className="size-[18px]" />
        ) : (
          <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 16V4M7.5 8.5L12 4l4.5 4.5M5 20h14" />
          </svg>
        )}
        {pending ? `Lendo ${what}…` : `Enviar ${what} (${bank?.format ?? ""})`}
        <input
          type="file"
          name="file"
          accept={bank?.accept}
          className="sr-only"
          onChange={(e) => {
            setFileName(e.target.files?.[0]?.name ?? null);
            if (e.target.files?.length) form.current?.requestSubmit();
          }}
        />
      </label>
      <p className="mt-2.5 text-[13px] text-ink-3">
        {fileName && pending ? `${fileName} · ` : ""}
        {bank?.howTo}
      </p>
      {state?.error && <p className="mt-2 text-[13.5px] font-medium text-danger">{state.error}</p>}
    </form>
  );
}

/* ---------- uma sugestão ---------- */

export interface CategoryOption {
  id: number;
  name: string;
  emoji: string;
  subs: { id: number; name: string; emoji: string | null }[];
}

export type ActionIcon = "valor" | "mes" | "forma" | "excluir" | "pago";

export interface IssueAction {
  /** Uma chave por linha (linhas iguais agrupadas: a sugestão vale para todas). */
  keys: string[];
  /** O que a sugestão faz ("Corrigir para R$ 52,90", "Mover para dezembro"...). Ao lançar, vale `create`. */
  label: string;
  icon: ActionIcon;
  /** Exclusão: pede confirmação. */
  danger?: boolean;
  /** Lançar: nome e categoria sugeridos (editáveis, se a pessoa quiser). */
  create?: {
    kind: "gasto" | "entrada";
    name: string;
    categoryId: number | null;
    subcategoryId: number | null;
    /** Categoria não reconhecida (ficou em Outros ou sem): aparece em destaque. */
    unsure: boolean;
  };
}

const ICON_PATH: Record<ActionIcon, string> = {
  valor: "M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4",
  mes: "M7 3v4M17 3v4M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z",
  forma: "M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 10h18M7 15h3",
  excluir: "M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3",
  pago: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12.5l2.5 2.5L16 9.5",
};

/**
 * A sugestão de um problema numa linha: o que vai ser feito (ao lançar, o nome e a categoria) + Recusar + Aprovar.
 * Tocar no nome e na categoria abre a edição; sem tocar, é só aprovar.
 */
export function IssueActions({ importId, action, categories }: { importId: number; action: IssueAction; categories: CategoryOption[] }) {
  const [state, fix] = useActionState<StatementState, FormData>(fixAction, undefined);
  const [ignState, ignore] = useActionState<StatementState, FormData>(ignoreAction, undefined);
  useToast(state);
  useToast(ignState);
  const [armed, setArmed] = useState(false);
  const [editing, setEditing] = useState(false);
  const create = action.create;
  const [name, setName] = useState(create?.name ?? "");
  const [cat, setCat] = useState<number | null>(create?.categoryId ?? null);
  const [sub, setSub] = useState<number | null>(create?.subcategoryId ?? null);
  const [touched, setTouched] = useState(false);
  const c = categories.find((x) => x.id === cat) ?? null;
  const s = c?.subs.find((x) => x.id === sub) ?? null;
  const keyInputs = action.keys.map((k) => <input key={k} type="hidden" name="key" value={k} />);
  const unsure = !!create && create.kind === "gasto" && !touched && (create.unsure || !c);

  return (
    <div className="mt-2.5">
      <div className="flex items-center gap-1.5 rounded-2xl bg-paper p-1.5 pl-2">
        {create ? (
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            aria-expanded={editing}
            title="Mudar nome e categoria"
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface text-[17px]" aria-hidden>
              {create.kind === "entrada" ? "💰" : (s?.emoji ?? c?.emoji ?? "🏷️")}
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[14.5px] font-semibold">{name}</span>
              <span className={`block text-[12.5px] ${unsure ? "font-medium text-[#9a5b00]" : "text-ink-3"}`}>
                {create.kind === "entrada" ? "Entrada" : c ? `${c.name}${s ? ` › ${s.name}` : ""}` : "Sem categoria"}
                {unsure && " · confira"}
                <svg viewBox="0 0 24 24" className="ml-1 inline size-3 align-[-1px]" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
                  <path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" />
                </svg>
              </span>
            </span>
          </button>
        ) : (
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <span className={`grid size-9 shrink-0 place-items-center rounded-full bg-surface ${action.danger ? "text-danger" : "text-ink-2"}`}>
              <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d={ICON_PATH[action.icon]} />
              </svg>
            </span>
            <span className={`min-w-0 text-[14px] leading-tight font-semibold ${action.danger ? "text-danger" : ""}`}>{action.label}</span>
          </span>
        )}

        {armed ? (
          <button type="button" onClick={() => setArmed(false)} className="shrink-0 rounded-full px-2.5 py-2 text-[13.5px] font-semibold text-ink-2">
            Cancelar
          </button>
        ) : (
          <form action={ignore} className="shrink-0">
            <input type="hidden" name="importId" value={importId} />
            {keyInputs}
            <Busy label="Recusar" className="size-9 rounded-full text-ink-3 hover:bg-surface hover:text-ink">
              <Cross />
            </Busy>
          </form>
        )}

        <form action={fix} className="shrink-0">
          <input type="hidden" name="importId" value={importId} />
          {keyInputs}
          {create && <input type="hidden" name="name" value={name} />}
          {create?.kind === "gasto" && <input type="hidden" name="categoryId" value={cat ?? ""} />}
          {create?.kind === "gasto" && <input type="hidden" name="subcategoryId" value={sub ?? ""} />}
          {action.danger && !armed ? (
            <button
              type="button"
              onClick={() => setArmed(true)}
              className="inline-flex items-center gap-1 rounded-full bg-danger-soft px-3 py-2 text-[13.5px] font-semibold text-danger"
            >
              <Check className="size-3.5" />
              Aprovar
            </button>
          ) : (
            <Busy
              tone={action.danger ? "brand" : "dark"}
              className={`rounded-full px-3 py-2 text-[13.5px] font-semibold text-white ${action.danger ? "bg-danger" : "bg-ink"}`}
            >
              <Check className="size-3.5" />
              {action.danger ? "Excluir" : "Aprovar"}
            </Busy>
          )}
        </form>
      </div>

      {create && editing && (
        <div className="mt-2 grid gap-2 rounded-2xl bg-paper p-2.5">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            aria-label="Nome no Atlas"
            className="rounded-xl border border-line bg-surface px-3 py-2 text-[15px]"
          />
          {create.kind === "gasto" && (
            <div className="grid grid-cols-2 gap-2">
              <select
                aria-label="Categoria"
                value={cat ?? ""}
                onChange={(e) => {
                  setCat(e.target.value ? Number(e.target.value) : null);
                  setSub(null);
                  setTouched(true);
                }}
                className="rounded-xl border border-line bg-surface px-2.5 py-2 text-[14.5px]"
              >
                <option value="">Sem categoria</option>
                {categories.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.emoji} {x.name}
                  </option>
                ))}
              </select>
              <select
                aria-label="Subcategoria"
                value={sub ?? ""}
                onChange={(e) => {
                  setSub(e.target.value ? Number(e.target.value) : null);
                  setTouched(true);
                }}
                disabled={!c?.subs.length}
                className="rounded-xl border border-line bg-surface px-2.5 py-2 text-[14.5px] disabled:opacity-50"
              >
                <option value="">Sem subcategoria</option>
                {c?.subs.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.emoji ?? c.emoji} {x.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <p className="px-1 text-[12px] text-ink-3">Da próxima vez, esta linha do banco já vem assim.</p>
        </div>
      )}
      {(state?.error || ignState?.error) && <p className="mt-1.5 text-[13px] text-danger">{state?.error ?? ignState?.error}</p>}
    </div>
  );
}

/* ---------- todas de uma vez ---------- */

export function ApproveAllButton({ importId, count }: { importId: number; count: number }) {
  const [state, action] = useActionState<StatementState, FormData>(fixAllAction, undefined);
  useToast(state);
  return (
    <form action={action} className="flex flex-col items-start gap-1">
      <input type="hidden" name="importId" value={importId} />
      <Busy tone="dark" pendingLabel="Aprovando…" className="rounded-full bg-brand px-4 py-2.5 text-[14.5px] font-semibold text-white">
        <Check />
        Aprovar {count === 1 ? "a sugestão" : `as ${count} sugestões`}
      </Busy>
      {state?.error && <span className="text-[13px] text-danger">{state.error}</span>}
    </form>
  );
}

export function UnignoreButton({ importId, count }: { importId: number; count: number }) {
  const [state, action] = useActionState<StatementState, FormData>(unignoreAction, undefined);
  useToast(state);
  return (
    <form action={action}>
      <input type="hidden" name="importId" value={importId} />
      <Busy className="text-[13px] font-semibold text-brand">
        {count} {count === 1 ? "recusada" : "recusadas"} · mostrar de novo
      </Busy>
    </form>
  );
}
