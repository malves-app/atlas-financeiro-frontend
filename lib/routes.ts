// Telas do app reconhecidas pela navegação instantânea (components/NavState.tsx): para cada
// endereço, qual skeleton mostrar enquanto a tela carrega.

export type RouteKey =
  | "painel"
  | "lancamentos"
  | "lancamento"
  | "entrada"
  | "fixos"
  | "fixo-novo"
  | "fixo"
  | "estatisticas"
  | "metas"
  | "meta-nova"
  | "meta"
  | "ajustes"
  | "novo";

const ROUTES: [RegExp, RouteKey][] = [
  [/^\/$/, "painel"],
  [/^\/lancamentos\/?$/, "lancamentos"],
  [/^\/lancamentos\/\d+\/?$/, "lancamento"],
  [/^\/entradas\/\d+\/?$/, "entrada"],
  [/^\/fixos\/?$/, "fixos"],
  [/^\/fixos\/novo\/?$/, "fixo-novo"],
  [/^\/fixos\/\d+\/?$/, "fixo"],
  [/^\/estatisticas\/?$/, "estatisticas"],
  [/^\/metas\/?$/, "metas"],
  [/^\/metas\/nova\/?$/, "meta-nova"],
  [/^\/metas\/\d+\/?$/, "meta"],
  [/^\/ajustes\/?$/, "ajustes"],
  [/^\/novo\/?$/, "novo"],
];

export function matchRoute(pathname: string): RouteKey | null {
  for (const [re, key] of ROUTES) if (re.test(pathname)) return key;
  return null;
}

/** Abertas por cima da página atual (janela no computador, folha no celular). */
const MODAL_ROUTES = new Set<RouteKey>(["novo", "lancamento", "entrada"]);

export function isModalRoute(route: RouteKey | null): boolean {
  return route != null && MODAL_ROUTES.has(route);
}
