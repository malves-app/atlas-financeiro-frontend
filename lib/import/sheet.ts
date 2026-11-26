import type { Supabase } from "../supabase/server";
import { must } from "../must";
import { MONTH_NAMES, nextPaymentColor, shiftMonth } from "../format";
import { checkMonth, looksLikeCredit, parseMonthSheet, type ParsedMonth } from "./parse";
import { bankById, guessBank, guessPaymentType } from "../payment-icons";

// Planilha do Google com uma aba por mês. O link precisa estar como "qualquer pessoa com o link pode ver".
export const DEFAULT_YEAR = 2026;

// Identificadores (gid) de cada aba mensal dessa planilha.
export const DEFAULT_GIDS: Record<string, string> = {
  Janeiro: "177787566",
  Fevereiro: "1978739936",
  Março: "45944163",
  Abril: "1735143319",
  Maio: "2073499829",
  Junho: "649573805",
  Julho: "1683388199",
  Agosto: "200249392",
  Setembro: "1147756546",
  Outubro: "100675778",
  Novembro: "542011733",
};

const CATEGORY_EMOJI: Record<string, string> = {
  Assinaturas: "📺",
  Apartamento: "🏠",
  Beleza: "💇",
  Carro: "🚗",
  Contas: "🧾",
  Eletrônicos: "💻",
  Farmácia: "💊",
  Igreja: "⛪",
  Necessidades: "🧺",
  Ifood: "🛵",
  Presentes: "🎁",
  Casa: "🛠️",
  Padaria: "🥖",
  Roupa: "👕",
  Restaurante: "🍽️",
  Saúde: "🩺",
  Supermercado: "🛒",
  Uber: "🚕",
  Viagem: "✈️",
  Lazer: "🎬",
  Desconhecido: "❔",
  Bolt: "🐶",
  Marmita: "🍱",
  Imposto: "🏛️",
};

// Ordem das categorias como na tabela "Gastos do mês por categoria" da planilha
const CATEGORY_ORDER = [
  "Supermercado",
  "Restaurante",
  "Apartamento",
  "Contas",
  "Saúde",
  "Carro",
  "Assinaturas",
  "Farmácia",
  "Uber",
  "Viagem",
  "Lazer",
  "Igreja",
  "Padaria",
  "Ifood",
  "Roupa",
  "Beleza",
  "Casa",
  "Eletrônicos",
  "Presentes",
  "Necessidades",
];

async function fetchTab(sheetId: string, gid: string): Promise<string> {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
  let res: Response;
  try {
    res = await fetch(url, { redirect: "follow", cache: "no-store" });
  } catch {
    throw new Error("Não consegui acessar o Google Planilhas. Verifique a conexão com a internet e tente de novo.");
  }
  const text = await res.text();
  if (!res.ok || /^\s*<!DOCTYPE html/i.test(text)) {
    throw new Error(
      `Não consegui baixar a aba (gid ${gid}). Confira se a planilha está compartilhada como "qualquer pessoa com o link pode ver".`,
    );
  }
  return text;
}

export interface ImportReport {
  months: { month: string; entries: number; incomes: number; ok: boolean; diffs: Record<string, { planilha: number; lido: number }> }[];
  categories: number;
  recurring: number;
  warnings: string[];
}

