// Leitura das abas mensais da planilha de controle financeiro.
// Funciona sobre o CSV exportado pelo Google Sheets (valores formatados).
// Sem dependências: roda no servidor, em script e também no navegador (para conferência).

export type EntryKind = "fixo" | "cartao" | "avulso";

export interface ParsedEntry {
  kind: EntryKind;
  name: string;
  amountCents: number;
  date: string | null; // YYYY-MM-DD
  day: number | null; // dia informado na planilha (para fixos)
  payment: string; // nome da forma de pagamento, como na coluna "Tipo" (ex.: "Crédito")
  category: string | null;
  paid: boolean | null;
  installmentNo: number | null;
  installmentTotal: number | null;
}

export interface ParsedIncome {
  name: string;
  amountCents: number;
}

export interface SheetTotals {
  totalGastos: number | null;
  fixos: number | null;
  cartao: number | null;
  avulsos: number | null;
  entradas: number | null;
  saldo: number | null;
  /** Seção "Saídas": total por forma de pagamento (ex.: Conta Corrente, Crédito) */
  saidas: Record<string, number>;
}

export interface ParsedMonth {
  month: string; // YYYY-MM
  entries: ParsedEntry[];
  incomes: ParsedIncome[];
  /** Formas de pagamento listadas na seção "Saídas" da aba */
  paymentNames: string[];
  sheetTotals: SheetTotals;
  warnings: string[];
}

export const MONTH_TABS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
] as const;

export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  row.push(field.replace(/\r$/, ""));
  rows.push(row);
  return rows;
}

