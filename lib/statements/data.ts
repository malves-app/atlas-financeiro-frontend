// Conferir com o banco: guardar o que foi lido do arquivo, montar a comparação com o Atlas e aplicar as correções.
// Tudo com a sessão de quem está logado (RLS).

import { getSupabase } from "../supabase/server";
import { must } from "../must";
import * as data from "../data";
import { monthDiff, shiftMonth } from "../format";
import { compareExtrato, compareFatura, faturaMonth, type EntryLite, type Fix, type Issue, type Report, type Rule } from "./compare";
import type { CategoryLite } from "./suggest";
import type { Extrato, Fatura } from "./types";

type R = Record<string, unknown>;
const num = (v: unknown) => (v == null ? null : Number(v));

export type ImportKind = "fatura" | "extrato";

export interface StatementImport {
  id: number;
  kind: ImportKind;
  /** Banco do arquivo (lib/statements/banks.ts). */
  bank: string;
  paymentMethodId: number;
  month: string | null;
  from: string;
  to: string;
  fileName: string | null;
  data: Fatura | Extrato;
  ignored: string[];
  createdAt: string;
}

const toImport = (r: R): StatementImport => ({
  id: Number(r.id),
  kind: r.kind === "extrato" ? "extrato" : "fatura",
  bank: String(r.bank ?? "santander"),
  paymentMethodId: Number(r.payment_method_id),
  month: (r.month as string) ?? null,
  from: String(r.period_from),
  to: String(r.period_to),
  fileName: (r.file_name as string) ?? null,
  data: r.data as Fatura | Extrato,
  ignored: Array.isArray(r.ignored) ? (r.ignored as string[]) : [],
  createdAt: String(r.created_at),
});

/** Envios de um tipo, do mais novo para o mais antigo. */
export async function listImports(kind: ImportKind, limit = 12): Promise<StatementImport[]> {
  const sb = await getSupabase();
  const rows = must(
    await sb.from("statement_imports").select("*").eq("kind", kind).order("period_to", { ascending: false }).order("id", { ascending: false }).limit(limit),
    "ler os arquivos enviados",
  ) as R[];
  return rows.map(toImport);
}

export async function getImport(id: number): Promise<StatementImport | null> {
  const sb = await getSupabase();
  const row = must(await sb.from("statement_imports").select("*").eq("id", id).maybeSingle(), "ler o arquivo enviado") as R | null;
  return row ? toImport(row) : null;
}

/** Guarda o que foi lido. Fatura do mesmo mês e cartão substitui a anterior. Devolve o id. */
export async function saveImport(input: {
  kind: ImportKind;
  bank: string;
  paymentMethodId: number;
  fileName: string | null;
  data: Fatura | Extrato;
}): Promise<number> {
  const sb = await getSupabase();
  const isFatura = input.kind === "fatura";
  const f = input.data as Fatura;
  const e = input.data as Extrato;
  const row = {
    kind: input.kind,
    bank: input.bank,
    payment_method_id: input.paymentMethodId,
    month: isFatura ? faturaMonth(f) : null,
    period_from: isFatura ? f.periodFrom : e.from,
    period_to: isFatura ? f.closing : e.to,
    file_name: input.fileName?.slice(0, 200) ?? null,
    data: input.data,
    updated_at: new Date().toISOString(),
  };
  if (isFatura) {
    const saved = must(
      await sb.from("statement_imports").upsert(row, { onConflict: "user_id,kind,payment_method_id,month" }).select("id").single(),
      "guardar a fatura",
    ) as R;
    return Number(saved.id);
  }
  const saved = must(await sb.from("statement_imports").insert(row).select("id").single(), "guardar o extrato") as R;
  return Number(saved.id);
}

export async function deleteImport(id: number) {
  const sb = await getSupabase();
  must(await sb.from("statement_imports").delete().eq("id", id), "apagar o arquivo enviado");
}

export async function ignoreIssue(id: number, keys: string | string[]) {
  const imp = await getImport(id);
  if (!imp) throw new Error("Esse arquivo não existe mais.");
  const sb = await getSupabase();
  const ignored = [...new Set([...imp.ignored, ...(Array.isArray(keys) ? keys : [keys])])].slice(-2000);
  must(await sb.from("statement_imports").update({ ignored, updated_at: new Date().toISOString() }).eq("id", id), "ignorar");
}

export async function unignoreAll(id: number) {
  const sb = await getSupabase();
  must(await sb.from("statement_imports").update({ ignored: [], updated_at: new Date().toISOString() }).eq("id", id), "desfazer");
}

/* ---------- como cada linha do banco foi lançada ---------- */

