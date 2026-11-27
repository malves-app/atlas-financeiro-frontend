import { getSupabase, type Supabase } from "./supabase/server";
import { currentMonth, dateInMonth, monthDiff, nextPaymentColor, PAYMENT_COLORS, shiftMonth, todayISO } from "./format";
import { must } from "./must";
import { isRealized } from "./realized";
import { totalsFromRows, type Goal, type GoalKind, type GoalPeriod, type MonthTotals } from "./goals";
import { bankById, guessBank, isBankId, isPaymentType, methodColor, type PaymentType } from "./payment-icons";
import { DEFAULT_CATEGORIES, guessCategoryIcon } from "./category-icons";

// Toda leitura e escrita passa pelo Supabase com a sessão de quem está logado.
// As regras de segurança (RLS) do banco garantem que cada usuário só acessa os próprios dados.

export type Kind = "fixo" | "cartao" | "avulso";

/** Forma de pagamento (o "Tipo" da planilha): Conta Corrente, Crédito, Pix, outro cartão... */
export interface PaymentMethod {
  id: number;
  name: string;
  isCredit: boolean;
  closingDay: number | null;
  color: string;
  sort: number;
  /** Tipo (só o desenho): conta, pix, crédito... */
  icon: PaymentType;
  /** Banco (selo com a cor do banco), opcional. */
  bank: string | null;
}

export interface Category {
  id: number;
  name: string;
  emoji: string;
  budgetCents: number | null;
  sort: number;
}

/** Subcategoria: dentro de uma categoria (Alimentação → Supermercado, Restaurante...). */
export interface Subcategory {
  id: number;
  categoryId: number;
  name: string;
  /** Ícone próprio; null = usa o da categoria. */
  emoji: string | null;
  sort: number;
}

export interface Entry {
  id: number;
  month: string;
  kind: Kind;
  name: string;
  amountCents: number;
  date: string | null;
  paymentMethodId: number | null;
  categoryId: number | null;
  subcategoryId: number | null;
  paid: boolean | null;
  installmentNo: number | null;
  installmentTotal: number | null;
  recurringId: number | null;
}

export interface Income {
  id: number;
  month: string;
  name: string;
  amountCents: number;
  date: string | null;
}

export interface Recurring {
  id: number;
  kind: "fixo" | "cartao";
  name: string;
  amountCents: number;
  day: number | null;
  paymentMethodId: number | null;
  categoryId: number | null;
  subcategoryId: number | null;
  installments: number | null;
  startMonth: string;
  endMonth: string | null;
}

/* ---------- utilidades ---------- */

type R = Record<string, unknown>;
const num = (v: unknown) => (v == null ? null : Number(v));


const toCategory = (r: R): Category => ({
  id: Number(r.id),
  name: String(r.name),
  emoji: String(r.emoji),
  budgetCents: num(r.budget_cents),
  sort: Number(r.sort),
});

const toEntry = (r: R): Entry => ({
  id: Number(r.id),
  month: String(r.month),
  kind: r.kind as Kind,
  name: String(r.name),
  amountCents: Number(r.amount_cents),
  date: (r.date as string) ?? null,
  paymentMethodId: num(r.payment_method_id),
  categoryId: num(r.category_id),
  subcategoryId: num(r.subcategory_id),
  paid: r.paid == null ? null : Boolean(r.paid),
  installmentNo: num(r.installment_no),
  installmentTotal: num(r.installment_total),
  recurringId: num(r.recurring_id),
});

const toIncome = (r: R): Income => ({
  id: Number(r.id),
  month: String(r.month),
  name: String(r.name),
  amountCents: Number(r.amount_cents),
  date: (r.date as string) ?? null,
});

const toRecurring = (r: R): Recurring => ({
  id: Number(r.id),
  kind: r.kind as "fixo" | "cartao",
  name: String(r.name),
  amountCents: Number(r.amount_cents),
  day: num(r.day),
  paymentMethodId: num(r.payment_method_id),
  categoryId: num(r.category_id),
  subcategoryId: num(r.subcategory_id),
  installments: num(r.installments),
  startMonth: String(r.start_month),
  endMonth: (r.end_month as string) ?? null,
});

/* ---------- usuário e ajustes ---------- */

export async function getUserEmail(): Promise<string | null> {
  const sb = await getSupabase();
  const { data } = await sb.auth.getClaims();
  return (data?.claims?.email as string | undefined) ?? null;
}

const toMethod = (r: R): PaymentMethod => ({
  id: Number(r.id),
  name: String(r.name),
  isCredit: Boolean(r.is_credit),
  closingDay: num(r.closing_day),
  // Com banco, a cor é a do banco (as que tinham banco antes desta regra também)
  color: methodColor(isBankId(r.bank) ? r.bank : null, String(r.color)),
  sort: Number(r.sort),
  icon: isPaymentType(r.icon) ? r.icon : r.is_credit ? "credito" : "conta",
  bank: isBankId(r.bank) ? r.bank : null,
});

