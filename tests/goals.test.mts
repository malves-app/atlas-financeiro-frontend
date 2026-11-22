// Teste das metas (lib/goals.ts): status, frases, ano, histórico, impacto de um gasto e o banco
// (tabela goals com RLS, função fm_month_totals e as versões ao mudar o valor).
// Rodar: npm test
import assert from "node:assert/strict";
import { fakeSupabase, setupDb } from "./helpers.mts";

process.env.TZ = "America/Fortaleza";

const g = await import("../lib/goals");
const { goalProgress, goalBoard, goalImpact, goalHints, averages, suggestedValue, findConflict, totalsFromRows, emptyTotals } = g;
type Goal = import("../lib/goals").Goal;
type MonthTotals = import("../lib/goals").MonthTotals;

const nb = (s: string) => s.replace(/ /g, " ");
const cats = new Map([
  [1, { name: "Restaurante", emoji: "🍽️" }],
  [2, { name: "Uber", emoji: "🚕" }],
]);
const T = (month: string, t: Partial<MonthTotals>): [string, MonthTotals] => [month, { ...emptyTotals(month), ...t }];
let nextId = 1;
const goal = (x: Partial<Goal> & Pick<Goal, "kind" | "targetCents">): Goal => ({
  id: nextId++,
  period: "mes",
  categoryId: null,
  startMonth: "2026-01",
  endMonth: null,
  ...x,
});

// ---------- meta do mês, mês atual ----------
{
  const totals = new Map([T("2026-11", { gastos: 620000, avulso: 180000, credito: 300000, entradas: 900000, byCategory: { 1: 42000 } })]);
  const ctx = { month: "2026-11", today: "2026-11-21", totals, categories: cats };

  const rest = goalProgress(goal({ kind: "categoria", categoryId: 1, targetCents: 60000 }), ctx);
  assert.equal(rest.name, "Restaurante");
  assert.equal(rest.phase, "atual");
  assert.equal(rest.value, 42000);
  assert.equal(rest.status, "ok", "70% no dia 21 de 30 (70% do mês): no caminho");
  assert.equal(nb(rest.headline), "Sobram R$ 180");
  assert.equal(nb(rest.detail), "Até R$ 18 por dia nos 10 dias que faltam");

  const fast = goalProgress(goal({ kind: "dia_a_dia", targetCents: 200000 }), { ...ctx, today: "2026-11-10" });
  assert.equal(fast.status, "atencao", "90% do limite do dia a dia: atenção");
  const pace = goalProgress(goal({ kind: "dia_a_dia", targetCents: 300000 }), { ...ctx, today: "2026-11-05" });
  assert.equal(pace.status, "atencao", "60% gasto com 17% do mês: gastando rápido demais");
  const fixed = goalProgress(goal({ kind: "total", targetCents: 1000000 }), { ...ctx, today: "2026-11-05" });
  assert.equal(fixed.status, "ok", "no total os fixos entram desde o começo: sem alerta de ritmo");

  const over = goalProgress(goal({ kind: "cartao", targetCents: 250000 }), ctx);
  assert.equal(over.status, "passou");
  assert.equal(nb(over.headline), "Passou R$ 500");

  const save = goalProgress(goal({ kind: "guardar", targetCents: 300000 }), ctx);
  assert.equal(save.value, 280000, "guardar = entradas − gastos");
  assert.equal(save.status, "atencao");
  assert.equal(nb(save.headline), "Faltam R$ 200");
  assert.equal(nb(save.detail), "Previsão: sobram R$ 2.800 no fim do mês");
}

// ---------- mês passado e futuro ----------
{
  const totals = new Map([T("2026-10", { gastos: 500000, entradas: 400000 }), T("2026-12", { gastos: 150000 })]);
  const lim = goal({ kind: "total", targetCents: 480000 });
  const past = goalProgress(lim, { month: "2026-10", today: "2026-11-21", totals, categories: cats });
  assert.equal(past.status, "nao_cumprida");
  assert.equal(nb(past.detail), "Usou 104% da meta de R$ 4.800");
  const fut = goalProgress(lim, { month: "2026-12", today: "2026-11-21", totals, categories: cats });
  assert.equal(fut.status, "prevista");
  assert.equal(nb(fut.detail), "R$ 1.500 já previsto em fixos e parcelas");
  const red = goalProgress(goal({ kind: "guardar", targetCents: 10000 }), { month: "2026-10", today: "2026-11-21", totals, categories: cats });
  assert.equal(red.status, "nao_cumprida");
  assert.equal(nb(red.detail), "Fechou R$ 1.000 no vermelho");
}

