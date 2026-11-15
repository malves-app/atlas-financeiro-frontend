// Teste do importador e das regras do site com uma cópia da aba Novembro,
// passando pelo mesmo código que o site usa para falar com o Supabase.
// Rodar: npm test
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { fakeSupabase, setupDb } from "./helpers.mts";

process.env.TZ = "America/Fortaleza";

const { parseMonthSheet, checkMonth, parseSheetDate, parseBRL } = await import("../lib/import/parse");

// ---------- leitura da planilha ----------
assert.equal(parseBRL("R$ 1.234,56"), 123456);
assert.equal(parseBRL("-R$ 32,64"), -3264);
assert.equal(parseBRL(""), null);
assert.deepEqual(parseSheetDate("13/12", 2026, 1), { date: "2025-12-13", day: 13 });
assert.deepEqual(parseSheetDate("-31", 2026, 11), { date: "2026-10-31", day: 31 });
assert.deepEqual(parseSheetDate("30", 2026, 2), { date: "2026-02-28", day: 30 });
assert.deepEqual(parseSheetDate("0", 2026, 4), { date: null, day: null });

const csv = readFileSync(new URL("./fixtures/novembro.csv", import.meta.url), "utf8");
const nov = parseMonthSheet(csv, 2026, 11);
const check = checkMonth(nov);
assert.ok(check.ok, "totais diferentes da planilha: " + JSON.stringify(check.diffs));
assert.equal(check.computed.totalGastos, 1393973);
assert.equal(check.computed.entradas, 1699473);
assert.equal(nov.entries.filter((e) => e.kind === "fixo").length, 10);
assert.equal(nov.entries.filter((e) => e.kind === "cartao").length, 22);
assert.equal(nov.entries.filter((e) => e.kind === "avulso").length, 82);
assert.equal(nov.incomes.length, 12);
assert.deepEqual(nov.paymentNames, ["Conta Corrente", "Crédito"], "formas de pagamento da seção Saídas");
assert.equal(check.computed["Conta Corrente"], 655364);
assert.equal(check.computed["Crédito"], 738609);

// ---------- máscara do campo de valor ----------
{
  const { nextCents, centsText } = await import("../lib/money-mask");
  const type = (start: number, keys: string, caretAtStart = false) => {
    let c = start;
    for (const k of keys) {
      const cur = centsText(c);
      const typed = k === "⌫" ? cur.slice(0, -1) : caretAtStart ? k + cur : cur + k;
      c = nextCents(c, typed);
    }
    return c;
  };
  assert.equal(type(0, "4590"), 4590);
  assert.equal(centsText(4590), "45,90");
  assert.equal(type(0, "990", true), 990, "cursor no começo também soma no fim");
  assert.equal(type(4590, "⌫"), 459);
  assert.equal(type(123456, "⌫⌫"), 1234);
  assert.equal(centsText(123456), "1.234,56");
  assert.equal(nextCents(0, "R$ 12,34"), 1234, "colar um valor");
}

// ---------- banco (mesmo SQL do Supabase) ----------
const db = await setupDb();
const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";
await db.exec(`insert into auth.users (id) values ('${A}'), ('${B}')`);
const g = globalThis as { __atlasTestClient?: unknown };
g.__atlasTestClient = fakeSupabase(db, A);

const { loadIntoDatabase } = await import("../lib/import/sheet");
const data = await import("../lib/data");

// Importação
const report = await loadIntoDatabase(g.__atlasTestClient as never, [nov]);
assert.equal(report.months[0].ok, true);
assert.equal(report.recurring, 32);
const month = await data.getMonth("2026-11");
assert.equal(month.totals.gastos, 1393973);
assert.equal(month.totals.entradas, 1699473);
assert.equal(month.totals.saldo, 305500);
const methods = await data.listPaymentMethods();
assert.deepEqual(methods.map((m) => [m.name, m.isCredit, m.closingDay]), [
  ["Conta Corrente", false, null],
  ["Crédito", true, 25],
]);
const byName = (id: number | null) => methods.find((m) => m.id === id)?.name;
assert.deepEqual(
  Object.fromEntries(month.byPayment.map((p) => [byName(p.paymentMethodId), p.total])),
  { "Conta Corrente": 655364, Crédito: 738609 },
);
assert.ok(month.entries.every((e) => e.paymentMethodId != null), "todo lançamento tem forma de pagamento");
assert.equal(month.entries.filter((e) => e.recurringId != null).length, 32, "fixos de novembro ligados aos modelos");

// Importar de novo não duplica
await loadIntoDatabase(g.__atlasTestClient as never, [nov]);
assert.equal((await data.getMonth("2026-11")).entries.length, 114);
assert.equal((await data.listCategories()).filter((c) => c.name === "Saúde").length, 1);

