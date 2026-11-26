// Exportar lançamentos (lib/entries-export.ts e a rota /exportar/lancamentos): o filtro é o mesmo da
// tela Lançamentos e a planilha (CSV) abre no Excel em português (; e vírgula decimal, UTF-8 com BOM).
// Rodar: npm test
import assert from "node:assert/strict";
import { fakeSupabase, setupDb } from "./helpers.mts";

process.env.TZ = "America/Fortaleza";

const ex = await import("../lib/entries-export");
type Entry = import("../lib/data").Entry;

let id = 1;
const e = (over: Partial<Entry>): Entry => ({
  id: id++,
  month: "2026-11",
  kind: "avulso",
  name: "x",
  amountCents: 1000,
  date: "2026-11-10",
  paymentMethodId: 1,
  categoryId: 1,
  subcategoryId: null,
  paid: null,
  installmentNo: null,
  installmentTotal: null,
  recurringId: null,
  ...over,
});

// ---------- filtro (igual ao da lista) ----------
const list = [
  e({ name: "Uber Centro", paymentMethodId: 2 }),
  e({ name: "Assaí", categoryId: 3 }),
  e({ name: "Aluguel", kind: "fixo", paid: true, categoryId: 2 }),
  e({ name: "Netflix", kind: "cartao", paymentMethodId: 2, categoryId: null }),
  e({ name: "Geladeira", kind: "cartao", paymentMethodId: 2, installmentNo: 3, installmentTotal: 10, categoryId: null }),
  e({ name: "Padaria", categoryId: null }),
];
const names = (l: Entry[]) => l.map((x) => x.name);
const F = (o: Partial<import("../lib/entries-export").EntryFilter>) => ({ f: "", q: "", cat: null, pm: null, ...o });
assert.deepEqual(names(ex.filterEntries(list, F({}))), ["Uber Centro", "Assaí", "Padaria"], "sem filtro: dia a dia");
assert.equal(ex.filterEntries(list, F({ f: "todos" })).length, 6);
assert.deepEqual(names(ex.filterEntries(list, F({ f: "fixos" }))), ["Aluguel", "Netflix", "Geladeira"]);
assert.deepEqual(names(ex.filterEntries(list, F({ f: "todos", pm: "2" }))), ["Uber Centro", "Netflix", "Geladeira"], "forma de pagamento: inclui fixos");
assert.deepEqual(names(ex.filterEntries(list, F({ f: "sem-categoria" }))), ["Netflix", "Geladeira", "Padaria"]);
assert.deepEqual(names(ex.filterEntries(list, F({ cat: "sem" }))), ["Netflix", "Geladeira", "Padaria"]);
assert.deepEqual(names(ex.filterEntries(list, F({ cat: "3" }))), ["Assaí"]);
assert.deepEqual(names(ex.filterEntries(list, F({ q: "assai" }))), ["Assaí"], "busca sem acento");
assert.equal(ex.filterEntries(list, F({ f: "todos", q: "  " })).length, 6, "busca só com espaços não filtra");
assert.deepEqual(ex.readEntryFilter((k) => ({ f: "todos", q: " uber ", pm: "2" })[k]), { f: "todos", q: "uber", cat: null, pm: "2" });

// ---------- planilha ----------
assert.equal(ex.csvMoney(123456), "1234,56");
assert.equal(ex.csvMoney(-5000), "-50,00");
assert.equal(ex.csvMoney(7), "0,07");
assert.equal(ex.csvDate("2026-11-05"), "05/11/2026");
assert.equal(ex.csvDate(null), "");
const lookups = {
  categories: new Map([
    [1, { name: "Transporte" }],
    [2, { name: "Moradia" }],
    [3, { name: "Alimentação" }],
  ]),
  subcategories: new Map([[9, { name: "Supermercado" }]]),
  methods: new Map([
    [1, { name: "Conta Corrente" }],
    [2, { name: "Nubank" }],
  ]),
};
const csv = ex.expensesCsv(
  [
    e({ name: "Assaí; atacado", categoryId: 3, subcategoryId: 9, date: "2026-11-12", amountCents: 32450 }),
    e({ name: "=SOMA(A1)", date: "2026-11-01" }),
    e({ name: 'Loja "X"', date: null, amountCents: -1500 }),
    e({ name: "Aluguel", kind: "fixo", paid: false, categoryId: 2, date: "2026-11-05", amountCents: 160000 }),
    e({ name: "Geladeira", kind: "cartao", paymentMethodId: 2, installmentNo: 3, installmentTotal: 10, categoryId: null, month: "2026-12", date: "2026-11-20" }),
  ],
  lookups,
);
assert.ok(csv.startsWith("﻿"), "BOM para o Excel reconhecer os acentos");
assert.ok(csv.endsWith("\r\n"));
const lines = csv.slice(1).trimEnd().split("\r\n");
assert.equal(lines[0], "Data;Descrição;Valor (R$);Categoria;Subcategoria;Forma de pagamento;Tipo;Parcela;Pago;Mês de referência");
assert.deepEqual(lines.slice(1), [
  "01/11/2026;'=SOMA(A1);10,00;Transporte;;Conta Corrente;Dia a dia;;;11/2026",
  "05/11/2026;Aluguel;1600,00;Moradia;;Conta Corrente;Fixo (conta);;Não;11/2026",
  '12/11/2026;"Assaí; atacado";324,50;Alimentação;Supermercado;Conta Corrente;Dia a dia;;;11/2026',
  "20/11/2026;Geladeira;10,00;;;Nubank;Fixo do cartão;3/10;;12/2026",
  ';"Loja ""X""";-15,00;Transporte;;Conta Corrente;Dia a dia;;;11/2026',
]);
const inc = ex.incomesCsv([
  { id: 1, month: "2026-11", name: "Salário", amountCents: 850000, date: "2026-11-05" },
  { id: 2, month: "2026-11", name: "Pix recebido", amountCents: 2000, date: "2026-11-02" },
]);
assert.deepEqual(inc.slice(1).trimEnd().split("\r\n"), [
  "Data;Descrição;Valor (R$);Mês de referência",
  "02/11/2026;Pix recebido;20,00;11/2026",
  "05/11/2026;Salário;8500,00;11/2026",
]);

