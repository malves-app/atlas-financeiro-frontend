// Teste da regra "já saiu" × "ainda vai sair" (gasto real até hoje × previsto do mês).
// Rodar: npm test
import assert from "node:assert/strict";

const { isRealized, cardChargeDate } = await import("../lib/realized");

const today = "2026-11-18";
const conta = { onCard: false, closingDay: null };
const cartao = { onCard: true, closingDay: 25 };
const cartaoSemFechamento = { onCard: true, closingDay: null };
const item = (month: string, kind: "fixo" | "cartao" | "avulso", date: string | null, paid: boolean | null = null) => ({
  month,
  kind,
  date,
  paid,
});

// ---------- dia do cartão ----------
assert.equal(cardChargeDate("2026-11", "2026-11-10", 25), "2026-11-10");
assert.equal(cardChargeDate("2026-11", "2026-11-28", 25), "2026-11-25", "depois do fechamento vale o fechamento");
assert.equal(cardChargeDate("2026-11", null, 25), "2026-11-25", "sem dia vale o fechamento");
assert.equal(cardChargeDate("2026-11", null, null), "2026-11-30", "sem fechamento, último dia do mês");
assert.equal(cardChargeDate("2026-02", null, 31), "2026-02-28", "fechamento no dia 31 em fevereiro");

// ---------- contas (fora do cartão) ----------
assert.equal(isRealized(item("2026-11", "fixo", "2026-11-30", false), conta, today), false, "conta do fim do mês ainda não saiu");
assert.equal(isRealized(item("2026-11", "fixo", "2026-11-05", false), conta, today), false, "conta vencida e não paga ainda não saiu");
assert.equal(isRealized(item("2026-11", "fixo", "2026-11-30", true), conta, today), true, "paga adiantada já saiu");
assert.equal(isRealized(item("2026-11", "fixo", null, null), conta, today), false, "sem marcação de pago, ainda não saiu");
assert.equal(isRealized(item("2026-12", "fixo", "2026-12-05", true), conta, today), true, "paga no mês seguinte já saiu");
assert.equal(isRealized(item("2026-10", "fixo", "2026-10-30", false), conta, today), true, "mês que acabou: tudo saiu");

// ---------- cobranças do cartão ----------
assert.equal(isRealized(item("2026-11", "cartao", "2026-11-10"), cartao, today), true, "assinatura do dia 10 já foi cobrada");
assert.equal(isRealized(item("2026-11", "cartao", "2026-11-18"), cartao, today), true, "cobrada hoje");
assert.equal(isRealized(item("2026-11", "cartao", "2026-11-20"), cartao, today), false, "cobrança do dia 20 ainda vem");
assert.equal(isRealized(item("2026-11", "cartao", null), cartao, today), false, "sem dia: entra no fechamento (25)");
assert.equal(isRealized(item("2026-11", "cartao", null), cartao, "2026-11-25"), true, "no fechamento, já entrou");
assert.equal(isRealized(item("2026-11", "cartao", "2026-11-28"), cartao, "2026-11-26"), true, "dia depois do fechamento conta no fechamento");
assert.equal(isRealized(item("2026-11", "cartao", null), cartaoSemFechamento, today), false);
assert.equal(isRealized(item("2026-11", "cartao", null), cartaoSemFechamento, "2026-11-30"), true);
assert.equal(isRealized(item("2026-12", "cartao", "2026-12-02"), cartao, today), false, "fatura que vem ainda não saiu");
assert.equal(isRealized(item("2026-11", "fixo", "2026-11-10", false), cartao, today), true, "fixo pago no crédito segue o cartão, não o check");

// ---------- dia a dia ----------
assert.equal(isRealized(item("2026-11", "avulso", "2026-11-03"), cartao, today), true);
assert.equal(isRealized(item("2026-11", "avulso", "2026-11-03"), conta, today), true);
assert.equal(isRealized(item("2026-11", "avulso", null), conta, today), true, "sem data, no mês atual, já saiu");
assert.equal(isRealized(item("2026-11", "avulso", "2026-11-29"), conta, today), false, "gasto marcado para o dia 29 ainda vai sair");
assert.equal(isRealized(item("2026-12", "avulso", "2026-11-17"), cartao, today), true, "compra depois do fechamento já aconteceu");
assert.equal(isRealized(item("2026-12", "avulso", null), conta, today), false, "sem data num mês que ainda vem");

console.log("✓ gasto real ok: contas pelo check de pago, cartão pelo dia da cobrança, dia a dia pela data");
