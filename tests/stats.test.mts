// Teste das estatísticas: cálculos (média, mediana, desvio, tendência...) e a leitura paginada no banco.
// Rodar: npm test
import assert from "node:assert/strict";
import { fakeSupabase, setupDb } from "./helpers.mts";

process.env.TZ = "America/Fortaleza";

const { computeStats, periodMonths } = await import("../lib/stats");
const { currentMonth, shiftMonth } = await import("../lib/format");

// ---------- períodos ----------
assert.equal(periodMonths({ kind: "ano", year: 2026 }, "2026-11").length, 11, "ano atual vai até o mês atual");
assert.deepEqual(periodMonths({ kind: "ano", year: 2025 }, "2026-11").slice(0, 2), ["2025-01", "2025-02"]);
assert.equal(periodMonths({ kind: "ano", year: 2025 }, "2026-11").length, 12);
assert.deepEqual(periodMonths({ kind: "12m" }, "2026-11")[0], "2025-12");
assert.equal(periodMonths({ kind: "12m" }, "2026-11").length, 12);
assert.deepEqual(periodMonths({ kind: "ano", year: 2027 }, "2026-11"), [], "ano futuro fica vazio");

// ---------- cálculos ----------
{
  let id = 0;
  const e = (month: string, kind: "fixo" | "cartao" | "avulso", name: string, amountCents: number, date: string | null = null, categoryId: number | null = 1, paymentMethodId: number | null = 1) => ({
    id: ++id,
    month,
    kind,
    name,
    amountCents,
    date,
    categoryId,
    paymentMethodId,
  });
  const entries = [
    // janeiro: 1.000 + 500 = 1.500
    e("2026-01", "fixo", "Aluguel", 100000, "2026-01-05", 2),
    e("2026-01", "avulso", "Mercado", 50000, "2026-01-03"), // sábado
    // fevereiro: 1.000 + 300 + 700 = 2.000
    e("2026-02", "fixo", "Aluguel", 100000, "2026-02-05", 2),
    e("2026-02", "cartao", "Netflix", 30000, null, 3, 2),
    e("2026-02", "avulso", "mercado ", 70000, "2026-02-07"), // sábado
    // março: 1.000 + 1.500 = 2.500, e um estorno de −100
    e("2026-03", "fixo", "Aluguel", 100000, "2026-03-05", 2),
    e("2026-03", "avulso", "Viagem", 150000, "2026-03-02", null), // segunda
    e("2026-03", "avulso", "Estorno", -10000, "2026-03-04", null),
    // abril (em andamento): 200
    e("2026-04", "avulso", "Mercado", 20000, "2026-04-02"),
  ];
  const incomes = [
    { month: "2026-01", name: "Salário (01)", amountCents: 300000 },
    { month: "2026-02", name: "Salário(02)", amountCents: 300000 },
    { month: "2026-03", name: "Salário", amountCents: 200000 },
    { month: "2026-03", name: "Freela", amountCents: 20000 },
  ];
  const s = computeStats({ months: ["2026-01", "2026-02", "2026-03", "2026-04"], entries, incomes, today: "2026-04-10" });

  assert.deepEqual(
    s.monthly.map((r) => r.gastos),
    [150000, 200000, 240000, 20000],
  );
  assert.equal(s.monthly[3].partial, true, "o mês atual é parcial");
  assert.equal(s.totals.gastos, 610000);
  assert.equal(s.totals.entradas, 820000);
  assert.equal(s.totals.saldo, 210000);
  assert.equal(Math.round(s.totals.savingsRate! * 1000), 256);
  // média, mediana e extremos só com os meses completos
  assert.equal(s.spend.basis, 3);
  assert.equal(s.spend.mean, 196667);
  assert.equal(s.spend.median, 200000);
  assert.equal(s.spend.stdev, 45092); // desvio padrão amostral de 1500, 2000, 2400
  assert.deepEqual(s.spend.max, { month: "2026-03", value: 240000 });
  assert.deepEqual(s.spend.min, { month: "2026-01", value: 150000 });
  assert.equal(s.spend.trendPerMonth, 45000, "tendência: +450 por mês");
  assert.deepEqual(s.cumulative, [150000, 250000, 230000, 210000]);
  assert.deepEqual(s.negativeMonths, ["2026-03"]);
  // composição
  assert.equal(s.monthly[1].fixo + s.monthly[1].cartao + s.monthly[1].avulso, s.monthly[1].gastos);
  // categorias: sem categoria também entra, e a média é por mês do período
  assert.equal(s.byCategory[0].categoryId, 2);
  assert.equal(s.byCategory[0].total, 300000);
  assert.equal(s.byCategory[0].monthlyAvg, 75000);
  assert.equal(s.byCategory.find((c) => c.categoryId == null)!.total, 140000);
  assert.equal(s.byPayment.find((p) => p.paymentMethodId === 2)!.total, 30000);
  // "Mercado" e "mercado " são o mesmo lugar
  const mercado = s.topNames.find((t) => t.name === "Mercado")!;
  assert.equal(mercado.count, 3);
  assert.equal(mercado.total, 140000);
  assert.equal(mercado.avg, 46667);
  assert.equal(s.topNames[0].name, "Viagem");
  // maiores gastos: só o dia a dia
  assert.deepEqual(
    s.biggest.slice(0, 2).map((x) => x.name),
    ["Viagem", "mercado "],
  );
  // dia da semana (0 = domingo)
  assert.equal(s.weekday[6].total, 120000, "sábado");
  assert.equal(s.weekday[6].count, 2);
  assert.equal(s.weekday[1].total, 150000, "segunda");
  // dia a dia por dia: 31 + 28 + 31 + 10 dias
  assert.equal(s.dayToDayDays, 100);
  assert.equal(s.dailyAvg, 2800);
  // entradas: "Salário (01)" e "Salário(02)" juntam com "Salário"
  assert.deepEqual(s.incomeSources[0], { name: "Salário", total: 800000, count: 3 });
}