// ---------- meta do ano ----------
{
  const totals = new Map(
    Array.from({ length: 11 }, (_, i) => T(`2026-${String(i + 1).padStart(2, "0")}`, { gastos: 500000, entradas: 600000 })),
  );
  totals.set("2026-12", { ...emptyTotals("2026-12"), gastos: 999999 }); // mês futuro: não entra
  const year = goal({ kind: "total", period: "ano", targetCents: 6000000, startMonth: "2026-01", endMonth: "2026-12" });
  const p = goalProgress(year, { month: "2026-11", today: "2026-11-15", totals, categories: cats });
  assert.equal(p.value, 5500000, "jan a nov (o mês atual pelo previsto)");
  assert.equal(p.months?.length, 12);
  assert.equal(p.months?.[11].value, null, "dezembro ainda não chegou");
  assert.equal(p.status, "atencao", "92% do limite do ano");
  assert.equal(nb(p.detail), "Até R$ 5.000 em dezembro");
  const save = goalProgress(goal({ kind: "guardar", period: "ano", targetCents: 1200000, startMonth: "2026-01", endMonth: "2026-12" }), {
    month: "2026-11",
    today: "2026-11-15",
    totals,
    categories: cats,
  });
  assert.equal(save.value, 1100000);
  assert.equal(save.status, "ok", "guardando no ritmo do ano");
  assert.equal(nb(save.detail), "Guarde R$ 1.000 por mês até dezembro");
}

// ---------- histórico com versões da meta ----------
{
  const v1 = goal({ kind: "categoria", categoryId: 2, targetCents: 20000, startMonth: "2026-06", endMonth: "2026-08" });
  const v2 = goal({ kind: "categoria", categoryId: 2, targetCents: 15000, startMonth: "2026-09" });
  const totals = new Map([
    T("2026-06", { byCategory: { 2: 19000 } }),
    T("2026-07", { byCategory: { 2: 25000 } }),
    T("2026-08", { byCategory: { 2: 18000 } }),
    T("2026-09", { byCategory: { 2: 14000 } }),
    T("2026-10", { byCategory: { 2: 15000 } }),
    T("2026-11", { byCategory: { 2: 3000 } }),
  ]);
  const board = goalBoard([v1, v2], { month: "2026-11", today: "2026-11-21", totals, categories: cats, history: true });
  assert.equal(board.monthly.length, 1, "só a versão que vale em novembro");
  const h = board.monthly[0].history!;
  assert.deepEqual(
    h.map((x) => [x.month, x.ok]),
    [
      ["2026-05", null],
      ["2026-06", true],
      ["2026-07", false],
      ["2026-08", true],
      ["2026-09", true],
      ["2026-10", true],
    ],
    "cada mês com o valor da época (agosto: R$ 180 ≤ R$ 200; setembro: R$ 140 ≤ R$ 150)",
  );
  assert.equal(board.monthly[0].streak, 3);
  assert.ok(findConflict([v1, v2], { kind: "categoria", period: "mes", categoryId: 2, startMonth: "2026-12", endMonth: null }));
  assert.equal(findConflict([v1], { kind: "categoria", period: "mes", categoryId: 2, startMonth: "2026-09", endMonth: null }), null);
  assert.equal(findConflict([v1, v2], { kind: "categoria", period: "mes", categoryId: 1, startMonth: "2026-12", endMonth: null }), null);
}