/* ---------- formas de pagamento ---------- */

export { DEFAULT_CATEGORIES };

/**
 * Conta nova começa com "Conta Corrente" e "Crédito" (como na planilha) e categorias básicas.
 * Roda só quando o usuário ainda não tem nenhuma forma de pagamento.
 */
async function seedDefaults(sb: Supabase) {
  must(
    await sb.from("payment_methods").upsert(
      [
        { name: "Conta Corrente", is_credit: false, closing_day: null, color: PAYMENT_COLORS[0], sort: 1, icon: "conta" },
        { name: "Crédito", is_credit: true, closing_day: 25, color: PAYMENT_COLORS[1], sort: 2, icon: "credito" },
      ],
      { onConflict: "user_id,name", ignoreDuplicates: true },
    ),
    "criar as formas de pagamento",
  );
  const anyCategory = must(await sb.from("categories").select("id").limit(1), "ler as categorias") as R[];
  if (!anyCategory.length) {
    must(
      await sb.from("categories").upsert(
        DEFAULT_CATEGORIES.map(({ name, emoji }, i) => ({ name, emoji, sort: i + 1 })),
        { onConflict: "user_id,name", ignoreDuplicates: true },
      ),
      "criar as categorias",
    );
    const cats = must(await sb.from("categories").select("id, name"), "ler as categorias") as { id: number; name: string }[];
    const idOf = new Map(cats.map((c) => [c.name, Number(c.id)]));
    const subs = DEFAULT_CATEGORIES.flatMap((c) =>
      idOf.has(c.name) ? c.subs.map((s, i) => ({ category_id: idOf.get(c.name)!, name: s.name, emoji: s.emoji, sort: i + 1 })) : [],
    );
    if (subs.length)
      must(
        await sb.from("subcategories").upsert(subs, { onConflict: "category_id,name", ignoreDuplicates: true }),
        "criar as subcategorias",
      );
  }
}

/** Formas de pagamento ativas, na ordem cadastrada. Cria as padrão para contas novas. */
export async function listPaymentMethods(): Promise<PaymentMethod[]> {
  const sb = await getSupabase();
  const all = must(await sb.from("payment_methods").select("*").order("sort").order("id"), "ler as formas de pagamento") as R[];
  if (!all.length) {
    await seedDefaults(sb);
    return listPaymentMethods();
  }
  return all.filter((r) => !r.archived).map(toMethod);
}

export async function getPaymentMethod(id: number): Promise<PaymentMethod | null> {
  const sb = await getSupabase();
  const row = must(
    await sb.from("payment_methods").select("*").eq("id", id).eq("archived", false).maybeSingle(),
    "ler a forma de pagamento",
  ) as R | null;
  return row ? toMethod(row) : null;
}

export interface PaymentMethodInput {
  id?: number;
  name: string;
  isCredit: boolean;
  closingDay: number | null;
  /** Só vale sem banco (com banco, a cor é a do banco). Sem ela, a próxima cor livre da paleta. */
  color?: string;
  /** Tipo (desenho). Sem ele: crédito ou conta. Crédito sempre fica com o tipo "credito". */
  icon?: PaymentType;
  /** Banco. undefined = adivinhar pelo nome (só ao criar); null = nenhum. */
  bank?: string | null;
}

export async function upsertPaymentMethod(m: PaymentMethodInput) {
  const sb = await getSupabase();
  const icon: PaymentType = m.isCredit ? "credito" : m.icon && m.icon !== "credito" ? m.icon : "conta";
  const bank = m.bank === undefined ? (m.id ? undefined : guessBank(m.name)) : isBankId(m.bank) ? m.bank : null;
  const values = {
    name: m.name,
    is_credit: m.isCredit,
    closing_day: m.isCredit ? m.closingDay : null,
    icon,
    ...(bank !== undefined ? { bank } : {}),
  };
  const all = must(await sb.from("payment_methods").select("id, color, bank, sort, archived"), "ler as formas de pagamento") as {
    id: number;
    color: string;
    bank: string | null;
    sort: number;
    archived: boolean;
  }[];
  const current = m.id ? all.find((x) => Number(x.id) === m.id) : undefined;
  const finalBank = bank !== undefined ? bank : (current?.bank ?? null);
  // Com banco: a cor do banco. Sem banco: a cor pedida, a que já tinha (se for da paleta) ou a próxima livre.
  const freeColor = () =>
    nextPaymentColor(all.filter((x) => !x.archived && Number(x.id) !== m.id).map((x) => methodColor(x.bank, x.color)));
  const color =
    bankById(finalBank)?.bg ??
    (m.color && PAYMENT_COLORS.includes(m.color)
      ? m.color
      : current && PAYMENT_COLORS.includes(current.color)
        ? current.color
        : freeColor());
  if (m.id) {
    must(await sb.from("payment_methods").update({ ...values, color }).eq("id", m.id), "salvar a forma de pagamento");
    return;
  }
  must(
    await sb.from("payment_methods").upsert(
      {
        ...values,
        archived: false,
        color,
        sort: Math.max(0, ...all.map((x) => x.sort)) + 1,
      },
      { onConflict: "user_id,name" },
    ),
    "criar a forma de pagamento",
  );
}

