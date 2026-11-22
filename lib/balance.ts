import type { MonthSummary, PaymentMethod } from "./data";
import { daysInMonth, formatBRL, monthLabel } from "./format";

// Cartão do saldo do Painel (e o resumo para compartilhar, com os mesmos nomes).
// O destaque é sempre o saldo do mês inteiro: entradas − tudo o que é do mês, inclusive o que ainda vai sair.
// Embaixo, um extrato que fecha a conta:
//   entrou − já saiu da conta = na conta hoje; − fatura do cartão − contas a pagar = saldo no fim do mês.
// O que é pago no crédito só sai da conta quando a fatura é paga, então a fatura do mês atual ainda está na conta.
// - "andamento": mês atual com fatura ou contas por sair;
// - "futuro": mês que ainda não começou;
// - "fechado": mês que acabou (tudo saiu, fatura inclusive) ou mês atual sem nada por sair.

export type BalanceMode = "fechado" | "andamento" | "futuro";

/** Uma parte das barras e a linha do extrato que é a legenda dela (mesma cor, mesmo listrado). */
export interface BalancePart {
  key: "in" | "conta" | "cartao" | "pagar";
  label: string;
  cents: number;
  /** verde = entrou; azul = conta; dourado = cartão de crédito */
  color: string;
  /** listrado = ainda não saiu da conta */
  striped: boolean;
  hint?: string;
  href: string;
}

export interface BalanceView {
  mode: BalanceMode;
  heroLabel: string;
  /** Última linha do extrato (mais curta que o destaque, para caber no celular). */
  totalLabel: string;
  saldo: number;
  entradas: number;
  gastos: number;
  /** Entrou − o que já saiu da conta (só faz sentido no mês atual: a fatura e as contas ainda vão sair). */
  naConta: number;
  naContaHint: string;
  /** O maior entre entrou e gastos: as duas barras usam a mesma escala. */
  scale: number;
  income: BalancePart;
  /** Partes dos gastos, na ordem das barras e do extrato. Valor zero não aparece em nenhum dos dois. */
  outs: BalancePart[];
  over: boolean;
  /** Frase embaixo das barras: o total dos gastos e quanto ele é do que entrou. */
  meterText: string;
  /** Descrição das barras para leitores de tela. */
  barsLabel: string;
}

// Conferidas para daltonismo e contraste sobre o azul-marinho do cartão (#172033).
export const FLOW_COLORS = { in: "#17a58f", conta: "#6a86f0", cartao: "#c07e0c" };