export async function fetchAndParseSheet(
  sheetId: string,
  gids = DEFAULT_GIDS,
  year = DEFAULT_YEAR,
): Promise<ParsedMonth[]> {
  const parsed: ParsedMonth[] = [];
  for (const [tab, gid] of Object.entries(gids)) {
    const monthIndex = MONTH_NAMES.indexOf(tab) + 1;
    if (monthIndex < 1) continue;
    const csv = await fetchTab(sheetId, gid);
    parsed.push(parseMonthSheet(csv, year, monthIndex));
  }
  return parsed.sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * Apaga os lançamentos do site e recria tudo a partir das abas lidas.
 * Os fixos do último mês viram os modelos de "Fixos" que o site repete todo mês.
 */
export async function loadIntoDatabase(sb: Supabase, parsed: ParsedMonth[]): Promise<ImportReport> {
  const warnings = parsed.flatMap((p) => p.warnings);
  const lastMonth = parsed[parsed.length - 1];

  must(await sb.rpc("fm_reset_data"), "limpar os dados antigos");

  // Categorias (mantém as que já existem, com o emoji que você escolheu)
  const names = new Set<string>(CATEGORY_ORDER);
  for (const p of parsed) for (const e of p.entries) if (e.category) names.add(e.category);
  const ordered = [...CATEGORY_ORDER, ...[...names].filter((n) => !CATEGORY_ORDER.includes(n)).sort()];
  const existing = must(await sb.from("categories").select("id, name"), "ler as categorias") as { id: number; name: string }[];
  const have = new Set(existing.map((c) => c.name));
  const missing = ordered
    .map((name, i) => ({ name, emoji: CATEGORY_EMOJI[name] ?? "🏷️", sort: i + 1 }))
    .filter((c) => !have.has(c.name));
  if (missing.length) must(await sb.from("categories").insert(missing), "criar as categorias");
  must(await sb.from("categories").update({ archived: false }).in("name", ordered), "reativar as categorias");
  const cats = must(await sb.from("categories").select("id, name"), "ler as categorias") as { id: number; name: string }[];
  const catId = new Map(cats.map((c) => [c.name, Number(c.id)]));
  const cat = (name: string | null) => (name ? catId.get(name) ?? null : null);

  // Formas de pagamento: as da seção "Saídas" e qualquer outro "Tipo" usado nas linhas
  const payNames: string[] = [];
  for (const p of parsed) for (const n of p.paymentNames) if (!payNames.includes(n)) payNames.push(n);
  for (const p of parsed) for (const e of p.entries) if (!payNames.includes(e.payment)) payNames.push(e.payment);
  const existingMethods = must(await sb.from("payment_methods").select("id, name, color, sort, archived"), "ler as formas de pagamento") as {
    id: number;
    name: string;
    color: string;
    sort: number;
    archived: boolean;
  }[];
  const usedColors = existingMethods.filter((m) => !m.archived).map((m) => m.color);
  let nextSort = Math.max(0, ...existingMethods.map((m) => m.sort));
  const newMethods = payNames
    .filter((n) => !existingMethods.some((m) => m.name.toLowerCase() === n.toLowerCase()))
    .map((name) => {
      // Com banco reconhecido pelo nome, a cor é a do banco; sem, a próxima livre da paleta
      const bank = guessBank(name);
      const color = bankById(bank)?.bg ?? nextPaymentColor(usedColors);
      usedColors.push(color);
      const credit = looksLikeCredit(name);
      return {
        name,
        is_credit: credit,
        closing_day: credit ? 25 : null,
        color,
        sort: ++nextSort,
        icon: guessPaymentType(name, credit),
        bank,
      };
    });
  if (newMethods.length) must(await sb.from("payment_methods").insert(newMethods), "criar as formas de pagamento");
  const reactivate = existingMethods.filter((m) => m.archived && payNames.some((n) => n.toLowerCase() === m.name.toLowerCase()));
  if (reactivate.length)
    must(
      await sb.from("payment_methods").update({ archived: false }).in(
        "id",
        reactivate.map((m) => m.id),
      ),
      "reativar as formas de pagamento",
    );
  const methods = must(await sb.from("payment_methods").select("id, name"), "ler as formas de pagamento") as { id: number; name: string }[];
  const methodId = (name: string) => {
    const m = methods.find((x) => x.name.toLowerCase() === name.toLowerCase());
    return m ? Number(m.id) : null;
  };

  // Modelos de fixos a partir do último mês importado
  const key = (kind: string, name: string, amount: number, installments: number | null, start: string) =>
    `${kind}|${name}|${amount}|${installments ?? ""}|${start}`;
  const recurringRows: Record<string, unknown>[] = [];
  const keyOfLastEntry = new Map<ParsedMonth["entries"][number], string>();
  if (lastMonth) {
    for (const e of lastMonth.entries) {
      if (e.kind === "avulso") continue;
      if (e.installmentNo != null && e.installmentTotal != null && e.installmentNo > e.installmentTotal) continue;
      const startMonth =
        e.installmentTotal != null && e.installmentNo != null ? shiftMonth(lastMonth.month, -(e.installmentNo - 1)) : lastMonth.month;
      keyOfLastEntry.set(e, key(e.kind, e.name, e.amountCents, e.installmentTotal, startMonth));
      recurringRows.push({
        kind: e.kind,
        name: e.name,
        amount_cents: e.amountCents,
        day: e.day != null && e.day >= 1 && e.day <= 31 ? e.day : null,
        payment_method_id: methodId(e.payment),
        category_id: cat(e.category),
        installments: e.installmentTotal,
        start_month: startMonth,
      });
    }
  }
  const recIdByKey = new Map<string, number>();
  if (recurringRows.length) {
    const inserted = must(await sb.from("recurring").insert(recurringRows).select(), "criar os fixos") as Record<string, unknown>[];
    for (const r of inserted) {
      recIdByKey.set(
        key(String(r.kind), String(r.name), Number(r.amount_cents), r.installments == null ? null : Number(r.installments), String(r.start_month)),
        Number(r.id),
      );
    }
  }

  const report: ImportReport["months"] = [];
  const entryRows: Record<string, unknown>[] = [];
  const incomeRows: Record<string, unknown>[] = [];
  for (const p of parsed) {
    for (const e of p.entries) {
      const k = p === lastMonth ? keyOfLastEntry.get(e) : undefined;
      entryRows.push({
        month: p.month,
        kind: e.kind,
        name: e.name,
        amount_cents: e.amountCents,
        date: e.date,
        payment_method_id: methodId(e.payment),
        category_id: cat(e.category),
        paid: e.paid,
        installment_no: e.installmentNo,
        installment_total: e.installmentTotal,
        recurring_id: k ? recIdByKey.get(k) ?? null : null,
      });
    }
    for (const i of p.incomes) incomeRows.push({ month: p.month, name: i.name, amount_cents: i.amountCents });
    const check = checkMonth(p);
    report.push({ month: p.month, entries: p.entries.length, incomes: p.incomes.length, ok: check.ok, diffs: check.diffs });
  }

  for (let i = 0; i < entryRows.length; i += 500) {
    must(await sb.from("entries").insert(entryRows.slice(i, i + 500)), "gravar os gastos");
  }
  for (let i = 0; i < incomeRows.length; i += 500) {
    must(await sb.from("incomes").insert(incomeRows.slice(i, i + 500)), "gravar as entradas");
  }
  must(
    await sb.from("generated_months").upsert(
      parsed.map((p) => ({ month: p.month })),
      { onConflict: "user_id,month", ignoreDuplicates: true },
    ),
    "marcar os meses importados",
  );

  return { months: report, categories: catId.size, recurring: recIdByKey.size, warnings };
}

export async function importFromGoogleSheet(sb: Supabase, sheetId: string) {
  const parsed = await fetchAndParseSheet(sheetId);
  return loadIntoDatabase(sb, parsed);
}