// ---------- sugestões e impacto de um gasto ----------
{
  const list = [
    { ...emptyTotals("2026-08"), gastos: 300000, entradas: 400000, avulso: 100000, byCategory: { 1: 30000 } },
    { ...emptyTotals("2026-09"), gastos: 400000, entradas: 400000, avulso: 200000, byCategory: { 1: 60000 } },
    { ...emptyTotals("2026-10"), gastos: 500000, entradas: 400000, avulso: 300000, byCategory: {} },
    { ...emptyTotals("2026-11"), gastos: 999999 },
  ];
  const avg = averages(list, "2026-11-21")!;
  assert.equal(avg.total, 400000, "média de ago a out (o mês atual não entra)");
  assert.equal(avg.guardar, 0);
  assert.equal(avg.categories[1], 30000);
  assert.equal(suggestedValue(avg, "dia_a_dia", null, "ano"), 2400000);

  const goals = [
    goal({ kind: "categoria", categoryId: 1, targetCents: 60000, startMonth: "2026-11" }),
    goal({ kind: "total", targetCents: 700000, startMonth: "2026-11" }),
    goal({ kind: "cartao", targetCents: 300000, startMonth: "2026-11" }),
    goal({ kind: "guardar", targetCents: 100000, startMonth: "2026-11" }),
  ];
  const totals = new Map([T("2026-11", { gastos: 650000, credito: 200000, byCategory: { 1: 55000 } })]);
  const hints = goalHints(goals, totals, ["2026-11"], cats);
  assert.equal(hints.length, 3, "guardar não entra no impacto de um gasto");
  const hit = goalImpact(hints, { month: "2026-11", categoryId: 1, onCard: false, avulso: true, delta: 8000 });
  assert.deepEqual(
    hit.map((h) => [h.kind, h.after, h.over]),
    [
      ["categoria", 63000, true],
      ["total", 658000, false],
    ],
    "no débito: a categoria (estourando) e o total; o cartão não",
  );
  assert.equal(goalImpact(hints, { month: "2026-12", categoryId: 1, onCard: true, avulso: true, delta: 8000 }).length, 0);
}

