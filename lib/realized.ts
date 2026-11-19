import { dateInMonth, daysInMonth } from "./format";

// "Já saiu" × "ainda vai sair".
// Os totais do mês contam tudo o que pertence ao mês (o previsto). Aqui se decide o que já saiu de fato
// até hoje, para mostrar o gasto real ao lado do previsto:
// - mês que já acabou: tudo já saiu;
// - contas (fixos fora do crédito): só depois de marcadas como pagas;
// - cobranças do cartão (fixos, assinaturas e parcelas): a partir do dia da cobrança, nunca depois do
//   fechamento da fatura (sem dia, vale o fechamento; cartão sem fechamento, o último dia do mês);
// - dia a dia: na data do gasto (sem data, conta a partir do mês dele).

export interface SpendItem {
  month: string;
  kind: "fixo" | "cartao" | "avulso";
  date: string | null;
  paid: boolean | null;
}

/** Forma de pagamento do lançamento, no que importa aqui. */
export interface SpendMethod {
  onCard: boolean;
  closingDay: number | null;
}

/** Dia em que uma cobrança do cartão passa a contar: o dia dela, limitado ao fechamento da fatura. */
export function cardChargeDate(month: string, date: string | null, closingDay: number | null): string {
  const closing = dateInMonth(month, closingDay ?? daysInMonth(month))!;
  return date && date < closing ? date : closing;
}

export function isRealized(e: SpendItem, method: SpendMethod, today: string): boolean {
  const current = today.slice(0, 7);
  if (e.month < current) return true;
  if (e.kind === "avulso") return e.date ? e.date <= today : e.month <= current;
  if (!method.onCard) return e.paid === true;
  return cardChargeDate(e.month, e.date, method.closingDay) <= today;
}
