"use client";

import { useOptimistic, useTransition } from "react";
import { togglePaid } from "@/app/actions";

/** Caixa de "pago?" que responde na hora e grava em segundo plano. */
export function PaidCheck({ id, paid, label }: { id: number; paid: boolean; label: string }) {
  const [optimistic, setOptimistic] = useOptimistic(paid);
  const [, start] = useTransition();
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={optimistic}
      aria-label={`${label}: ${optimistic ? "pago" : "não pago"}`}
      onClick={() =>
        start(async () => {
          setOptimistic(!optimistic);
          await togglePaid(id, !optimistic);
        })
      }
      className={`grid size-7 shrink-0 place-items-center rounded-full border-2 transition-colors ${
        optimistic ? "border-brand bg-brand text-white" : "border-line bg-surface text-transparent hover:border-ink-3"
      }`}
    >
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="3.2" aria-hidden>
        <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

/** Botão "Paguei" usado na lista de contas a pagar do painel. */
export function PayNowButton({ id, name }: { id: number; name: string }) {
  const [optimistic, setOptimistic] = useOptimistic(false);
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={optimistic || pending}
      onClick={() =>
        start(async () => {
          setOptimistic(true);
          await togglePaid(id, true);
        })
      }
      aria-label={`Marcar ${name} como pago`}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold transition-colors ${
        optimistic ? "bg-brand text-white" : "bg-brand-soft text-brand hover:bg-brand hover:text-white"
      }`}
    >
      <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
        <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {optimistic ? "Pago" : "Paguei"}
    </button>
  );
}
