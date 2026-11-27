// Leitura dos arquivos do Santander: a fatura do cartão (PDF) e o extrato da conta corrente (CSV).
// Outro banco = outro arquivo como este, registrado em lib/statements/banks.ts.
// Funções puras: recebem o texto do PDF já com as posições (lib/statements/pdf.ts) ou o texto do CSV.
// Testadas em tests/statements.test.mts com arquivos inventados (o repositório é público).

import type { Extrato, ExtratoLine, Fatura, FaturaLine, PdfItem, PdfPage } from "./types";

export type { Extrato, ExtratoLine, Fatura, FaturaLine, PdfItem, PdfPage } from "./types";
export { extratoName, merchantName, titleCase } from "./names";

/* ---------- utilidades ---------- */

/** "1.234,56" → 123456; "-8.579,32" → -857932. */
export function moneyCents(s: string): number | null {
  const t = s.replace(/\s|R\$/g, "");
  if (!/^-?[\d.]*\d,\d{2}$/.test(t)) return null;
  const neg = t.startsWith("-");
  const n = Number(t.replace(/^-/, "").replace(/\./g, "").replace(",", ""));
  return Number.isFinite(n) ? (neg ? -n : n) : null;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "25/11/26" ou "25/11/2026" → "2026-11-25". */
function dmy(s: string): string | null {
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{2}|\d{4})$/);
  if (!m) return null;
  const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  return `${y}-${m[2]}-${m[1]}`;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Chaves únicas: a mesma linha repetida (ex.: 9 estornos iguais) ganha #1, #2... */
function keyed<T>(rows: T[], base: (r: T) => string): (T & { key: string })[] {
  const seen = new Map<string, number>();
  return rows.map((r) => {
    const b = base(r);
    const n = (seen.get(b) ?? 0) + 1;
    seen.set(b, n);
    return { ...r, key: `${b}#${n}` };
  });
}

/* ---------- fatura (PDF) ---------- */

interface Line {
  y: number;
  items: (PdfItem & { rx: number })[];
}

/** Junta os pedaços que estão na mesma altura (±3) numa linha, da esquerda para a direita. */
function toLines(items: (PdfItem & { rx: number })[]): Line[] {
  const sorted = [...items].sort((a, b) => a.y - b.y || a.rx - b.rx);
  const lines: Line[] = [];
  for (const it of sorted) {
    const l = lines.find((x) => Math.abs(x.y - it.y) < 3);
    if (l) l.items.push(it);
    else lines.push({ y: it.y, items: [it] });
  }
  for (const l of lines) l.items.sort((a, b) => a.rx - b.rx);
  return lines.sort((a, b) => a.y - b.y);
}

const text = (l: Line) => l.items.map((i) => i.s.trim()).join(" ").replace(/\s+/g, " ").trim();
/** O texto sem o ícone da coluna "Compra" (contactless, @), que fica antes da data. */
const body = (l: Line) => l.items.filter((i) => i.rx >= 25).map((i) => i.s.trim()).join(" ").replace(/\s+/g, " ").trim();

/**
 * Lê a fatura do cartão do Santander (PDF). O detalhamento vem em duas colunas por página, com um bloco por
 * cartão (titular, adicionais e virtuais) e, em cada um, "Pagamento e Demais Créditos", "Parcelamentos" e
 * "Despesas". No fim, o "Resumo da Fatura" serve para conferir se tudo foi lido.
 */
