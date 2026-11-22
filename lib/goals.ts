// Metas: limites de gasto (do mês ou do ano) e metas de guardar dinheiro.
// Aqui ficam só os cálculos (funções puras, testadas em tests/goals.test.mts); quem busca os dados é lib/data.ts.
//
// Regras:
// - Gastos = tudo o que é do mês (o previsto, como nos totais do Painel): fixos e parcelas já entram desde o
//   começo do mês. "Guardar" = entradas − gastos (o saldo do fim do mês).
// - Meta do mês vale de start_month até end_month; meta do ano vale de AAAA-01 a AAAA-12.
// - Meta do ano soma os meses de janeiro até o mês atual (o mês atual pelo previsto).
// - Mês que passou: cumprida ou não. Mês atual: no caminho, atenção ou passou. Mês futuro: prevista.

import { daysInMonth, MONTH_NAMES, shiftMonth } from "./format";

export type GoalKind = "total" | "dia_a_dia" | "cartao" | "categoria" | "guardar";
export type GoalPeriod = "mes" | "ano";

export const GOAL_KINDS: GoalKind[] = ["total", "dia_a_dia", "categoria", "cartao", "guardar"];

export const KIND_INFO: Record<
  GoalKind,
  { title: string; emoji: string; desc: string; annual: boolean; saving: boolean; color: string }
> = {
  total: {
    title: "Limite de gastos",
    emoji: "🎯",
    desc: "Quanto gastar no total, com fixos e cartão",
    annual: true,
    saving: false,
    color: "#172033",
  },
  dia_a_dia: {
    title: "Dia a dia",
    emoji: "☕",
    desc: "Só os gastos variáveis, sem os fixos",
    annual: false,
    saving: false,
    color: "#5b6b8c",
  },
  categoria: {
    title: "Por categoria",
    emoji: "🏷️",
    desc: "Ex.: até R$ 600 em Restaurante",
    annual: true,
    saving: false,
    color: "#6250d6",
  },
  cartao: {
    title: "Fatura do cartão",
    emoji: "💳",
    desc: "Quanto pode vir no cartão no mês",
    annual: false,
    saving: false,
    color: "#c07e0c",
  },
  guardar: {
    title: "Guardar dinheiro",
    emoji: "🐷",
    desc: "Quanto você quer que sobre",
    annual: true,
    saving: true,
    color: "#0b7a6b",
  },
};

export const isGoalKind = (s: string): s is GoalKind => (GOAL_KINDS as string[]).includes(s);

export interface Goal {
  id: number;
  kind: GoalKind;
  period: GoalPeriod;
  categoryId: number | null;
  targetCents: number;
  startMonth: string;
  endMonth: string | null;
}

/** Totais de um mês que as metas usam. */
export interface MonthTotals {
  month: string;
  /** Tudo o que é do mês (previsto). */
  gastos: number;
  /** Dia a dia (lançamentos avulsos). */
  avulso: number;
  /** Tudo do mês no cartão de crédito (a fatura). */
  credito: number;
  entradas: number;
  byCategory: Record<number, number>;
}

export const emptyTotals = (month: string): MonthTotals => ({
  month,
  gastos: 0,
  avulso: 0,
  credito: 0,
  entradas: 0,
  byCategory: {},
});

/** Linhas da função fm_month_totals (banco) → totais por mês. */
export function totalsFromRows(
  rows: { month: string; kind: string; category_id: number | string | null; on_card: boolean; total: number | string | bigint }[],
): Map<string, MonthTotals> {
  const map = new Map<string, MonthTotals>();
  for (const r of rows) {
    const t = map.get(r.month) ?? emptyTotals(r.month);
    const v = Number(r.total);
    if (r.kind === "entrada") t.entradas += v;
    else {
      t.gastos += v;
      if (r.kind === "avulso") t.avulso += v;
      if (r.on_card) t.credito += v;
      if (r.category_id != null) {
        const id = Number(r.category_id);
        t.byCategory[id] = (t.byCategory[id] ?? 0) + v;
      }
    }
    map.set(r.month, t);
  }
  return map;
}

/** Quanto conta para a meta num mês: o que foi gasto (limites) ou o que sobrou (guardar). */
export function metricOf(kind: GoalKind, categoryId: number | null, t: MonthTotals): number {
  switch (kind) {
    case "total":
      return t.gastos;
    case "dia_a_dia":
      return t.avulso;
    case "cartao":
      return t.credito;
    case "categoria":
      return categoryId != null ? (t.byCategory[categoryId] ?? 0) : 0;
    case "guardar":
      return t.entradas - t.gastos;
  }
}

