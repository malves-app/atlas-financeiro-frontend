"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ExpenseForm,
  IncomeForm,
  type CategoryOption,
  type FormMode,
  type PaymentMethodOption,
  type SuggestionOption,
} from "./EntryForm";
import { useCloseModal } from "./Modal";
import { showToast } from "./Toast";

export interface QuickAddData {
  categories: CategoryOption[];
  suggestions: SuggestionOption[];
  methods: PaymentMethodOption[];
  incomeSuggestions: string[];
  today: string;
}

/** Lançar gasto ou entrada. Usado na janela (modal) e na página /novo. */
export function QuickAdd({
  data,
  mode,
  month,
  initialTab = "gasto",
}: {
  data: QuickAddData;
  mode: FormMode;
  month: string;
  initialTab?: "gasto" | "entrada";
}) {
  const [tab, setTab] = useState<"gasto" | "entrada">(initialTab);
  const [nonce, setNonce] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 2500);
    return () => clearTimeout(t);
  }, [flash]);
  const closeModal = useCloseModal();
  const router = useRouter();

  const onDone = useCallback(
    (again: boolean) => {
      if (again) {
        // continua aberto, limpo para o próximo; o aviso aparece dentro da janela
        setFlash(tab === "gasto" ? "Gasto salvo" : "Entrada salva");
        setNonce((n) => n + 1);
        router.refresh();
      } else {
        showToast(tab === "gasto" ? "gasto" : "entrada");
        closeModal?.({ refresh: true });
      }
    },
    [tab, closeModal, router],
  );

  const tabBtn = (value: "gasto" | "entrada", label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === value}
      onClick={() => {
        setTab(value);
        setNonce((n) => n + 1);
      }}
      className={`rounded-full px-4 py-2 text-[15px] font-semibold ${
        tab === value ? (value === "gasto" ? "bg-ink text-white" : "bg-brand text-white") : "text-ink-2"
      }`}
    >
      {label}
    </button>
  );

  const closeIcon = (
    <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );

  return (
    <>
      <header
        className={`flex items-center justify-between px-3 pb-2 ${
          mode === "modal" ? "sticky top-0 z-10 bg-paper/95 pt-2 backdrop-blur lg:px-4 lg:pt-4" : "pt-[max(env(safe-area-inset-top),10px)] lg:px-0 lg:pt-2 lg:pb-4"
        }`}
      >
        <div role="tablist" aria-label="Tipo de lançamento" className="flex gap-1 rounded-full bg-surface p-1 ring-1 ring-line">
          {tabBtn("gasto", "Gasto")}
          {tabBtn("entrada", "Entrada")}
        </div>
        {flash && (
          <span role="status" className="toast flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-[13px] font-medium text-white">
            <svg viewBox="0 0 24 24" className="size-3.5 text-[#7fd8c8]" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
              <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {flash}
          </span>
        )}
        {mode === "modal" ? (
          <button
            type="button"
            onClick={() => closeModal?.()}
            aria-label="Fechar"
            className="grid size-10 place-items-center rounded-full text-ink-2 hover:bg-surface"
          >
            {closeIcon}
          </button>
        ) : (
          <Link href={`/?m=${month}`} aria-label="Fechar" className="grid size-10 place-items-center rounded-full text-ink-2 hover:bg-surface">
            {closeIcon}
          </Link>
        )}
      </header>

      {tab === "gasto" ? (
        <ExpenseForm
          key={`g${nonce}`}
          categories={data.categories}
          suggestions={data.suggestions}
          methods={data.methods}
          today={data.today}
          mode={mode}
          onDone={onDone}
        />
      ) : (
        <IncomeForm
          key={`e${nonce}`}
          suggestions={data.incomeSuggestions}
          today={data.today}
          defaultMonth={month}
          mode={mode}
          onDone={onDone}
        />
      )}
    </>
  );
}
