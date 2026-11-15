"use client";

import { useState, useTransition } from "react";

/** Exclusão em dois toques, sem janela de confirmação do navegador. */
export function DeleteButton({
  action,
  fields,
  label,
  confirmLabel = "Confirmar exclusão",
  onDone,
}: {
  action: (f: FormData) => Promise<void>;
  fields: Record<string, string>;
  label: string;
  confirmLabel?: string;
  /** Na janela: chamado depois de excluir (para fechar), em vez de mudar de página. */
  onDone?: () => void;
}) {
  const [armed, setArmed] = useState(false);
  const [pending, start] = useTransition();
  const run = onDone
    ? (f: FormData) =>
        start(async () => {
          await action(f);
          onDone();
        })
    : action;
  return (
    <form action={run} className="pb-6">
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {armed ? (
        <div className="flex gap-2">
          <button type="submit" disabled={pending} className="flex-1 rounded-full bg-danger py-3 text-[15px] font-semibold text-white disabled:opacity-60">
            {pending ? "Excluindo…" : confirmLabel}
          </button>
          <button
            type="button"
            onClick={() => setArmed(false)}
            className="rounded-full border border-line bg-surface px-5 py-3 text-[15px] font-semibold"
          >
            Cancelar
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setArmed(true)}
          className="w-full rounded-full py-3 text-[15px] font-semibold text-danger hover:bg-danger-soft"
        >
          {label}
        </button>
      )}
    </form>
  );
}
