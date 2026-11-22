"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { showToast } from "./Toast";

type CloseFn = (opts?: { refresh?: boolean }) => void;
const ModalContext = createContext<CloseFn | null>(null);

/** Fecha o modal em que o componente está (ou null se não estiver num modal). */
export function useCloseModal() {
  return useContext(ModalContext);
}

/** Visual da janela (também usado pela folha de carregamento em components/RouteTransition.tsx). */
export const SHEET_CLASS =
  "fm-sheet fixed inset-x-0 top-auto bottom-0 m-0 hidden max-h-[94dvh] border-0 open:flex w-full max-w-none flex-col overflow-hidden rounded-t-[28px] bg-paper p-0 text-ink shadow-[0_30px_80px_-20px_rgba(23,32,51,0.55)] backdrop:bg-ink/40 backdrop:backdrop-blur-[3px] lg:inset-0 lg:m-auto lg:h-fit lg:max-h-[90vh] lg:w-[600px] lg:rounded-[28px] lg:ring-1 lg:ring-white/60";

// Quando a folha de carregamento abre no toque, a janela de verdade chega um pouco depois:
// ela continua a animação de onde a outra estava, em vez de subir de novo.
let handoffAt: number | null = null;
export function markSheetHandoff() {
  handoffAt = performance.now();
}

/**
 * Janela por cima da página atual, aberta como rota (/novo) para funcionar com o botão
 * voltar do celular. No computador: janela no centro. No celular: folha que sobe de baixo.
 * Fecha com Esc, clique fora, botão voltar ou o X.
 */
export function Modal({ children, label }: { children: React.ReactNode; label: string }) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const refreshOnClose = useRef(false);
  const closing = useRef(false);

  // Antes da pintura: na troca com a folha de carregamento não pode haver um quadro sem janela.
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) {
      const elapsed = handoffAt == null ? Infinity : performance.now() - handoffAt;
      handoffAt = null;
      if (elapsed < 1500) {
        dialog.dataset.handoff = "";
        dialog.style.setProperty("--sheet-delay", `${-Math.round(elapsed)}ms`);
      }
      dialog.showModal();
      // o navegador foca o primeiro botão; o certo é o campo de valor (abre o teclado numérico)
      dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    }
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = prev;
    };
  }, []);

  const onClose = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    if (refreshOnClose.current) {
      window.addEventListener("popstate", () => setTimeout(() => router.refresh(), 0), { once: true });
    }
    router.back();
  }, [router]);

  const close: CloseFn = useCallback((opts) => {
    refreshOnClose.current = !!opts?.refresh;
    ref.current?.close();
  }, []);

  return (
    <ModalContext.Provider value={close}>
      <dialog
        ref={ref}
        aria-label={label}
        onClose={onClose}
        onClick={(e) => {
          if (e.target === ref.current) close();
        }}
        className={SHEET_CLASS}
      >
        <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-line lg:hidden" aria-hidden />
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </dialog>
    </ModalContext.Provider>
  );
}

/** Cabeçalho das janelas de criar (Nova meta, Novo investimento): título e o X, preso no topo ao rolar. */
export function SheetHeader({ title }: { title: string }) {
  const close = useCloseModal();
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-paper/90 px-5 pt-2 pb-2 backdrop-blur-md lg:pt-5">
      <h2 className="display text-[20px] font-bold">{title}</h2>
      <button
        type="button"
        onClick={() => close?.()}
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

/** Formulário de criar aberto na janela: ao salvar, avisa, fecha e atualiza a página de baixo. */
export function useCloseOnSaved(state: { ok?: boolean; at?: number } | undefined, toast: string) {
  const close = useCloseModal();
  const last = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (state?.ok && state.at && state.at !== last.current) {
      last.current = state.at;
      showToast(toast);
      close?.({ refresh: true });
    }
  }, [state, toast, close]);
}