// Meses antes do primeiro lançamento ficam de fora
{
  const s = computeStats({
    months: ["2025-12", "2026-01", "2026-02"],
    entries: [{ id: 1, month: "2026-01", kind: "avulso", name: "X", amountCents: 1000, date: "2026-01-02", categoryId: null, paymentMethodId: null }],
    incomes: [{ month: "2026-02", name: "Y", amountCents: 5000 }],
    today: "2026-02-10",
  });
  assert.deepEqual(s.months, ["2026-01", "2026-02"]);
  assert.equal(s.dayToDayDays, 31 + 10);
}

// Sem dados
{
  const s = computeStats({ months: ["2026-01"], entries: [], incomes: [], today: "2026-02-01" });
  assert.equal(s.totals.savingsRate, null);
  assert.equal(s.spend.mean, 0);
  assert.equal(s.topNames.length, 0);
}

// ---------- leitura no banco: mais de 1000 linhas, só do período e só do usuário ----------
const db = await setupDb();
const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";
await db.exec(`insert into auth.users (id, email) values ('${A}', 'a@x.com'), ('${B}', 'b@x.com');`);
const now = currentMonth();
const year = now.slice(0, 4);
const inYear = `${year}-01`;
const lastYear = `${Number(year) - 1}-06`;
await db.query(
  `insert into public.entries (user_id, month, kind, name, amount_cents, date)
   select $1, $2, 'avulso', 'Café', 100, $3 from generate_series(1, 2350)`,
  [A, inYear, `${inYear}-15`],
);
await db.query(`insert into public.entries (user_id, month, kind, name, amount_cents) values ($1, $2, 'avulso', 'Ano passado', 99999)`, [A, lastYear]);
await db.query(`insert into public.entries (user_id, month, kind, name, amount_cents) values ($1, $2, 'fixo', 'Futuro', 77777)`, [A, shiftMonth(now, 2)]);
await db.query(`insert into public.entries (user_id, month, kind, name, amount_cents) values ($1, $2, 'avulso', 'Outra pessoa', 55555)`, [B, inYear]);
await db.query(`insert into public.incomes (user_id, month, name, amount_cents) values ($1, $2, 'Salário', 500000)`, [A, inYear]);

const g = globalThis as { __atlasTestClient?: unknown };
g.__atlasTestClient = fakeSupabase(db, A);
const { loadStats, loadLookups } = await import("../lib/stats");

const yearStats = await loadStats({ kind: "ano", year: Number(year) });
assert.equal(yearStats.totals.gastos, 235000, "todas as 2350 linhas, sem o ano passado, o futuro ou outra pessoa");
assert.equal(yearStats.topNames[0].count, 2350);
assert.equal(yearStats.totals.entradas, 500000);
const prev = await loadStats({ kind: "ano", year: Number(year) - 1 });
assert.equal(prev.totals.gastos, 99999);
const lookups = await loadLookups();
assert.equal(lookups.firstYear, Number(year) - 1);

console.log(`✓ estatísticas ok: médias, tendência e ${yearStats.topNames[0].count} lançamentos lidos em páginas`);
process.exit(0);
