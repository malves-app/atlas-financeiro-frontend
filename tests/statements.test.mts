// Conferir com o banco (27/11/2026): leitura da fatura (PDF) e do extrato (CSV) do Santander, a comparação com o
// Atlas e as correções. Os arquivos aqui são inventados (o repositório é público): mesmo desenho, dados de mentira.
// Rodar: npm test
import assert from "node:assert/strict";
import { fakeSupabase, setupDb } from "./helpers.mts";

process.env.TZ = "America/Fortaleza";

const sa = await import("../lib/statements/santander");
const cmp = await import("../lib/statements/compare");
const sg = await import("../lib/statements/suggest");
const banks = await import("../lib/statements/banks");
const { pdfPages } = await import("../lib/statements/pdf");
type PdfPage = import("../lib/statements/santander").PdfPage;
type EntryLite = import("../lib/statements/compare").EntryLite;

/* ---------- números e nomes ---------- */

assert.equal(sa.moneyCents("1.234,56"), 123456);
assert.equal(sa.moneyCents("-8.579,32"), -857932);
assert.equal(sa.moneyCents("0,00"), 0);
assert.equal(sa.moneyCents("1000,00"), 100000);
assert.equal(sa.moneyCents("R$ 5,8003"), null, "cotação com 4 casas não é valor");
assert.equal(sa.moneyCents("03/12"), null);

assert.equal(sa.merchantName("UBER UBER *TRIP HELP U"), "Uber");
assert.equal(sa.merchantName("DL *UBERRIDES"), "Uber");
assert.equal(sa.merchantName("IFD*PADARIA EXEMPLO AL"), "iFood");
assert.equal(sa.merchantName("PG *TEC CONCURSOS TECC"), "Tec Concursos Tecc");
assert.equal(sa.merchantName("MP *ESTACIONAMENTO X"), "Estacionamento");
assert.equal(sa.merchantName("LOJA EXEMPLO LTDA"), "Loja Exemplo");
assert.equal(sa.merchantName("COMERCIO DE PECAS"), "Comercio de Pecas");
assert.equal(sa.merchantName("RP COMERCIO DE"), "Rp Comercio", "não termina em 'de'");
assert.equal(sa.merchantName("IOF DESPESA NO EXTERIOR"), "IOF");
assert.equal(sa.merchantName("ACADEMIA EXEMPLO POS"), "Academia Exemplo", "sem o POS da maquininha");
assert.equal(sa.merchantName("LOJA ESPORTE CE249"), "Loja Esporte", "sem o código da loja");
assert.equal(sa.merchantName("EC *MP*HBOMAXASSIN"), "HBO Max");
assert.equal(sa.merchantName("BMB *ENERGISA"), "Energisa");
assert.equal(sa.extratoName({ counterpart: "Fulana dos santos silva", kind: "Pix enviado" }), "Fulana dos Santos");
assert.equal(sa.extratoName({ counterpart: "Empresa exemplo ltda", kind: "Pix enviado" }), "Empresa Exemplo");
assert.equal(sa.extratoName({ counterpart: null, kind: "Resgate cdb/rdb" }), "Resgate cdb/rdb");

/* ---------- extrato (CSV) ---------- */

const CSV = [
  "Extrato de conta corrente",
  "Nome;Fulano",
  "Agência;0001",
  "Conta;01.000000.0",
  "Período do extrato;20/11/2026 a 26/11/2026",
  "",
  "Lançamentos:",
  "Data;Descrição;Valor;Saldo",
  '26/11/2026;"Pix enviado\nLoja de software ltda";-40,32;562,37',
  "26/11/2026;Resgate cdb/rdb;1000,00;618,69",
  '25/11/2026;"Pagamento de boleto outros bancos\nPlano de saude coop";-542,00;-371,31',
  '25/11/2026;"Pagamento de boleto outros bancos\nCondominio do edificio co";-472,23;170,69',
  '23/11/2026;"Pix enviado\nFulano de tal souza";-116,71;642,92',
  '23/11/2026;"Pix enviado\nMaria diarista silva";-150,00;759,63',
  '22/11/2026;"Pix recebido\nEmpresa pagadora sa";5.000,00;909,63',
  '21/11/2026;"Pix enviado\nPadaria do bairro";-12,00;0,00',
  "",
].join("\r\n");
const ext = sa.parseSantanderExtrato(CSV);
assert.deepEqual([ext.holder, ext.agency, ext.from, ext.to, ext.lines.length], ["Fulano", "0001", "2026-11-20", "2026-11-26", 8]);
assert.deepEqual(
  [ext.lines[0].date, ext.lines[0].kind, ext.lines[0].counterpart, ext.lines[0].amountCents, ext.lines[0].balanceCents],
  ["2026-11-26", "Pix enviado", "Loja de software ltda", -4032, 56237],
);
assert.equal(ext.lines[1].counterpart, null);
assert.equal(ext.lines[6].amountCents, 500000, "milhar com ponto");
assert.throws(() => sa.parseSantanderExtrato("qualquer;coisa\n1;2"), /lista de lançamentos/);
assert.equal(sa.decodeText(new Uint8Array([0x50, 0x65, 0x72, 0xed, 0x6f, 0x64, 0x6f])), "Período", "Latin-1 quando não é UTF-8");

/* ---------- fatura (PDF): o desenho do Santander com dados inventados ---------- */

