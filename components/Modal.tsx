"use client";

import { createContext, useCallback, useContext, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type CloseFn = (opts?: { refresh?: boolean }) => void;
const ModalContext = createContext<CloseFn | null>(null);

/** Fecha o modal em que o componente está (ou null se não estiver num modal). */
export function useCloseModal() {
  return useContext(ModalContext);
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

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) {
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
        className="fm-sheet fixed inset-x-0 top-auto bottom-0 m-0 hidden max-h-[94dvh] border-0 open:flex w-full max-w-none flex-col overflow-hidden rounded-t-[28px] bg-paper p-0 text-ink shadow-2xl backdrop:bg-ink/45 backdrop:backdrop-blur-[2px] lg:inset-0 lg:m-auto lg:h-fit lg:max-h-[88vh] lg:w-[560px] lg:rounded-[24px]"
      >
        <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-line lg:hidden" aria-hidden />
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </dialog>
    </ModalContext.Provider>
  );
}
