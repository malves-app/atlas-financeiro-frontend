import { getSupabase } from "./supabase/server";
import { must } from "./must";
import { currentMonth, daysInMonth, monthDiff, shiftMonth, todayISO } from "./format";

// Estatísticas de um período (ano ou últimos 12 meses).
// Os cálculos ficam em computeStats (função pura, testada); loadStats só busca os dados.

export interface StatEntry {
  id: number;
  month: string;
  kind: "fixo" | "cartao" | "avulso";
  name: string;
  amountCents: number;
  date: string | null;
  paymentMethodId: number | null;
  categoryId: number | null;
}

export interface StatIncome {
  month: string;
  name: string;
  amountCents: number;
}

export interface MonthRow {
  month: string;
  entradas: number;
  gastos: number;
  saldo: number;
  fixo: number;
  cartao: number;
  avulso: number;
  partial: boolean;
}

export interface Stats {
  months: string[];
  monthly: MonthRow[];
  totals: { entradas: number; gastos: number; saldo: number; savingsRate: number | null };
  /** Gasto mensal: média, mediana, desvio padrão, extremos e tendência (só meses completos) */
  spend: {
    basis: number;
    mean: number;
    median: number;
    stdev: number;
    max: { month: string; value: number } | null;
    min: { month: string; value: number } | null;
    trendPerMonth: number;
    trendPct: number;
  };
  cumulative: number[];
  negativeMonths: string[];
  byCategory: { categoryId: number | null; total: number; count: number; monthlyAvg: number; share: number }[];
  byPayment: { paymentMethodId: number | null; total: number; share: number }[];
  topNames: { name: string; total: number; count: number; avg: number }[];
  biggest: StatEntry[];
  weekday: { day: number; total: number; count: number }[];
  dailyAvg: number;
  dayToDayDays: number;
  incomeSources: { name: string; total: number; count: number }[];
}

const sum = (xs: number[]) => xs.reduce((a, x) => a + x, 0);

function median(xs: number[]) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

function stdev(xs: number[]) {
  if (xs.length < 2) return 0;
  const mean = sum(xs) / xs.length;
  return Math.round(Math.sqrt(sum(xs.map((x) => (x - mean) ** 2)) / (xs.length - 1)));
}

/** Inclinação da reta de tendência (mínimos quadrados), em centavos por mês. */
function slope(ys: number[]) {
  const n = ys.length;
  if (n < 3) return 0;
  const mx = (n - 1) / 2;
  const my = sum(ys) / n;
  let num = 0;
  let den = 0;
  ys.forEach((y, x) => {
    num += (x - mx) * (y - my);
    den += (x - mx) ** 2;
  });
  return den ? Math.round(num / den) : 0;
}

const normName = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** "Salário (04)", "Salário(05)" -> "Salário": tira anotações entre parênteses dos nomes de entradas */
const incomeKey = (s: string) => s.replace(/\(.*?\)/g, "").replace(/\s+/g, " ").trim() || s.trim();

