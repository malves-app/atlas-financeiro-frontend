// Teste do cartão do saldo do Painel (lib/balance.ts): destaque, linhas do extrato e barras.
// Rodar: npm test
import assert from "node:assert/strict";

const { balanceView } = await import("../lib/balance");

const nbsp = (s: string) => s.replace(/ /g, " ");
const methods = [
  { id: 1, name: "Conta Corrente", isCredit: false, closingDay: null, color: "#2a78d6", sort: 0, icon: "conta" as const, bank: null },
  { id: 2, name: "Crédito", isCredit: true, closingDay: 25, color: "#eb6834", sort: 1, icon: "credito" as const, bank: null },
];
const up = (kind: "fixo" | "cartao" | "avulso", onCard: boolean) =>
  ({ id: 0, month: "2026-11", kind, name: "x", amountCents: 1, date: null, paymentMethodId: onCard ? 2 : 1, categoryId: null, paid: false, installmentNo: null, installmentTotal: null, onCard }) as never;
const totalsOf = (entradas: number, contaSaiu: number, credito: number, contaASair: number) => {
  const gastos = contaSaiu + credito + contaASair;
  return { gastos, entradas, saldo: entradas - gastos, fixo: 0, cartao: 0, avulso: 0, saiu: 0, aSair: 0, contaSaiu, contaASair, credito };
};
const byPayment = (credito: number) => [
  { paymentMethodId: 1, total: 1 },
  { paymentMethodId: 2, total: credito },
];

// Mês atual com cartão e contas por vir (o caso do print): destaque = saldo no fim do mês
{
  const totals = totalsOf(1699473, 850000, 1150000, 177569);
  const v = balanceView({
    month: "2026-11",
    today: "2026-11-21",
    totals,
    upcoming: [up("fixo", false), up("fixo", false), ...Array.from({ length: 6 }, () => up("cartao", true))],
    byPayment: byPayment(1150000),
    methods,
  });
  assert.equal(v.mode, "andamento");
  assert.equal(v.heroLabel, "Saldo no fim do mês");
  assert.equal(v.saldo, -478096, "destaque = entrou − tudo o que é do mês");
  assert.equal(v.naConta, 1699473 - 850000, "na conta hoje = entrou − já saiu da conta (a fatura ainda está na conta)");
  assert.deepEqual(v.outs.map((p) => p.label), ["Já saiu da conta", "Fatura do cartão", "Contas a pagar"]);
  assert.deepEqual(v.outs.map((p) => p.striped), [false, true, true], "listrado = ainda não saiu da conta");
  assert.equal(v.outs.reduce((a, p) => a + p.cents, 0), totals.gastos, "as partes da barra de gastos somam os gastos");
  assert.equal(v.naConta - v.outs.slice(1).reduce((a, p) => a + p.cents, 0), v.saldo, "o extrato fecha a conta");
  assert.equal(v.outs[1].hint, "Fecha dia 25 · 6 cobranças por vir");
  assert.equal(v.outs[1].href, "/lancamentos?m=2026-11&f=todos&pm=2");
  assert.equal(v.outs[2].hint, "2 contas");
  assert.equal(v.scale, totals.gastos, "gastos maior que entrou: a escala é a dos gastos");
  assert.ok(v.over);
  assert.equal(nbsp(v.meterText), "Os gastos do mês somam R$ 21.775,69, 28% a mais do que entrou.");
}

// Nada saiu da conta ainda: sem linha de valor zero (não haveria parte na barra)
{
  const v = balanceView({
    month: "2026-11",
    today: "2026-11-02",
    totals: totalsOf(500000, 0, 120000, 0),
    upcoming: [up("cartao", true)],
    byPayment: byPayment(120000),
    methods,
  });
  assert.deepEqual(v.outs.map((p) => p.key), ["cartao"]);
  assert.equal(v.naConta, 500000);
  assert.equal(v.naContaHint, "Antes de pagar a fatura do cartão");
  assert.equal(nbsp(v.meterText), "Os gastos do mês somam R$ 1.200,00, 24% do que entrou.");
}

// Mês que acabou: a fatura já foi paga (sem listrado), "Saiu da conta"
{
  const v = balanceView({
    month: "2026-10",
    today: "2026-11-21",
    totals: totalsOf(1000000, 400000, 300000, 0),
    upcoming: [],
    byPayment: byPayment(300000),
    methods,
  });
  assert.equal(v.mode, "fechado");
  assert.equal(v.heroLabel, "Saldo de outubro");
  assert.deepEqual(v.outs.map((p) => [p.label, p.striped]), [["Saiu da conta", false], ["Fatura do cartão", false]]);
  assert.equal(v.outs[1].hint, undefined);
  assert.equal(v.scale, 1000000);
  assert.equal(nbsp(v.meterText), "Os gastos somaram R$ 7.000,00, 70% do que entrou.");
}

// Mês que ainda vem: saldo previsto
{
  const v = balanceView({
    month: "2026-12",
    today: "2026-11-21",
    totals: totalsOf(1000000, 0, 300000, 200000),
    upcoming: [up("fixo", false), up("avulso", false), up("cartao", true)],
    byPayment: byPayment(300000),
    methods,
  });
  assert.equal(v.mode, "futuro");
  assert.equal(v.heroLabel, "Saldo previsto de dezembro");
  assert.equal(v.income.label, "Vai entrar");
  assert.equal(v.outs[0].hint, "Fecha dia 25");
  assert.equal(v.outs[1].hint, "1 conta e 1 gasto agendado");
  assert.equal(nbsp(v.meterText), "Os gastos previstos somam R$ 5.000,00, 50% do que vai entrar.");
}

// Mês atual sem cartão e sem nada por sair: um saldo só
{
  const v = balanceView({
    month: "2026-11",
    today: "2026-11-21",
    totals: totalsOf(300000, 100000, 0, 0),
    upcoming: [],
    byPayment: [{ paymentMethodId: 1, total: 100000 }],
    methods,
  });
  assert.equal(v.mode, "fechado");
  assert.equal(v.heroLabel, "Saldo de novembro");
  assert.deepEqual(v.outs.map((p) => p.label), ["Já saiu da conta"]);
}

console.log("✓ cartão do saldo ok: saldo do fim do mês no destaque, na conta hoje sem a fatura, extrato fecha a conta");