/** Mesma meta ao longo do tempo (as versões de uma meta do mês têm a mesma chave). */
export const goalKey = (g: Pick<Goal, "kind" | "period" | "categoryId">) => `${g.kind}|${g.period}|${g.categoryId ?? ""}`;

export const isActiveIn = (g: Pick<Goal, "startMonth" | "endMonth">, month: string) =>
  g.startMonth <= month && (g.endMonth == null || month <= g.endMonth);

/** Metas que valem num mês: as do mês e as do ano daquele mês. */
export function goalsFor(goals: Goal[], month: string) {
  const active = goals.filter((g) => isActiveIn(g, month));
  return {
    monthly: sortGoals(active.filter((g) => g.period === "mes")),
    annual: sortGoals(active.filter((g) => g.period === "ano")),
  };
}

const KIND_ORDER: Record<GoalKind, number> = { total: 0, dia_a_dia: 1, cartao: 2, categoria: 3, guardar: 4 };
function sortGoals(goals: Goal[]) {
  return [...goals].sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || (a.categoryId ?? 0) - (b.categoryId ?? 0));
}

/** Outra meta igual que já vale em algum mês do intervalo (não pode haver duas ao mesmo tempo). */
export function findConflict(
  goals: Goal[],
  g: Pick<Goal, "kind" | "period" | "categoryId" | "startMonth" | "endMonth">,
  ignoreId?: number,
): Goal | null {
  const key = goalKey(g);
  const end = g.endMonth ?? "9999-12";
  return (
    goals.find(
      (x) => x.id !== ignoreId && goalKey(x) === key && x.startMonth <= end && (x.endMonth ?? "9999-12") >= g.startMonth,
    ) ?? null
  );
}

/* ------------------------------- progresso ------------------------------- */

export type GoalStatus = "ok" | "atencao" | "passou" | "cumprida" | "nao_cumprida" | "prevista";
export type GoalPhase = "atual" | "passado" | "futuro";

export function statusLabel(status: GoalStatus, saving: boolean): string {
  switch (status) {
    case "ok":
      return "No caminho";
    case "atencao":
      return saving ? "Abaixo da meta" : "Atenção";
    case "passou":
      return saving ? "No vermelho" : "Passou";
    case "cumprida":
      return "Cumprida";
    case "nao_cumprida":
      return "Não cumprida";
    case "prevista":
      return "Prevista";
  }
}

/** Mais urgente primeiro (para o Painel). */
export const STATUS_WEIGHT: Record<GoalStatus, number> = {
  passou: 0,
  nao_cumprida: 1,
  atencao: 2,
  ok: 3,
  prevista: 4,
  cumprida: 5,
};

export interface GoalProgress {
  goal: Goal;
  key: string;
  name: string;
  emoji: string;
  /** "Limite por mês", "Meta para 2026"... */
  sub: string;
  saving: boolean;
  phase: GoalPhase;
  status: GoalStatus;
  /** Gasto (limites) ou o que sobrou (guardar), no mês ou no ano até agora. */
  value: number;
  target: number;
  /** value / target (pode passar de 1 ou ser negativo). */
  ratio: number;
  /** Quanto do período já passou (0 a 1), só no período atual. */
  pace: number | null;
  /** target − value: o que sobra do limite, ou o que falta guardar. */
  remaining: number;
  headline: string;
  detail: string;
  /** Meta do ano: valor de cada mês (null = mês que ainda não chegou). */
  months?: { month: string; value: number | null }[];
  /** Meta do mês: resultado nos meses anteriores (null = não havia a meta). */
  history?: { month: string; ok: boolean | null }[];
  /** Meses seguidos cumprindo a meta, até o último mês fechado. */
  streak?: number;
}

export interface GoalContext {
  /** Mês na tela. */
  month: string;
  /** Hoje (YYYY-MM-DD). */
  today: string;
  totals: Map<string, MonthTotals>;
  categories: Map<number, { name: string; emoji: string }>;
  /** Todas as metas (para o histórico das versões anteriores). Sem isso, não calcula o histórico. */
  allGoals?: Goal[];
  historyMonths?: number;
}

const brl0 = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
/** Valor redondo para frases: "R$ 180". */
export const formatBRL0 = (cents: number) => brl0.format(Math.round(Math.abs(cents) / 100));
const pct = (r: number) => `${Math.round(r * 100)}%`;