export async function archivePaymentMethod(id: number) {
  const sb = await getSupabase();
  const active = (await listPaymentMethods()).filter((m) => m.id !== id);
  if (!active.length) throw new Error("Mantenha pelo menos uma forma de pagamento.");
  must(await sb.from("payment_methods").update({ archived: true }).eq("id", id), "remover a forma de pagamento");
}

/* ---------- categorias ---------- */

export async function listCategories(): Promise<Category[]> {
  const sb = await getSupabase();
  const rows = must(
    await sb.from("categories").select("*").eq("archived", false).order("sort").order("name"),
    "ler as categorias",
  ) as R[];
  return rows.map(toCategory);
}

/** Categorias ordenadas pelas mais usadas nos últimos meses (para o lançamento rápido). */
export async function listCategoriesByUse(): Promise<Category[]> {
  const sb = await getSupabase();
  const [cats, usage] = await Promise.all([
    listCategories(),
    sb.rpc("fm_category_usage", { p_from: shiftMonth(currentMonth(), -4) }),
  ]);
  const uses = new Map(
    (must(usage, "ler o uso das categorias") as { category_id: number; uses: number }[]).map((u) => [
      Number(u.category_id),
      Number(u.uses),
    ]),
  );
  return [...cats].sort((a, b) => (uses.get(b.id) ?? 0) - (uses.get(a.id) ?? 0) || a.sort - b.sort);
}

/** Uma categoria ativa (para a tela de detalhes em Configurações). */
export async function getCategory(id: number): Promise<Category | null> {
  const sb = await getSupabase();
  const row = must(
    await sb.from("categories").select("*").eq("id", id).eq("archived", false).maybeSingle(),
    "ler a categoria",
  ) as R | null;
  return row ? toCategory(row) : null;
}

/**
 * O valor previsto por mês virou meta da categoria (Metas); budgetCents só é gravado quando vem.
 * Devolve o id (na criação, o da categoria criada ou reativada).
 */
export async function upsertCategory(c: { id?: number; name: string; emoji: string; budgetCents?: number | null }): Promise<number> {
  const sb = await getSupabase();
  const budget = c.budgetCents !== undefined ? { budget_cents: c.budgetCents } : {};
  if (c.id) {
    must(await sb.from("categories").update({ name: c.name, emoji: c.emoji, ...budget }).eq("id", c.id), "salvar a categoria");
    return c.id;
  }
  const last = must(await sb.from("categories").select("sort").order("sort", { ascending: false }).limit(1), "ler as categorias") as {
    sort: number;
  }[];
  const row = must(
    await sb
      .from("categories")
      .upsert(
        { name: c.name, emoji: c.emoji, ...budget, archived: false, sort: (last[0]?.sort ?? 0) + 1 },
        { onConflict: "user_id,name" },
      )
      .select("id")
      .single(),
    "criar a categoria",
  ) as R;
  return Number(row.id);
}

/* ---------- subcategorias ---------- */

const toSubcategory = (r: R): Subcategory => ({
  id: Number(r.id),
  categoryId: Number(r.category_id),
  name: String(r.name),
  emoji: r.emoji == null || r.emoji === "" ? null : String(r.emoji),
  sort: Number(r.sort),
});

/** Subcategorias ativas (de todas as categorias), na ordem de cada categoria. */
export async function listSubcategories(): Promise<Subcategory[]> {
  const sb = await getSupabase();
  const rows = must(
    await sb.from("subcategories").select("*").eq("archived", false).order("sort").order("name"),
    "ler as subcategorias",
  ) as R[];
  return rows.map(toSubcategory);
}

/** Nome e ícone de todas as subcategorias, inclusive as removidas (para os lançamentos antigos). */
export async function subcategoryLookup(): Promise<Map<number, { name: string; emoji: string | null }>> {
  const sb = await getSupabase();
  const rows = must(await sb.from("subcategories").select("id, name, emoji"), "ler as subcategorias") as R[];
  return new Map(rows.map((r) => [Number(r.id), { name: String(r.name), emoji: r.emoji ? String(r.emoji) : null }]));
}

/**
 * Cria (ou reativa, se já existiu com esse nome) uma subcategoria no fim da lista da categoria.
 * Sem ícone escolhido (undefined), tenta um que combine com o nome ("Padaria" → 🥖).
 */
