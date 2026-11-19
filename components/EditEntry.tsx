"use client";

import Link from "next/link";
import { deleteEntryAction, deleteIncomeAction } from "@/app/actions";
import {
  ExpenseForm,
  IncomeForm,
  type CategoryOption,
  type FormMode,
  type PaymentMethodOption,
  type SuggestionOption,
} from "./EntryForm";
import { DeleteButton } from "./DeleteButton";
import { useCloseModal } from "./Modal";
import { showToast } from "./Toast";

export interface EntryEditorData {
  entry: {
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
  recurringId: number | null;
  categories: CategoryOption[];
  suggestions: SuggestionOption[];
  methods: PaymentMethodOption[];
  today: string;
}

export interface IncomeEditorData {
  income: { id: number; name: string; amountCents: number; date: string | null; month: string };
  suggestions: string[];
  today: string;
}

/** Cabeçalho: na janela, título + fechar; na página inteira, voltar + título. */
function EditorHeader({ title, mode, back }: { title: string; mode: FormMode; back: string }) {
  const closeModal = useCloseModal();
  if (mode === "modal") {
    return (
      <header className="sticky top-0 z-10 flex items-center justify-between bg-paper/90 px-5 pt-2 pb-2 backdrop-blur-md lg:pt-5">
        <h1 className="display text-[20px] font-bold">{title}</h1>
        <button
          type="button"
          onClick={() => closeModal?.()}
          aria-label="Fechar"
          title="Fechar (Esc)"
          className="grid size-10 place-items-center rounded-full bg-surface text-ink-2 ring-1 ring-line/80 transition-colors hover:bg-white hover:text-ink"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </header>
    );
  }
  return (
    <header className="flex items-center gap-2 px-2 pt-[max(env(safe-area-inset-top),10px)] pb-1 lg:px-0 lg:pt-2 lg:pb-4">
      <Link href={back} aria-label="Voltar" className="grid size-10 place-items-center rounded-full text-ink-2 hover:bg-surface">
        <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M15 6l-6 6 6 6" />
        </svg>
      </Link>
      <h1 className="display text-[20px] font-bold">{title}</h1>
    </header>
  );
}

/** Editar um gasto (do dia a dia ou fixo). Abre na janela ou na página /lancamentos/[id]. */
export function EntryEditor({ data, mode, back }: { data: EntryEditorData; mode: FormMode; back: string }) {
  const closeModal = useCloseModal();
  const { entry } = data;
  const title = entry.kind === "avulso" ? "Editar gasto" : entry.kind === "fixo" ? "Editar fixo do mês" : "Editar fixo do cartão";
  const inModal = mode === "modal" && !!closeModal;

  return (
    <>
      <EditorHeader title={title} mode={mode} back={back} />
      <ExpenseForm
        categories={data.categories}
        suggestions={data.suggestions}
        methods={data.methods}
        today={data.today}
        back={back}
        hasRecurring={data.recurringId != null}
        entry={entry}
        mode={mode}
        onDone={
          inModal
            ? () => {
                showToast("editado");
                closeModal({ refresh: true });
              }
            : undefined
        }
      />
      <div className="mx-5 mt-3 space-y-3">
        {data.recurringId != null && (
          <Link
            href={`/fixos/${data.recurringId}?m=${entry.month}`}
            className="flex items-center justify-between gap-3 rounded-[20px] bg-surface px-4 py-3.5 text-[15px] font-medium ring-1 ring-line/80 transition-colors hover:ring-ink-3/40"
          >
            Editar ou encerrar este fixo em todos os meses
            <svg viewBox="0 0 24 24" className="size-4 shrink-0 text-ink-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M9 6l6 6-6 6" />
            </svg>
          </Link>
        )}
        <DeleteButton
          action={deleteEntryAction}
          fields={{ id: String(entry.id), back, mode }}
          label="Excluir este lançamento"
          onDone={
            inModal
              ? () => {
                  showToast("excluido");
                  closeModal({ refresh: true });
                }
              : undefined
          }
        />
      </div>
    </>
  );
}

/** Editar uma entrada. Abre na janela ou na página /entradas/[id]. */
export function IncomeEditor({ data, mode, back }: { data: IncomeEditorData; mode: FormMode; back: string }) {
  const closeModal = useCloseModal();
  const inModal = mode === "modal" && !!closeModal;
  return (
    <>
      <EditorHeader title="Editar entrada" mode={mode} back={back} />
      <IncomeForm
        suggestions={data.suggestions}
        today={data.today}
        defaultMonth={data.income.month}
        income={data.income}
        back={back}
        mode={mode}
        onDone={
          inModal
            ? () => {
                showToast("editado");
                closeModal({ refresh: true });
              }
            : undefined
        }
      />
      <div className="mx-5 mt-3">
        <DeleteButton
          action={deleteIncomeAction}
          fields={{ id: String(data.income.id), back, mode }}
          label="Excluir esta entrada"
          onDone={
            inModal
              ? () => {
                  showToast("excluida");
                  closeModal({ refresh: true });
                }
              : undefined
          }
        />
      </div>
    </>
  );
}