// Fixos do mês seguinte gerados a partir dos modelos
const recs = await data.listRecurring();
const jane = recs.find((r) => r.name === "Jane Ótica")!;
assert.equal(jane.installments, 10);
assert.equal(jane.startMonth, "2026-03");
const dec = await data.getMonth("2026-12");
const names = dec.entries.map((e) => `${e.name}${e.installmentNo ? ` ${e.installmentNo}/${e.installmentTotal}` : ""}`);
assert.ok(names.includes("Jane Ótica 10/10"), names.join(", "));
assert.ok(!names.some((n) => n.startsWith("Espaço Laser")), "Espaço Laser terminou em 15/15");
assert.ok(names.includes("Centauro 3/3"));
const aluguel = dec.entries.find((e) => e.name === "ALUGUEL")!;
assert.equal(aluguel.paid, false);
assert.equal(aluguel.date, "2026-12-01");
assert.equal(dec.entries.length, 31);
assert.equal((await data.getMonth("2026-12")).entries.length, 31, "abrir de novo não duplica");
// Parcelas continuam em 2027 (e terminam na última)
const jan27 = await data.getMonth("2027-01");
const visualJan = jan27.entries.find((e) => e.name === "Visual (Argentina)")!;
assert.equal(`${visualJan.installmentNo}/${visualJan.installmentTotal}`, "8/10");
assert.equal((await data.getMonth("2027-03")).entries.find((e) => e.name === "Visual (Argentina)")?.installmentNo, 10);
assert.ok(!(await data.getMonth("2027-04")).entries.some((e) => e.name === "Visual (Argentina)"), "acabou em 10/10");
assert.ok((await data.getMonth("2027-04")).entries.some((e) => e.name === "ALUGUEL"), "fixos mensais seguem");
assert.equal((await data.getMonth("2032-01")).entries.length, 0, "não gera além de 5 anos");

// Contas a pagar e marcar como pago
const novAgain = await data.getMonth("2026-11");
// só as contas fora do cartão (Unimed - Pessoa B e Condomínio); assinaturas no crédito não entram
assert.deepEqual(novAgain.pending.map((e) => e.name).sort(), ["Condomínio", "Unimed - Pessoa B"]);
await data.setPaid(novAgain.pending.find((e) => e.name === "Condomínio")!.id, true);
assert.equal((await data.getMonth("2026-11")).pending.length, 1);

// Novo parcelamento na parcela 3 de 10: aparece em nov (3/10) e dez (4/10)
const credito = methods.find((m) => m.name === "Crédito")!;
const conta = methods.find((m) => m.name === "Conta Corrente")!;
await data.createRecurring({
  kind: "cartao",
  name: "Geladeira",
  amountCents: 29990,
  day: 12,
  paymentMethodId: credito.id,
  categoryId: null,
  installments: 10,
  startMonth: "2026-09",
});
const gel = (await data.getMonth("2026-12")).entries.find((e) => e.name === "Geladeira")!;
assert.equal(gel.installmentNo, 4);
assert.equal(gel.paymentMethodId, credito.id);
assert.equal((await data.getMonth("2027-06")).entries.find((e) => e.name === "Geladeira")!.installmentNo, 10, "chega aos meses de 2027 já abertos");
assert.equal((await data.getMonth("2026-11")).entries.find((e) => e.name === "Geladeira")!.installmentNo, 3);

// Mudar o aluguel a partir de dezembro
const aluguelRec = recs.find((r) => r.name === "ALUGUEL")!;
await data.updateRecurring(aluguelRec.id, { ...aluguelRec, amountCents: 165000 }, "2026-12");
assert.equal((await data.getMonth("2026-12")).entries.find((e) => e.name === "ALUGUEL")!.amountCents, 165000);
assert.equal((await data.getMonth("2026-11")).entries.find((e) => e.name === "ALUGUEL")!.amountCents, 160000, "novembro fica igual");

// Encerrar a Netflix depois de novembro
const netflix = recs.find((r) => r.name === "Netflix")!;
await data.endRecurring(netflix.id, "2026-11");
assert.ok(!(await data.getMonth("2026-12")).entries.some((e) => e.name === "Netflix"));

// Lançamento rápido, sugestões e categorias pelo histórico
const cats = await data.listCategories();
const uberCat = cats.find((c) => c.name === "Uber")!;
await data.createEntry({ month: "2026-10", kind: "avulso", name: "Uber", amountCents: 1500, date: "2026-10-03", paymentMethodId: credito.id, categoryId: uberCat.id });
const sugg = await data.getSuggestions();
const uber = sugg.find((s) => s.name === "Uber")!;
assert.equal(uber.categoryId, uberCat.id);
assert.equal(uber.paymentMethodId, credito.id);
assert.ok(uber.uses > 20);
const filled = await data.fillCategoriesFromHistory("2026-11");
assert.ok(filled >= 30, `preencheu ${filled}`);
assert.equal((await data.listCategoriesByUse())[0].name, "Uber");