export async function createSubcategory(categoryId: number, name: string, emoji?: string | null) {
  const sb = await getSupabase();
  const last = must(
    await sb.from("subcategories").select("sort").eq("category_id", categoryId).order("sort", { ascending: false }).limit(1),
    "ler as subcategorias",
  ) as { sort: number }[];
  must(
    await sb
      .from("subcategories")
      .upsert(
        {
          category_id: categoryId,
          name,
          emoji: emoji === undefined ? guessCategoryIcon(name) : emoji || null,
          archived: false,
          sort: (last[0]?.sort ?? 0) + 1,
        },
        { onConflict: "category_id,name" },
      ),
    "criar a subcategoria",
  );
}

/** Muda o nome e, se vier, o ícone (null = sem ícone próprio). */
export async function renameSubcategory(id: number, name: string, emoji?: string | null) {
  const sb = await getSupabase();
  must(
    await sb
      .from("subcategories")
      .update({ name, ...(emoji !== undefined ? { emoji: emoji || null } : {}) })
      .eq("id", id),
    "salvar a subcategoria",
  );
}

/** Remove da lista (os lançamentos antigos continuam com ela). */
export async function archiveSubcategory(id: number) {
  const sb = await getSupabase();
  must(await sb.from("subcategories").update({ archived: true }).eq("id", id), "remover a subcategoria");
}

/** Categorias com as subcategorias de cada uma (para os formulários de lançar). */
export function withSubcategories(categories: Category[], subs: Subcategory[]) {
  return categories.map(({ id, name, emoji }) => ({
    id,
    name,
    emoji,
    subs: subs.filter((s) => s.categoryId === id).map((s) => ({ id: s.id, name: s.name, emoji: s.emoji })),
  }));
}

/** A subcategoria só vale se for da categoria escolhida (senão, fica sem). */
export async function checkSubcategory(categoryId: number | null, subcategoryId: number | null): Promise<number | null> {
  if (categoryId == null || subcategoryId == null) return null;
  const sb = await getSupabase();
  const row = must(
    await sb.from("subcategories").select("category_id").eq("id", subcategoryId).maybeSingle(),
    "ler a subcategoria",
  ) as R | null;
  return row && Number(row.category_id) === categoryId ? subcategoryId : null;
}

/** Nome e emoji de todas as categorias, inclusive as removidas (para metas e históricos). */
export async function categoryNames(): Promise<Map<number, { name: string; emoji: string }>> {
  const sb = await getSupabase();
  const rows = must(await sb.from("categories").select("id, name, emoji"), "ler as categorias") as R[];
  return new Map(rows.map((r) => [Number(r.id), { name: String(r.name), emoji: String(r.emoji) }]));
}

export async function archiveCategory(id: number) {
  const sb = await getSupabase();
  must(await sb.from("categories").update({ archived: true }).eq("id", id), "remover a categoria");
}

/* ---------- mês ---------- */

export interface MonthSummary {
  month: string;
  entries: Entry[];
  incomes: Income[];
  totals: {
    /** Tudo o que é do mês, inclusive o que ainda vai sair (previsto). */
    gastos: number;
    entradas: number;
    /** Entradas menos o previsto. */
    saldo: number;
    fixo: number;
    cartao: number;
    avulso: number;
    /** O que já saiu de fato até hoje (ver lib/realized.ts). */
    saiu: number;
    /** O que ainda vai sair no mês: contas não pagas, cobranças do cartão por vir, gastos com data futura. */
    aSair: number;
    // Conta × cartão: o que é pago no crédito só sai da conta quando a fatura é paga, então, no mês atual,
    // a fatura ainda está na conta. contaSaiu + contaASair + credito = gastos.
    /** Fora do cartão e já saiu: contas pagas e gastos até hoje (num mês que acabou, tudo fora do cartão). */
    contaSaiu: number;
    /** Fora do cartão e ainda vai sair: contas não pagas e gastos com data futura. */
    contaASair: number;
    /** Tudo o que é do mês no cartão de crédito (a fatura do mês), cobrado ou por vir. */
    credito: number;
  };
  byPayment: { paymentMethodId: number | null; total: number }[];
  byCategory: { categoryId: number | null; total: number; count: number }[];
  pending: Entry[];
  /** Lançamentos que ainda vão sair, por data. */
  upcoming: (Entry & { onCard: boolean })[];
}

