"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { currentMonth, isMonth } from "@/lib/format";
import { isModalRoute, matchRoute, type RouteKey } from "@/lib/routes";

/*
 * Navegação instantânea. As páginas buscam os dados no servidor, então entre o toque e a
 * tela nova existe uma espera. Aqui a tela responde na hora do toque: o provider percebe o
 * clique num link (ou o envio de uma busca) e, até o Next trocar de endereço, as telas
 * mostram o skeleton do destino (RouteTransition), trocam só a parte que muda (PendingSwap)
 * e já marcam a aba, o filtro, o mês e o item do menu escolhidos.
 */

interface Pending {
  url: URL;
  route: RouteKey;
  /** Endereço em que o toque aconteceu: quando o endereço muda, a espera acabou. */
  from: string;
  anchor: HTMLAnchorElement | null;
}

const NavContext = createContext<{ committed: string; pending: Pending | null }>({ committed: "/", pending: null });

const EVENT = "atlas:navigate";

/** Para navegações feitas por código (router.push): avisa antes, para o carregamento aparecer na hora. */
export function startNavigation(href: string) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: href }));
}

const pathAndSearch = (pathname: string, search: string) => {
  const q = new URLSearchParams(search).toString();
  return q ? `${pathname}?${q}` : pathname;
};

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const committed = pathAndSearch(pathname, search);
  const committedRef = useRef(committed);
  const [pending, setPending] = useState<Pending | null>(null);

  // O endereço mudou: a navegação terminou (ou foi para outro lugar, como um redirecionamento).
  useLayoutEffect(() => {
    committedRef.current = committed;
    setPending((p) => (p && p.from !== committed ? null : p));
  }, [committed]);

  const begin = useCallback((href: string, anchor: HTMLAnchorElement | null = null) => {
    let url: URL;
    try {
      url = new URL(href, window.location.href);
    } catch {
      return;
    }
    if (url.origin !== window.location.origin) return;
    const route = matchRoute(url.pathname);
    if (!route) return;
    const from = committedRef.current;
    // Mesmo endereço (ou só a #âncora): o Next só atualiza os dados, sem trocar de tela.
    if (pathAndSearch(url.pathname, url.search) === from) return;
    setPending({ url, route, from, anchor });
  }, []);

  useEffect(() => {
    // Depois do Link do Next: ele chama preventDefault quando vai navegar sem recarregar a página.
    const onClick = (e: MouseEvent) => {
      if (!e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]");
      if (!(a instanceof HTMLAnchorElement)) return;
      if ((a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      begin(a.href, a);
    };
    // Buscas (next/form): formulário GET enviado sem recarregar a página.
    const onSubmit = (e: SubmitEvent) => {
      const form = e.target;
      if (!e.defaultPrevented || !(form instanceof HTMLFormElement) || form.method.toLowerCase() !== "get") return;
      const raw = form.getAttribute("action");
      if (!raw) return;
      let url: URL;
      try {
        url = new URL(raw, window.location.href);
      } catch {
        return;
      }
      const params = new URLSearchParams();
      new FormData(form, e.submitter ?? undefined).forEach((v, k) => {
        if (typeof v === "string") params.append(k, v);
      });
      url.search = params.toString();
      begin(url.href);
    };
    const onProgrammatic = (e: Event) => begin((e as CustomEvent<string>).detail);
    const onPop = () => setPending(null);
    window.addEventListener("click", onClick);
    window.addEventListener("submit", onSubmit);
    window.addEventListener(EVENT, onProgrammatic);
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("click", onClick);
      window.removeEventListener("submit", onSubmit);
      window.removeEventListener(EVENT, onProgrammatic);
      window.removeEventListener("popstate", onPop);
    };
  }, [begin]);

  // Se a navegação não acontecer (erro de rede, por exemplo), o skeleton não fica para sempre.
  // Link clicado dentro de uma janela aberta pulsa enquanto a página nova carrega por baixo.
  useEffect(() => {
    if (!pending) return;
    const t = setTimeout(() => setPending(null), 15000);
    const a = pending.anchor?.closest("dialog[open]") ? pending.anchor : null;
    a?.setAttribute("data-nav-pending", "");
    return () => {
      clearTimeout(t);
      a?.removeAttribute("data-nav-pending");
    };
  }, [pending]);

  const value = useMemo(
    () => ({ committed, pending: pending && pending.from === committed ? pending : null }),
    [committed, pending],
  );
  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

/**
 * A navegação em andamento, se houver.
 * - target: endereço de destino
 * - samePath: mesma tela, outros parâmetros (mês, aba, filtro, período)
 * - modal: o destino abre numa janela por cima da página
 */
export function usePendingNav() {
  const { committed, pending } = useContext(NavContext);
  return useMemo(() => {
    const current = new URL(committed, "http://atlas.local");
    const target = pending?.url ?? null;
    const modal = !!pending && isModalRoute(pending.route);
    return {
      current,
      target,
      route: pending?.route ?? null,
      modal,
      samePath: !!target && !modal && target.pathname === current.pathname,
    };
  }, [committed, pending]);
}

/** Valor de um parâmetro já considerando a navegação em andamento na mesma tela. */
export function useOptimisticParam(name: string, current: string, fallback = ""): string {
  const nav = usePendingNav();
  return nav.target && nav.samePath ? (nav.target.searchParams.get(name) ?? fallback) : current;
}

/** Mês na tela, já considerando a navegação em andamento (troca de mês). */
export function useViewMonth(month: string): string {
  const nav = usePendingNav();
  if (!nav.target || !nav.samePath) return month;
  const m = nav.target.searchParams.get("m");
  return isMonth(m) ? m : currentMonth();
}

/** Classe que reinicia o fade de entrada toda vez que o conteúdo volta depois do skeleton. */
export function useReveal(waiting: boolean) {
  const [n, setN] = useState(0);
  const was = useRef(waiting);
  useLayoutEffect(() => {
    if (was.current && !waiting) setN((x) => x + 1);
    was.current = waiting;
  }, [waiting]);
  return n % 2 ? "reveal-b" : "reveal-a";
}

/**
 * Parte da tela que depende dos parâmetros do endereço. Numa troca na mesma tela, mostra o
 * skeleton (fallback) na hora do toque. `keys`: só troca quando um destes parâmetros muda.
 */
export function PendingSwap({
  keys,
  fallback,
  children,
  className = "",
}: {
  keys?: string[];
  fallback: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const nav = usePendingNav();
  const target = nav.samePath ? nav.target : null;
  const swap =
    !!target && (!keys || keys.some((k) => (target.searchParams.get(k) ?? "") !== (nav.current.searchParams.get(k) ?? "")));
  const reveal = useReveal(swap);
  return (
    <>
      {swap && fallback}
      <div hidden={swap} className={`${reveal} ${className}`}>
        {children}
      </div>
    </>
  );
}

/**
 * Link de aba ou filtro que já aparece escolhido no toque (atributo data-active), antes da
 * página responder. `match`: parâmetros que definem a escolha.
 */
export function OptimisticLink({
  active,
  match,
  current = false,
  ...props
}: React.ComponentProps<typeof Link> & { href: string; active: boolean; match: string[]; current?: boolean }) {
  const nav = usePendingNav();
  let on = active;
  if (nav.target && nav.samePath) {
    const link = new URL(props.href, "http://atlas.local");
    const target = nav.target;
    on = match.every((k) => (link.searchParams.get(k) ?? "") === (target.searchParams.get(k) ?? ""));
  }
  return <Link {...props} data-active={on ? "" : undefined} aria-current={current && on ? "page" : undefined} />;
}

/** Painel de uma aba já renderizada: troca na hora do toque, sem esperar a página. */
export function ParamShow({
  name,
  value,
  current,
  fallback = "",
  className,
  children,
}: {
  name: string;
  value: string;
  current: string;
  fallback?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const v = useOptimisticParam(name, current, fallback);
  return (
    <div hidden={v !== value} className={className}>
      {children}
    </div>
  );
}