// ---------- banco: tabela, RLS, fm_month_totals e versões ----------
{
  const db = await setupDb();
  const A = "11111111-1111-1111-1111-111111111111";
  const B = "22222222-2222-2222-2222-222222222222";
  await db.exec(`insert into auth.users (id) values ('${A}'), ('${B}')`);
  await db.exec(`
    set role authenticated; set request.jwt.claim.sub = '${A}';
    insert into public.categories (name, emoji, budget_cents) values ('Restaurante', '🍽️', 60000), ('Uber', '🚕', null);
    insert into public.payment_methods (name, is_credit, closing_day) values ('Conta', false, null), ('Nubank', true, 3);
    insert into public.entries (month, kind, name, amount_cents) values ('2026-10', 'avulso', 'Café', 500);
    reset role; reset request.jwt.claim.sub;
  `);
  // O "previsto" das categorias que já existia vira meta mensal (rodando a migração das metas de novo)
  const { readFileSync, readdirSync } = await import("node:fs");
  const dir = new URL("../supabase/migrations/", import.meta.url);
  const file = readdirSync(dir).find((f) => f.endsWith("_goals.sql"))!;
  await db.exec(readFileSync(new URL(file, dir), "utf8"));
  await db.exec(readFileSync(new URL(file, dir), "utf8"));
  const moved = (await db.query<{ kind: string; target_cents: number }>(`select kind, target_cents from public.goals where user_id = '${A}'`)).rows;
  assert.deepEqual(moved, [{ kind: "categoria", target_cents: 60000 }], "previsto da categoria vira meta, uma vez só");
  const [{ start_month }] = (await db.query<{ start_month: string }>(`select start_month from public.goals`)).rows;
  assert.equal(start_month, "2026-10", "vale desde o primeiro mês com lançamentos");
  assert.equal((await db.query(`select 1 from public.categories where budget_cents is not null`)).rows.length, 0);

  const gl = globalThis as { __atlasTestClient?: unknown };
  gl.__atlasTestClient = fakeSupabase(db, A);
  const data = await import("../lib/data");
  const [rest, uber] = await data.listCategories();
  const methods = await data.listPaymentMethods();
  const conta = methods.find((m) => !m.isCredit)!;
  const card = methods.find((m) => m.isCredit)!;
  await data.createEntry({ month: "2026-11", kind: "avulso", name: "Pizza", amountCents: 9000, date: "2026-11-02", paymentMethodId: card.id, categoryId: rest.id });
  await data.createEntry({ month: "2026-11", kind: "avulso", name: "Uber", amountCents: 2000, date: "2026-11-03", paymentMethodId: conta.id, categoryId: uber.id });
  await data.createEntry({ month: "2026-11", kind: "fixo", name: "Aluguel", amountCents: 150000, date: "2026-11-05", paymentMethodId: conta.id, categoryId: null });
  await data.createEntry({ month: "2026-10", kind: "avulso", name: "Uber", amountCents: 1500, date: "2026-10-03", paymentMethodId: null, categoryId: uber.id });
  await data.createIncome({ month: "2026-11", name: "Salário", amountCents: 500000, date: null });

  const totals = await data.getMonthTotals("2026-10", "2026-11");
  const nov = totals.get("2026-11")!;
  assert.deepEqual(
    { gastos: nov.gastos, avulso: nov.avulso, credito: nov.credito, entradas: nov.entradas, rest: nov.byCategory[rest.id], uber: nov.byCategory[uber.id] },
    { gastos: 161000, avulso: 11000, credito: 9000, entradas: 500000, rest: 9000, uber: 2000 },
  );
  const summary = await data.getMonth("2026-11");
  assert.deepEqual(data.monthTotalsOf(summary), { ...nov, byCategory: { [rest.id]: 9000, [uber.id]: 2000 } }, "igual ao getMonth");

  // Mudar o valor a partir de dezembro cria uma versão nova; novembro continua com o valor antigo
  const [migrated] = await data.listGoals();
  await data.updateGoal(migrated.id, 50000, "2026-12");
  let goals = await data.listGoals();
  assert.deepEqual(
    goals.map((x) => [x.startMonth, x.endMonth, x.targetCents]),
    [
      ["2026-10", "2026-11", 60000],
      ["2026-12", null, 50000],
    ],
  );
  // Encerrar a partir de dezembro apaga a versão que começa nele
  await data.endGoal(goals[1].id, "2026-12");
  goals = await data.listGoals();
  assert.equal(goals.length, 1);
  await data.createGoal({ kind: "guardar", period: "ano", categoryId: null, targetCents: 1000000, startMonth: "2026-01", endMonth: "2026-12" });
  assert.equal((await data.listGoals()).length, 2);

  // B não vê as metas de A nem os totais
  await db.exec(`set role authenticated; set request.jwt.claim.sub = '${B}';`);
  assert.equal((await db.query("select * from public.goals")).rows.length, 0);
  assert.equal((await db.query("select * from public.fm_month_totals('2026-01', '2026-12')")).rows.length, 0);
  await assert.rejects(db.query(`insert into public.goals (user_id, kind, target_cents, start_month) values ('${A}', 'total', 1, '2026-11')`));
  await db.exec("reset role; reset request.jwt.claim.sub;");
  // Meta de categoria precisa da categoria; meta do ano precisa do fim
  await db.exec(`set role authenticated; set request.jwt.claim.sub = '${A}';`);
  await assert.rejects(db.query(`insert into public.goals (kind, target_cents, start_month) values ('categoria', 100, '2026-11')`));
  await assert.rejects(db.query(`insert into public.goals (kind, period, target_cents, start_month) values ('total', 'ano', 100, '2026-01')`));
  await assert.rejects(db.query(`insert into public.goals (kind, target_cents, start_month) values ('total', 0, '2026-11')`));
  await db.exec("reset role; reset request.jwt.claim.sub;");
  // Visitante sem login
  await db.exec("set role anon;");
  await assert.rejects(db.query("select * from public.goals"), /permission denied/);
  await db.exec("reset role;");

  assert.equal(totalsFromRows([{ month: "2026-01", kind: "entrada", category_id: null, on_card: false, total: "5" }]).get("2026-01")!.entradas, 5);
}

console.log("✓ metas ok: status, frases, ano, histórico com versões, impacto de um gasto, banco com RLS");
process.exit(0);