export function balanceView({
  month,
  today,
  totals,
  upcoming,
  byPayment,
  methods,
}: {
  month: string;
  /** YYYY-MM-DD */
  today: string;
  totals: MonthSummary["totals"];
  upcoming: MonthSummary["upcoming"];
  byPayment: MonthSummary["byPayment"];
  methods: PaymentMethod[];
}): BalanceView {
  const thisMonth = today.slice(0, 7);
  const isCurrent = month === thisMonth;
  const monthName = monthLabel(month, false).toLowerCase();
  const mode: BalanceMode =
    month > thisMonth
      ? "futuro"
      : isCurrent && (totals.credito !== 0 || totals.contaASair !== 0)
        ? "andamento"
        : "fechado";
  const pastMonth = month < thisMonth;
  const heroLabel =
    mode === "andamento"
      ? "Saldo no fim do mês"
      : mode === "futuro"
        ? `Saldo previsto de ${monthName}`
        : `Saldo de ${monthName}`;

  // Cartões de crédito usados no mês: com um só, a linha leva aos gastos dele e mostra o fechamento
  const cards = methods.filter(
    (m) => m.isCredit && byPayment.some((p) => p.paymentMethodId === m.id && p.total !== 0),
  );
  const closingDay =
    cards.length === 1 && cards[0].closingDay ? Math.min(cards[0].closingDay, daysInMonth(month)) : null;

  // Ainda vai sair: contas não pagas, cobranças do cartão por vir e gastos com data futura
  const bills = upcoming.filter((e) => e.kind !== "avulso" && !e.onCard).length;
  const scheduled = upcoming.filter((e) => e.kind === "avulso" && !e.onCard).length;
  const cardCharges = upcoming.filter((e) => e.onCard).length;

  const inLabel = mode === "futuro" ? "Vai entrar" : "Entrou";
  const income: BalancePart = {
    key: "in",
    label: inLabel,
    cents: totals.entradas,
    color: FLOW_COLORS.in,
    striped: false,
    href: `/lancamentos?m=${month}&tab=entradas`,
  };
  const outs: BalancePart[] = [
    {
      key: "conta",
      label: pastMonth ? "Saiu da conta" : "Já saiu da conta",
      cents: totals.contaSaiu,
      color: FLOW_COLORS.conta,
      striped: false,
      hint: pastMonth ? "Contas e gastos fora do cartão" : "Contas pagas e gastos fora do cartão",
      href: `/lancamentos?m=${month}&f=todos`,
    },
    {
      key: "cartao",
      label: cards.length > 1 ? "Faturas dos cartões" : "Fatura do cartão",
      cents: totals.credito,
      color: FLOW_COLORS.cartao,
      // num mês que acabou a fatura já foi paga; no atual e nos próximos, ainda não saiu da conta
      striped: mode !== "fechado",
      hint:
        mode === "fechado"
          ? undefined
          : [
              closingDay &&
                (mode === "andamento" && Number(today.slice(8, 10)) >= closingDay
                  ? `Fechou dia ${closingDay}`
                  : `Fecha dia ${closingDay}`),
              mode === "andamento" &&
                cardCharges > 0 &&
                `${cardCharges} ${cardCharges === 1 ? "cobrança" : "cobranças"} por vir`,
            ]
              .filter(Boolean)
              .join(" · ") || undefined,
      href:
        cards.length === 1
          ? `/lancamentos?m=${month}&f=todos&pm=${cards[0].id}`
          : `/fixos?m=${month}&aba=cartao`,
    },
    {
      key: "pagar",
      label: bills ? "Contas a pagar" : "Gastos agendados",
      cents: totals.contaASair,
      color: FLOW_COLORS.conta,
      striped: true,
      hint:
        joinPt(
          [
            bills && `${bills} ${bills === 1 ? "conta" : "contas"}`,
            scheduled && `${scheduled} ${scheduled === 1 ? "gasto agendado" : "gastos agendados"}`,
          ].filter((x): x is string => !!x),
        ) || undefined,
      href: bills ? `/fixos?m=${month}` : `/lancamentos?m=${month}&f=todos`,
    },
  ].filter((p) => p.cents !== 0) as BalancePart[];

  const naContaHint =
    totals.credito !== 0 && totals.contaASair !== 0
      ? "Antes de pagar a fatura e as contas"
      : totals.credito !== 0
        ? "Antes de pagar a fatura do cartão"
        : "Antes de pagar as contas";

  const gastosText = formatBRL(totals.gastos);
  const over = totals.gastos > totals.entradas;
  const pct = totals.entradas > 0 ? Math.round((totals.gastos / totals.entradas) * 100) : 0;
  const entra = mode === "futuro" ? "vai entrar" : "entrou";
  const meterText =
    totals.entradas === 0
      ? totals.gastos === 0
        ? "Nada lançado neste mês ainda."
        : `Nenhuma entrada registrada. Os gastos ${pastMonth ? "somaram" : "somam"} ${gastosText}.`
      : (mode === "futuro"
          ? `Os gastos previstos somam ${gastosText}`
          : pastMonth
            ? `Os gastos somaram ${gastosText}`
            : `Os gastos do mês somam ${gastosText}`) +
        (over ? `, ${Math.max(1, pct - 100)}% a mais do que ${entra}.` : `, ${pct}% do que ${entra}.`);
  const barsLabel =
    `${inLabel}: ${formatBRL(totals.entradas)}. Gastos: ${gastosText}` +
    outs.map((p) => `, ${p.label.toLowerCase()} ${formatBRL(p.cents)}`).join("") +
    ".";

  return {
    mode,
    heroLabel,
    totalLabel: mode === "futuro" ? "Saldo previsto" : heroLabel,
    saldo: totals.saldo,
    entradas: totals.entradas,
    gastos: totals.gastos,
    naConta: totals.entradas - totals.contaSaiu,
    naContaHint,
    scale: Math.max(totals.entradas, totals.gastos, 1),
    income,
    outs,
    over,
    meterText,
    barsLabel,
  };
}

/** "2 contas, 3 cobranças no cartão e 1 gasto agendado" */
export function joinPt(parts: string[]) {
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} e ${parts[parts.length - 1]}` : (parts[0] ?? "");
}