// Monta as páginas como o pdf.js devolve: pedaços de texto com x (esquerda) e y (de cima para baixo).
// Duas colunas: a da direita começa 294 pontos depois. Dentro da coluna: data+descrição em 33, parcela em 168,
// R$ em ~205, US$ em ~240.
type It = { s: string; x: number; y: number };
const W = 595.3;
const page = (items: It[]): PdfPage => ({ width: W, height: 841.9, items: items.map((i) => ({ ...i, w: i.s.length * 3 })) });
let y = 0;
function col(off: number, rows: (string | [string, string?, string?, string?])[], start: number): It[] {
  y = start;
  const out: It[] = [];
  for (const r of rows) {
    y += 11.5;
    if (typeof r === "string") out.push({ s: r, x: off + 10, y });
    else {
      const [desc, parc, brl, usd] = r;
      out.push({ s: "2", x: off + 16, y: y + 1 }); // ícone (contactless/@): ignorado
      out.push({ s: desc, x: off + 33, y });
      if (parc) out.push({ s: parc, x: off + 168, y });
      if (brl) out.push({ s: brl, x: off + 226 - brl.length * 3, y });
      if (usd) out.push({ s: usd, x: off + 241, y });
    }
  }
  return out;
}
const p1 = page([
  { s: "Total a Pagar", x: 313, y: 81 },
  { s: "Vencimento", x: 412, y: 81 },
  { s: "R$ 999,99", x: 304, y: 94 },
  { s: "02/12/2026", x: 401, y: 94 },
  { s: "Vencimento", x: 412, y: 700 }, // o do boleto, mais embaixo
  { s: "15/01/2030", x: 401, y: 712 },
  { s: "NOV.", x: 289, y: 225 },
  { s: "Fatura Anterior", x: 421, y: 224 },
  { s: "26/09/26 a 26/10/26", x: 503, y: 224 },
  { s: "DEZ.", x: 291, y: 242 },
  { s: "R$ 999,99", x: 345, y: 241 },
  { s: "Esta Fatura", x: 421, y: 241 },
  { s: "27/10/26 a 25/11/26", x: 503, y: 241 },
]);
const p2 = page([
  { s: "INFORMAMOS QUE SEU CONTRATO SERA ALTERADO", x: 300, y: 68 }, // aviso no alto, antes do detalhamento
  { s: "Detalhamento da Fatura", x: 14, y: 305 },
  ...col(
    0,
    [
      "FULANO TESTE - 5480 XXXX XXXX 1111",
      "Pagamento e Demais Créditos",
      "Compra Data Descrição Parcela R$ US$",
      ["03/11 PAGAMENTO DE FATURA-INTERNET", undefined, "-500,00"],
      "Despesas",
      "Compra Data Descrição Parcela R$ US$",
      ["02/11 IFD*IFOOD CLUB", undefined, "12,90"],
      ["25/11 ANUIDADE DIFERENCIADA", "03/12", "0,00"],
      "VALOR TOTAL",
      "@ CICLANA TESTE - 5480 XXXX XXXX 2222",
      "Parcelamentos",
      ["28/09 LOJA DE VIAGEM", "02/10", "300,00"],
      "Despesas",
      ["26/10 UBER UBER *TRIP HELP U", undefined, "11,96"],
      ["30/10 SHOPEE *LOJA", undefined, "50,00"],
    ],
    312,
  ),
  ...col(
    294,
    [
      ["06/11 MERCADO EXEMPLO", undefined, "175,90"],
      ["12/11 UBER UBER *TRIP HELP U", undefined, "10,00"],
      ["13/11 DL", undefined, "12,98"],
      ["20/11 PADARIA EXEMPLO", undefined, "15,16"],
    ],
    312,
  ),
]);
// "*UBERRIDES" num pedaço separado, como no PDF de verdade
p2.items.push({ s: "*UBERRIDES", x: 294 + 70, y: p2.items.find((i) => i.s === "13/11 DL")!.y, w: 30 });
const p3 = page([
  { s: "Detalhamento da Fatura", x: 14, y: 60 },
  ...col(
    0,
    [
      "@ FULANO TESTE - 5480 XXXX XXXX 3333",
      "Despesas",
      ["03/11 SHOPEE*DEVOLVIDO", undefined, "-32,64"],
      ["03/11 ANTHROPIC* CLAUDE SUB", undefined, "117,28", "20,22"],
      "COTAÇÃO DOLAR R$ 5,8003",
      ["IOF DESPESA NO EXTERIOR", undefined, "4,10"],
      "VALOR TOTAL",
      "Resumo da Fatura",
      "Descrição R$ US$",
    ],
    70,
  ),
]);
// IOF: sem data (o pedaço começa em 33 como texto comum, sem "dd/mm")
// Resumo: rótulo + valor
const resumo: [string, string][] = [
  ["Saldo Anterior", "500,00"],
  ["(+) Total Despesas/Débitos no Brasil", "593,00"],
  ["(+) Total Despesas/Débitos no Exterior", "117,28"],
  ["(-) Total de pagamentos", "500,00"],
  ["(-) Total de créditos", "32,64"],
  ["(=) Saldo Desta Fatura", "677,64"],
];
for (const [label, v] of resumo) {
  y += 11.5;
  p3.items.push({ s: label, x: 45, y, w: label.length * 3 }, { s: v, x: 226 - v.length * 3, y, w: 15 });
}
y += 30;
p3.items.push({ s: "Saldo total consolidado de obrigações futuras", x: 10, y, w: 120 });
y += 12;
p3.items.push({ s: "Compras parceladas", x: 45, y, w: 40 }, { s: "9.999,99", x: 200, y, w: 15 });

