"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatBRL } from "@/lib/format";

// Botão "Compartilhar" do Painel: monta um resumo curto do mês em texto (com o *negrito* do WhatsApp),
// que dá para ajustar antes de mandar pelo compartilhamento do celular, pelo WhatsApp ou copiando.

export interface ReportData {
  monthTitle: string; // "novembro de 2026"
  partial: boolean;
  /** fechado: nada mais por sair; andamento: mês atual com fatura ou contas por sair; futuro: mês que não começou */
  mode: "fechado" | "andamento" | "futuro";
  heroLabel: string; // "Saldo no fim do mês", "Saldo previsto de dezembro"...
  entradas: number;
  gastos: number; // tudo o que é do mês (previsto)
  saldo: number; // entradas − tudo o que é do mês
  naConta: number; // entradas − o que já saiu da conta (a fatura do cartão ainda está na conta)
  /** As linhas do extrato do Painel, com os mesmos nomes (saídas com valor negativo) */
  rows: { emoji: string; label: string; cents: number; bold?: boolean }[];
  pending: {
    date: string | null;
    name: string;
    amount: number;
    late: boolean;
  }[];
  payments: { name: string; total: number }[];
  categories: { emoji: string; name: string; total: number }[];
}

type SectionId = "pagar" | "pagamentos" | "categorias";
const SECTIONS: { id: SectionId; label: string }[] = [
  { id: "pagar", label: "Contas a pagar" },
  { id: "pagamentos", label: "Formas de pagamento" },
  { id: "categorias", label: "Onde mais gastou" },
];

const day = (d: string | null) =>
  d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : "";
const money = (c: number) => formatBRL(c).replace(/ /g, " ");

function buildText(
  r: ReportData,
  on: Record<SectionId, boolean>,
  note: string,
) {
  const lines: string[] = [];
  lines.push(`📊 *Resumo de ${r.monthTitle}*${r.partial ? " (até hoje)" : ""}`);
  if (note.trim()) lines.push("", note.trim());
  lines.push("");
  // Mesmo extrato do Painel: o saldo em destaque e, embaixo, de onde ele vem
  const pct =
    r.entradas > 0
      ? ` (${Math.round((r.gastos / r.entradas) * 100)}% do que ${r.mode === "futuro" ? "vai entrar" : "entrou"})`
      : "";
  lines.push(`💰 ${r.heroLabel}: *${money(r.saldo)}*`);
  for (const row of r.rows)
    lines.push(`${row.emoji} ${row.label}: ${row.bold ? `*${money(row.cents)}*` : money(row.cents)}`);
  lines.push(`🧮 Gastos do mês: ${money(r.gastos)}${pct}`);

  if (on.pagar) {
    lines.push("");
    if (r.pending.length) {
      const total = r.pending.reduce((a, p) => a + p.amount, 0);
      lines.push(
        `🧾 *A pagar* (${r.pending.length} ${r.pending.length === 1 ? "conta" : "contas"}, ${money(total)})`,
      );
      for (const p of r.pending)
        lines.push(
          `• ${day(p.date)} ${p.name}: ${money(p.amount)}${p.late ? " ⚠️ vencida" : ""}`.replace(
            "•  ",
            "• ",
          ),
        );
    } else {
      lines.push("✅ Nenhuma conta a pagar");
    }
  }
  if (on.pagamentos && r.payments.length) {
    lines.push("", "💳 *Por forma de pagamento*");
    for (const p of r.payments) lines.push(`• ${p.name}: ${money(p.total)}`);
  }
  if (on.categorias && r.categories.length) {
    lines.push("", "🏷️ *Onde mais gastou*");
    for (const c of r.categories)
      lines.push(`• ${c.emoji} ${c.name}: ${money(c.total)}`);
  }
  lines.push("", "_Enviado pelo AtlasFinanceiro_");
  return lines.join("\n");
}

