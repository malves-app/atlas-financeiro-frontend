import { formatBRL, shiftMonth } from "./format";

// Investimentos: contas puras (sem banco), usadas pelas telas e pelos testes.
// Cada investimento tem movimentações: aporte (+), resgate (−) e "saldo" (conferiu quanto tem hoje).
// Saldo = aportes − resgates, trocado pelo valor conferido a cada atualização de saldo.
// Aplicado = aportes − resgates. Rendimento = saldo − aplicado (o que o dinheiro rendeu ou perdeu).

export const INVESTMENT_KINDS = ["caixinha", "renda_fixa", "tesouro", "acoes", "fundos", "cripto", "previdencia", "outro"] as const;
export type InvestmentKind = (typeof INVESTMENT_KINDS)[number];

/**
 * Cor fixa por tipo (a cor segue o tipo, nunca a posição na lista). Ordem e cores conferidas para daltonismo
 * (paleta das formas de pagamento); "Outro" fica cinza.
 */
export const KIND_INFO: Record<InvestmentKind, { label: string; emoji: string; color: string; desc: string; placeholder: string }> = {
  caixinha: { label: "Conta e caixinha", emoji: "🐷", color: "#2a78d6", desc: "Poupança, caixinha, conta que rende", placeholder: "Ex.: Caixinha do banco" },
  renda_fixa: { label: "Renda fixa", emoji: "🏦", color: "#eb6834", desc: "CDB, LCI, LCA, debêntures", placeholder: "Ex.: CDB 110% do CDI" },
  tesouro: { label: "Tesouro Direto", emoji: "🏛️", color: "#1baf7a", desc: "Selic, IPCA+, prefixado", placeholder: "Ex.: Tesouro Selic 2029" },
  acoes: { label: "Ações e FIIs", emoji: "📈", color: "#6250d6", desc: "Ações, fundos imobiliários, ETFs", placeholder: "Ex.: Carteira de ações" },
  fundos: { label: "Fundos", emoji: "💼", color: "#e87ba4", desc: "Fundos de investimento", placeholder: "Ex.: Fundo multimercado" },
  cripto: { label: "Cripto", emoji: "🪙", color: "#eda100", desc: "Bitcoin, Ethereum, stablecoins", placeholder: "Ex.: Bitcoin" },
  previdencia: { label: "Previdência", emoji: "🌱", color: "#008300", desc: "PGBL, VGBL", placeholder: "Ex.: Previdência VGBL" },
  outro: { label: "Outro", emoji: "💰", color: "#8b95ab", desc: "Dinheiro guardado em outro lugar", placeholder: "Ex.: Reserva em dinheiro" },
};

export function isInvestmentKind(s: string): s is InvestmentKind {
  return (INVESTMENT_KINDS as readonly string[]).includes(s);
}

export const MOVE_KINDS = ["aporte", "resgate", "saldo"] as const;
export type MoveKind = (typeof MOVE_KINDS)[number];

export function isMoveKind(s: string): s is MoveKind {
  return (MOVE_KINDS as readonly string[]).includes(s);
}

export interface Investment {
  id: number;
  name: string;
  kind: InvestmentKind;
  institution: string | null;
  targetCents: number | null;
  archived: boolean;
}

export interface Move {
  id: number;
  investmentId: number;
  kind: MoveKind;
  /** Aporte e resgate: o valor movimentado. Saldo: o saldo conferido. */
  amountCents: number;
  /** YYYY-MM-DD */
  date: string;
  note: string | null;
}

export interface Position {
  balance: number;
  /** Aportes − resgates */
  invested: number;
  deposits: number;
  withdrawals: number;
  /** Saldo − aplicado */
  gain: number;
  /** Rendimento sobre o aplicado (null quando já tirou mais do que colocou) */
  gainRatio: number | null;
  firstDate: string | null;
  lastDate: string | null;
  count: number;
}

/** Em ordem de data; no mesmo dia, na ordem em que foram registradas. */
export function sortMoves<T extends Pick<Move, "date" | "id">>(moves: T[]): T[] {
  return [...moves].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
}

/**
 * Como estava até uma data (inclusive; sem data, hoje). Com movimentações de vários investimentos, soma os
 * investimentos (a atualização de saldo de um não mexe no outro).
 */