export async function listRules(): Promise<Rule[]> {
  const sb = await getSupabase();
  const rows = must(
    await sb.from("statement_rules").select("key, name, category_id, subcategory_id").order("updated_at", { ascending: false }).limit(5000),
    "ler as regras",
  ) as R[];
  return rows.map((r) => ({ key: String(r.key), name: String(r.name), categoryId: num(r.category_id), subcategoryId: num(r.subcategory_id) }));
}

/** Lembra como lançar cada linha (a chave é única por pessoa: a última vez vale). */
export async function saveRules(rules: Rule[]) {
  const rows = [...new Map(rules.filter((r) => r.key.length >= 3 && r.name.trim()).map((r) => [r.key, r])).values()].map((r) => ({
    key: r.key.slice(0, 120),
    name: r.name.trim().slice(0, 80),
    category_id: r.categoryId,
    subcategory_id: r.categoryId == null ? null : r.subcategoryId,
    updated_at: new Date().toISOString(),
  }));
  if (!rows.length) return;
  const sb = await getSupabase();
  must(await sb.from("statement_rules").upsert(rows, { onConflict: "user_id,key" }), "guardar como lançar");
}

/* ---------- a comparação ---------- */

const toEntryLite = (r: R): EntryLite => ({
  id: Number(r.id),
  month: String(r.month),
  kind: r.kind as EntryLite["kind"],
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

/** Meses que entram na comparação (com os fixos e parcelas já criados nesses meses). */
async function monthsFor(imp: Pick<StatementImport, "kind" | "from" | "to" | "month">) {
  const first = imp.kind === "fatura" ? shiftMonth(imp.month!, -1) : shiftMonth(imp.from.slice(0, 7), -1);
  const last = imp.kind === "fatura" ? shiftMonth(imp.month!, 1) : shiftMonth(imp.to.slice(0, 7), 1);
  const months: string[] = [];
  for (let m = first; m <= last && monthDiff(first, m) <= 14; m = shiftMonth(m, 1)) months.push(m);
  for (const m of months) await data.ensureMonthGenerated(m);
  return { first, last };
}

export interface LoadedReport {
  imp: StatementImport;
  report: Report;
  method: data.PaymentMethod | null;
}

/** Depois de enviar o arquivo: o que já bateu com o Atlas ensina como lançar as próximas linhas iguais. */
export async function learnFromImport(id: number) {
  const imp = await getImport(id);
  if (!imp) return;
  const { report } = await loadReport(imp);
  await saveRules(report.learned);
}

/** Compara o arquivo guardado com o que está lançado agora. */
export async function loadReport(imp: StatementImport): Promise<LoadedReport> {
  const sb = await getSupabase();
  const { first, last } = await monthsFor(imp);
  const [methods, entryRows, incomeRows, hints, rules, cats, subs] = await Promise.all([
    data.listPaymentMethods(),
    sb.from("entries").select("*").gte("month", first).lte("month", last).order("id"),
    imp.kind === "extrato" ? sb.from("incomes").select("*").gte("month", first).lte("month", last).order("id") : Promise.resolve({ data: [], error: null }),
    data.getSuggestions(),
    listRules(),
    data.listCategories(),
    data.listSubcategories(),
  ]);
  const categories: CategoryLite[] = data.withSubcategories(cats, subs);
  const entries = (must(entryRows, "ler os lançamentos") as R[]).map(toEntryLite);
  const methodLites = methods.map((m) => ({ id: m.id, name: m.name, isCredit: m.isCredit, icon: m.icon }));
  const report =
    imp.kind === "fatura"
      ? compareFatura({ fatura: imp.data as Fatura, methodId: imp.paymentMethodId, methods: methodLites, entries, hints, rules, categories, ignored: imp.ignored })
      : compareExtrato({
          extrato: imp.data as Extrato,
          methodId: imp.paymentMethodId,
          methods: methodLites,
          entries,
          incomes: (must(incomeRows as { data: unknown; error: { message: string } | null }, "ler as entradas") as R[]).map((r) => ({
            id: Number(r.id),
            month: String(r.month),
            name: String(r.name),
            amountCents: Number(r.amount_cents),
            date: (r.date as string) ?? null,
          })),
          hints,
          rules,
          categories,
          ignored: imp.ignored,
        });
  return { imp, report, method: methods.find((m) => m.id === imp.paymentMethodId) ?? null };
}

/* ---------- correções ---------- */

/** O que a pessoa pode mudar antes de lançar (nome e categoria). */
export interface FixEdits {
  name?: string;
  categoryId?: number | null;
  subcategoryId?: number | null;
}

/** Aplica a correção. Ao lançar, devolve como a linha foi lançada (para sugerir igual da próxima vez). */
export async function applyFix(fix: Fix, edits: FixEdits = {}): Promise<Rule | null> {
  const sb = await getSupabase();
  switch (fix.kind) {
    case "criar": {
      const name = (edits.name ?? fix.name).trim().slice(0, 80) || fix.name;
      const categoryId = edits.categoryId !== undefined ? edits.categoryId : fix.categoryId;
      const subcategoryId = await data.checkSubcategory(categoryId, edits.subcategoryId !== undefined ? edits.subcategoryId : fix.subcategoryId);
      const rule: Rule = { key: fix.ruleKey, name, categoryId, subcategoryId };
      if (fix.installment && fix.installment.total > 1) {
        // Compra parcelada: o fixo começa na 1ª parcela, mas só é criado desta fatura em diante
        const id = await data.createRecurring({
          kind: "cartao",
          name,
          amountCents: fix.amountCents,
          day: Number(fix.date.slice(8, 10)),
          paymentMethodId: fix.paymentMethodId,
          categoryId,
          subcategoryId,
          installments: fix.installment.total,
          startMonth: shiftMonth(fix.month, -(fix.installment.no - 1)),
        });
        await data.fillRecurringFrom(id, fix.month);
        return rule;
      }
      await data.createEntry({
        month: fix.month,
        kind: "avulso",
        name,
        amountCents: fix.amountCents,
        date: fix.date,
        paymentMethodId: fix.paymentMethodId,
        categoryId,
        subcategoryId,
      });
      return rule;
    }
    case "criar-entrada": {
      const name = (edits.name ?? fix.name).trim().slice(0, 80) || fix.name;
      await data.createIncome({ month: fix.month, name, amountCents: fix.amountCents, date: fix.date });
      return { key: fix.ruleKey, name, categoryId: null, subcategoryId: null };
    }
    case "valor":
      must(await sb.from("entries").update({ amount_cents: fix.amountCents }).eq("id", fix.entryId), "corrigir o valor");
      return null;
    case "valor-entrada": {
      const inc = await data.getIncome(fix.incomeId);
      if (!inc) throw new Error("Essa entrada não existe mais.");
      await data.updateIncome(inc.id, { ...inc, amountCents: fix.amountCents });
      return null;
    }
    case "mes":
      must(await sb.from("entries").update({ month: fix.month }).eq("id", fix.entryId), "mudar o mês");
      return null;
    case "forma":
      must(
        await sb.from("entries").update({ payment_method_id: fix.paymentMethodId, month: fix.month }).eq("id", fix.entryId),
        "mudar a forma de pagamento",
      );
      return null;
    case "excluir":
      await data.deleteEntry(fix.entryId);
      return null;
    case "pago":
      await data.setPaid(fix.entryId, fix.paid);
      return null;
  }
}

/**
 * Refaz a comparação e aplica a correção dos problemas `keys` (o servidor decide a correção, não a tela).
 * Várias chaves: linhas iguais agrupadas na tela (ex.: 9 estornos iguais), com o mesmo nome e categoria.
 */
export async function fixIssue(importId: number, keys: string | string[], edits: FixEdits = {}) {
  const imp = await getImport(importId);
  if (!imp) throw new Error("Esse arquivo não existe mais.");
  const { report } = await loadReport(imp);
  const wanted = new Set(Array.isArray(keys) ? keys : [keys]);
  const issues = report.issues.filter((i) => wanted.has(i.key));
  if (!issues.length) throw new Error("Isso já foi corrigido. Atualize a página.");
  const learned: Rule[] = [];
  for (const issue of issues) {
    const rule = await applyFix(issue.fix, edits);
    if (rule) learned.push(rule);
  }
  await saveRules(learned);
}

/** "Aprovar tudo": aplica as sugestões seguras (lançar, valor, mês, forma, marcar paga). Exclusões ficam de fora. */
export async function fixAll(importId: number): Promise<{ done: number; failed: string[] }> {
  const imp = await getImport(importId);
  if (!imp) throw new Error("Esse arquivo não existe mais.");
  const { report } = await loadReport(imp);
  let done = 0;
  const failed: string[] = [];
  const learned: Rule[] = [];
  for (const issue of report.issues.filter((i: Issue) => i.safe)) {
    try {
      const rule = await applyFix(issue.fix);
      if (rule) learned.push(rule);
      done += 1;
    } catch (e) {
      failed.push(`${issue.title}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  await saveRules(learned);
  return { done, failed };
}
