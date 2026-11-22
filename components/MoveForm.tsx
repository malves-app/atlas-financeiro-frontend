"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { deleteMoveAction, saveMove } from "@/app/actions";
import { formatBRL, formatShortDate } from "@/lib/format";
import { centsText } from "@/lib/money-mask";
import { signedBRL, signedPercent, type MoveKind } from "@/lib/investments";
import { AmountField, DateChips, Segmented } from "./EntryForm";
import { LogoLoader } from "./LogoLoader";
import { showToast } from "./Toast";

const TEXT: Record<MoveKind, { tab: string; hint: string; amount: string; submit: string; toast: string }> = {
  aporte: { tab: "Aporte", hint: "Colocou dinheiro neste investimento.", amount: "Quanto você aplicou?", submit: "Registrar aporte", toast: "aporte" },
  resgate: { tab: "Resgate", hint: "Tirou dinheiro deste investimento.", amount: "Quanto você resgatou?", submit: "Registrar resgate", toast: "resgate" },
  saldo: {
    tab: "Novo saldo",
    hint: "Confira no app do banco ou da corretora e digite quanto tem hoje. A diferença é o rendimento.",
    amount: "Quanto tem hoje?",
    submit: "Atualizar saldo",
    toast: "saldo-atualizado",
  },
};