export function position(moves: Move[], upTo?: string): Position {
  const balances = new Map<number, number>();
  let invested = 0;
  let deposits = 0;
  let withdrawals = 0;
  let firstDate: string | null = null;
  let lastDate: string | null = null;
  let count = 0;
  for (const m of sortMoves(moves)) {
    if (upTo && m.date > upTo) break;
    const before = balances.get(m.investmentId) ?? 0;
    if (m.kind === "aporte") {
      balances.set(m.investmentId, before + m.amountCents);
      invested += m.amountCents;
      deposits += m.amountCents;
    } else if (m.kind === "resgate") {
      balances.set(m.investmentId, before - m.amountCents);
      invested -= m.amountCents;
      withdrawals += m.amountCents;
    } else {
      balances.set(m.investmentId, m.amountCents);
    }
    firstDate ??= m.date;
    lastDate = m.date;
    count++;
  }
  let balance = 0;
  for (const b of balances.values()) balance += b;
  const gain = balance - invested;
  return { balance, invested, deposits, withdrawals, gain, gainRatio: invested > 0 ? gain / invested : null, firstDate, lastDate, count };
}

export interface HistoryRow {
  move: Move;
  before: number;
  after: number;
  /** Atualização de saldo: quanto rendeu (ou perdeu) desde o registro anterior. */
  yieldCents: number | null;
}

/** Histórico do investimento, do mais recente para o mais antigo, com o saldo antes e depois de cada registro. */
export function history(moves: Move[]): HistoryRow[] {
  let balance = 0;
  const rows: HistoryRow[] = [];
  for (const m of sortMoves(moves)) {
    const before = balance;
    balance = m.kind === "aporte" ? balance + m.amountCents : m.kind === "resgate" ? balance - m.amountCents : m.amountCents;
    rows.push({ move: m, before, after: balance, yieldCents: m.kind === "saldo" ? balance - before : null });
  }
  return rows.reverse();
}

export interface SeriesPoint {
  month: string;
  balance: number;
  invested: number;
}

/** Saldo e aplicado no fim de cada mês (o mês atual, até hoje), desde o primeiro registro, no máximo `maxMonths`. */
export function monthlySeries(moves: Move[], today: string, maxMonths = 12): SeriesPoint[] {
  if (!moves.length) return [];
  const sorted = sortMoves(moves);
  const cur = today.slice(0, 7);
  const first = sorted[0].date.slice(0, 7);
  let start = shiftMonth(cur, -(maxMonths - 1));
  if (first > start) start = first;
  const out: SeriesPoint[] = [];
  for (let m = start; m <= cur; m = shiftMonth(m, 1)) {
    // "-31" fica depois de qualquer dia do mês na comparação de texto
    const p = position(sorted, m === cur ? today : `${m}-31`);
    out.push({ month: m, balance: p.balance, invested: p.invested });
  }
  return out;
}

/** Quanto o total mudou no mês: o que entrou/saiu (aportes − resgates) e o que rendeu. */
export interface MonthChange {
  /** Saldo no fim do mês anterior */
  start: number;
  change: number;
  flow: number;
  yieldCents: number;
  /** Quantas vezes o saldo foi conferido no mês (sem nenhuma, o rendimento do mês ainda não aparece). */
  updates: number;
}

export function monthChange(moves: Move[], today: string): MonthChange {
  const cur = today.slice(0, 7);
  const start = position(moves, `${shiftMonth(cur, -1)}-31`).balance;
  const end = position(moves, today).balance;
  let flow = 0;
  let updates = 0;
  for (const m of moves) {
    if (m.date.slice(0, 7) !== cur || m.date > today) continue;
    if (m.kind === "aporte") flow += m.amountCents;
    else if (m.kind === "resgate") flow -= m.amountCents;
    else updates++;
  }
  return { start, change: end - start, flow, yieldCents: end - start - flow, updates };
}

export interface Holding {
  investment: Investment;
  position: Position;
  /** Dias desde o último registro (aporte, resgate ou saldo). */
  daysSince: number | null;
  /** Mais de 30 dias sem conferir o saldo. */
  stale: boolean;
}

