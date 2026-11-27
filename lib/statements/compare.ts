// Confere a fatura do cartão e o extrato da conta com o que está lançado no Atlas, e sugere a correção de cada
// diferença. Funções puras (sem banco de dados), testadas em tests/statements.test.mts.
//
// Fatura: cada compra da fatura procura o seu lançamento (mesma forma de pagamento, mesmo valor, data perto;
// parcela pelo número). O que sobra vira um problema com uma correção:
//   falta lançar → Lançar          valor diferente → Corrigir o valor     mês errado → Mover para o mês da fatura
//   outra forma de pagamento → Mudar para o cartão                       no Atlas e não na fatura → Excluir
// Extrato: o mesmo para Pix, boletos e entradas da conta corrente, mais "conta fixa paga e não marcada".

import { monthDiff, shiftMonth } from "../format";
import { extratoName, merchantName } from "./names";
import { ruleKey, suggest, type CategoryLite, type Hint, type Rule, type SuggestionSource } from "./suggest";
import type { Extrato, ExtratoLine, Fatura, FaturaLine } from "./types";

export type { CategoryLite, Hint, Rule } from "./suggest";

export interface EntryLite {
  id: number;
  month: string;
  kind: "fixo" | "cartao" | "avulso";
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

export interface IncomeLite {
  id: number;
  month: string;
  name: string;
  amountCents: number;
  date: string | null;
}

export interface MethodLite {
  id: number;
  name: string;
  isCredit: boolean;
  /** Tipo (conta, pix, dinheiro, vale...): dinheiro e vale não passam pela conta. */
  icon: string;
}

export type Fix =
  | {
      kind: "criar";
      name: string;
      categoryId: number | null;
      subcategoryId: number | null;
      month: string;
      date: string;
      amountCents: number;
      paymentMethodId: number;
      installment: { no: number; total: number } | null;
      /** De onde veio a sugestão de nome e categoria (lib/statements/suggest.ts). */
      source: SuggestionSource;
      /** Para lembrar como esta linha do banco foi lançada. */
      ruleKey: string;
    }
  | { kind: "criar-entrada"; name: string; month: string; date: string; amountCents: number; ruleKey: string }
  | { kind: "valor"; entryId: number; amountCents: number }
  | { kind: "valor-entrada"; incomeId: number; amountCents: number }
  | { kind: "mes"; entryId: number; month: string }
  | { kind: "forma"; entryId: number; paymentMethodId: number; month: string }
  | { kind: "excluir"; entryId: number }
  | { kind: "pago"; entryId: number; paid: boolean };

export type IssueType = "faltando" | "valor" | "mes" | "forma" | "sobrando" | "duplicado" | "pagar" | "nao-pago";

export interface Issue {
  /** l:<linha do banco> ou e:<lançamento> (para ignorar). */
  key: string;
  type: IssueType;
  /** Como aparece no banco (ou o nome no Atlas, quando só está no Atlas). */
  title: string;
  /** A explicação em uma frase. */
  detail: string;
  date: string | null;
  amountCents: number;
  fix: Fix;
  /** Entra no "Aprovar tudo" (excluir, desmarcar e categoria não reconhecida ficam para aprovar um a um). */
  safe: boolean;
}

export interface Report {
  issues: Issue[];
  /** O que bateu (banco ↔ Atlas). */
  matched: { title: string; entryName: string; date: string | null; amountCents: number }[];
  /** Linhas do banco que não são lançamento (pagamento da fatura, transferência sua, aplicação). */
  skipped: { title: string; date: string; amountCents: number; reason: string }[];
  /** Total do banco e do Atlas no que foi comparado. */
  bankCents: number;
  atlasCents: number;
  ignored: number;
  /** Como as linhas que bateram estão lançadas (para sugerir igual nas próximas). */
  learned: Rule[];
}

/* ---------- texto e datas ---------- */

const fold = (s: string | null | undefined) =>
  (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const STOP = new Set(["de", "da", "do", "das", "dos", "e", "com", "br", "pag", "pg", "mp", "ec", "dl", "ifd", "ltda", "help", "trip"]);
const words = (s: string | null | undefined) => fold(s).split(" ").filter((w) => w.length >= 3 && !STOP.has(w) && !/^\d+$/.test(w));

/** O nome do Atlas parece com o do banco (uma palavra em comum, ou o começo de uma). */
export function similar(atlasName: string, bankText: string): boolean {
  const have = words(bankText);
  return words(atlasName).some((w) => have.some((h) => h === w || (h.length >= 4 && w.length >= 4 && (h.startsWith(w) || w.startsWith(h)))));
}

const dayNo = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 86_400_000;
const days = (a: string, b: string) => Math.abs(dayNo(a) - dayNo(b));
const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const monthWord = (m: string) => MONTHS[Number(m.slice(5, 7)) - 1];

/* ---------- pareamento ---------- */

interface Pair<L> {
  line: L;
  entryId: number;
  exact: boolean;
  score: number;
}

/**
 * Exatos primeiro (menor nota), depois os de valor diferente; cada linha e cada lançamento uma vez só.
 * Um lançamento igualzinho a outro que já bateu (mesmo nome, valor e data) não vira "valor diferente" de outra
 * compra: é mais provável que esteja lançado duas vezes.
 */
function assign<L extends { key: string }>(pairs: Pair<L>[], twinOf?: (entryId: number, used: Set<number>) => boolean) {
  pairs.sort((a, b) => Number(b.exact) - Number(a.exact) || a.score - b.score);
  const byLine = new Map<string, Pair<L>>();
  const usedEntries = new Set<number>();
  for (const p of pairs) {
    if (byLine.has(p.line.key) || usedEntries.has(p.entryId)) continue;
    if (!p.exact && twinOf?.(p.entryId, usedEntries)) continue;
    byLine.set(p.line.key, p);
    usedEntries.add(p.entryId);
  }
  return { byLine, usedEntries };
}

/** O lançamento tem um gêmeo (mesmo nome, valor e data) que já bateu com o banco? */
function twins(entries: EntryLite[]) {
  const byId = new Map(entries.map((e) => [e.id, e]));
  return (id: number, used: Set<number>) => {
    const e = byId.get(id);
    if (!e) return false;
    return entries.some(
      (x) => x.id !== id && used.has(x.id) && x.amountCents === e.amountCents && fold(x.name) === fold(e.name) && x.date === e.date,
    );
  };
}

/**
 * O valor do Atlas pode ser o mesmo gasto com o valor errado? Até 2,5× para mais ou para menos; no mesmo dia
 * (ou no seguinte) qualquer diferença, porque um dígito a mais ou a menos é o erro mais comum (11,97 × 1,97).
 */
const ratioOk = (a: number, b: number, dayGap = 99) => {
  const r = Math.abs(a) / Math.max(1, Math.abs(b));
  return dayGap <= 1 ? r >= 0.05 && r <= 20 : r >= 0.4 && r <= 2.5;
};

/* ---------- fatura ---------- */

/** Mês do Atlas desta fatura: o mês do fechamento (compras até o fechamento ficam nele). */
export const faturaMonth = (f: Pick<Fatura, "closing">) => f.closing.slice(0, 7);

export function compareFatura(input: {
  fatura: Fatura;
  /** Forma de pagamento do cartão no Atlas. */
  methodId: number;
  methods: MethodLite[];
  /** Lançamentos de todas as formas, do mês da fatura e dos vizinhos. */
  entries: EntryLite[];
  hints: Hint[];
  /** Como cada linha do banco foi lançada antes (statement_rules). */
  rules?: Rule[];
  categories?: CategoryLite[];
  ignored?: string[];
}): Report {
  const { fatura, methodId } = input;
  const M = faturaMonth(fatura);
  const near = new Set([shiftMonth(M, -1), M, shiftMonth(M, 1)]);
  const ignored = new Set(input.ignored ?? []);
  const methodById = new Map(input.methods.map((m) => [m.id, m]));

  const skipped: Report["skipped"] = [];
  const lines: FaturaLine[] = [];
  for (const l of fatura.lines) {
    if (l.kind === "pagamento") skipped.push({ title: l.description, date: l.date, amountCents: l.amountCents, reason: "Pagamento da fatura anterior" });
    else if (l.amountCents !== 0) lines.push(l);
  }

  const card = input.entries.filter((e) => e.paymentMethodId === methodId && near.has(e.month));
  const pairs: Pair<FaturaLine>[] = [];
  for (const l of lines) {
    const text = `${merchantName(l.description)} ${l.description}`;
    for (const e of card) {
      if (Math.sign(e.amountCents) !== Math.sign(l.amountCents)) continue;
      const gap = Math.abs(monthDiff(e.month, M));
      const sim = similar(e.name, text);
      if (l.installment && e.installmentTotal) {
        // Parcela: pelo número e pelo total; o valor pode ter centavos de arredondamento
        if (e.installmentTotal !== l.installment.total || e.installmentNo !== l.installment.no) continue;
        const close = Math.abs(e.amountCents - l.amountCents) <= Math.max(5, Math.round(Math.abs(l.amountCents) * 0.01));
        if (close) pairs.push({ line: l, entryId: e.id, exact: true, score: gap * 2 + (sim ? 0 : 1) });
        else if (sim && ratioOk(l.amountCents, e.amountCents)) pairs.push({ line: l, entryId: e.id, exact: false, score: 10 + gap });
        continue;
      }
      if (e.installmentTotal) continue; // parcela do Atlas × compra à vista no banco: não é o mesmo
      // À vista (ou parcela lançada como gasto do dia): pela data
      const d = e.date ? days(e.date, l.date) : e.month === M ? 2 : 99;
      const limit = e.kind === "avulso" ? 3 : 7;
      if (d > limit) continue;
      if (e.amountCents === l.amountCents) pairs.push({ line: l, entryId: e.id, exact: true, score: d + gap * 2 + (sim ? 0 : 1.5) });
      else if (sim && ratioOk(l.amountCents, e.amountCents, d)) pairs.push({ line: l, entryId: e.id, exact: false, score: 10 + d + gap });
    }
  }
  const { byLine, usedEntries } = assign(pairs, twins(card));
  const entryById = new Map(input.entries.map((e) => [e.id, e]));

  // O que bateu ensina como lançar o que falta (as 9 corridas de Uber lançadas dizem como lançar a 10ª)
  const learned = new Map<string, Rule>();
  for (const l of lines) {
    const p = byLine.get(l.key);
    const e = p && entryById.get(p.entryId);
    if (!p?.exact || !e) continue;
    const sure = similar(e.name, `${merchantName(l.description)} ${l.description}`) || (e.date != null && days(e.date, l.date) === 0) || !!l.installment;
    if (sure) learn(learned, ruleKey("cartao", l.description), e);
  }
  const rules = ruleMap(input.rules, learned);

  const issues: Issue[] = [];
  const matched: Report["matched"] = [];

  // Compras do banco sem par no cartão: lançadas em outra forma de pagamento?
  const others = input.entries.filter((e) => e.paymentMethodId !== methodId && near.has(e.month) && e.date);
  const usedOther = new Set<number>();

  for (const l of lines) {
    const name = merchantName(l.description);
    const p = byLine.get(l.key);
    if (p) {
      const e = entryById.get(p.entryId)!;
      if (!p.exact) {
        issues.push({
          key: `l:${l.key}`,
          type: "valor",
          title: l.description,
          detail: `No Atlas: ${e.name}${e.date ? ` · ${fmtDate(e.date)}` : ""} com ${brl(e.amountCents)}. Na fatura: ${brl(l.amountCents)}.`,
          date: l.date,
          amountCents: l.amountCents,
          fix: { kind: "valor", entryId: e.id, amountCents: l.amountCents },
          safe: true,
        });
      } else if (e.month !== M) {
        issues.push({
          key: `l:${l.key}`,
          type: "mes",
          title: l.description,
          detail: `Está lançado em ${monthWord(e.month)} (${e.name}), mas veio na fatura de ${monthWord(M)}.`,
          date: l.date,
          amountCents: l.amountCents,
          fix: { kind: "mes", entryId: e.id, month: M },
          safe: true,
        });
      } else {
        matched.push({ title: l.description, entryName: e.name, date: e.date, amountCents: l.amountCents });
      }
      continue;
    }
    const other = others.find(
      (e) =>
        !usedOther.has(e.id) &&
        e.amountCents === l.amountCents &&
        days(e.date!, l.date) <= 2 &&
        similar(e.name, `${name} ${l.description}`),
    );
    if (other) {
      usedOther.add(other.id);
      issues.push({
        key: `l:${l.key}`,
        type: "forma",
        title: l.description,
        detail: `Está lançado como ${methodById.get(other.paymentMethodId ?? -1)?.name ?? "outra forma de pagamento"} (${other.name}), mas foi no cartão.`,
        date: l.date,
        amountCents: l.amountCents,
        fix: { kind: "forma", entryId: other.id, paymentMethodId: methodId, month: M },
        safe: true,
      });
      continue;
    }
    const key = ruleKey("cartao", l.description);
    const sug = suggest({ key, bankText: l.description, name, rules, hints: input.hints, categories: input.categories ?? [] });
    const credit = l.amountCents < 0;
    issues.push({
      key: `l:${l.key}`,
      type: "faltando",
      title: l.description,
      detail: [
        fatura.cards.length > 1 ? `Cartão ${l.card} · ${firstName(l.holder)}` : "",
        l.installment ? `Parcela ${l.installment.no}/${l.installment.total}: vira compra parcelada a partir desta fatura` : "",
        credit ? "Estorno: entra com valor negativo" : "",
      ]
        .filter(Boolean)
        .join(". "),
      date: l.date,
      amountCents: l.amountCents,
      fix: {
        kind: "criar",
        name: sug.name,
        categoryId: sug.categoryId,
        subcategoryId: sug.subcategoryId,
        month: M,
        date: l.date,
        amountCents: l.amountCents,
        paymentMethodId: methodId,
        installment: l.installment && !credit ? l.installment : null,
        source: sug.source,
        ruleKey: key,
      },
      // Categoria não reconhecida (Outros): fica fora do "Aprovar tudo", para a pessoa olhar
      safe: sug.source !== "outros" && sug.source !== "nenhuma",
    });
  }

  // No Atlas (cartão, mês da fatura) e não na fatura
  for (const e of card) {
    if (e.month !== M || usedEntries.has(e.id) || e.amountCents === 0) continue;
    if (e.date && e.date > fatura.closing) {
      const next = shiftMonth(M, 1);
      issues.push({
        key: `e:${e.id}`,
        type: "mes",
        title: e.name,
        detail: `Data ${fmtDate(e.date)}, depois do fechamento (${fmtDate(fatura.closing)}): é da fatura de ${monthWord(next)}.`,
        date: e.date,
        amountCents: e.amountCents,
        fix: { kind: "mes", entryId: e.id, month: next },
        safe: true,
      });
      continue;
    }
    const twin = card.find(
      (x) =>
        x.id !== e.id &&
        usedEntries.has(x.id) &&
        x.amountCents === e.amountCents &&
        fold(x.name) === fold(e.name) &&
        (!x.date || !e.date || days(x.date, e.date) <= 1),
    );
    issues.push({
      key: `e:${e.id}`,
      type: twin ? "duplicado" : "sobrando",
      title: e.name,
      detail: twin
        ? "Lançado duas vezes: a fatura só tem uma."
        : e.installmentTotal
          ? `Parcela ${e.installmentNo}/${e.installmentTotal} do Atlas que não veio nesta fatura.`
          : e.kind === "cartao"
            ? "Fixo do cartão que não veio nesta fatura."
            : "Está no Atlas, mas não veio na fatura.",
      date: e.date,
      amountCents: e.amountCents,
      fix: { kind: "excluir", entryId: e.id },
      safe: false,
    });
  }

  const bankCents = lines.reduce((a, l) => a + l.amountCents, 0);
  const atlasCents = input.entries.filter((e) => e.paymentMethodId === methodId && e.month === M).reduce((a, e) => a + e.amountCents, 0);
  return finish(issues, ignored, matched, skipped, bankCents, atlasCents, learned);
}

/* ---------- extrato da conta corrente ---------- */

/** Linhas do extrato que não são gasto nem entrada do mês. */
export function extratoSkip(l: ExtratoLine, holder: string | null): string | null {
  const d = fold(`${l.kind} ${l.counterpart ?? ""}`);
  if (/\b(resgate|aplicacao|aplic|cdb|rdb|poupanca|invest)/.test(d)) return "Aplicação ou resgate";
  if (/\bfatura\b|cartao de credito|pagamento cartao/.test(d)) return "Pagamento da fatura do cartão";
  const first = fold(holder).split(" ")[0];
  if (first && l.counterpart && fold(l.counterpart).split(" ")[0] === first && /transf|pix|ted/.test(fold(l.kind))) return "Transferência para você";
  if (/mesma titularidade|entre contas/.test(d)) return "Transferência para você";
  return null;
}

export function compareExtrato(input: {
  extrato: Extrato;
  /** Forma de pagamento da conta no Atlas (para o que for lançado). */
  methodId: number;
  methods: MethodLite[];
  /** Lançamentos (todas as formas) e entradas dos meses do período. */
  entries: EntryLite[];
  incomes: IncomeLite[];
  hints: Hint[];
  rules?: Rule[];
  categories?: CategoryLite[];
  ignored?: string[];
}): Report {
  const { extrato, methodId } = input;
  const ignored = new Set(input.ignored ?? []);
  const methodById = new Map(input.methods.map((m) => [m.id, m]));
  // Formas que saem desta conta: as que não são cartão de crédito, dinheiro nem vale
  const account = new Set(input.methods.filter((m) => !m.isCredit && !["dinheiro", "vale"].includes(m.icon)).map((m) => m.id));
  account.add(methodId);

  const skipped: Report["skipped"] = [];
  const outs: ExtratoLine[] = [];
  const ins: ExtratoLine[] = [];
  for (const l of extrato.lines) {
    const reason = extratoSkip(l, extrato.holder);
    if (reason) skipped.push({ title: l.description, date: l.date, amountCents: l.amountCents, reason });
    else if (l.amountCents < 0) outs.push(l);
    else if (l.amountCents > 0) ins.push(l);
  }

  const mine = input.entries.filter((e) => e.paymentMethodId != null && account.has(e.paymentMethodId) && e.kind !== "cartao");
  const pairs: Pair<ExtratoLine>[] = [];
  for (const l of outs) {
    const amount = -l.amountCents;
    const text = `${l.counterpart ?? ""} ${l.kind}`;
    for (const e of mine) {
      if (!e.date) continue;
      const d = days(e.date, l.date);
      if (d > (e.kind === "avulso" ? 3 : 7)) continue;
      const sim = similar(e.name, text);
      if (e.amountCents === amount) pairs.push({ line: l, entryId: e.id, exact: true, score: d + (sim ? 0 : 1.5) });
      else if (sim && ratioOk(amount, e.amountCents, d)) pairs.push({ line: l, entryId: e.id, exact: false, score: 10 + d });
    }
  }
  const { byLine, usedEntries } = assign(pairs, twins(mine));

  const incPairs: Pair<ExtratoLine>[] = [];
  for (const l of ins) {
    for (const i of input.incomes) {
      const d = i.date ? days(i.date, l.date) : i.month === l.date.slice(0, 7) ? 2 : 99;
      if (d > 4) continue;
      const sim = similar(i.name, `${l.counterpart ?? ""} ${l.kind}`);
      if (i.amountCents === l.amountCents) incPairs.push({ line: l, entryId: i.id, exact: true, score: d + (sim ? 0 : 1.5) });
      else if (sim && ratioOk(l.amountCents, i.amountCents, d)) incPairs.push({ line: l, entryId: i.id, exact: false, score: 10 + d });
    }
  }
  const inc = assign(incPairs);

  const entryById = new Map(input.entries.map((e) => [e.id, e]));
  const incomeById = new Map(input.incomes.map((i) => [i.id, i]));
  const who = (l: ExtratoLine) => l.counterpart ?? l.kind;

  const learned = new Map<string, Rule>();
  for (const l of outs) {
    const p = byLine.get(l.key);
    const e = p && entryById.get(p.entryId);
    if (!p?.exact || !e) continue;
    if (similar(e.name, `${l.counterpart ?? ""} ${l.kind}`) || (e.date != null && days(e.date, l.date) === 0)) learn(learned, ruleKey("conta", who(l)), e);
  }
  for (const l of ins) {
    const p = inc.byLine.get(l.key);
    const i = p && incomeById.get(p.entryId);
    if (p?.exact && i) learned.set(ruleKey("entrada", who(l)), { key: ruleKey("entrada", who(l)), name: i.name, categoryId: null, subcategoryId: null });
  }
  const rules = ruleMap(input.rules, learned);
  const issues: Issue[] = [];
  const matched: Report["matched"] = [];
  const credits = input.entries.filter((e) => e.paymentMethodId != null && methodById.get(e.paymentMethodId)?.isCredit && e.date);
  const usedCredit = new Set<number>();

  for (const l of outs) {
    const amount = -l.amountCents;
    const name = extratoName(l);
    const p = byLine.get(l.key);
    if (p) {
      const e = entryById.get(p.entryId)!;
      if (!p.exact) {
        issues.push({
          key: `l:${l.key}`,
          type: "valor",
          title: l.description,
          detail: `No Atlas: ${e.name}${e.date ? ` · ${fmtDate(e.date)}` : ""} com ${brl(e.amountCents)}. Saiu da conta: ${brl(amount)}.`,
          date: l.date,
          amountCents: amount,
          fix: { kind: "valor", entryId: e.id, amountCents: amount },
          safe: true,
        });
      } else if (e.kind === "fixo" && e.paid !== true) {
        issues.push({
          key: `l:${l.key}`,
          type: "pagar",
          title: l.description,
          detail: `${e.name} já saiu da conta, mas não está marcada como paga.`,
          date: l.date,
          amountCents: amount,
          fix: { kind: "pago", entryId: e.id, paid: true },
          safe: true,
        });
      } else if (e.kind === "avulso" && e.month !== l.date.slice(0, 7)) {
        issues.push({
          key: `l:${l.key}`,
          type: "mes",
          title: l.description,
          detail: `Está lançado em ${monthWord(e.month)} (${e.name}), mas saiu da conta em ${monthWord(l.date)}.`,
          date: l.date,
          amountCents: amount,
          fix: { kind: "mes", entryId: e.id, month: l.date.slice(0, 7) },
          safe: true,
        });
      } else matched.push({ title: l.description, entryName: e.name, date: e.date, amountCents: amount });
      continue;
    }
    const other = credits.find(
      (e) => !usedCredit.has(e.id) && e.amountCents === amount && days(e.date!, l.date) <= 2 && similar(e.name, `${name} ${l.description}`),
    );
    if (other) {
      usedCredit.add(other.id);
      issues.push({
        key: `l:${l.key}`,
        type: "forma",
        title: l.description,
        detail: `Está lançado no ${methodById.get(other.paymentMethodId ?? -1)?.name ?? "cartão"} (${other.name}), mas saiu da conta.`,
        date: l.date,
        amountCents: amount,
        fix: { kind: "forma", entryId: other.id, paymentMethodId: methodId, month: l.date.slice(0, 7) },
        safe: true,
      });
      continue;
    }
    const key = ruleKey("conta", who(l));
    const sug = suggest({ key, bankText: `${l.kind} ${l.counterpart ?? ""}`, name, rules, hints: input.hints, categories: input.categories ?? [] });
    issues.push({
      key: `l:${l.key}`,
      type: "faltando",
      title: l.description,
      detail: "",
      date: l.date,
      amountCents: amount,
      fix: {
        kind: "criar",
        name: sug.name,
        categoryId: sug.categoryId,
        subcategoryId: sug.subcategoryId,
        month: l.date.slice(0, 7),
        date: l.date,
        amountCents: amount,
        paymentMethodId: methodId,
        installment: null,
        source: sug.source,
        ruleKey: key,
      },
      // Categoria não reconhecida (Outros): fica fora do "Aprovar tudo", para a pessoa olhar
      safe: sug.source !== "outros" && sug.source !== "nenhuma",
    });
  }

  for (const l of ins) {
    const p = inc.byLine.get(l.key);
    if (p) {
      const i = incomeById.get(p.entryId)!;
      if (p.exact) matched.push({ title: l.description, entryName: i.name, date: i.date, amountCents: l.amountCents });
      else
        issues.push({
          key: `l:${l.key}`,
          type: "valor",
          title: l.description,
          detail: `No Atlas: entrada ${i.name} com ${brl(i.amountCents)}. Entrou na conta: ${brl(l.amountCents)}.`,
          date: l.date,
          amountCents: l.amountCents,
          fix: { kind: "valor-entrada", incomeId: i.id, amountCents: l.amountCents },
          safe: true,
        });
      continue;
    }
    issues.push({
      key: `l:${l.key}`,
      type: "faltando",
      title: l.description,
      detail: "Entrada que não está no Atlas",
      date: l.date,
      amountCents: l.amountCents,
      fix: {
        kind: "criar-entrada",
        name: rules.get(ruleKey("entrada", who(l)))?.name ?? extratoName(l),
        month: l.date.slice(0, 7),
        date: l.date,
        amountCents: l.amountCents,
        ruleKey: ruleKey("entrada", who(l)),
      },
      safe: true,
    });
  }

  // No Atlas (saindo desta conta, dentro do período) e não no extrato
  for (const e of mine) {
    if (usedEntries.has(e.id) || !e.date || e.date < extrato.from || e.date > extrato.to || e.amountCents === 0) continue;
    if (e.kind === "fixo" && e.paid !== true) continue; // ainda não paga: não devia ter saído
    const isFixo = e.kind === "fixo";
    issues.push({
      key: `e:${e.id}`,
      type: isFixo ? "nao-pago" : "sobrando",
      title: e.name,
      detail: isFixo
        ? "Marcada como paga, mas não saiu desta conta no período."
        : `Lançado em ${methodById.get(e.paymentMethodId ?? -1)?.name ?? "conta"}, mas não saiu da conta no período.`,
      date: e.date,
      amountCents: e.amountCents,
      fix: isFixo ? { kind: "pago", entryId: e.id, paid: false } : { kind: "excluir", entryId: e.id },
      safe: false,
    });
  }

  const bankCents = -outs.reduce((a, l) => a + l.amountCents, 0);
  const atlasCents = mine
    .filter((e) => e.date && e.date >= extrato.from && e.date <= extrato.to && (e.kind === "avulso" || e.paid === true))
    .reduce((a, e) => a + e.amountCents, 0);
  return finish(issues, ignored, matched, skipped, bankCents, atlasCents, learned);
}

/* ---------- comum ---------- */

/** Guarda como o lançamento que bateu está (só com categoria: sem ela não ensina nada). */
function learn(map: Map<string, Rule>, key: string, e: EntryLite) {
  if (e.categoryId == null || key.endsWith(":")) return;
  map.set(key, { key, name: e.name, categoryId: e.categoryId, subcategoryId: e.subcategoryId });
}

/** Regras guardadas + as aprendidas agora (as de agora valem mais: são como está no Atlas hoje). */
function ruleMap(saved: Rule[] | undefined, learned: Map<string, Rule>) {
  const m = new Map<string, Rule>((saved ?? []).map((r) => [r.key, r]));
  for (const [k, r] of learned) m.set(k, r);
  return m;
}

function firstName(holder: string) {
  const w = holder.trim().split(/\s+/)[0] ?? "";
  return w.charAt(0) + w.slice(1).toLowerCase();
}

function fmtDate(d: string) {
  return `${Number(d.slice(8, 10))}/${d.slice(5, 7)}`;
}

const ORDER: IssueType[] = ["valor", "faltando", "forma", "mes", "pagar", "duplicado", "sobrando", "nao-pago"];

function finish(
  issues: Issue[],
  ignored: Set<string>,
  matched: Report["matched"],
  skipped: Report["skipped"],
  bankCents: number,
  atlasCents: number,
  learned: Map<string, Rule>,
): Report {
  const visible = issues.filter((i) => !ignored.has(i.key));
  visible.sort((a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type) || (b.date ?? "").localeCompare(a.date ?? ""));
  return { issues: visible, matched, skipped, bankCents, atlasCents, ignored: issues.length - visible.length, learned: [...learned.values()] };
}
