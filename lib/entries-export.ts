// Filtro da tela Lançamentos (o mesmo para a lista e para a exportação) e a planilha exportada (CSV).
// Funções puras: a página e a rota /exportar/lancamentos passam os dados já lidos do banco.
import type { Entry, Income } from "./data";

/** Filtro da aba Gastos, como no endereço: f (dia a dia/todos/fixos/sem-categoria), q (busca), cat, pm. */
export interface EntryFilter {
  f: string;
  q: string;
  cat: string | null;
  pm: string | null;
}

export function readEntryFilter(get: (k: string) => string | undefined | null): EntryFilter {
  return { f: get("f") ?? "", q: (get("q") ?? "").trim(), cat: get("cat") || null, pm: get("pm") || null };
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/** Os gastos que a lista mostra com esse filtro (sem filtro nenhum: só o dia a dia). */
export function filterEntries(entries: Entry[], { f, q, cat, pm }: EntryFilter): Entry[] {
  let list = entries;
  if (!f && !cat && !pm) list = list.filter((e) => e.kind === "avulso");
  if (f === "fixos") list = list.filter((e) => e.kind !== "avulso");
  if (pm) list = list.filter((e) => String(e.paymentMethodId) === pm);
  if (f === "sem-categoria") list = list.filter((e) => e.categoryId == null);
  if (cat) list = list.filter((e) => (cat === "sem" ? e.categoryId == null : String(e.categoryId) === cat));
  const query = norm(q.trim());
  if (query) list = list.filter((e) => norm(e.name).includes(query));
  return list;
}

/* ------------------------------ planilha ------------------------------ */

// Ponto e vírgula e vírgula decimal: o Excel em português abre direto, com os valores como números.
const SEP = ";";

/** Texto: protege contra fórmulas (=, +, -, @ no começo) e põe aspas quando precisa. */
function text(v: string | null | undefined): string {
  let s = (v ?? "").replace(/\r?\n/g, " ");
  if (/^[=+\-@\t]/.test(s)) s = "'" + s;
  return /[";]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Valor em reais com vírgula decimal, sem separador de milhar ("1234,56"). */
export const csvMoney = (cents: number) => (cents < 0 ? "-" : "") + (Math.abs(cents) / 100).toFixed(2).replace(".", ",");

/** "2026-11-05" → "05/11/2026" */
export const csvDate = (iso: string | null) => (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "");

/** "2026-11" → "11/2026" */
const csvMonth = (month: string) => `${month.slice(5, 7)}/${month.slice(0, 4)}`;

function toCsv(rows: string[][]): string {
  // BOM: o Excel reconhece os acentos (UTF-8)
  return "﻿" + rows.map((r) => r.join(SEP)).join("\r\n") + "\r\n";
}

/** Do mais antigo para o mais novo; sem data no fim. */
const byDate = <T extends { date: string | null; id: number }>(a: T, b: T) =>
  (a.date ?? "9999").localeCompare(b.date ?? "9999") || a.id - b.id;

const KIND_LABEL: Record<Entry["kind"], string> = { avulso: "Dia a dia", fixo: "Fixo (conta)", cartao: "Fixo do cartão" };

export interface ExportLookups {
  categories: Map<number, { name: string }>;
  subcategories: Map<number, { name: string }>;
  methods: Map<number, { name: string }>;
}

export const EXPENSE_HEADER = [
  "Data",
  "Descrição",
  "Valor (R$)",
  "Categoria",
  "Subcategoria",
  "Forma de pagamento",
  "Tipo",
  "Parcela",
  "Pago",
  "Mês de referência",
];

export function expensesCsv(entries: Entry[], { categories, subcategories, methods }: ExportLookups): string {
  const rows = [...entries].sort(byDate).map((e) => [
    csvDate(e.date),
    text(e.name),
    csvMoney(e.amountCents),
    text(e.categoryId != null ? categories.get(e.categoryId)?.name : ""),
    text(e.categoryId != null && e.subcategoryId != null ? subcategories.get(e.subcategoryId)?.name : ""),
    text(e.paymentMethodId != null ? methods.get(e.paymentMethodId)?.name : ""),
    KIND_LABEL[e.kind],
    e.installmentTotal ? `${e.installmentNo}/${e.installmentTotal}` : "",
    e.kind === "fixo" && e.paid != null ? (e.paid ? "Sim" : "Não") : "",
    csvMonth(e.month),
  ]);
  return toCsv([EXPENSE_HEADER, ...rows]);
}

export const INCOME_HEADER = ["Data", "Descrição", "Valor (R$)", "Mês de referência"];

export function incomesCsv(incomes: Income[]): string {
  const rows = [...incomes].sort(byDate).map((i) => [csvDate(i.date), text(i.name), csvMoney(i.amountCents), csvMonth(i.month)]);
  return toCsv([INCOME_HEADER, ...rows]);
}

const slug = (s: string) =>
  norm(s)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

/** Nome do arquivo com o mês e o filtro: "lancamentos-2026-11-nubank-busca-uber.csv". */
export function exportFilename(
  month: string,
  tab: "gastos" | "entradas",
  filter: EntryFilter,
  names: { method?: string; category?: string } = {},
): string {
  if (tab === "entradas") return `entradas-${month}.csv`;
  const parts = ["lancamentos", month];
  if (filter.pm) parts.push(slug(names.method ?? "forma-de-pagamento"));
  else if (filter.cat) parts.push(filter.cat === "sem" ? "sem-categoria" : slug(names.category ?? "categoria"));
  else parts.push({ "": "dia-a-dia", todos: "todos", fixos: "fixos-e-parcelas", "sem-categoria": "sem-categoria" }[filter.f] ?? "todos");
  if (filter.q) parts.push("busca", slug(filter.q));
  return parts.filter(Boolean).join("-") + ".csv";
}