export async function getMonth(month: string): Promise<MonthSummary> {
  await ensureMonthGenerated(month);
  const sb = await getSupabase();
  const [entryRes, incomeRes, methodRes] = await Promise.all([
    sb.from("entries").select("*").eq("month", month).order("date", { nullsFirst: true }).order("id"),
    sb.from("incomes").select("*").eq("month", month).order("date", { nullsFirst: true }).order("id"),
    sb.from("payment_methods").select("id, is_credit, closing_day"),
  ]);
  const methodRows = (must(methodRes, "ler as formas de pagamento") ?? []) as R[];
  const creditIds = new Set(methodRows.filter((m) => m.is_credit).map((m) => Number(m.id)));
  const knownIds = new Set(methodRows.map((m) => Number(m.id)));
  const closingDays = new Map(methodRows.map((m) => [Number(m.id), num(m.closing_day)]));
  const entries = (must(entryRes, "ler os gastos") as R[]).map(toEntry);
  const incomes = (must(incomeRes, "ler as entradas") as R[]).map(toIncome);
  const sum = (xs: { amountCents: number }[]) => xs.reduce((a, x) => a + x.amountCents, 0);
  const gastos = sum(entries);
  const entradas = sum(incomes);

  const catMap = new Map<number | null, { total: number; count: number }>();
  for (const e of entries) {
    const cur = catMap.get(e.categoryId) ?? { total: 0, count: 0 };
    cur.total += e.amountCents;
    cur.count += 1;
    catMap.set(e.categoryId, cur);
  }
  const byCategory = [...catMap.entries()]
    .map(([categoryId, v]) => ({ categoryId, ...v }))
    .filter((c) => c.total !== 0)
    .sort((a, b) => b.total - a.total);

  const payMap = new Map<number | null, number>();
  for (const e of entries) payMap.set(e.paymentMethodId, (payMap.get(e.paymentMethodId) ?? 0) + e.amountCents);
  const byPayment = [...payMap.entries()].map(([paymentMethodId, total]) => ({ paymentMethodId, total }));

  // A pagar: só fixos fora do cartão de crédito (o cartão é pago na fatura, sem marcar um a um)
  const onCard = (e: Entry) =>
    e.paymentMethodId != null && knownIds.has(e.paymentMethodId) ? creditIds.has(e.paymentMethodId) : e.kind === "cartao";
  const pending =
    month >= currentMonth()
      ? entries
          .filter((e) => e.kind !== "avulso" && !onCard(e) && e.paid !== true)
          .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))
      : [];

  // Já saiu × ainda vai sair
  const today = todayISO();
  const upcoming = entries
    .map((e) => ({ ...e, onCard: onCard(e) }))
    .filter(
      (e) =>
        !isRealized(
          e,
          { onCard: e.onCard, closingDay: e.paymentMethodId != null ? (closingDays.get(e.paymentMethodId) ?? null) : null },
          today,
        ),
    )
    .sort((a, b) => (a.date ?? "99").localeCompare(b.date ?? "99"));
  const aSair = sum(upcoming);
  const credito = sum(entries.filter(onCard));
  const contaASair = sum(upcoming.filter((e) => !e.onCard));

  return {
    month,
    entries,
    incomes,
    totals: {
      gastos,
      entradas,
      saldo: entradas - gastos,
      fixo: sum(entries.filter((e) => e.kind === "fixo")),
      cartao: sum(entries.filter((e) => e.kind === "cartao")),
      avulso: sum(entries.filter((e) => e.kind === "avulso")),
      saiu: gastos - aSair,
      aSair,
      contaSaiu: gastos - credito - contaASair,
      contaASair,
      credito,
    },
    byPayment,
    byCategory,
    pending,
    upcoming,
  };
}

/* ---------- fixos recorrentes ---------- */

export function installmentFor(r: Pick<Recurring, "installments" | "startMonth" | "endMonth">, month: string) {
  if (month < r.startMonth) return null;
  if (r.endMonth && month > r.endMonth) return null;
  const n = monthDiff(r.startMonth, month) + 1;
  if (r.installments != null && n > r.installments) return null;
  return { no: r.installments != null ? n : null, total: r.installments };
}

function entryFromRecurring(r: Recurring, month: string) {
  const inst = installmentFor(r, month);
  if (!inst) return null;
  return {
    month,
    kind: r.kind,
    name: r.name,
    amount_cents: r.amountCents,
    date: dateInMonth(month, r.day),
    payment_method_id: r.paymentMethodId,
    category_id: r.categoryId,
    subcategory_id: r.categoryId != null ? r.subcategoryId : null,
    paid: r.kind === "fixo" ? false : null,
    installment_no: inst.no,
    installment_total: inst.total,
    recurring_id: r.id,
  };
}