export function ShareReport({
  report,
  variant,
}: {
  report: ReportData;
  variant: "icon" | "pill";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [on, setOn] = useState<Record<SectionId, boolean>>({
    pagar: true,
    pagamentos: false,
    categorias: true,
  });
  const [note, setNote] = useState("");
  const generated = useMemo(
    () => buildText(report, on, note),
    [report, on, note],
  );
  const [text, setText] = useState(generated);
  const [canShare, setCanShare] = useState(false);
  const [copied, setCopied] = useState(false);

  // Mudou o que entra no resumo: o texto é refeito
  useEffect(() => setText(generated), [generated]);
  useEffect(
    () =>
      setCanShare(
        typeof navigator !== "undefined" &&
          typeof navigator.share === "function",
      ),
    [],
  );

  const open = () => {
    setText(generated);
    setCopied(false);
    ref.current?.showModal();
    document.documentElement.style.overflow = "hidden";
  };
  const close = () => ref.current?.close();

  const share = async () => {
    try {
      await navigator.share({ text });
    } catch {
      /* cancelado */
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const icon = (
    <svg
      viewBox="0 0 24 24"
      className="size-[20px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 3v12M7.5 7.5L12 3l4.5 4.5" />
      <path d="M5 12v6.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V12" />
    </svg>
  );

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          onClick={open}
          aria-label="Compartilhar resumo do mês"
          className="grid size-10 shrink-0 place-items-center rounded-full text-ink-2 hover:bg-white/70"
        >
          {icon}
        </button>
      ) : (
        <button
          type="button"
          onClick={open}
          className="inline-flex items-center gap-2 rounded-full bg-surface px-4 py-2 text-[14px] font-semibold text-ink ring-1 ring-line hover:bg-paper"
        >
          {icon}
          Compartilhar
        </button>
      )}

      <dialog
        ref={ref}
        aria-label="Compartilhar resumo do mês"
        onClose={() => {
          document.documentElement.style.overflow = "";
        }}
        onClick={(e) => {
          if (e.target === ref.current) close();
        }}
        className="fm-sheet fixed inset-x-0 top-auto bottom-0 m-0 hidden max-h-[94dvh] w-full max-w-none flex-col overflow-hidden rounded-t-[28px] border-0 bg-paper p-0 text-ink shadow-2xl open:flex backdrop:bg-ink/45 backdrop:backdrop-blur-[2px] lg:inset-0 lg:m-auto lg:h-fit lg:max-h-[88vh] lg:w-[560px] lg:rounded-[24px]"
      >
        <div
          className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-line lg:hidden"
          aria-hidden
        />
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-3 pb-[calc(20px+env(safe-area-inset-bottom))] lg:pt-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="display text-[22px] font-bold tracking-tight">
                Compartilhar resumo
              </h2>
              <p className="mt-0.5 text-[14px] text-ink-2">
                Um texto curto de {report.monthTitle} para mandar a quem você
                quiser.
              </p>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="Fechar"
              className="-mr-2 grid size-10 shrink-0 place-items-center rounded-full text-ink-2 hover:bg-white/70"
            >
              <svg
                viewBox="0 0 24 24"
                className="size-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          <fieldset className="mt-4">
            <legend className="mb-2 text-[14px] font-medium text-ink-2">
              Além do saldo, incluir
            </legend>
            <div className="flex flex-wrap gap-2">
              {SECTIONS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={on[s.id]}
                  onClick={() => setOn((o) => ({ ...o, [s.id]: !o[s.id] }))}
                  className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[14px] font-medium ring-1 ${
                    on[s.id]
                      ? "bg-ink text-white ring-ink"
                      : "bg-surface text-ink-2 ring-line"
                  }`}
                >
                  {on[s.id] && (
                    <svg
                      viewBox="0 0 24 24"
                      className="size-3.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      aria-hidden
                    >
                      <path
                        d="M5 12.5l4.5 4.5L19 7.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                  {s.label}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="mt-4 block">
            <span className="mb-2 block text-[14px] font-medium text-ink-2">
              Recado (opcional)
            </span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-2xl border border-line bg-surface px-4 py-3 outline-none focus:border-brand"
            />
          </label>

          <label className="mt-4 block">
            <span className="mb-2 flex items-baseline justify-between gap-2 text-[14px] font-medium text-ink-2">
              Texto
              <span className="text-[12px] font-normal text-ink-3">
                Dá para editar antes de enviar
              </span>
            </span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={12}
              className="w-full resize-y rounded-2xl border border-line bg-surface px-4 py-3 font-[inherit] text-[14px] leading-relaxed outline-none focus:border-brand"
            />
          </label>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            {canShare && (
              <button
                type="button"
                onClick={share}
                className="flex-1 rounded-full bg-ink py-3.5 text-[15px] font-semibold text-white"
              >
                Compartilhar…
              </button>
            )}
            <a
              href={`https://wa.me/?text=${encodeURIComponent(text)}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex-1 rounded-full py-3.5 text-center text-[15px] font-semibold ${canShare ? "bg-surface text-ink ring-1 ring-line" : "bg-ink text-white"}`}
            >
              Enviar no WhatsApp
            </a>
            <button
              type="button"
              onClick={copy}
              aria-live="polite"
              className="flex-1 rounded-full bg-surface py-3.5 text-[15px] font-semibold text-ink ring-1 ring-line"
            >
              {copied ? "Copiado ✓" : "Copiar texto"}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