// ---------- nome do arquivo ----------
assert.equal(ex.exportFilename("2026-11", "gastos", F({})), "lancamentos-2026-11-dia-a-dia.csv");
assert.equal(ex.exportFilename("2026-11", "gastos", F({ f: "fixos" })), "lancamentos-2026-11-fixos-e-parcelas.csv");
assert.equal(ex.exportFilename("2026-11", "gastos", F({ f: "todos", pm: "2" }), { method: "Crédito Itaú" }), "lancamentos-2026-11-credito-itau.csv");
assert.equal(ex.exportFilename("2026-11", "gastos", F({ cat: "3", q: "Pão de Açúcar" }), { category: "Alimentação" }), "lancamentos-2026-11-alimentacao-busca-pao-de-acucar.csv");
assert.equal(ex.exportFilename("2026-11", "entradas", F({ q: "x" })), "entradas-2026-11.csv");

// ---------- rota /exportar/lancamentos (com o banco) ----------
const db = await setupDb();
const A = "11111111-1111-1111-1111-111111111111";
await db.exec(`insert into auth.users (id) values ('${A}')`);
(globalThis as { __atlasTestClient?: unknown }).__atlasTestClient = fakeSupabase(db, A);
const data = await import("../lib/data");
const methods = await data.listPaymentMethods();
const cats = await data.listCategories();
const food = cats.find((c) => c.name === "Alimentação")!;
const sub = (await data.listSubcategories()).find((s) => s.categoryId === food.id && s.name === "Supermercado")!;
const credit = methods.find((m) => m.isCredit)!;
const conta = methods.find((m) => !m.isCredit)!;
await data.createEntry({ month: "2026-10", kind: "avulso", name: "Assaí", amountCents: 32450, date: "2026-10-03", paymentMethodId: credit.id, categoryId: food.id, subcategoryId: sub.id });
await data.createEntry({ month: "2026-10", kind: "avulso", name: "Uber", amountCents: 2350, date: "2026-10-04", paymentMethodId: conta.id, categoryId: null });
await data.createIncome({ month: "2026-10", name: "Salário", amountCents: 850000, date: "2026-10-05" });

const { GET } = await import("../app/exportar/lancamentos/route");
const { NextRequest } = await import("next/server");
const call = async (qs: string) => {
  const res = await GET(new NextRequest(`http://localhost/exportar/lancamentos?${qs}`));
  return { res, body: await res.text() };
};
{
  const { res, body } = await call(`m=2026-10&f=todos&pm=${credit.id}`);
  assert.equal(res.headers.get("content-type"), "text/csv; charset=utf-8");
  assert.match(res.headers.get("content-disposition")!, /attachment; filename="lancamentos-2026-10-credito\.csv"/);
  const rows = body.replace(/^﻿/, "").trimEnd().split("\r\n");
  assert.equal(rows.length, 2, "só o que passou no crédito");
  assert.equal(rows[1], "03/10/2026;Assaí;324,50;Alimentação;Supermercado;Crédito;Dia a dia;;;10/2026");
}
{
  const { body } = await call("m=2026-10&q=uber");
  const rows = body.replace(/^﻿/, "").trimEnd().split("\r\n");
  assert.deepEqual(rows.slice(1), ["04/10/2026;Uber;23,50;;;Conta Corrente;Dia a dia;;;10/2026"]);
}
{
  const { res, body } = await call("m=2026-10&tab=entradas");
  assert.match(res.headers.get("content-disposition")!, /filename="entradas-2026-10\.csv"/);
  assert.ok(body.includes("05/10/2026;Salário;8500,00;10/2026"));
}

console.log("✓ exportar ok: mesmo filtro da lista, planilha com ; e vírgula decimal, nome do arquivo e a rota com o banco");