/** Coloca nos meses indicados os lançamentos que faltam de um ou mais fixos. */
async function fillMonths(sb: Supabase, recs: Recurring[], months: string[]) {
  if (!recs.length || !months.length) return;
  const existing = must(
    await sb
      .from("entries")
      .select("recurring_id, month")
      .in("month", months)
      .in(
        "recurring_id",
        recs.map((r) => r.id),
      ),
    "ler os fixos do mês",
  ) as { recurring_id: number; month: string }[];
  const have = new Set(existing.map((e) => `${e.recurring_id}|${e.month}`));
  const rows = months.flatMap((m) =>
    recs.filter((r) => !have.has(`${r.id}|${m}`)).map((r) => entryFromRecurring(r, m)).filter((x) => x != null),
  );
  if (rows.length) must(await sb.from("entries").insert(rows), "criar os fixos do mês");
}

export async function listRecurring(): Promise<Recurring[]> {
  const sb = await getSupabase();
  const rows = must(
    await sb.from("recurring").select("*").order("kind").order("day", { nullsFirst: false }).order("name"),
    "ler os fixos",
  ) as R[];
  return rows.map(toRecurring);
}

export async function getRecurring(id: number): Promise<Recurring | null> {
  const sb = await getSupabase();
  const row = must(await sb.from("recurring").select("*").eq("id", id).maybeSingle(), "ler o fixo") as R | null;
  return row ? toRecurring(row) : null;
}

/**
 * Cria os fixos de um mês a partir dos modelos, uma única vez por mês (inclusive meses futuros,
 * para as parcelas aparecerem até o fim). Mudanças num fixo depois disso são levadas para os
 * meses já criados por updateRecurring / endRecurring / createRecurring.
 */
export const GENERATE_MONTHS_AHEAD = 60;

export async function ensureMonthGenerated(month: string) {
  if (month > shiftMonth(currentMonth(), GENERATE_MONTHS_AHEAD)) return;
  const sb = await getSupabase();
  const done = must(await sb.from("generated_months").select("month").eq("month", month), "ler os meses") as R[];
  if (done.length) return;
  const claimed = must(
    await sb.from("generated_months").upsert({ month }, { onConflict: "user_id,month", ignoreDuplicates: true }).select(),
    "marcar o mês",
  ) as R[];
  if (!claimed.length) return; // outra aba já gerou
  const recs = (must(await sb.from("recurring").select("*"), "ler os fixos") as R[]).map(toRecurring);
  await fillMonths(sb, recs, [month]);
}

export interface RecurringInput {
  kind: "fixo" | "cartao";
  name: string;
  amountCents: number;
  day: number | null;
  paymentMethodId: number | null;
  categoryId: number | null;
  subcategoryId?: number | null;
  installments: number | null;
  startMonth: string;
}

/**
 * Cria um fixo e já o coloca nos meses que já foram gerados a partir de hoje.
 * Com backfill, começa no próprio mês inicial (compra parcelada lançada depois, numa fatura passada).
 */
export async function createRecurring(input: RecurringInput, { backfill = false }: { backfill?: boolean } = {}): Promise<number> {
  const sb = await getSupabase();
  const row = must(
    await sb
      .from("recurring")
      .insert({
        kind: input.kind,
        name: input.name,
        amount_cents: input.amountCents,
        day: input.day,
        payment_method_id: input.paymentMethodId,
        category_id: input.categoryId,
        subcategory_id: input.categoryId != null ? (input.subcategoryId ?? null) : null,
        installments: input.installments,
        start_month: input.startMonth,
      })
      .select()
      .single(),
    "criar o fixo",
  ) as R;
  const from = !backfill && input.startMonth < currentMonth() ? currentMonth() : input.startMonth;
  const months = must(await sb.from("generated_months").select("month").gte("month", from), "ler os meses") as {
    month: string;
  }[];
  await fillMonths(
    sb,
    [toRecurring(row)],
    months.map((m) => m.month),
  );
  return Number(row.id);
}

/**
 * Coloca um fixo no mês `from` e nos meses já gerados depois dele (usado ao lançar, pela conferência da fatura,
 * uma parcela de uma compra antiga: só desta parcela em diante, sem mexer nos meses anteriores).
 */
export async function fillRecurringFrom(id: number, from: string) {
  const rec = await getRecurring(id);
  if (!rec) return;
  const sb = await getSupabase();
  const months = must(await sb.from("generated_months").select("month").gte("month", from), "ler os meses") as { month: string }[];
  await fillMonths(sb, [rec], [...new Set([from, ...months.map((m) => m.month)])]);
}

