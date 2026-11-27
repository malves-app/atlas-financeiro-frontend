"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const MESSAGES: Record<string, string> = {
  gasto: "Gasto salvo",
  entrada: "Entrada salva",
  fixo: "Fixo salvo",
  parcelado: "Compra parcelada salva",
  encerrado: "Fixo encerrado",
  categoria: "Categoria removida",
  categorias: "Categorias preenchidas pelo histórico",
  ajustes: "Configurações salvas",
  "categoria-salva": "Categoria salva",
  "categoria-criada": "Categoria criada",
  pagamento: "Forma de pagamento removida",
  "pagamento-salvo": "Forma de pagamento salva",
  "pagamento-criado": "Forma de pagamento criada",
  editado: "Alterações salvas",
  excluido: "Lançamento excluído",
  excluida: "Entrada excluída",
  "pagamento-minimo": "Mantenha pelo menos uma forma de pagamento",
  meta: "Meta salva",
  "meta-encerrada": "Meta encerrada",
  investimento: "Investimento salvo",
  "investimento-encerrado": "Investimento encerrado",
  "investimento-reaberto": "Investimento reaberto",
  "investimento-apagado": "Investimento apagado",
  aporte: "Aporte registrado",
  resgate: "Resgate registrado",
  "saldo-atualizado": "Saldo atualizado",
  "movimentacao-excluida": "Movimentação excluída",
};

/** Mostra o aviso sem mudar de página (usado pela janela de lançar). */
export function showToast(key: string) {
  window.dispatchEvent(new CustomEvent("fm:toast", { detail: key }));
}

/** Mostra um aviso com um texto pronto (ex.: "12 correções feitas"). */
export function showToastText(text: string) {
  window.dispatchEvent(new CustomEvent("fm:toast", { detail: `text:${text}` }));
}

export function Toast() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const ok = sp.get("ok");
  const [shown, setShown] = useState<string | null>(null);

  useEffect(() => {
    if (!ok) return;
    setShown(MESSAGES[ok] ?? "Salvo");
    const params = new URLSearchParams(sp.toString());
    params.delete("ok");
    const q = params.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    const t = setTimeout(() => setShown(null), 2600);
    return () => clearTimeout(t);
  }, [ok, pathname, router, sp]);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const onToast = (e: Event) => {
      const key = (e as CustomEvent<string>).detail;
      setShown(key.startsWith("text:") ? key.slice(5) : (MESSAGES[key] ?? "Salvo"));
      clearTimeout(t);
      t = setTimeout(() => setShown(null), 2600);
    };
    window.addEventListener("fm:toast", onToast);
    return () => {
      window.removeEventListener("fm:toast", onToast);
      clearTimeout(t);
    };
  }, []);

  if (!shown) return null;
  return (
    <div role="status" className="pointer-events-none fixed inset-x-0 bottom-24 z-40 flex justify-center px-4 lg:bottom-8 lg:pl-60">
      <div className="toast flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-[14px] font-medium text-white shadow-lg">
        <svg viewBox="0 0 24 24" className="size-4 text-[#7fd8c8]" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
          <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {shown}
      </div>
    </div>
  );
}
