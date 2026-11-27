// Formato comum do que é lido de qualquer banco (a fatura do cartão e o extrato da conta), usado pela
// comparação com o Atlas. Cada banco tem o seu leitor (lib/statements/santander.ts, ...).

/** Um pedaço de texto do PDF, com a posição (x da esquerda para a direita, y de cima para baixo). */
export interface PdfItem {
  s: string;
  x: number;
  y: number;
  w: number;
}

export interface PdfPage {
  width: number;
  height: number;
  items: PdfItem[];
}

export interface FaturaLine {
  /** Identifica a linha entre leituras do mesmo arquivo (para "ignorar"). */
  key: string;
  /** Final do cartão (4 dígitos) e nome impresso. */
  card: string;
  holder: string;
  section: "creditos" | "parcelamentos" | "despesas";
  /** AAAA-MM-DD (o ano é deduzido pelo fechamento). */
  date: string;
  description: string;
  installment: { no: number; total: number } | null;
  /** Gasto > 0; estorno, crédito e pagamento < 0. */
  amountCents: number;
  usdCents: number | null;
  kind: "gasto" | "credito" | "pagamento";
}

export interface Fatura {
  /** Banco que gerou o arquivo (id de lib/statements/banks.ts). */
  bank: string;
  /** Período das compras desta fatura (AAAA-MM-DD). */
  periodFrom: string;
  closing: string;
  due: string | null;
  /** Resumo impresso na fatura (centavos). */
  summary: {
    previous: number | null;
    debits: number | null;
    credits: number | null;
    payments: number | null;
    total: number | null;
  };
  lines: FaturaLine[];
  cards: { card: string; holder: string; debitsCents: number }[];
  /** A soma do que foi lido bate com o resumo da fatura? */
  check: { ok: boolean; message: string | null };
}

export interface ExtratoLine {
  key: string;
  date: string;
  /** Primeira linha da descrição ("Pix enviado", "Pagamento de boleto outros bancos"). */
  kind: string;
  /** Segunda linha (quem recebeu ou quem pagou), quando tem. */
  counterpart: string | null;
  description: string;
  /** Saída < 0, entrada > 0. */
  amountCents: number;
  balanceCents: number | null;
}

export interface Extrato {
  /** Banco que gerou o arquivo (id de lib/statements/banks.ts). */
  bank: string;
  holder: string | null;
  agency: string | null;
  account: string | null;
  from: string;
  to: string;
  lines: ExtratoLine[];
}
