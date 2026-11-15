// Utilidades compartilhadas entre servidor e navegador.

export const MONTH_NAMES = [
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
];

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatBRL(cents: number): string {
  // Intl usa espaço não separável; mantemos para não quebrar linha
  return brl.format(cents / 100);
}

export function formatBRLSigned(cents: number): string {
  if (cents > 0) return "+" + formatBRL(cents);
  return formatBRL(cents);
}

/** Converte o que a pessoa digitou ("1.234,56", "12,5", "R$ 30") em centavos. */
export function parseAmountInput(raw: string): number | null {
  let s = raw.trim().replace(/R\$|\s/g, "");
  if (!s) return null;
  const negative = s.startsWith("-");
  s = s.replace(/^[-+]/, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  const cents = Math.round(n * 100);
  return negative ? -cents : cents;
}

export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function isMonth(s: string | undefined | null): s is string {
  return !!s && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
}

export function monthOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthDiff(from: string, to: string): number {
  const [y1, m1] = from.split("-").map(Number);
  const [y2, m2] = to.split("-").map(Number);
  return (y2 - y1) * 12 + (m2 - m1);
}

export function monthLabel(month: string, withYear = true): string {
  const [y, m] = month.split("-").map(Number);
  return withYear ? `${MONTH_NAMES[m - 1]} ${y}` : MONTH_NAMES[m - 1];
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function dateInMonth(month: string, day: number | null | undefined): string | null {
  if (!day) return null;
  const d = Math.min(Math.max(1, day), daysInMonth(month));
  return `${month}-${String(d).padStart(2, "0")}`;
}

/** Data de hoje no fuso do Brasil (YYYY-MM-DD). */
export function todayISO(timeZone = "America/Fortaleza"): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(),
  );
  return parts; // en-CA já vem como YYYY-MM-DD
}

export function currentMonth(timeZone?: string): string {
  return todayISO(timeZone).slice(0, 7);
}

/**
 * Mês de referência de um gasto: no cartão de crédito, compras depois do dia de fechamento
 * entram na fatura do mês seguinte (como na planilha).
 */
export function referenceMonth(
  date: string,
  method: { isCredit: boolean; closingDay: number | null } | null | undefined,
): string {
  const month = date.slice(0, 7);
  if (!method?.isCredit || !method.closingDay) return month;
  const day = Number(date.slice(8, 10));
  return day > method.closingDay ? shiftMonth(month, 1) : month;
}

/**
 * Cores das formas de pagamento, em ordem fixa (paleta categórica validada para daltonismo).
 * Vermelho fica de fora: é reservado para alertas.
 */
export const PAYMENT_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6"];

export function nextPaymentColor(used: string[]): string {
  return PAYMENT_COLORS.find((c) => !used.includes(c)) ?? "#7a839a";
}

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MONTHS_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function formatDay(date: string | null): string {
  if (!date) return "Sem data";
  const [y, m, d] = date.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${WEEKDAYS[wd]}, ${d} ${MONTHS_SHORT[m - 1]}`;
}

export function formatShortDate(date: string | null): string {
  if (!date) return "—";
  const [, m, d] = date.split("-").map(Number);
  return `${d} ${MONTHS_SHORT[m - 1]}`;
}

/** Para usar no meio de frases: "setembro de 2027". */
export function monthPhrase(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${MONTH_NAMES[m - 1].toLowerCase()} de ${y}`;
}

const compact = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

/** Valor curto para eixos e resumos: "R$ 950", "R$ 12,5 mil", "R$ 1,2 mi". */
export function formatCompactBRL(cents: number): string {
  const v = cents / 100;
  const abs = Math.abs(v);
  const sign = v < 0 ? "−" : "";
  if (abs >= 1_000_000) return `${sign}R$ ${compact.format(abs / 1_000_000)} mi`;
  if (abs >= 1_000) return `${sign}R$ ${compact.format(abs / 1_000)} mil`;
  return `${sign}R$ ${Math.round(abs)}`;
}

/** "2026-03" -> "mar" */
export function monthShort(month: string): string {
  return MONTH_NAMES[Number(month.slice(5, 7)) - 1].slice(0, 3).toLowerCase();
}

export function formatPercent(ratio: number, digits = 0): string {
  return `${(ratio * 100).toLocaleString("pt-BR", { maximumFractionDigits: digits, minimumFractionDigits: 0 })}%`;
}
