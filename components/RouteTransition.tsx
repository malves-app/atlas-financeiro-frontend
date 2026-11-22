"use client";

import { useLayoutEffect, useRef } from "react";
import { usePendingNav } from "./NavState";
import { ModalSkeleton, RouteSkeleton } from "./PageSkeletons";
import { SHEET_CLASS, markSheetHandoff } from "./Modal";
import type { RouteKey } from "@/lib/routes";

/**
 * Envolve o conteúdo das páginas. No toque num link para outra tela, troca a página atual
 * pelo skeleton do destino na hora; num link que abre janela (lançar, editar), abre a folha
 * com o skeleton do formulário. Tudo some sozinho quando o endereço muda.
 */
export function RouteTransition({ children }: { children: React.ReactNode }) {
  const nav = usePendingNav();
  const target = nav.target;
  const overlay = target && nav.route && !nav.modal && !nav.samePath ? nav.route : null;
  const key = overlay && target ? target.href : null;

  // Tela nova começa do topo (o Next faria o mesmo quando ela chegasse).
  useLayoutEffect(() => {
    if (key) window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [key]);

  return (
    <>
      <div hidden={!!overlay}>{children}</div>
      {overlay && target && <RouteSkeleton key={key} route={overlay} url={target} />}
      {nav.modal && nav.route && target && <PendingSheet key={target.href} route={nav.route} url={target} />}
    </>
  );
}

function PendingSheet({ route, url }: { route: RouteKey; url: URL }) {
  const ref = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
      markSheetHandoff();
    }
  }, []);
  return (
    <dialog ref={ref} aria-label="Carregando" onCancel={(e) => e.preventDefault()} className={SHEET_CLASS}>
      <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-line lg:hidden" aria-hidden />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <ModalSkeleton route={route} url={url} />
      </div>
    </dialog>
  );
}