export function parseSantanderFatura(pages: PdfPage[]): Fatura {
  // Período e vencimento: na 1ª página ("Esta Fatura 27/10/26 a 25/11/26"; "Vencimento" com a data embaixo)
  let periodFrom: string | null = null;
  let closing: string | null = null;
  let due: string | null = null;
  for (const page of pages.slice(0, 2)) {
    const lines = toLines(page.items.map((i) => ({ ...i, rx: i.x })));
    for (const l of lines) {
      const t = text(l);
      if (!closing && /Esta Fatura/i.test(t)) {
        const m = t.match(/(\d{2}\/\d{2}\/\d{2,4})\s*a\s*(\d{2}\/\d{2}\/\d{2,4})/);
        if (m) {
          periodFrom = dmy(m[1]);
          closing = dmy(m[2]);
        }
      }
    }
    const head = page.items.filter((i) => i.s.trim() === "Vencimento").sort((a, b) => a.y - b.y)[0];
    if (!due && head) {
      const below = page.items
        .filter((i) => /^\d{2}\/\d{2}\/\d{4}$/.test(i.s.trim()) && i.y > head.y && i.y - head.y < 25 && Math.abs(i.x - head.x) < 40)
        .sort((a, b) => a.y - b.y)[0];
      if (below) due = dmy(below.s.trim());
    }
  }
  if (!closing) {
    // Sem o histórico: "compras e pagamentos realizados até 25/11" + vencimento
    const all = pages[0]?.items.map((i) => i.s).join(" ") ?? "";
    const m = all.match(/realizados até (\d{2})\/(\d{2})/);
    if (m && due) {
      const y = Number(due.slice(0, 4)) - (Number(m[2]) > Number(due.slice(5, 7)) ? 1 : 0);
      closing = `${y}-${m[2]}-${m[1]}`;
    }
  }
  if (!closing) throw new Error("Não achei o período desta fatura. O arquivo é a fatura do cartão Santander em PDF?");

  const cy = Number(closing.slice(0, 4));
  const cmd = closing.slice(5);
  /** "13/03" → ano do fechamento, ou o anterior se a data for depois do fechamento. */
  const dateOf = (dm: string) => {
    const [d, m] = dm.split("/");
    const y = `${m}-${d}` > cmd ? cy - 1 : cy;
    return `${y}-${m}-${d}`;
  };

  type Raw = Omit<FaturaLine, "key">;
  const raw: Raw[] = [];
  const summary: Fatura["summary"] = { previous: null, debits: null, credits: null, payments: null, total: null };
  let debitsBR: number | null = null;
  let debitsEx: number | null = null;
  let card = "";
  let holder = "";
  let section: FaturaLine["section"] | "resumo" | "fim" | null = null;
  let started = false;

  for (const page of pages) {
    const mid = page.width / 2;
    const detail = page.items.find((i) => /^Detalhamento da Fatura/.test(i.s.trim()));
    if (detail) started = true;
    if (!started) continue;
    const top = detail ? detail.y + 2 : 0;
    for (const col of [0, 1]) {
      const off = col ? mid - 2 : 0;
      const mine = page.items
        .filter((i) => (col ? i.x >= mid : i.x < mid) && i.y > top && i.s.trim())
        .map((i) => ({ ...i, rx: i.x - off }));
      for (const l of toLines(mine)) {
        const t = text(l);
        const cardM = t.match(/^@?\s*(.+?)\s+-\s+\d{4}\s+X{4}\s+X{4}\s+(\d{4})$/);
        if (cardM) {
          holder = cardM[1].trim();
          card = cardM[2];
          continue;
        }
        if (/^Pagamento e Demais Cr[ée]ditos/i.test(t)) section = "creditos";
        else if (/^Parcelamentos/i.test(t)) section = "parcelamentos";
        else if (/^Despesas/i.test(t)) section = "despesas";
        else if (/^Resumo da Fatura/i.test(t)) section = "resumo";
        else if (/^(Saldo total consolidado|Juros e Custo)/i.test(t)) section = "fim";
        if (/^(Pagamento e Demais|Parcelamentos|Despesas|Resumo da Fatura|Saldo total|Juros e Custo)/i.test(t)) continue;
        if (section === "fim" || section == null) continue;

        const brl = l.items.find((i) => i.rx >= 185 && i.rx < 236 && moneyCents(i.s) != null);
        if (section === "resumo") {
          const label = l.items.filter((i) => i.rx < 185).map((i) => i.s.trim()).join(" ");
          const v = brl ? moneyCents(brl.s) : null;
          if (v == null) continue;
          if (/Saldo Anterior/i.test(label)) summary.previous = v;
          else if (/Despesas.*Brasil/i.test(label)) debitsBR = v;
          else if (/Despesas.*Exterior/i.test(label)) debitsEx = v;
          else if (/Total de pagamentos/i.test(label)) summary.payments = v;
          else if (/Total de cr[ée]ditos/i.test(label)) summary.credits = v;
          else if (/Saldo Desta Fatura/i.test(label)) summary.total = v;
          continue;
        }
        if (/^VALOR TOTAL/i.test(t) || /^Compra Data/i.test(t)) continue;

        const first = l.items.find((i) => i.rx >= 25 && i.rx < 60 && /^\d{2}\/\d{2}\s+\S/.test(i.s.trim()));
        const usd = l.items.find((i) => i.rx >= 236 && moneyCents(i.s) != null);
        if (first && brl) {
          const m = first.s.trim().match(/^(\d{2}\/\d{2})\s+(.+)$/)!;
          const rest = l.items.filter((i) => i !== first && i.rx >= 60 && i.rx < 160).map((i) => i.s.trim());
          const parc = l.items.find((i) => i.rx >= 155 && i.rx < 195 && /^\d{2}\/\d{2}$/.test(i.s.trim()));
          const amount = moneyCents(brl.s)!;
          const description = [m[2], ...rest].join(" ").replace(/\s+/g, " ").trim();
          const [no, total] = parc ? parc.s.trim().split("/").map(Number) : [0, 0];
          raw.push({
            card,
            holder,
            section,
            date: dateOf(m[1]),
            description,
            installment: parc && total > 1 ? { no, total } : null,
            amountCents: amount,
            usdCents: usd ? moneyCents(usd.s) : null,
            kind: /PAGAMENTO DE FATURA/i.test(description) ? "pagamento" : amount < 0 ? "credito" : "gasto",
          });
        } else if (brl && /^IOF\b/i.test(body(l)) && raw.length) {
          // IOF de compra no exterior: linha sem data, embaixo da compra
          const prev = raw[raw.length - 1];
          raw.push({
            ...prev,
            description: body(l).replace(/\s*-?[\d.]+,\d{2}(\s+-?[\d.]+,\d{2})?$/, "").trim() || "IOF",
            installment: null,
            amountCents: moneyCents(brl.s)!,
            usdCents: null,
            kind: "gasto",
          });
        }
      }
    }
  }

  const lines = keyed(raw, (r) => `${r.card}|${r.date}|${r.amountCents}|${norm(r.description)}`);
  summary.debits = debitsBR != null || debitsEx != null ? (debitsBR ?? 0) + (debitsEx ?? 0) : null;
  const sum = (f: (l: FaturaLine) => boolean) => lines.filter(f).reduce((a, l) => a + l.amountCents, 0);
  const parsedDebits = sum((l) => l.amountCents > 0);
  const parsedPayments = -sum((l) => l.kind === "pagamento");
  const parsedCredits = -sum((l) => l.kind === "credito");

  const problems: string[] = [];
  const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  if (!lines.length) problems.push("nenhum lançamento encontrado");
  if (summary.debits != null && summary.debits !== parsedDebits)
    problems.push(`despesas lidas ${brl(parsedDebits)} × resumo ${brl(summary.debits)}`);
  if (summary.credits != null && summary.credits !== parsedCredits)
    problems.push(`créditos lidos ${brl(parsedCredits)} × resumo ${brl(summary.credits)}`);
  if (summary.payments != null && summary.payments !== parsedPayments)
    problems.push(`pagamentos lidos ${brl(parsedPayments)} × resumo ${brl(summary.payments)}`);
  if (summary.debits == null) problems.push("o resumo da fatura não foi encontrado");

  const cards = [...new Set(lines.map((l) => l.card))].map((c) => ({
    card: c,
    holder: lines.find((l) => l.card === c)!.holder,
    debitsCents: lines.filter((l) => l.card === c && l.amountCents > 0).reduce((a, l) => a + l.amountCents, 0),
  }));

  return {
    bank: "santander",
    periodFrom: periodFrom ?? closing,
    closing,
    due,
    summary,
    lines,
    cards,
    check: problems.length
      ? { ok: false, message: `A leitura da fatura não fechou com o resumo do banco (${problems.join("; ")}).` }
      : { ok: true, message: null },
  };
}