/** "R$ 1.234,56", "-R$ 32,64", "1234,5" -> centavos. Vazio -> null */
export function parseBRL(raw: string | undefined): number | null {
  if (raw == null) return null;
  let s = raw.trim();
  if (!s) return null;
  const negative = /^-|^\(|-\s*R\$/.test(s);
  s = s.replace(/[R$\s()\-+]/g, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  const cents = Math.round(n * 100);
  return negative ? -cents : cents;
}

function cell(rows: string[][], r: number, c: number): string {
  return (rows[r]?.[c] ?? "").trim();
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function iso(year: number, month: number, day: number): string {
  const d = Math.min(Math.max(day, 1), daysInMonth(year, month));
  return `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Datas da planilha:
 *  "13/12" -> dia/mês (mês maior que o da aba = ano anterior)
 *  "5" / "05" -> dia do mês da aba
 *  "-31" -> dia 31 do mês anterior (compras da fatura que começa no mês anterior)
 *  "0" / vazio -> sem data
 */
export function parseSheetDate(raw: string, year: number, month: number): { date: string | null; day: number | null } {
  const s = raw.trim();
  if (!s) return { date: null, day: null };
  const dm = s.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (dm) {
    const d = Number(dm[1]);
    const m = Number(dm[2]);
    let y = dm[3] ? Number(dm[3].length === 2 ? "20" + dm[3] : dm[3]) : year;
    if (!dm[3] && m > month + 1) y = year - 1;
    if (m < 1 || m > 12 || d < 1) return { date: null, day: null };
    return { date: iso(y, m, d), day: d };
  }
  const n = Number(s.replace(",", "."));
  if (!Number.isFinite(n) || n === 0) return { date: null, day: null };
  if (n < 0) {
    const pm = month === 1 ? 12 : month - 1;
    const py = month === 1 ? year - 1 : year;
    return { date: iso(py, pm, Math.abs(Math.trunc(n))), day: Math.abs(Math.trunc(n)) };
  }
  return { date: iso(year, month, Math.trunc(n)), day: Math.trunc(n) };
}

/** A forma de pagamento parece um cartão de crédito? (para o dia de fechamento) */
export function looksLikeCredit(name: string): boolean {
  return /cr[ée]dito|cart[ãa]o|credit/i.test(name);
}

function parsePaid(raw: string): boolean | null {
  const s = raw.trim().toUpperCase();
  if (s === "TRUE" || s === "VERDADEIRO") return true;
  if (s === "FALSE" || s === "FALSO") return false;
  return null;
}

/** Corrige grafias que aparecem na planilha para os nomes de categoria do site. */
export function normalizeCategory(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  if (/^supe?r?me?r?cado$/i.test(s) || s.toLowerCase() === "supermecado") return "Supermercado";
  return s;
}

function parseInstallments(raw: string): { no: number; total: number } | null {
  const m = raw.trim().match(/^(\d{1,3})\s*\/\s*(\d{1,3})$/);
  if (!m) return null;
  return { no: Number(m[1]), total: Number(m[2]) };
}

// Colunas (0 = A)
const C = {
  fixName: 2, // C
  fixParcelas: 3, // D
  fixPago: 4, // E
  fixData: 5, // F
  fixTipo: 6, // G
  fixCat: 7, // H
  fixValor: 8, // I
  varName: 10, // K
  varData: 11, // L
  varTipo: 12, // M
  varCat: 13, // N
  varValor: 14, // O
  incName: 16, // Q
  incValor: 17, // R
};

export function parseMonthSheet(csv: string, year: number, monthIndex1: number): ParsedMonth {
  const rows = parseCSV(csv);
  const warnings: string[] = [];
  const month = `${year}-${String(monthIndex1).padStart(2, "0")}`;
  const entries: ParsedEntry[] = [];
  const incomes: ParsedIncome[] = [];

  // Cabeçalhos "Nome" na coluna C: o primeiro é dos fixos da conta, o segundo do cartão
  const nomeRows: number[] = [];
  rows.forEach((r, i) => {
    if (cell(rows, i, C.fixName) === "Nome") nomeRows.push(i);
  });
  const varHeader = rows.findIndex((_, i) => cell(rows, i, C.varName) === "Nome");
  const cardTotalRow = rows.findIndex((_, i) => /^Total de Cart/i.test(cell(rows, i, C.fixName)));

  if (nomeRows.length < 2 || varHeader < 0) {
    warnings.push(`Aba ${month}: estrutura não reconhecida (cabeçalhos não encontrados).`);
    return { month, entries, incomes, paymentNames: [], sheetTotals: emptyTotals(), warnings };
  }

  // Seção "Saídas": as formas de pagamento e o total de cada uma
  const saidas: Record<string, number> = {};
  const saidasRow = rows.findIndex((_, i) => /^Saídas/i.test(cell(rows, i, C.incName)));
  if (saidasRow >= 0) {
    for (let i = saidasRow + 1; i < rows.length; i++) {
      const label = cell(rows, i, C.incName);
      if (!label) continue;
      if (/^Total/i.test(label)) break;
      saidas[label] = parseBRL(cell(rows, i, C.incValor)) ?? 0;
    }
  }
  const paymentNames = Object.keys(saidas);
  const knownPayment = new Map(paymentNames.map((n) => [n.toLowerCase(), n]));
  const payment = (raw: string) => {
    const t = raw.trim();
    if (!t) return paymentNames[0] ?? "Conta Corrente";
    return knownPayment.get(t.toLowerCase()) ?? t;
  };

  const fixStart = nomeRows[0] + 1;
  const fixEnd = cardTotalRow > fixStart ? cardTotalRow : nomeRows[1] - 1;
  const cardStart = nomeRows[1] + 1;

  const pushFixed = (i: number, kind: EntryKind) => {
    const name = cell(rows, i, C.fixName);
    const amount = parseBRL(cell(rows, i, C.fixValor));
    if (!name || amount == null) return;
    if (/^total/i.test(name)) return;
    const { date, day } = parseSheetDate(cell(rows, i, C.fixData), year, monthIndex1);
    const inst = kind === "cartao" ? parseInstallments(cell(rows, i, C.fixParcelas)) : null;
    entries.push({
      kind,
      name,
      amountCents: amount,
      date,
      day,
      payment: payment(cell(rows, i, C.fixTipo)),
      category: normalizeCategory(cell(rows, i, C.fixCat)),
      paid: parsePaid(cell(rows, i, C.fixPago)),
      installmentNo: inst?.no ?? null,
      installmentTotal: inst?.total ?? null,
    });
  };

  for (let i = fixStart; i < fixEnd; i++) pushFixed(i, "fixo");
  for (let i = cardStart; i < rows.length; i++) pushFixed(i, "cartao");

  for (let i = varHeader + 1; i < rows.length; i++) {
    const rawName = cell(rows, i, C.varName);
    const amount = parseBRL(cell(rows, i, C.varValor));
    if (amount == null) continue;
    if (!rawName && !cell(rows, i, C.varTipo)) continue;
    const { date } = parseSheetDate(cell(rows, i, C.varData), year, monthIndex1);
    entries.push({
      kind: "avulso",
      name: rawName || "(sem nome)",
      amountCents: amount,
      date,
      day: null,
      payment: payment(cell(rows, i, C.varTipo)),
      category: normalizeCategory(cell(rows, i, C.varCat)),
      paid: null,
      installmentNo: null,
      installmentTotal: null,
    });
  }

  // Entradas: da linha seguinte ao rótulo "Entradas..." até "Total:"
  const incLabel = rows.findIndex((_, i) => /^Entradas/i.test(cell(rows, i, C.incName)));
  let incTotalRow = -1;
  if (incLabel >= 0) {
    for (let i = incLabel + 1; i < rows.length; i++) {
      const name = cell(rows, i, C.incName);
      if (/^Total/i.test(name)) {
        incTotalRow = i;
        break;
      }
      const amount = parseBRL(cell(rows, i, C.incValor));
      if (amount == null) continue;
      incomes.push({ name: name || "Entrada sem descrição", amountCents: amount });
    }
  } else warnings.push(`Aba ${month}: seção de entradas não encontrada.`);

  // Totais exibidos na planilha (para conferência)
  const find = (col: number, re: RegExp) => rows.findIndex((_, i) => re.test(cell(rows, i, col)));
  const valAt = (r: number, c: number) => (r >= 0 ? parseBRL(cell(rows, r, c)) : null);
  const sheetTotals: SheetTotals = {
    totalGastos: valAt(find(C.fixName, /^Total de gastos/i), 3),
    fixos: valAt(find(C.fixName, /^Total Conta Corrente Fixos/i), 6),
    cartao: valAt(cardTotalRow, 6),
    avulsos: valAt(find(C.varName, /^Total de Gastos do M/i), 13),
    entradas: valAt(incTotalRow, C.incValor),
    saldo: valAt(find(C.incName, /^Saldo/i), C.incValor),
    saidas,
  };

  return { month, entries, incomes, paymentNames, sheetTotals, warnings };
}

function emptyTotals(): SheetTotals {
  return { totalGastos: null, fixos: null, cartao: null, avulsos: null, entradas: null, saldo: null, saidas: {} };
}

/** Soma o que foi lido e compara com os totais que a própria planilha mostra. */
export function checkMonth(p: ParsedMonth) {
  const sum = (xs: ParsedEntry[]) => xs.reduce((a, e) => a + e.amountCents, 0);
  const computed: Record<string, number> = {
    fixos: sum(p.entries.filter((e) => e.kind === "fixo")),
    cartao: sum(p.entries.filter((e) => e.kind === "cartao")),
    avulsos: sum(p.entries.filter((e) => e.kind === "avulso")),
    totalGastos: sum(p.entries),
    entradas: p.incomes.reduce((a, i) => a + i.amountCents, 0),
  };
  computed.saldo = computed.entradas - computed.totalGastos;
  const expected: Record<string, number | null> = {
    fixos: p.sheetTotals.fixos,
    cartao: p.sheetTotals.cartao,
    avulsos: p.sheetTotals.avulsos,
    totalGastos: p.sheetTotals.totalGastos,
    entradas: p.sheetTotals.entradas,
    saldo: p.sheetTotals.saldo,
  };
  for (const [name, total] of Object.entries(p.sheetTotals.saidas)) {
    expected[name] = total;
    computed[name] = sum(p.entries.filter((e) => e.payment === name));
  }
  const diffs: Record<string, { planilha: number; lido: number }> = {};
  for (const [k, v] of Object.entries(expected)) {
    if (v != null && v !== computed[k]) diffs[k] = { planilha: v, lido: computed[k] };
  }
  return { computed, diffs, ok: Object.keys(diffs).length === 0 };
}