/** Atualiza o modelo e os lançamentos ainda não pagos a partir de um mês. */
export async function updateRecurring(id: number, input: Omit<RecurringInput, "startMonth" | "kind">, fromMonth: string) {
  const sb = await getSupabase();
  must(
    await sb
      .from("recurring")
      .update({
        name: input.name,
        amount_cents: input.amountCents,
        day: input.day,
        payment_method_id: input.paymentMethodId,
        category_id: input.categoryId,
        subcategory_id: input.categoryId != null ? (input.subcategoryId ?? null) : null,
        installments: input.installments,
      })
      .eq("id", id),
    "salvar o fixo",
  );
  const rows = (
    must(
      await sb.from("entries").select("*").eq("recurring_id", id).gte("month", fromMonth).or("paid.is.null,paid.eq.false"),
      "ler os lançamentos do fixo",
    ) as R[]
  ).map(toEntry);
  await Promise.all(
    rows.map(async (e) =>
      must(
        await sb
          .from("entries")
          .update({
            name: input.name,
            amount_cents: input.amountCents,
            date: dateInMonth(e.month, input.day) ?? e.date,
            payment_method_id: input.paymentMethodId,
            category_id: input.categoryId,
            subcategory_id: input.categoryId != null ? (input.subcategoryId ?? null) : null,
            installment_total: input.installments,
          })
          .eq("id", e.id),
        "atualizar o lançamento",
      ),
    ),
  );
}

/** Encerra um fixo: ele não aparece mais depois de `lastMonth`. */
export async function endRecurring(id: number, lastMonth: string) {
  const sb = await getSupabase();
  must(await sb.from("recurring").update({ end_month: lastMonth }).eq("id", id), "encerrar o fixo");
  must(
    await sb.from("entries").delete().eq("recurring_id", id).gt("month", lastMonth).or("paid.is.null,paid.eq.false"),
    "apagar os próximos lançamentos do fixo",
  );
}

/* ---------- lançamentos ---------- */

export async function getEntry(id: number): Promise<Entry | null> {
  const sb = await getSupabase();
  const row = must(await sb.from("entries").select("*").eq("id", id).maybeSingle(), "ler o lançamento") as R | null;
  return row ? toEntry(row) : null;
}

export interface EntryInput {
  month: string;
  kind: Kind;
  name: string;
  amountCents: number;
  date: string | null;
  paymentMethodId: number | null;
  categoryId: number | null;
  /** Precisa ser da categoria (veja checkSubcategory). */
  subcategoryId?: number | null;
}

export async function createEntry(e: EntryInput) {
  const sb = await getSupabase();
  must(
    await sb.from("entries").insert({
      month: e.month,
      kind: e.kind,
      name: e.name,
      amount_cents: e.amountCents,
      date: e.date,
      payment_method_id: e.paymentMethodId,
      category_id: e.categoryId,
      subcategory_id: e.categoryId != null ? (e.subcategoryId ?? null) : null,
    }),
    "salvar o gasto",
  );
}

export async function updateEntry(id: number, e: Omit<EntryInput, "kind">) {
  const sb = await getSupabase();
  must(
    await sb
      .from("entries")
      .update({
        month: e.month,
        name: e.name,
        amount_cents: e.amountCents,
        date: e.date,
        payment_method_id: e.paymentMethodId,
        category_id: e.categoryId,
        subcategory_id: e.categoryId != null ? (e.subcategoryId ?? null) : null,
      })
      .eq("id", id),
    "salvar o lançamento",
  );
}

export async function deleteEntry(id: number) {
  const sb = await getSupabase();
  must(await sb.from("entries").delete().eq("id", id), "excluir o lançamento");
}

export async function setPaid(id: number, paid: boolean) {
  const sb = await getSupabase();
  must(await sb.from("entries").update({ paid }).eq("id", id), "marcar como pago");
}

export async function fillCategoriesFromHistory(month: string): Promise<number> {
  const sb = await getSupabase();
  return Number(must(await sb.rpc("fm_fill_categories", { p_month: month }), "preencher as categorias"));
}

/* ---------- entradas ---------- */

export async function getIncome(id: number): Promise<Income | null> {
  const sb = await getSupabase();
  const row = must(await sb.from("incomes").select("*").eq("id", id).maybeSingle(), "ler a entrada") as R | null;
  return row ? toIncome(row) : null;
}

export async function createIncome(i: Omit<Income, "id">) {
  const sb = await getSupabase();
  must(
    await sb.from("incomes").insert({ month: i.month, name: i.name, amount_cents: i.amountCents, date: i.date }),
    "salvar a entrada",
  );
}

export async function updateIncome(id: number, i: Omit<Income, "id">) {
  const sb = await getSupabase();
  must(
    await sb.from("incomes").update({ month: i.month, name: i.name, amount_cents: i.amountCents, date: i.date }).eq("id", id),
    "salvar a entrada",
  );
}

export async function deleteIncome(id: number) {
  const sb = await getSupabase();
  must(await sb.from("incomes").delete().eq("id", id), "excluir a entrada");
}

/* ---------- sugestões para o lançamento rápido ---------- */

export interface Suggestion {
  name: string;
  categoryId: number | null;
  subcategoryId: number | null;
  paymentMethodId: number | null;
  uses: number;
}

