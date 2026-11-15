import { getSupabase, type Supabase } from "./supabase/server";
import { currentMonth, dateInMonth, monthDiff, nextPaymentColor, PAYMENT_COLORS, shiftMonth } from "./format";
import { must } from "./must";

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
}

export interface Category {
  id: number;
  name: string;
  emoji: string;
  budgetCents: number | null;
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
  color: String(r.color),
  sort: Number(r.sort),
});

/* ---------- formas de pagamento ---------- */

export const DEFAULT_CATEGORIES: [string, string][] = [
  ["Supermercado", "🛒"],
  ["Restaurante", "🍽️"],
  ["Apartamento", "🏠"],
  ["Contas", "🧾"],
  ["Saúde", "🩺"],
  ["Carro", "🚗"],
  ["Assinaturas", "📺"],
  ["Farmácia", "💊"],
  ["Uber", "🚕"],
  ["Viagem", "✈️"],
  ["Lazer", "🎬"],
  ["Roupa", "👕"],
  ["Casa", "🛠️"],
  ["Presentes", "🎁"],
];

/**
 * Conta nova começa com "Conta Corrente" e "Crédito" (como na planilha) e categorias básicas.
 * Roda só quando o usuário ainda não tem nenhuma forma de pagamento.
 */
async function seedDefaults(sb: Supabase) {
  must(
    await sb.from("payment_methods").upsert(
      [
        { name: "Conta Corrente", is_credit: false, closing_day: null, color: PAYMENT_COLORS[0], sort: 1 },
        { name: "Crédito", is_credit: true, closing_day: 25, color: PAYMENT_COLORS[1], sort: 2 },
      ],
      { onConflict: "user_id,name", ignoreDuplicates: true },
    ),
    "criar as formas de pagamento",
  );
  const anyCategory = must(await sb.from("categories").select("id").limit(1), "ler as categorias") as R[];
  if (!anyCategory.length) {
    must(
      await sb.from("categories").upsert(
        DEFAULT_CATEGORIES.map(([name, emoji], i) => ({ name, emoji, sort: i + 1 })),
        { onConflict: "user_id,name", ignoreDuplicates: true },
      ),
      "criar as categorias",
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

export interface PaymentMethodInput {
  id?: number;
  name: string;
  isCredit: boolean;
  closingDay: number | null;
  color?: string;
}

export async function upsertPaymentMethod(m: PaymentMethodInput) {
  const sb = await getSupabase();
  const values = { name: m.name, is_credit: m.isCredit, closing_day: m.isCredit ? m.closingDay : null };
  if (m.id) {
    must(
      await sb
        .from("payment_methods")
        .update({ ...values, ...(m.color ? { color: m.color } : {}) })
        .eq("id", m.id),
      "salvar a forma de pagamento",
    );
    return;
  }
  const all = must(await sb.from("payment_methods").select("color, sort, archived"), "ler as formas de pagamento") as {
    color: string;
    sort: number;
    archived: boolean;
  }[];
  must(
    await sb.from("payment_methods").upsert(
      {
        ...values,
        archived: false,
        color: m.color ?? nextPaymentColor(all.filter((x) => !x.archived).map((x) => x.color)),
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

export async function upsertCategory(c: { id?: number; name: string; emoji: string; budgetCents: number | null }) {
  const sb = await getSupabase();
  if (c.id) {
    must(
      await sb.from("categories").update({ name: c.name, emoji: c.emoji, budget_cents: c.budgetCents }).eq("id", c.id),
      "salvar a categoria",
    );
    return;
  }
  const last = must(await sb.from("categories").select("sort").order("sort", { ascending: false }).limit(1), "ler as categorias") as {
    sort: number;
  }[];
  must(
    await sb.from("categories").upsert(
      { name: c.name, emoji: c.emoji, budget_cents: c.budgetCents, archived: false, sort: (last[0]?.sort ?? 0) + 1 },
      { onConflict: "user_id,name" },
    ),
    "criar a categoria",
  );
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
    gastos: number;
    entradas: number;
    saldo: number;
    fixo: number;
    cartao: number;
    avulso: number;
  };
  byPayment: { paymentMethodId: number | null; total: number }[];
  byCategory: { categoryId: number | null; total: number; count: number }[];
  pending: Entry[];
}

export async function getMonth(month: string): Promise<MonthSummary> {
  await ensureMonthGenerated(month);
  const sb = await getSupabase();
  const [entryRes, incomeRes, methodRes] = await Promise.all([
    sb.from("entries").select("*").eq("month", month).order("date", { nullsFirst: true }).order("id"),
    sb.from("incomes").select("*").eq("month", month).order("date", { nullsFirst: true }).order("id"),
    sb.from("payment_methods").select("id, is_credit"),
  ]);
  const creditIds = new Set(
    ((must(methodRes, "ler as formas de pagamento") ?? []) as R[]).filter((m) => m.is_credit).map((m) => Number(m.id)),
  );
  const knownIds = new Set(((methodRes.data ?? []) as R[]).map((m) => Number(m.id)));
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
    },
    byPayment,
    byCategory,
    pending,
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
  installments: number | null;
  startMonth: string;
}

/**
 * Cria um fixo e já o coloca nos meses que já foram gerados a partir de hoje.
 * Com backfill, começa no próprio mês inicial (compra parcelada lançada depois, numa fatura passada).
 */
export async function createRecurring(input: RecurringInput, { backfill = false }: { backfill?: boolean } = {}) {
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
  paymentMethodId: number | null;
  uses: number;
}

/** Nomes já usados, com a categoria e a forma de pagamento mais recentes de cada um. */
export async function getSuggestions(): Promise<Suggestion[]> {
  const sb = await getSupabase();
  const rows = must(await sb.rpc("fm_suggestions"), "ler as sugestões") as {
    name: string;
    category_id: number | null;
    payment_method_id: number | null;
    uses: number;
  }[];
  return rows.map((r) => ({
    name: r.name,
    categoryId: r.category_id == null ? null : Number(r.category_id),
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