// Formas de pagamento configuráveis
const { referenceMonth } = await import("../lib/format");
await data.upsertPaymentMethod({ name: "Pix", isCredit: false, closingDay: null });
await data.upsertPaymentMethod({ name: "Nubank", isCredit: true, closingDay: 3 });
await data.upsertPaymentMethod({ id: credito.id, name: "Crédito Itaú", isCredit: true, closingDay: 26 });
const all = await data.listPaymentMethods();
assert.deepEqual(all.map((m) => m.name), ["Conta Corrente", "Crédito Itaú", "Pix", "Nubank"]);
assert.equal(new Set(all.map((m) => m.color)).size, 4, "cada forma com uma cor");
const nubank = all.find((m) => m.name === "Nubank")!;
assert.equal(referenceMonth("2026-11-04", nubank), "2026-12", "Nubank fecha dia 3");
assert.equal(referenceMonth("2026-11-26", all.find((m) => m.name === "Crédito Itaú")), "2026-11", "Itaú fecha dia 26");
assert.equal(referenceMonth("2026-11-30", conta), "2026-11", "conta corrente não tem fatura");
await data.archivePaymentMethod(all.find((m) => m.name === "Pix")!.id);
assert.ok(!(await data.listPaymentMethods()).some((m) => m.name === "Pix"));
await data.upsertPaymentMethod({ name: "Pix", isCredit: false, closingDay: null });
assert.ok((await data.listPaymentMethods()).some((m) => m.name === "Pix"), "recriar reativa");
assert.equal((await data.getMonth("2026-11")).byPayment.find((p) => p.paymentMethodId === credito.id)!.total > 0, true);

// Categoria nova e remover
await data.upsertCategory({ name: "Pets", emoji: "🐾", budgetCents: 30000 });
const pets = (await data.listCategories()).find((c) => c.name === "Pets")!;
assert.equal(pets.budgetCents, 30000);
await data.archiveCategory(pets.id);
assert.ok(!(await data.listCategories()).some((c) => c.name === "Pets"));

// Entradas
await data.createIncome({ month: "2026-11", name: "Plantão extra", amountCents: 50000, date: "2026-11-14" });
assert.equal((await data.getMonth("2026-11")).totals.entradas, 1749473);
assert.equal((await data.getIncomeSuggestions())[0], "Plantão extra");

// "A pagar" não inclui nada do cartão de crédito (o cartão é pago na fatura)
{
  const { currentMonth } = await import("../lib/format");
  const now = currentMonth();
  const methods = await data.listPaymentMethods();
  const creditIds = new Set(methods.filter((m) => m.isCredit).map((m) => m.id));
  const m = await data.getMonth(now);
  assert.ok(m.pending.every((e) => e.paymentMethodId == null || !creditIds.has(e.paymentMethodId)), "nada do crédito em A pagar");
  const card = methods.find((x) => x.isCredit)!;
  // Compra parcelada lançada pelo "Lançar gasto": vira fixo do cartão, inclusive numa fatura que já passou
  const { shiftMonth } = await import("../lib/format");
  const start = shiftMonth(now, -1);
  await data.getMonth(start); // mês passado já montado
  await data.createRecurring(
    { kind: "cartao", name: "Fogão", amountCents: 30000, day: 20, paymentMethodId: card.id, categoryId: null, installments: 10, startMonth: start },
    { backfill: true },
  );
  const g = (await data.getMonth(start)).entries.find((e) => e.name === "Fogão")!;
  assert.equal(g.installmentNo, 1, "1ª parcela na fatura passada");
  const g2 = (await data.getMonth(now)).entries.find((e) => e.name === "Fogão")!;
  assert.equal(g2.installmentNo, 2);
  assert.ok(!(await data.getMonth(now)).pending.some((e) => e.name === "Fogão"));
  const last = (await data.getMonth(shiftMonth(start, 9))).entries.find((e) => e.name === "Fogão")!;
  assert.equal(last.installmentNo, 10);
  assert.equal((await data.getMonth(shiftMonth(start, 10))).entries.some((e) => e.name === "Fogão"), false, "acaba na 10ª");
}

// Outro usuário (conta nova) não vê nada disso e começa com o padrão
g.__atlasTestClient = fakeSupabase(db, B);
assert.equal((await data.getMonth("2026-11")).entries.length, 0);
assert.equal(await data.hasAnyData(), false);
assert.deepEqual((await data.listPaymentMethods()).map((m) => m.name), ["Conta Corrente", "Crédito"]);
assert.equal((await data.listCategories()).length, data.DEFAULT_CATEGORIES.length);
await data.listPaymentMethods();
assert.equal((await data.listPaymentMethods()).length, 2, "padrão criado uma vez só");

console.log(`✓ importador e regras ok: novembro confere com a planilha, ${recs.length} fixos, dezembro com ${dec.entries.length} lançamentos`);
process.exit(0);