/** Nomes já usados, com a categoria e a forma de pagamento mais recentes de cada um. */
export async function getSuggestions(): Promise<Suggestion[]> {
  const sb = await getSupabase();
  const rows = must(await sb.rpc("fm_suggestions"), "ler as sugestões") as {
    name: string;
    category_id: number | null;
    subcategory_id: number | null;
    payment_method_id: number | null;
    uses: number;
  }[];
  return rows.map((r) => ({
    name: r.name,
    categoryId: r.category_id == null ? null : Number(r.category_id),
    subcategoryId: r.subcategory_id == null ? null : Number(r.subcategory_id),
    paymentMethodId: r.payment_method_id == null ? null : Number(r.payment_method_id),
    uses: Number(r.uses),
  }));
}

export async function getIncomeSuggestions(): Promise<string[]> {
  const sb = await getSupabase();
  const rows = must(
    await sb.from("incomes").select("name").order("month", { ascending: false }).order("id", { ascending: false }).limit(300),
    "ler as entradas",
  ) as { name: string }[];
  return [...new Set(rows.map((r) => r.name.trim()))].slice(0, 60);
}

export async function hasAnyData(): Promise<boolean> {
  const sb = await getSupabase();
  const rows = must(await sb.from("entries").select("id").limit(1), "ler os gastos") as R[];
  return rows.length > 0;
}

/* ---------- metas ---------- */

const toGoal = (r: R): Goal => ({
  id: Number(r.id),
  kind: r.kind as GoalKind,
  period: r.period as GoalPeriod,
  categoryId: num(r.category_id),
  targetCents: Number(r.target_cents),
  startMonth: String(r.start_month),
  endMonth: (r.end_month as string) ?? null,
});

export async function listGoals(): Promise<Goal[]> {
  const sb = await getSupabase();
  const rows = must(await sb.from("goals").select("*").order("start_month").order("id"), "ler as metas") as R[];
  return rows.map(toGoal);
}

export async function getGoal(id: number): Promise<Goal | null> {
  const sb = await getSupabase();
  const row = must(await sb.from("goals").select("*").eq("id", id).maybeSingle(), "ler a meta") as R | null;
  return row ? toGoal(row) : null;
}

export async function createGoal(g: Omit<Goal, "id">) {
  const sb = await getSupabase();
  must(
    await sb.from("goals").insert({
      kind: g.kind,
      period: g.period,
      category_id: g.categoryId,
      target_cents: g.targetCents,
      start_month: g.startMonth,
      end_month: g.endMonth,
    }),
    "criar a meta",
  );
}

/**
 * Muda o valor de uma meta a partir de um mês. Meta do mês que começou antes: a versão antiga vai até o mês
 * anterior e uma nova começa no mês (os meses que passaram continuam com o valor da época).
 */
export async function updateGoal(id: number, targetCents: number, fromMonth: string) {
  const sb = await getSupabase();
  const g = await getGoal(id);
  if (!g) return;
  if (g.period === "ano" || g.startMonth >= fromMonth) {
    must(await sb.from("goals").update({ target_cents: targetCents }).eq("id", id), "salvar a meta");
    return;
  }
  if (g.endMonth != null && g.endMonth < fromMonth) return; // já tinha acabado antes deste mês
  must(await sb.from("goals").update({ end_month: shiftMonth(fromMonth, -1) }).eq("id", id), "salvar a meta");
  await createGoal({ ...g, targetCents, startMonth: fromMonth });
}

/** Encerra uma meta a partir de um mês (ela some deste mês em diante; os meses anteriores ficam). */
export async function endGoal(id: number, fromMonth: string) {
  const sb = await getSupabase();
  const g = await getGoal(id);
  if (!g) return;
  if (g.period === "ano" || g.startMonth >= fromMonth) {
    must(await sb.from("goals").delete().eq("id", id), "apagar a meta");
    return;
  }
  must(await sb.from("goals").update({ end_month: shiftMonth(fromMonth, -1) }).eq("id", id), "encerrar a meta");
}

/** Totais de cada mês do intervalo (gastos, dia a dia, cartão, categorias e entradas) para as metas. */
export async function getMonthTotals(from: string, to: string): Promise<Map<string, MonthTotals>> {
  const sb = await getSupabase();
  const rows = must(await sb.rpc("fm_month_totals", { p_from: from, p_to: to }), "somar os meses") as Parameters<
    typeof totalsFromRows
  >[0];
  return totalsFromRows(rows ?? []);
}

/** Os totais de um mês já carregado (getMonth), no formato das metas. */
export function monthTotalsOf(s: MonthSummary): MonthTotals {
  const byCategory: Record<number, number> = {};
  for (const c of s.byCategory) if (c.categoryId != null) byCategory[c.categoryId] = c.total;
  return {
    month: s.month,
    gastos: s.totals.gastos,
    avulso: s.totals.avulso,
    credito: s.totals.credito,
    entradas: s.totals.entradas,
    byCategory,
  };
}