/** Registrar aporte, resgate ou o saldo de hoje. Ao salvar, o formulário se limpa e a página se atualiza. */
export function MoveForm({
  investmentId,
  balance,
  lastDate,
  today,
  initialKind = "aporte",
}: {
  investmentId: number;
  balance: number;
  lastDate: string | null;
  today: string;
  initialKind?: MoveKind;
}) {
  const [kind, setKind] = useState<MoveKind>(initialKind);
  const [cents, setCents] = useState(0);
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [state, action, pending] = useActionState(saveMove, undefined);
  const kindRef = useRef(kind);
  kindRef.current = kind;
  // Salvou: limpa o formulário (a página continua aberta e os números se atualizam) e avisa
  const [handled, setHandled] = useState<number | undefined>(undefined);
  if (state?.ok && state.at !== handled) {
    setHandled(state.at);
    setCents(0);
    setNote("");
    setDate(today);
  }
  useEffect(() => {
    if (state?.ok) showToast(TEXT[kindRef.current].toast);
  }, [state]);

  const t = TEXT[kind];
  const tooMuch = kind === "resgate" && cents > balance;
  const after = kind === "aporte" ? balance + cents : kind === "resgate" ? balance - cents : cents;
  const diff = cents - balance;

  return (
    <section id="movimentar" aria-labelledby="mov-titulo" className="mx-3 scroll-mt-4 rounded-[24px] bg-surface lg:mx-0">
      <form action={action}>
        <input type="hidden" name="investmentId" value={investmentId} />
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="amount" value={centsText(cents)} />
        <input type="hidden" name="date" value={date} />

        <div className="px-4 pt-4 lg:px-5">
          <h2 id="mov-titulo" className="text-[15px] font-semibold">
            Registrar movimentação
          </h2>
          <div className="mt-3">
            <Segmented
              label="O que aconteceu"
              size="sm"
              options={(["aporte", "resgate", "saldo"] as const).map((k) => [k, TEXT[k].tab] as const)}
              value={kind}
              onChange={setKind}
            />
          </div>
          <p className="mt-2 min-h-[2.5em] text-[13px] leading-snug text-ink-3">{t.hint}</p>
        </div>

        <AmountField
          cents={cents}
          onChange={setCents}
          negative={false}
          onNegativeChange={() => {}}
          allowNegative={false}
          tone={kind === "resgate" ? "ink" : "brand"}
          label={t.amount}
        />

        <div className="-mt-2 flex min-h-8 flex-wrap items-center justify-center gap-2 px-4 pb-4 text-center text-[13.5px]">
          {kind === "resgate" && balance > 0 && cents !== balance && (
            <button
              type="button"
              onClick={() => setCents(balance)}
              className="rounded-full bg-paper px-3 py-1.5 text-[13px] font-medium text-ink-2 hover:bg-line/70"
            >
              Resgatar tudo{" "}
              <span className="num font-semibold">
                {formatBRL(balance)}
              </span>
            </button>
          )}
          {cents > 0 && kind !== "saldo" && !tooMuch && (
            <span className="text-ink-3">
              Saldo vai de{" "}
              <span className="num font-semibold text-ink-2">
                {formatBRL(balance)}
              </span>{" "}
              para{" "}
              <span className="num font-semibold text-ink">
                {formatBRL(after)}
              </span>
            </span>
          )}
          {tooMuch && (
            <span role="alert" className="font-medium text-danger">
              É mais do que o saldo ({formatBRL(balance)})
            </span>
          )}
          {kind === "saldo" && cents > 0 && balance > 0 && (
            <span className="text-ink-3">
              {diff === 0 ? (
                "Igual ao último registro"
              ) : (
                <>
                  {diff > 0 ? "Rendeu" : "Caiu"}{" "}
                  <span className={`num font-semibold ${diff > 0 ? "text-brand" : "text-danger"}`}>
                    {signedBRL(diff)} ({signedPercent(diff / balance)})
                  </span>
                  {lastDate && <> desde {formatShortDate(lastDate)}</>}
                </>
              )}
            </span>
          )}
        </div>

        <div className="space-y-4 border-t border-line/70 px-4 pt-4 pb-4 lg:px-5 lg:pb-5">
          <div>
            <span className="mb-2 block text-[13px] font-medium text-ink-3">Data</span>
            <DateChips value={date} onChange={(d) => setDate(d > today ? today : d)} today={today} />
          </div>
          <label className="block">
            <span className="mb-2 block text-[13px] font-medium text-ink-3">Observação (opcional)</span>
            <input
              name="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={140}
              autoComplete="off"
              placeholder={kind === "aporte" ? "Ex.: 13º salário" : kind === "resgate" ? "Ex.: Viagem" : "Ex.: Conferido no app"}
              className="w-full rounded-2xl bg-paper px-4 py-3 outline-none placeholder:text-ink-3/70 focus:ring-2 focus:ring-ink"
            />
          </label>

          {state?.error && (
            <p role="alert" className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-[14px] font-medium text-danger">
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending || cents <= 0 || tooMuch}
            aria-busy={pending || undefined}
            className="flex w-full items-center justify-center gap-2.5 rounded-full bg-ink py-3.5 text-[16px] font-semibold text-white transition-opacity disabled:opacity-40 aria-busy:opacity-90"
          >
            {pending && <LogoLoader className="size-5" />}
            {pending ? "Salvando…" : t.submit}
          </button>
        </div>
      </form>
    </section>
  );
}

/** Lixeira da linha do histórico: dois toques para excluir, sem sair da página. */
export function MoveDelete({ id }: { id: number }) {
  const [armed, setArmed] = useState(false);
  const [pending, start] = useTransition();
  if (armed) {
    return (
      <span className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const f = new FormData();
              f.set("id", String(id));
              await deleteMoveAction(f);
              showToast("movimentacao-excluida");
            })
          }
          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-danger px-3 text-[13px] font-semibold text-white"
        >
          {pending && <LogoLoader tone="brand" className="size-3.5" />}
          Excluir
        </button>
        <button
          type="button"
          aria-label="Cancelar"
          onClick={() => setArmed(false)}
          className="grid size-8 place-items-center rounded-full text-ink-3 hover:bg-paper"
        >
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </span>
    );
  }
  return (
    <button
      type="button"
      aria-label="Excluir movimentação"
      onClick={() => setArmed(true)}
      className="grid size-8 shrink-0 place-items-center rounded-full text-ink-3/70 transition-colors hover:bg-danger-soft hover:text-danger"
    >
      <svg viewBox="0 0 24 24" className="size-[17px]" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
      </svg>
    </button>
  );
}