export function goalName(g: Goal, categories: Map<number, { name: string; emoji: string }>) {
  const year = g.startMonth.slice(0, 4);
  const annual = g.period === "ano";
  const info = KIND_INFO[g.kind];
  if (g.kind === "categoria") {
    const c = g.categoryId != null ? categories.get(g.categoryId) : undefined;
    return { name: c?.name ?? "Categoria removida", emoji: c?.emoji ?? "🏷️", sub: annual ? `Limite em ${year}` : "Limite por mês" };
  }
  const name =
    g.kind === "total"
      ? annual
        ? "Gastos do ano"
        : "Gastos do mês"
      : g.kind === "guardar"
        ? annual
          ? "Guardar no ano"
          : "Guardar no mês"
        : info.title;
  const sub = g.kind === "guardar" ? (annual ? `Meta para ${year}` : "Meta por mês") : annual ? `Limite em ${year}` : "Limite por mês";
  return { name, emoji: info.emoji, sub };
}

function statusOf(g: Goal, phase: GoalPhase, value: number, pace: number | null): GoalStatus {
  const target = g.targetCents;
  const saving = KIND_INFO[g.kind].saving;
  if (phase === "passado") return (saving ? value >= target : value <= target) ? "cumprida" : "nao_cumprida";
  if (!saving) {
    if (value > target) return "passou";
    if (phase === "futuro") return "prevista";
    const ratio = value / target;
    if (ratio >= 0.9) return "atencao";
    // Gastos variáveis (e o ano) andando mais rápido que o mês: atenção antes de estourar
    const variable = g.kind === "dia_a_dia" || g.kind === "categoria" || g.period === "ano";
    if (variable && pace != null && ratio > pace + 0.15) return "atencao";
    return "ok";
  }
  if (phase === "futuro") return "prevista";
  if (value >= target) return "ok";
  if (value < 0) return "passou";
  // No ano, guardando no ritmo (proporcional ao tempo que passou) também está no caminho
  if (g.period === "ano" && pace != null && value >= target * pace) return "ok";
  return "atencao";
}