const fat = sa.parseSantanderFatura([p1, p2, p3]);
assert.deepEqual([fat.periodFrom, fat.closing, fat.due], ["2026-10-27", "2026-11-25", "2026-12-02"], "período e vencimento do topo");
assert.equal(fat.lines.length, 13);
assert.deepEqual(fat.cards.map((c) => [c.card, c.holder]), [["1111", "FULANO TESTE"], ["2222", "CICLANA TESTE"], ["3333", "FULANO TESTE"]]);
const L = (d: string) => fat.lines.find((l) => l.description.startsWith(d))!;
assert.deepEqual([L("PAGAMENTO").kind, L("PAGAMENTO").amountCents], ["pagamento", -50000]);
assert.deepEqual([L("LOJA DE VIAGEM").date, L("LOJA DE VIAGEM").installment, L("LOJA DE VIAGEM").section], ["2026-09-28", { no: 2, total: 10 }, "parcelamentos"]);
assert.equal(L("ANUIDADE").installment?.total, 12);
assert.equal(L("DL").description, "DL *UBERRIDES", "descrição em dois pedaços");
assert.equal(L("DL").card, "2222", "a coluna da direita continua o cartão da esquerda");
assert.deepEqual([L("ANTHROPIC").usdCents, L("IOF").amountCents, L("IOF").date], [2022, 410, "2026-11-03"]);
assert.deepEqual([L("SHOPEE*DEVOLVIDO").kind, L("SHOPEE*DEVOLVIDO").amountCents], ["credito", -3264]);
assert.equal(L("UBER").date, "2026-10-26");
assert.deepEqual(fat.summary, { previous: 50000, debits: 71028, credits: 3264, payments: 50000, total: 67764 });
assert.equal(fat.check.ok, true, fat.check.message ?? "");
// Uma linha a menos: o resumo não fecha e avisa
{
  const cut = { ...p2, items: p2.items.filter((i) => i.s !== "175,90") };
  const bad = sa.parseSantanderFatura([p1, cut, p3]);
  assert.equal(bad.check.ok, false);
  assert.match(bad.check.message!, /despesas lidas/);
}
assert.throws(() => sa.parseSantanderFatura([page([{ s: "qualquer coisa", x: 10, y: 10 }])]), /período/);
// Mesmas linhas repetidas ganham chaves diferentes
{
  const twice = page([
    { s: "Detalhamento da Fatura", x: 14, y: 40 },
    ...col(0, ["FULANO - 5480 XXXX XXXX 9999", "Pagamento e Demais Créditos", ["13/03 ACADEMIA", undefined, "-178,00"], ["13/03 ACADEMIA", undefined, "-178,00"]], 40),
  ]);
  const f = sa.parseSantanderFatura([p1, twice]);
  assert.equal(new Set(f.lines.map((l) => l.key)).size, 2);
  assert.equal(f.lines[0].date, "2026-03-13", "março: do ano do fechamento");
}

