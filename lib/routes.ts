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
  | "investimentos"
  | "investimento-novo"
  | "investimento"
  | "investimento-editar"
  | "configuracoes"
  | "config-pagamentos"
  | "config-pagamento-nova"
  | "config-pagamento"
  | "config-categorias"
  | "config-categoria-nova"
  | "config-categoria"
  | "config-conta"
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
  [/^\/investimentos\/?$/, "investimentos"],
  [/^\/investimentos\/novo\/?$/, "investimento-novo"],
  [/^\/investimentos\/\d+\/?$/, "investimento"],
  [/^\/investimentos\/\d+\/editar\/?$/, "investimento-editar"],
  [/^\/configuracoes\/?$/, "configuracoes"],
  [/^\/configuracoes\/pagamentos\/?$/, "config-pagamentos"],
  [/^\/configuracoes\/pagamentos\/nova\/?$/, "config-pagamento-nova"],
  [/^\/configuracoes\/pagamentos\/\d+\/?$/, "config-pagamento"],
  [/^\/configuracoes\/categorias\/?$/, "config-categorias"],
  [/^\/configuracoes\/categorias\/nova\/?$/, "config-categoria-nova"],
  [/^\/configuracoes\/categorias\/\d+\/?$/, "config-categoria"],
  [/^\/configuracoes\/conta\/?$/, "config-conta"],
  [/^\/novo\/?$/, "novo"],
];

export function matchRoute(pathname: string): RouteKey | null {
  for (const [re, key] of ROUTES) if (re.test(pathname)) return key;
  return null;
}

/** Abertas por cima da página atual (janela no computador, folha no celular). */
const MODAL_ROUTES = new Set<RouteKey>(["novo", "lancamento", "entrada", "meta-nova", "investimento-novo"]);

export function isModalRoute(route: RouteKey | null): boolean {
  return route != null && MODAL_ROUTES.has(route);
}