export function goalProgress(g: Goal, ctx: GoalContext): GoalProgress {
  const cur = ctx.today.slice(0, 7);
  const info = KIND_INFO[g.kind];
  const saving = info.saving;
  const metric = (m: string) => {
    const t = ctx.totals.get(m);
    return t ? metricOf(g.kind, g.categoryId, t) : 0;
  };
  const day = Number(ctx.today.slice(8, 10));
  const { name, emoji, sub } = goalName(g, ctx.categories);

  let value: number;
  let phase: GoalPhase;
  let pace: number | null = null;
  let daysLeft = 0;
  let monthsLeft = 0;
  let months: GoalProgress["months"];
  const year = g.startMonth.slice(0, 4);

  if (g.period === "mes") {
    value = metric(ctx.month);
    phase = ctx.month < cur ? "passado" : ctx.month > cur ? "futuro" : "atual";
    if (phase === "atual") {
      const dim = daysInMonth(cur);
      pace = day / dim;
      daysLeft = dim - day + 1;
    }
  } else {
    const curYear = cur.slice(0, 4);
    phase = year < curYear ? "passado" : year > curYear ? "futuro" : "atual";
    const last = phase === "passado" ? `${year}-12` : cur;
    months = Array.from({ length: 12 }, (_, i) => {
      const m = `${year}-${String(i + 1).padStart(2, "0")}`;
      return { month: m, value: phase !== "futuro" && m <= last ? metric(m) : null };
    });
    value = months.reduce((a, m) => a + (m.value ?? 0), 0);
    if (phase === "atual") {
      const mi = Number(cur.slice(5, 7));
      pace = (mi - 1 + day / daysInMonth(cur)) / 12;
      monthsLeft = 12 - mi;
    }
  }

  const target = g.targetCents;
  const status = statusOf(g, phase, value, pace);
  const remaining = target - value;
  const ratio = target > 0 ? value / target : 0;
  const annual = g.period === "ano";
  let headline = "";
  let detail = "";

  if (!saving) {
    if (status === "passou" || status === "nao_cumprida") {
      headline = `Passou ${formatBRL0(-remaining)}`;
      detail = `${phase === "passado" ? "Usou" : "Já usou"} ${pct(ratio)} da meta de ${formatBRL0(target)}`;
    } else if (status === "cumprida") {
      headline = remaining > 0 ? `Ficou ${formatBRL0(remaining)} abaixo` : "Bem na meta";
      detail = `Usou ${pct(ratio)} da meta de ${formatBRL0(target)}`;
    } else if (status === "prevista") {
      headline = `Sobram ${formatBRL0(remaining)}`;
      detail = annual
        ? `Começa em janeiro de ${year}`
        : value > 0
          ? `${formatBRL0(value)} já previsto em fixos e parcelas`
          : "Nada lançado ainda";
    } else {
      headline = `Sobram ${formatBRL0(remaining)}`;
      if (annual)
        detail =
          monthsLeft === 0
            ? "Último mês do ano"
            : monthsLeft === 1
              ? `Até ${formatBRL0(remaining)} em dezembro`
              : `Até ${formatBRL0(remaining / monthsLeft)} por mês nos próximos ${monthsLeft} meses`;
      else
        detail =
          daysLeft <= 1
            ? "Último dia do mês"
            : `Até ${formatBRL0(remaining / daysLeft)} por dia nos ${daysLeft} dias que faltam`;
    }
  } else {
    if (phase === "passado") {
      if (status === "cumprida") {
        headline = `Guardou ${formatBRL0(value)}`;
        detail = value > target ? `${formatBRL0(value - target)} além da meta` : "Bem na meta";
      } else {
        headline = `Faltaram ${formatBRL0(remaining)}`;
        detail = value >= 0 ? `Guardou ${formatBRL0(value)} de ${formatBRL0(target)}` : `Fechou ${formatBRL0(value)} no vermelho`;
      }
    } else if (phase === "futuro") {
      headline = `Meta de ${formatBRL0(target)}`;
      detail = annual ? `Começa em janeiro de ${year}` : value > 0 ? `Previsão: sobram ${formatBRL0(value)}` : "As entradas do mês ainda não foram lançadas";
    } else if (annual) {
      if (value >= target) {
        headline = "Meta alcançada";
        detail = `${formatBRL0(value)} guardados até agora`;
      } else {
        headline = `Faltam ${formatBRL0(remaining)}`;
        detail =
          monthsLeft > 0
            ? `Guarde ${formatBRL0(remaining / monthsLeft)} por mês até dezembro`
            : value >= 0
              ? `${formatBRL0(value)} guardados até agora`
              : `${formatBRL0(value)} no vermelho no ano`;
      }
    } else if (value >= target) {
      headline = `Deve sobrar ${formatBRL0(value)}`;
      detail = value > target ? `${formatBRL0(value - target)} além da meta` : "Bem na meta";
    } else {
      headline = `Faltam ${formatBRL0(remaining)}`;
      detail = value >= 0 ? `Previsão: sobram ${formatBRL0(value)} no fim do mês` : `Previsão: fechar ${formatBRL0(value)} no vermelho`;
    }
  }

  const p: GoalProgress = {
    goal: g,
    key: goalKey(g),
    name,
    emoji,
    sub,
    saving,
    phase,
    status,
    value,
    target,
    ratio,
    pace,
    remaining,
    headline,
    detail,
    months,
  };

  // Histórico das metas do mês: os meses fechados antes do mês na tela, com a versão da meta que valia em cada um
  if (g.period === "mes" && ctx.allGoals) {
    const n = ctx.historyMonths ?? 6;
    const history: { month: string; ok: boolean | null }[] = [];
    for (let i = n; i >= 1; i--) {
      const m = shiftMonth(ctx.month, -i);
      if (m >= cur) continue;
      const version = ctx.allGoals.find((x) => x.period === "mes" && goalKey(x) === p.key && isActiveIn(x, m));
      if (!version) {
        history.push({ month: m, ok: null });
        continue;
      }
      const v = metric(m);
      history.push({ month: m, ok: saving ? v >= version.targetCents : v <= version.targetCents });
    }
    let streak = 0;
    for (let i = history.length - 1; i >= 0 && history[i].ok === true; i--) streak++;
    p.history = history.some((h) => h.ok != null) ? history : [];
    p.streak = streak;
  }
  return p;
}

/** Progresso de todas as metas que valem no mês na tela. */
export function goalBoard(goals: Goal[], ctx: Omit<GoalContext, "allGoals"> & { history?: boolean }) {
  const { monthly, annual } = goalsFor(goals, ctx.month);
  const full = { ...ctx, allGoals: ctx.history ? goals : undefined };
  return {
    monthly: monthly.map((g) => goalProgress(g, full)),
    annual: annual.map((g) => goalProgress(g, full)),
  };
}