export interface Portfolio {
  /** Ativos, do maior saldo para o menor. */
  holdings: Holding[];
  closed: Holding[];
  /** Soma dos ativos. */
  total: Pick<Position, "balance" | "invested" | "gain" | "gainRatio">;
  allocation: { kind: InvestmentKind; balance: number; ratio: number; count: number }[];
  month: MonthChange;
  series: SeriesPoint[];
}

export function daysBetween(from: string, to: string): number {
  const a = Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10));
  const b = Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

export function holdingOf(investment: Investment, moves: Move[], today: string): Holding {
  const p = position(moves);
  const daysSince = p.lastDate ? daysBetween(p.lastDate, today) : null;
  return { investment, position: p, daysSince, stale: !investment.archived && p.balance > 0 && daysSince != null && daysSince > 30 };
}

/** Visão geral: cada investimento, o total, a distribuição por tipo, o mês e a evolução. */
export function portfolio(investments: Investment[], moves: Move[], today: string, maxMonths = 12): Portfolio {
  const byInv = new Map<number, Move[]>();
  for (const m of moves) {
    const list = byInv.get(m.investmentId);
    if (list) list.push(m);
    else byInv.set(m.investmentId, [m]);
  }
  const all = investments.map((inv) => holdingOf(inv, byInv.get(inv.id) ?? [], today));
  const holdings = all
    .filter((h) => !h.investment.archived)
    .sort((a, b) => b.position.balance - a.position.balance || a.investment.name.localeCompare(b.investment.name, "pt-BR"));
  const closed = all.filter((h) => h.investment.archived);

  const balance = holdings.reduce((s, h) => s + h.position.balance, 0);
  const invested = holdings.reduce((s, h) => s + h.position.invested, 0);
  const gain = balance - invested;

  const allocation = INVESTMENT_KINDS.map((kind) => {
    const of = holdings.filter((h) => h.investment.kind === kind && h.position.balance > 0);
    const b = of.reduce((s, h) => s + h.position.balance, 0);
    return { kind, balance: b, ratio: 0, count: of.length };
  }).filter((a) => a.balance > 0);
  const positive = allocation.reduce((s, a) => s + a.balance, 0);
  for (const a of allocation) a.ratio = positive > 0 ? a.balance / positive : 0;

  // Evolução e mês: todos os registros, inclusive dos encerrados (fizeram parte do total na época)
  const known = new Set(investments.map((i) => i.id));
  const tracked = moves.filter((m) => known.has(m.investmentId));
  return {
    holdings,
    closed,
    total: { balance, invested, gain, gainRatio: invested > 0 ? gain / invested : null },
    allocation,
    month: monthChange(tracked, today),
    series: monthlySeries(tracked, today, maxMonths),
  };
}

/** Bancos e corretoras já usados, do mais usado para o menos. */
export function institutionsOf(list: { institution: string | null }[]): string[] {
  const count = new Map<string, { name: string; n: number }>();
  for (const { institution } of list) {
    const name = institution?.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const c = count.get(key);
    if (c) c.n++;
    else count.set(key, { name, n: 1 });
  }
  return [...count.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name, "pt-BR")).map((c) => c.name);
}

/* ---------- textos ---------- */

/** "+R$ 1.234,56" / "−R$ 80,00" / "R$ 0,00" */
export function signedBRL(cents: number): string {
  if (cents === 0) return formatBRL(0);
  return `${cents > 0 ? "+" : "−"}${formatBRL(Math.abs(cents))}`;
}

/** "+5,2%" / "−1,3%" */
export function signedPercent(ratio: number, digits = 1): string {
  const v = Math.abs(ratio * 100);
  const text = v.toLocaleString("pt-BR", { maximumFractionDigits: v >= 100 ? 0 : digits, minimumFractionDigits: 0 });
  if (text === "0") return "0%";
  return `${ratio > 0 ? "+" : "−"}${text}%`;
}

/** "hoje", "ontem", "há 5 dias", "há 2 meses" */
export function agoText(days: number): string {
  if (days <= 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 45) return `há ${days} dias`;
  const months = Math.round(days / 30.4);
  if (months < 12) return `há ${months} meses`;
  const years = Math.floor(days / 365);
  return years === 1 ? "há mais de 1 ano" : `há mais de ${years} anos`;
}
