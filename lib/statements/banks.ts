// Bancos que o Conferir sabe ler. Hoje só o Santander; outro banco = um leitor novo (como santander.ts) que devolve
// a mesma Fatura / Extrato de lib/statements/types.ts, e uma entrada nesta lista. O resto (comparação, sugestões,
// tela) não muda.

import { pdfPages } from "./pdf";
import { decodeText, parseSantanderExtrato, parseSantanderFatura } from "./santander";
import type { Extrato, Fatura } from "./types";

export interface StatementBank {
  /** Mesmo id de lib/payment-icons.ts (BANKS), para casar com o banco da forma de pagamento. */
  id: string;
  name: string;
  fatura: { format: "PDF"; accept: string; howTo: string };
  extrato: { format: "CSV"; accept: string; howTo: string };
}

export const STATEMENT_BANKS: StatementBank[] = [
  {
    id: "santander",
    name: "Santander",
    fatura: {
      format: "PDF",
      accept: "application/pdf,.pdf",
      howTo: "A fatura fechada, em PDF, baixada do app ou do site do Santander. Enviar a mesma fatura de novo substitui a anterior.",
    },
    extrato: {
      format: "CSV",
      accept: "text/csv,.csv",
      howTo: "O extrato da conta em CSV, exportado do app ou do site do Santander, de qualquer período.",
    },
  },
];

export const statementBank = (id: string | null | undefined) => STATEMENT_BANKS.find((b) => b.id === id) ?? null;

const isPdf = (bytes: Uint8Array) => /%PDF-/.test(new TextDecoder("latin1").decode(bytes.slice(0, 1024)));

/** Lê o arquivo do banco. Erro com uma frase para a pessoa se não for o arquivo certo. */
export async function readStatement(bankId: string, kind: "fatura" | "extrato", bytes: Uint8Array): Promise<Fatura | Extrato> {
  const bank = statementBank(bankId);
  if (!bank) throw new Error("Ainda não lemos arquivos desse banco. Por enquanto, só Santander.");
  switch (bank.id) {
    case "santander":
      if (kind === "fatura") {
        if (!isPdf(bytes)) throw new Error("A fatura precisa ser o PDF baixado do Santander.");
        return parseSantanderFatura(await pdfPages(bytes));
      }
      return parseSantanderExtrato(decodeText(bytes));
  }
  throw new Error("Ainda não lemos arquivos desse banco.");
}