/** Meses que o histórico e as metas do ano precisam (para buscar os totais de uma vez). */
export function monthsNeeded(month: string, today: string, historyMonths = 6) {
  const cur = today.slice(0, 7);
  const year = month.slice(0, 4);
  const yearEnd = `${year}-12` < cur ? `${year}-12` : cur;
  const from = [`${year}-01`, shiftMonth(month, -historyMonths)].sort()[0];
  const to = month > yearEnd ? month : yearEnd;
  return { from, to };
}

/* ------------------------------ sugestões ------------------------------ */

/**
 * Média dos últimos meses fechados com movimento (para sugerir o valor da meta).
 * Devolve null quando ainda não há mês fechado com dados.
 */
export function averages(totals: MonthTotals[], today: string, count = 3) {
  const cur = today.slice(0, 7);
  const done = totals
    .filter((t) => t.month < cur && (t.gastos !== 0 || t.entradas !== 0))
    .sort((a, b) => b.month.localeCompare(a.month))
    .slice(0, count);
  if (!done.length) return null;
  const avg = (f: (t: MonthTotals) => number) => Math.round(done.reduce((a, t) => a + f(t), 0) / done.length);
  const categories: Record<number, number> = {};
  const ids = new Set(done.flatMap((t) => Object.keys(t.byCategory).map(Number)));
  for (const id of ids) categories[id] = avg((t) => t.byCategory[id] ?? 0);
  return {
    months: done.length,
    total: avg((t) => t.gastos),
    dia_a_dia: avg((t) => t.avulso),
    cartao: avg((t) => t.credito),
    guardar: avg((t) => t.entradas - t.gastos),
    categories,
  };
}
export type Averages = NonNullable<ReturnType<typeof averages>>;

/** Valor de referência para uma meta a partir das médias (anual = 12 meses). */
export function suggestedValue(avg: Averages | null, kind: GoalKind, categoryId: number | null, period: GoalPeriod) {
  if (!avg) return null;
  const monthly = kind === "categoria" ? (categoryId != null ? (avg.categories[categoryId] ?? 0) : 0) : avg[kind];
  return period === "ano" ? monthly * 12 : monthly;
}

/* -------------------- impacto de um gasto (Lançar) -------------------- */

/** Uma meta de limite do mês, com o quanto já foi usado (para o formulário de lançar). */
export interface GoalHint {
  month: string;
  kind: Exclude<GoalKind, "guardar">;
  categoryId: number | null;
  name: string;
  emoji: string;
  target: number;
  used: number;
}

export function goalHints(goals: Goal[], totals: Map<string, MonthTotals>, months: string[], categories: Map<number, { name: string; emoji: string }>) {
  const hints: GoalHint[] = [];
  for (const month of months) {
    const t = totals.get(month) ?? emptyTotals(month);
    for (const g of goalsFor(goals, month).monthly) {
      if (g.kind === "guardar") continue;
      const { name, emoji } = goalName(g, categories);
      hints.push({ month, kind: g.kind, categoryId: g.categoryId, name, emoji, target: g.targetCents, used: metricOf(g.kind, g.categoryId, t) });
    }
  }
  return hints;
}

/**
 * Metas afetadas por um gasto novo: a da categoria, a do dia a dia (compra à vista), a do cartão (no crédito)
 * e a do total. As que passam do limite vêm primeiro.
 */
export function goalImpact(
  hints: GoalHint[],
  e: { month: string; categoryId: number | null; onCard: boolean; avulso: boolean; delta: number },
) {
  return hints
    .filter(
      (h) =>
        h.month === e.month &&
        (h.kind === "total" ||
          (h.kind === "categoria" && h.categoryId === e.categoryId) ||
          (h.kind === "dia_a_dia" && e.avulso) ||
          (h.kind === "cartao" && e.onCard)),
    )
    .map((h) => {
      const after = h.used + e.delta;
      return { ...h, after, ratio: after / h.target, over: after > h.target };
    })
    .sort(
      (a, b) =>
        Number(b.over) - Number(a.over) ||
        Number(b.kind === "categoria") - Number(a.kind === "categoria") ||
        b.ratio - a.ratio,
    );
}

/** "novembro" a partir de "2026-11". */
export const monthNameLower = (month: string) => MONTH_NAMES[Number(month.slice(5, 7)) - 1].toLowerCase();