/* ---------- extrato da conta corrente (CSV) ---------- */

/** Separa um CSV com ";" e aspas (o campo pode ter quebra de linha dentro). */
export function parseCsv(textIn: string, sep = ";"): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const t = textIn.replace(/^﻿/, "");
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (quoted) {
      if (c === '"' && t[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === sep) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Texto do arquivo: UTF-8; se vier quebrado (acentos), lê como Latin-1. */
export function decodeText(bytes: Uint8Array): string {
  const utf = new TextDecoder("utf-8").decode(bytes);
  return utf.includes("�") ? new TextDecoder("latin1").decode(bytes) : utf;
}

/**
 * Lê o extrato da conta corrente do Santander (CSV): cabeçalho com nome, agência, conta e período; depois
 * "Data;Descrição;Valor;Saldo". A descrição vem em duas linhas ("Pix enviado" + quem recebeu).
 */
export function parseSantanderExtrato(textIn: string): Extrato {
  const rows = parseCsv(textIn);
  const get = (label: RegExp) => rows.find((r) => label.test(r[0] ?? ""))?.[1]?.trim() || null;
  const period = get(/^Per[ií]odo/i);
  const pm = period?.match(/(\d{2}\/\d{2}\/\d{4})\s*a\s*(\d{2}\/\d{2}\/\d{4})/);
  const headIdx = rows.findIndex((r) => /^Data$/i.test((r[0] ?? "").trim()) && /Valor/i.test(r.join(";")));
  if (headIdx < 0) throw new Error("Não achei a lista de lançamentos. O arquivo é o extrato da conta corrente Santander em CSV?");
  const head = rows[headIdx].map((h) => norm(h));
  const ci = (name: string) => head.findIndex((h) => h === name);
  const [iDate, iDesc, iVal, iBal] = [ci("data"), ci("descricao"), ci("valor"), ci("saldo")];

  const raw: Omit<ExtratoLine, "key">[] = [];
  for (const r of rows.slice(headIdx + 1)) {
    const date = dmy((r[iDate] ?? "").trim());
    const amount = moneyCents((r[iVal] ?? "").trim());
    if (!date || amount == null) continue;
    const parts = (r[iDesc] ?? "")
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    raw.push({
      date,
      kind: parts[0] ?? "",
      counterpart: parts.length > 1 ? parts.slice(1).join(" ") : null,
      description: parts.join(" · "),
      amountCents: amount,
      balanceCents: iBal >= 0 ? moneyCents((r[iBal] ?? "").trim()) : null,
    });
  }
  if (!raw.length) throw new Error("O extrato não tem lançamentos no período.");
  const dates = raw.map((l) => l.date).sort();
  return {
    bank: "santander",
    holder: get(/^Nome$/i),
    agency: get(/^Ag[eê]ncia$/i),
    account: get(/^Conta$/i),
    from: (pm && dmy(pm[1])) || dates[0],
    to: (pm && dmy(pm[2])) || dates[dates.length - 1],
    lines: keyed(raw, (l) => `${l.date}|${l.amountCents}|${norm(l.description)}`),
  };
}