export function computeStats({
  months,
  entries,
  incomes,
  today,
}: {
  months: string[];
  entries: StatEntry[];
  incomes: StatIncome[];
  today: string;
}): Stats {
  const nowMonth = today.slice(0, 7);
  // Meses antes do primeiro lançamento não entram (ex.: últimos 12 meses de quem começou há pouco)
  const first = months.findIndex((m) => entries.some((e) => e.month === m) || incomes.some((i) => i.month === m));
  if (first > 0) months = months.slice(first);
  const monthly: MonthRow[] = months.map((m) => {
    const es = entries.filter((e) => e.month === m);
    const entradas = sum(incomes.filter((i) => i.month === m).map((i) => i.amountCents));
    const gastos = sum(es.map((e) => e.amountCents));
    return {
      month: m,
      entradas,
      gastos,
      saldo: entradas - gastos,
      fixo: sum(es.filter((e) => e.kind === "fixo").map((e) => e.amountCents)),
      cartao: sum(es.filter((e) => e.kind === "cartao").map((e) => e.amountCents)),
      avulso: sum(es.filter((e) => e.kind === "avulso").map((e) => e.amountCents)),
      partial: m === nowMonth,
    };
  });

  const entradas = sum(monthly.map((r) => r.entradas));
  const gastos = sum(monthly.map((r) => r.gastos));
  const saldo = entradas - gastos;

  // Para média, extremos e tendência usamos os meses completos (o mês atual ainda está correndo)
  const closed = monthly.filter((r) => !r.partial);
  const basisRows = closed.length >= 2 ? closed : monthly;
  const spendVals = basisRows.map((r) => r.gastos);
  const mean = spendVals.length ? Math.round(sum(spendVals) / spendVals.length) : 0;
  const maxRow = basisRows.reduce<MonthRow | null>((a, r) => (!a || r.gastos > a.gastos ? r : a), null);
  const minRow = basisRows.reduce<MonthRow | null>((a, r) => (!a || r.gastos < a.gastos ? r : a), null);
  const trend = slope(spendVals);

  let acc = 0;
  const cumulative = monthly.map((r) => (acc += r.saldo));

  const catMap = new Map<number | null, { total: number; count: number }>();
  for (const e of entries) {
    const c = catMap.get(e.categoryId) ?? { total: 0, count: 0 };
    c.total += e.amountCents;
    c.count += 1;
    catMap.set(e.categoryId, c);
  }
  const positiveTotal = gastos > 0 ? gastos : 1;
  const byCategory = [...catMap.entries()]
    .map(([categoryId, v]) => ({
      categoryId,
      ...v,
      monthlyAvg: Math.round(v.total / Math.max(months.length, 1)),
      share: v.total / positiveTotal,
    }))
    .filter((c) => c.total !== 0)
    .sort((a, b) => b.total - a.total);

  const payMap = new Map<number | null, number>();
  for (const e of entries) payMap.set(e.paymentMethodId, (payMap.get(e.paymentMethodId) ?? 0) + e.amountCents);
  const byPayment = [...payMap.entries()]
    .map(([paymentMethodId, total]) => ({ paymentMethodId, total, share: total / positiveTotal }))
    .filter((p) => p.total !== 0)
    .sort((a, b) => b.total - a.total);

  const avulsos = entries.filter((e) => e.kind === "avulso");
  const nameMap = new Map<string, { names: Map<string, number>; total: number; count: number }>();
  for (const e of avulsos) {
    const k = normName(e.name);
    if (!k) continue;
    const g = nameMap.get(k) ?? { names: new Map(), total: 0, count: 0 };
    g.total += e.amountCents;
    g.count += 1;
    g.names.set(e.name.trim(), (g.names.get(e.name.trim()) ?? 0) + 1);
    nameMap.set(k, g);
  }
  const topNames = [...nameMap.values()]
    .map((g) => ({
      name: [...g.names.entries()].sort((a, b) => b[1] - a[1])[0][0],
      total: g.total,
      count: g.count,
      avg: Math.round(g.total / g.count),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  const biggest = [...avulsos].sort((a, b) => b.amountCents - a.amountCents).slice(0, 8);

  const weekday = Array.from({ length: 7 }, (_, day) => ({ day, total: 0, count: 0 }));
  for (const e of avulsos) {
    if (!e.date) continue;
    const [y, m, d] = e.date.split("-").map(Number);
    const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    weekday[wd].total += e.amountCents;
    weekday[wd].count += 1;
  }

  const dayToDayDays = months.reduce((a, m) => {
    if (m > nowMonth) return a;
    if (m === nowMonth) return a + Number(today.slice(8, 10));
    return a + daysInMonth(m);
  }, 0);
  const dailyAvg = dayToDayDays ? Math.round(sum(avulsos.map((e) => e.amountCents)) / dayToDayDays) : 0;

  const incMap = new Map<string, { name: string; total: number; count: number }>();
  for (const i of incomes) {
    const name = incomeKey(i.name);
    const k = normName(name);
    const g = incMap.get(k) ?? { name, total: 0, count: 0 };
    g.total += i.amountCents;
    g.count += 1;
    incMap.set(k, g);
  }
  const incomeSources = [...incMap.values()].sort((a, b) => b.total - a.total).slice(0, 6);

  return {
    months,
    monthly,
    totals: { entradas, gastos, saldo, savingsRate: entradas > 0 ? saldo / entradas : null },
    spend: {
      basis: basisRows.length,
      mean,
      median: median(spendVals),
      stdev: stdev(spendVals),
      max: maxRow ? { month: maxRow.month, value: maxRow.gastos } : null,
      min: minRow ? { month: minRow.month, value: minRow.gastos } : null,
      trendPerMonth: trend,
      trendPct: mean ? trend / mean : 0,
    },
    cumulative,
    // o mês em andamento fica de fora: as entradas dele podem ainda não ter chegado
    negativeMonths: monthly.filter((r) => r.saldo < 0 && !r.partial).map((r) => r.month),
    byCategory,
    byPayment,
    topNames,
    biggest,
    weekday,
    dailyAvg,
    dayToDayDays,
    incomeSources,
  };
}

/* ---------- período ---------- */

export type Period = { kind: "ano"; year: number } | { kind: "12m" };

export function periodMonths(p: Period, now = currentMonth()): string[] {
  let from: string;
  let to: string;
  if (p.kind === "12m") {
    from = shiftMonth(now, -11);
    to = now;
  } else {
    from = `${p.year}-01`;
    to = `${p.year}-12` < now ? `${p.year}-12` : now;
  }
  if (to < from) return [];
  return Array.from({ length: monthDiff(from, to) + 1 }, (_, i) => shiftMonth(from, i));
}

/* ---------- busca ---------- */

/** Busca todas as linhas, de 1000 em 1000 (limite padrão da API do Supabase). */
async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  what: string,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const rows = must(await page(from, from + 999), what) ?? [];
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

export async function loadStats(p: Period): Promise<Stats> {
  const months = periodMonths(p);
  const today = todayISO();
  if (!months.length) return computeStats({ months, entries: [], incomes: [], today });
  const sb = await getSupabase();
  const from = months[0];
  const to = months[months.length - 1];
  const [entryRows, incomeRows] = await Promise.all([
    fetchAll<Record<string, unknown>>(
      (a, b) =>
        sb
          .from("entries")
          .select("id, month, kind, name, amount_cents, date, payment_method_id, category_id")
          .gte("month", from)
          .lte("month", to)
          .order("id")
          .range(a, b),
      "ler os gastos do período",
    ),
    fetchAll<Record<string, unknown>>(
      (a, b) => sb.from("incomes").select("month, name, amount_cents").gte("month", from).lte("month", to).order("id").range(a, b),
      "ler as entradas do período",
    ),
  ]);
  const num = (v: unknown) => (v == null ? null : Number(v));
  return computeStats({
    months,
    today,
    entries: entryRows.map((r) => ({
      id: Number(r.id),
      month: String(r.month),
      kind: r.kind as StatEntry["kind"],
      name: String(r.name),
      amountCents: Number(r.amount_cents),
      date: (r.date as string) ?? null,
      paymentMethodId: num(r.payment_method_id),
      categoryId: num(r.category_id),
    })),
    incomes: incomeRows.map((r) => ({ month: String(r.month), name: String(r.name), amountCents: Number(r.amount_cents) })),
  });
}

/* ---------- nomes (inclui categorias e formas de pagamento já removidas) ---------- */

export interface StatLookups {
  categories: Map<number, { name: string; emoji: string | null }>;
  methods: Map<number, { name: string; color: string; sort: number }>;
  /** Primeiro ano com lançamentos (para os atalhos de ano) */
  firstYear: number;
}

export async function loadLookups(): Promise<StatLookups> {
  const sb = await getSupabase();
  const nowYear = Number(currentMonth().slice(0, 4));
  const [cats, methods, firstEntry, firstIncome] = await Promise.all([
    sb.from("categories").select("id, name, emoji"),
    sb.from("payment_methods").select("id, name, color, sort"),
    sb.from("entries").select("month").order("month").limit(1),
    sb.from("incomes").select("month").order("month").limit(1),
  ]);
  const catRows = (must(cats, "ler as categorias") ?? []) as { id: number; name: string; emoji: string | null }[];
  const methodRows = (must(methods, "ler as formas de pagamento") ?? []) as { id: number; name: string; color: string; sort: number }[];
  const firsts = [
    ...((must(firstEntry, "ler o primeiro mês") ?? []) as { month: string }[]),
    ...((must(firstIncome, "ler o primeiro mês") ?? []) as { month: string }[]),
  ].map((r) => Number(r.month.slice(0, 4)));
  return {
    categories: new Map(catRows.map((c) => [Number(c.id), { name: c.name, emoji: c.emoji }])),
    methods: new Map(methodRows.map((m) => [Number(m.id), { name: m.name, color: m.color, sort: m.sort }])),
    firstYear: Math.min(nowYear, ...firsts),
  };
}