// O mesmo desenho num PDF de verdade, lido pelo pdf.js
function makePdf(pages: PdfPage[]): Uint8Array {
  const objs: string[] = [];
  const add = (s: string) => objs.push(s) && objs.length;
  const catalog = add("");
  const pagesObj = add("");
  const font = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const kids: number[] = [];
  const esc = (s: string) => s.replace(/[\\()]/g, (c) => `\\${c}`);
  for (const pg of pages) {
    const ops = pg.items.map((i) => `BT /F1 6 Tf 1 0 0 1 ${i.x.toFixed(2)} ${(pg.height - i.y).toFixed(2)} Tm (${esc(i.s)}) Tj ET`).join("\n");
    const content = add(`<< /Length ${Buffer.byteLength(ops, "latin1")} >>\nstream\n${ops}\nendstream`);
    kids.push(add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${pg.width} ${pg.height}] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${content} 0 R >>`));
  }
  objs[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
  objs[pagesObj - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(" ")}] /Count ${kids.length} >>`;
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(Buffer.byteLength(out, "latin1"));
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Uint8Array(Buffer.from(out, "latin1"));
}
{
  const read = await pdfPages(makePdf([p1, p2, p3]));
  assert.equal(read.length, 3);
  const f = sa.parseSantanderFatura(read);
  assert.equal(f.lines.length, 13, "o pdf.js devolve as posições que o leitor espera");
  assert.equal(f.check.ok, true, f.check.message ?? "");
  assert.deepEqual(f.summary, fat.summary);
}

/* ---------- comparar a fatura com o Atlas ---------- */

const CARD = 10;
const PIX = 20;
const methods = [
  { id: CARD, name: "Santander", isCredit: true, icon: "credito" },
  { id: PIX, name: "Pix", isCredit: false, icon: "pix" },
  { id: 30, name: "Conta Santander", isCredit: false, icon: "conta" },
  { id: 40, name: "Dinheiro", isCredit: false, icon: "dinheiro" },
];
// Categorias da pessoa (como as padrão: Alimentação › Padaria...)
const categories = [
  { id: 1, name: "Alimentação", subs: [{ id: 2, name: "Padaria" }, { id: 4, name: "Supermercado" }] },
  { id: 3, name: "Transporte", subs: [{ id: 5, name: "Aplicativo" }] },
  { id: 6, name: "Outros", subs: [] },
];
let eid = 0;
const E = (o: Partial<EntryLite>): EntryLite => ({
  id: ++eid,
  month: "2026-11",
  kind: "avulso",
  name: "?",
  amountCents: 100,
  date: "2026-11-10",
  paymentMethodId: CARD,
  categoryId: null,
  subcategoryId: null,
  paid: null,
  installmentNo: null,
  installmentTotal: null,
  recurringId: null,
  ...o,
});
{
  const ifood = E({ name: "iFood", amountCents: 1290, date: "2026-11-02" });
  const viagem = E({ kind: "cartao", name: "Passagem", amountCents: 30000, date: "2026-11-28", installmentNo: 2, installmentTotal: 10, recurringId: 5 });
  const uber1 = E({ name: "Uber", amountCents: 1196, date: "2026-10-26", month: "2026-10" }); // mês errado
  const mercado = E({ name: "Mercado Exemplo", amountCents: 17950, date: "2026-11-06" }); // valor diferente
  const shopee = E({ name: "Shopee", amountCents: 5000, date: "2026-10-30", paymentMethodId: PIX }); // outra forma
  const dup1 = E({ name: "Uber", amountCents: 1000, date: "2026-11-12" });
  const dup2 = E({ name: "Uber", amountCents: 1000, date: "2026-11-12" }); // duplicado
  const sobra = E({ name: "Farmácia", amountCents: 4500, date: "2026-11-15" }); // não veio
  const depois = E({ name: "Netflix", amountCents: 5590, date: "2026-11-28", kind: "cartao", recurringId: 9 }); // depois do fechamento
  const outroMes = E({ name: "Cinema", amountCents: 3000, date: "2026-12-03", month: "2026-12" }); // de dezembro: fica quieto
  const r = cmp.compareFatura({
    fatura: fat,
    methodId: CARD,
    methods,
    entries: [ifood, viagem, uber1, mercado, shopee, dup1, dup2, sobra, depois, outroMes],
    hints: [
      { name: "Padaria", categoryId: 1, subcategoryId: 2 },
      { name: "Uber", categoryId: 3, subcategoryId: null },
    ],
    categories,
  });
  const by = (t: string) => r.issues.find((i) => i.title.startsWith(t) || i.title === t);
  assert.deepEqual(r.skipped.map((s) => s.reason), ["Pagamento da fatura anterior"]);
  assert.ok(!r.issues.some((i) => i.title.startsWith("ANUIDADE")), "linha de R$ 0,00 não conta");
  assert.ok(r.matched.some((m) => m.entryName === "iFood"));
  assert.ok(r.matched.some((m) => m.entryName === "Passagem"), "parcela pelo número, não pela data");
  assert.ok(r.matched.some((m) => m.entryName === "Uber" && m.amountCents === 1000));

  const uberOut = r.issues.find((i) => i.title === "UBER UBER *TRIP HELP U")!;
  assert.deepEqual([uberOut.type, uberOut.fix], ["mes", { kind: "mes", entryId: uber1.id, month: "2026-11" }]);
  assert.deepEqual(by("MERCADO EXEMPLO")?.fix, { kind: "valor", entryId: mercado.id, amountCents: 17590 });
  assert.deepEqual(by("SHOPEE *LOJA")?.fix, { kind: "forma", entryId: shopee.id, paymentMethodId: CARD, month: "2026-11" });
  const pad = by("PADARIA EXEMPLO")!;
  assert.equal(pad.type, "faltando");
  assert.deepEqual(pad.fix, {
    kind: "criar",
    name: "Padaria Exemplo",
    categoryId: 1,
    subcategoryId: 2,
    month: "2026-11",
    date: "2026-11-20",
    amountCents: 1516,
    paymentMethodId: CARD,
    installment: null,
    source: "loja",
    ruleKey: sg.ruleKey("cartao", pad.title),
  });
  const uberEats = by("DL *UBERRIDES")!;
  assert.deepEqual([uberEats.type, (uberEats.fix as { name: string }).name, (uberEats.fix as { categoryId: number }).categoryId], ["faltando", "Uber", 3]);
  assert.equal((uberEats.fix as { source: string }).source, "historico", "mesmo nome já usado no Atlas");
  assert.equal(uberEats.detail, "Cartão 2222 · Ciclana");
  const estorno = by("SHOPEE*DEVOLVIDO")!;
  assert.deepEqual([estorno.type, estorno.fix.kind, (estorno.fix as { amountCents: number }).amountCents], ["faltando", "criar", -3264]);
  assert.equal((by("IOF DESPESA")!.fix as { name: string }).name, "IOF");
  // IOF: a pessoa não tem "Taxas e impostos": vai para Outros, marcado como incerto
  assert.deepEqual([(by("IOF DESPESA")!.fix as { categoryId: number }).categoryId, (by("IOF DESPESA")!.fix as { source: string }).source], [6, "outros"]);
  assert.equal(by("IOF DESPESA")!.safe, false, "categoria não reconhecida fica fora do Aprovar tudo");
  // O que bateu ensina: o iFood lançado sem categoria não ensina; o Uber de 12/11 (com categoria) ensina
  assert.ok(!r.learned.some((l) => l.name === "iFood"));
  assert.deepEqual([by("Uber")?.type, by("Uber")?.fix, by("Uber")?.safe], ["duplicado", { kind: "excluir", entryId: dup2.id }, false]);
  assert.deepEqual([by("Farmácia")?.type, by("Farmácia")?.safe], ["sobrando", false]);
  assert.deepEqual(by("Netflix")?.fix, { kind: "mes", entryId: depois.id, month: "2026-12" });
  assert.ok(!r.issues.some((i) => i.title === "Cinema"));
  assert.equal(r.bankCents, 71028 - 3264, "compras menos créditos, sem o pagamento");
  // Ignorar some da lista
  const r2 = cmp.compareFatura({ fatura: fat, methodId: CARD, methods, entries: [], hints: [], ignored: [r.issues[0].key] });
  assert.equal(r2.ignored, 1);
  assert.ok(!r2.issues.some((i) => i.key === r.issues[0].key));
  // Parcela que falta: vira parcelado a partir da parcela da fatura
  const parc = r2.issues.find((i) => i.title === "LOJA DE VIAGEM")!;
  assert.deepEqual((parc.fix as { installment: unknown }).installment, { no: 2, total: 10 });
}

/* ---------- comparar o extrato com o Atlas ---------- */
{
  const loja = E({ name: "Loja de software", amountCents: 4032, date: "2026-11-26", paymentMethodId: PIX });
  const plano = E({ kind: "fixo", name: "Plano de saúde", amountCents: 54200, date: "2026-11-25", paymentMethodId: 30, paid: false, recurringId: 1 });
  const cond = E({ kind: "fixo", name: "Condomínio", amountCents: 45000, date: "2026-11-20", paymentMethodId: 30, paid: true, recurringId: 2 });
  const diarista = E({ name: "Diarista", amountCents: 15000, date: "2026-11-23", paymentMethodId: CARD }); // lançado no cartão
  const cafe = E({ name: "Café", amountCents: 800, date: "2026-11-24", paymentMethodId: PIX }); // não saiu
  const dinheiro = E({ name: "Feira", amountCents: 3000, date: "2026-11-24", paymentMethodId: 40 }); // dinheiro: fora
  const luzPaga = E({ kind: "fixo", name: "Luz", amountCents: 18000, date: "2026-11-21", paymentMethodId: 30, paid: true, recurringId: 3 });
  const r = cmp.compareExtrato({
    extrato: ext,
    methodId: 30,
    methods,
    entries: [loja, plano, cond, diarista, cafe, dinheiro, luzPaga],
    incomes: [],
    hints: [{ name: "Padaria", categoryId: 1, subcategoryId: null }],
    categories,
  });
  const by = (t: string) => r.issues.find((i) => i.title.includes(t));
  assert.deepEqual(r.skipped.map((s) => s.reason).sort(), ["Aplicação ou resgate", "Transferência para você"]);
  assert.ok(r.matched.some((m) => m.entryName === "Loja de software"), "Pix lançado com a forma Pix");
  assert.deepEqual(by("Plano de saude")?.fix, { kind: "pago", entryId: plano.id, paid: true }, "conta fixa que saiu: marcar como paga");
  assert.deepEqual(by("Condominio")?.fix, { kind: "valor", entryId: cond.id, amountCents: 47223 });
  assert.deepEqual(by("Maria diarista")?.fix, { kind: "forma", entryId: diarista.id, paymentMethodId: 30, month: "2026-11" });
  const padaria = by("Padaria do bairro")!;
  assert.deepEqual(
    [padaria.type, (padaria.fix as { name: string }).name, (padaria.fix as { categoryId: number }).categoryId, (padaria.fix as { subcategoryId: number }).subcategoryId],
    ["faltando", "Padaria do Bairro", 1, 2],
  );
  const salario = by("Empresa pagadora")!;
  assert.deepEqual(salario.fix, {
    kind: "criar-entrada",
    name: "Empresa Pagadora",
    month: "2026-11",
    date: "2026-11-22",
    amountCents: 500000,
    ruleKey: "entrada:empresa pagadora",
  });
  assert.deepEqual([by("Café")?.type, by("Café")?.safe], ["sobrando", false]);
  assert.deepEqual([by("Luz")?.type, by("Luz")?.fix], ["nao-pago", { kind: "pago", entryId: luzPaga.id, paid: false }]);
  assert.ok(!r.issues.some((i) => i.title === "Feira"), "dinheiro não passa pela conta");
  // Entrada já lançada
  const r2 = cmp.compareExtrato({
    extrato: ext,
    methodId: 30,
    methods,
    entries: [],
    incomes: [{ id: 1, month: "2026-11", name: "Salário", amountCents: 500000, date: "2026-11-22" }],
    hints: [],
  });
  assert.ok(r2.matched.some((m) => m.entryName === "Salário"));
  assert.ok(r2.learned.some((l) => l.key === "entrada:empresa pagadora" && l.name === "Salário"), "a entrada que bateu ensina o nome");
}

/* ---------- sugestão de nome e categoria ---------- */
{
  assert.equal(sg.ruleKey("cartao", "IFD*49 237 511 DAVI GA"), "cartao:ifd davi ga");
  assert.equal(sg.ruleKey("cartao", "UBER UBER *TRIP HELP U"), "cartao:uber uber trip help");
  assert.equal(sg.ruleKey("conta", "Empresa exemplo ltda"), "conta:empresa exemplo");

  // Categorias padrão de conta nova
  const { DEFAULT_CATEGORIES } = await import("../lib/category-icons");
  let n = 0;
  const std = DEFAULT_CATEGORIES.map((c) => ({ id: ++n, name: c.name, subs: c.subs.map((x) => ({ id: ++n, name: x.name })) }));
  const nameOf = (r: { categoryId: number | null; subcategoryId: number | null } | null) => {
    if (!r || r.categoryId == null) return null;
    const c = std.find((x) => x.id === r.categoryId)!;
    const sub = c.subs.find((x) => x.id === r.subcategoryId);
    return sub ? `${c.name} › ${sub.name}` : c.name;
  };
  const cases: [string, string][] = [
    ["IFD*WMS SUPERMERCADOS", "Alimentação › Delivery"],
    ["CARREFOUR EXEMPLO", "Alimentação › Supermercado"],
    ["MERCADOLIVRE*LOJA", "Compras"],
    ["MERCADOLIVRE*MERCADOL Mercado Livre", "Compras"],
    ["MERCADO DO BAIRRO", "Alimentação › Supermercado"],
    ["POSTO EXEMPLO", "Transporte › Combustível"],
    ["UBER UBER *TRIP HELP U", "Transporte › Aplicativo"],
    ["MP *CGESTACIONAME", "Transporte › Estacionamento"],
    ["PIZZA EXEMPLO", "Alimentação › Restaurante"],
    ["PADARIA E LANCHONETE", "Alimentação › Padaria"],
    ["SORVETERIA EXEMPLO", "Alimentação › Lanches"],
    ["ACADEMIA EXEMPLO GYM", "Cuidados pessoais › Academia"],
    ["DROGARIA EXEMPLO", "Saúde › Farmácia"],
    ["NETFLIX ENTRETENIMENTO", "Assinaturas › Streaming"],
    ["AMAZON PRIME BR", "Assinaturas › Streaming"],
    ["APPLE COM/BILL", "Assinaturas › Apps"],
    ["BMB *ENERGISA", "Moradia › Energia"],
    ["Pagamento de boleto Condominio do edificio", "Moradia › Condomínio"],
    ["IOF DESPESA NO EXTERIOR", "Taxas e impostos › Impostos"],
    ["ANUIDADE DIFERENCIADA", "Taxas e impostos › Tarifas bancárias"],
    ["PG *CURSOS CONCURSOS", "Educação › Cursos"],
    ["CINEMA EXEMPLO", "Lazer › Cinema e shows"],
    ["COMBO EXEMPLO TURISMO", "Viagem › Passeios"],
    ["ESTETICA LASER", "Cuidados pessoais › Beleza"],
  ];
  for (const [text, want] of cases) assert.equal(nameOf(sg.storeCategory(text, std)), want, text);
  assert.equal(sg.storeCategory("LOJA DESCONHECIDA", std), null);
  // Quem ainda tem as categorias da planilha (soltas): "Supermercado" e "Uber" são categorias
  const flat = [
    { id: 1, name: "Supermercado", subs: [] },
    { id: 2, name: "Uber", subs: [] },
    { id: 3, name: "Lazer", subs: [] },
  ];
  assert.deepEqual(sg.storeCategory("ATACADAO EXEMPLO", flat), { categoryId: 1, subcategoryId: null });
  assert.deepEqual(sg.storeCategory("DL *UBERRIDES", flat), { categoryId: 2, subcategoryId: null });
  assert.equal(sg.storeCategory("POSTO EXEMPLO", flat), null, "sem categoria parecida: não chuta");

  // Ordem: regra > mesmo nome no histórico > loja > histórico parecido > Outros
  const base = { key: "cartao:loja x", bankText: "LOJA X", name: "Loja X", hints: [], categories: std, rules: new Map() };
  const outros = std.find((c) => c.name === "Outros")!;
  assert.deepEqual(sg.suggest(base), { name: "Loja X", categoryId: outros.id, subcategoryId: null, source: "outros" });
  assert.equal(sg.suggest({ ...base, categories: [] }).source, "nenhuma");
  const lazer = std.find((c) => c.name === "Lazer")!;
  const rule = { key: "cartao:loja x", name: "Presente da Ana", categoryId: lazer.id, subcategoryId: null };
  assert.deepEqual(sg.suggest({ ...base, rules: new Map([[rule.key, rule]]) }), { name: "Presente da Ana", categoryId: lazer.id, subcategoryId: null, source: "regra" });
  const gone = { ...rule, categoryId: 9999 };
  assert.equal(sg.suggest({ ...base, rules: new Map([[gone.key, gone]]) }).name, "Presente da Ana", "categoria apagada: o nome ainda vale");
  const hist = [{ name: "Loja X", categoryId: lazer.id, subcategoryId: null }];
  assert.equal(sg.suggest({ ...base, hints: hist }).source, "historico");
  const posto = { ...base, bankText: "POSTO X", name: "Posto X", hints: [{ name: "Posto", categoryId: lazer.id, subcategoryId: null }] };
  assert.equal(nameOf(sg.suggest(posto)), "Transporte › Combustível", "a loja vale mais que um nome parecido");
}

/* ---------- o que bateu ensina a lançar o que falta ---------- */
{
  const two = {
    ...fat,
    lines: [
      { ...fat.lines[0], key: "u#1", date: "2026-11-05", description: "PADARIA DO ZE", amountCents: 1200, kind: "gasto" as const, installment: null, section: "despesas" as const },
      { ...fat.lines[0], key: "u#2", date: "2026-11-09", description: "PADARIA DO ZE", amountCents: 900, kind: "gasto" as const, installment: null, section: "despesas" as const },
    ],
  };
  // Lançada como "Pão" em Lazer (do jeito da pessoa): a outra vem igual, não como a loja sugeriria
  const pao = E({ name: "Pão", amountCents: 1200, date: "2026-11-05", categoryId: 3, subcategoryId: null });
  const r = cmp.compareFatura({ fatura: two, methodId: CARD, methods, entries: [pao], hints: [], categories });
  assert.equal(r.matched.length, 1);
  const miss = r.issues.find((i) => i.type === "faltando")!.fix as { name: string; categoryId: number; source: string };
  assert.deepEqual([miss.name, miss.categoryId, miss.source], ["Pão", 3, "regra"]);
  assert.deepEqual(r.learned, [{ key: "cartao:padaria ze", name: "Pão", categoryId: 3, subcategoryId: null }]);
}

/* ---------- banco: guardar, comparar, corrigir ---------- */

const { currentMonth, shiftMonth } = await import("../lib/format");
const db = await setupDb();
const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";
await db.exec(`insert into auth.users (id) values ('${A}'), ('${B}')`);
const g = globalThis as { __atlasTestClient?: unknown };
g.__atlasTestClient = fakeSupabase(db, A);
const data = await import("../lib/data");
const st = await import("../lib/statements/data");

const M = currentMonth();
const d = (day: number, m = M) => `${m}-${String(day).padStart(2, "0")}`;
const ms = await data.listPaymentMethods();
const credito = ms.find((m) => m.isCredit)!;
const conta = ms.find((m) => !m.isCredit)!;
const cats = await data.listCategories();
const transporte = cats.find((c) => c.name === "Transporte")!;

// Uma fatura que fecha neste mês
const closing = d(25);
const fatura = {
  ...fat,
  periodFrom: d(1),
  closing,
  lines: [
    { ...fat.lines[0], key: "a#1", date: d(3), description: "PAGAMENTO DE FATURA-INTERNET", amountCents: -50000, kind: "pagamento" as const, installment: null },
    { ...fat.lines[0], key: "b#1", date: d(5), description: "UBER UBER *TRIP HELP U", amountCents: 2390, kind: "gasto" as const, installment: null, section: "despesas" as const },
    { ...fat.lines[0], key: "c#1", date: d(6), description: "MERCADO EXEMPLO", amountCents: 17590, kind: "gasto" as const, installment: null, section: "despesas" as const },
    { ...fat.lines[0], key: "e#1", date: d(20, shiftMonth(M, -2)), description: "LOJA DE ROUPAS PARCELADA", amountCents: 10000, kind: "gasto" as const, installment: { no: 3, total: 5 }, section: "parcelamentos" as const },
  ],
};
await data.createEntry({ month: M, kind: "avulso", name: "Mercado Exemplo", amountCents: 17950, date: d(6), paymentMethodId: credito.id, categoryId: null });
await data.createEntry({ month: M, kind: "avulso", name: "Farmácia", amountCents: 4500, date: d(9), paymentMethodId: credito.id, categoryId: null });
await data.createEntry({ month: shiftMonth(M, -1), kind: "avulso", name: "Uber", amountCents: 1800, date: d(2, shiftMonth(M, -1)), paymentMethodId: credito.id, categoryId: transporte.id });

const id = await st.saveImport({ kind: "fatura", bank: "santander", paymentMethodId: credito.id, fileName: "fatura.pdf", data: fatura });
assert.equal(await st.saveImport({ kind: "fatura", bank: "santander", paymentMethodId: credito.id, fileName: "de novo.pdf", data: fatura }), id, "mesma fatura substitui");
// RLS: outra pessoa não vê; não dá para usar a forma de pagamento de outra pessoa
{
  await db.exec(`set role authenticated; set request.jwt.claim.sub = '${B}';`);
  const seen = (await db.query<{ n: number }>("select count(*)::int as n from public.statement_imports")).rows[0].n;
  let blocked = false;
  try {
    await db.query(`insert into public.statement_imports (kind, payment_method_id, period_from, period_to, data) values ('extrato', ${credito.id}, '2026-01-01', '2026-01-02', '{}')`);
  } catch {
    blocked = true;
  }
  await db.exec("reset role; reset request.jwt.claim.sub;");
  assert.equal(seen, 0);
  assert.ok(blocked, "forma de pagamento de outra pessoa");
}

let imp = (await st.getImport(id))!;
assert.equal(imp.month, M);
assert.equal(imp.bank, "santander");
assert.equal(imp.fileName, "de novo.pdf");
let rep = (await st.loadReport(imp)).report;
const keyOf = (t: string) => rep.issues.find((i) => i.title === t)!.key;
assert.deepEqual(rep.issues.map((i) => [i.type, i.title]).sort(), [
  ["faltando", "LOJA DE ROUPAS PARCELADA"],
  ["faltando", "UBER UBER *TRIP HELP U"],
  ["sobrando", "Farmácia"],
  ["valor", "MERCADO EXEMPLO"],
].sort());
assert.equal((rep.issues.find((i) => i.title === "UBER UBER *TRIP HELP U")!.fix as { categoryId: number }).categoryId, transporte.id, "categoria pelo histórico");

// Corrigir um com nome editado; ignorar outro; "Corrigir tudo" faz o resto (sem excluir)
await st.fixIssue(id, keyOf("UBER UBER *TRIP HELP U"), { name: "Uber (trabalho)", categoryId: transporte.id, subcategoryId: null });
await assert.rejects(st.fixIssue(id, "l:nao-existe"), /já foi corrigido/);
await st.ignoreIssue(id, keyOf("Farmácia"));
imp = (await st.getImport(id))!;
rep = (await st.loadReport(imp)).report;
assert.equal(rep.ignored, 1);
assert.deepEqual(rep.issues.map((i) => i.title).sort(), ["LOJA DE ROUPAS PARCELADA", "MERCADO EXEMPLO"]);
const all = await st.fixAll(id);
assert.deepEqual(all, { done: 2, failed: [] });
rep = (await st.loadReport((await st.getImport(id))!)).report;
assert.equal(rep.issues.length, 0, "tudo certo depois de corrigir");
assert.equal(rep.bankCents, rep.atlasCents + 0 - 4500, "a farmácia ignorada continua no Atlas");
{
  // Aprovar com o nome mudado: a próxima linha igual do banco já vem assim
  const rules = await st.listRules();
  assert.deepEqual(
    rules.find((r) => r.key === "cartao:uber uber trip help"),
    { key: "cartao:uber uber trip help", name: "Uber (trabalho)", categoryId: transporte.id, subcategoryId: null },
  );
  assert.ok(rules.some((r) => r.key === "cartao:loja roupas parcelada" && r.name === "Loja de Roupas"), "Aprovar tudo também lembra");
  const next = { ...fatura, lines: [{ ...fatura.lines[1], key: "n#1", date: d(8), amountCents: 1500 }] };
  const r = cmp.compareFatura({ fatura: next, methodId: credito.id, methods: [], entries: [], hints: [], rules, categories: data.withSubcategories(cats, await data.listSubcategories()) });
  const f = r.issues[0].fix as { name: string; categoryId: number; source: string };
  assert.deepEqual([f.name, f.categoryId, f.source], ["Uber (trabalho)", transporte.id, "regra"]);
  // RLS: as regras são de cada um
  await db.exec(`set role authenticated; set request.jwt.claim.sub = '${B}';`);
  const seen = (await db.query<{ n: number }>("select count(*)::int as n from public.statement_rules")).rows[0].n;
  await db.exec("reset role; reset request.jwt.claim.sub;");
  assert.equal(seen, 0);
}
{
  const rows = (await db.query<Record<string, unknown>>(`select * from public.entries where user_id = '${A}' and month = '${M}' order by id`)).rows;
  assert.ok(rows.some((r) => r.name === "Uber (trabalho)" && r.amount_cents === 2390 && r.category_id === transporte.id && r.payment_method_id === credito.id));
  assert.equal(rows.find((r) => r.name === "Mercado Exemplo")!.amount_cents, 17590);
  assert.ok(rows.some((r) => r.name === "Loja de Roupas" && r.installment_no === 3 && r.installment_total === 5 && r.amount_cents === 10000));
  const before = (await db.query<{ n: number }>(`select count(*)::int as n from public.entries where name = 'Loja de Roupas' and month < '${M}'`)).rows[0].n;
  assert.equal(before, 0, "parcelas antes desta não são criadas");
  const rec = (await db.query<Record<string, unknown>>(`select * from public.recurring where name = 'Loja de Roupas'`)).rows[0];
  assert.deepEqual([rec.kind, rec.installments, rec.start_month], ["cartao", 5, shiftMonth(M, -2)]);
}
await st.unignoreAll(id);
rep = (await st.loadReport((await st.getImport(id))!)).report;
assert.deepEqual(rep.issues.map((i) => i.title), ["Farmácia"]);

// Extrato: conta fixa paga pelo extrato e entrada nova
await data.createRecurring({ kind: "fixo", name: "Aluguel", amountCents: 150000, day: 5, paymentMethodId: conta.id, categoryId: null, installments: null, startMonth: M });
await data.ensureMonthGenerated(M);
const extrato = {
  ...ext,
  from: d(1),
  to: d(20),
  holder: "Fulano",
  lines: [
    { key: "x#1", date: d(5), kind: "Pix enviado", counterpart: "Imobiliaria exemplo", description: "Pix enviado · Imobiliaria exemplo", amountCents: -150000, balanceCents: null },
    { key: "y#1", date: d(10), kind: "Pix recebido", counterpart: "Cliente bom", description: "Pix recebido · Cliente bom", amountCents: 80000, balanceCents: null },
  ],
};
const eid2 = await st.saveImport({ kind: "extrato", bank: "santander", paymentMethodId: conta.id, fileName: "extrato.csv", data: extrato });
rep = (await st.loadReport((await st.getImport(eid2))!)).report;
assert.deepEqual(rep.issues.map((i) => [i.type, i.fix.kind]).sort(), [["faltando", "criar-entrada"], ["pagar", "pago"]]);
await st.fixAll(eid2);
rep = (await st.loadReport((await st.getImport(eid2))!)).report;
assert.equal(rep.issues.length, 0);
assert.equal((await db.query<{ paid: boolean }>(`select paid from public.entries where name = 'Aluguel' and month = '${M}'`)).rows[0].paid, true);
assert.equal((await db.query<{ n: number }>(`select count(*)::int as n from public.incomes where name = 'Cliente Bom' and amount_cents = 80000`)).rows[0].n, 1);
assert.equal((await st.listImports("extrato")).length, 1);
// Enviar de novo: o que bateu (Aluguel pela imobiliária, entrada do cliente) vira regra
await st.learnFromImport(eid2);
{
  const rules = await st.listRules();
  assert.ok(rules.some((r) => r.key === "entrada:cliente bom" && r.name === "Cliente Bom"));
}
// Leitor por banco: banco que ainda não lemos dá um aviso claro
await assert.rejects(banks.readStatement("nubank", "fatura", new Uint8Array([1])), /só Santander/);
await assert.rejects(banks.readStatement("santander", "fatura", new TextEncoder().encode("não é pdf")), /PDF/);
assert.equal(banks.statementBank("santander")?.name, "Santander");
await st.deleteImport(eid2);
assert.equal((await st.listImports("extrato")).length, 0);

console.log("✓ conferir com o banco ok: extrato CSV, fatura PDF (duas colunas, cartões, parcelas, IOF, resumo), comparação, sugestão de nome e categoria (regras, histórico, loja), aprovações e RLS");
