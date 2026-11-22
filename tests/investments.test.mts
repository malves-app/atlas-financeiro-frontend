// Teste dos investimentos (lib/investments.ts): saldo, aplicado, rendimento, histórico, evolução mês a mês,
// o mês atual e a visão geral; e o banco (tabelas investments/investment_moves com RLS e dono garantido).
// Rodar: npm test
import assert from "node:assert/strict";
import { fakeSupabase, setupDb } from "./helpers.mts";

process.env.TZ = "America/Fortaleza";

const {
  position,
  history,
  monthlySeries,
  monthChange,
  portfolio,
  holdingOf,
  institutionsOf,
  signedBRL,
  signedPercent,
  agoText,
  daysBetween,
} = await import("../lib/investments");
type Move = import("../lib/investments").Move;
type Investment = import("../lib/investments").Investment;

const nb = (s: string) => s.replace(/\u00a0/g, " ");
let nextId = 1;
const mv = (investmentId: number, kind: Move["kind"], amountCents: number, date: string, note: string | null = null): Move => ({
  id: nextId++,
  investmentId,
  kind,
  amountCents,
  date,
  note,
});
const inv = (id: number, x: Partial<Investment> = {}): Investment => ({
  id,
  name: `Inv ${id}`,
  kind: "renda_fixa",
  institution: null,
  targetCents: null,
  archived: false,
  ...x,
});

// ---------- um investimento ----------
const cdb = [
  mv(1, "aporte", 100000, "2026-01-10", "Valor inicial"),
  mv(1, "saldo", 105000, "2026-02-28"),
  mv(1, "aporte", 50000, "2026-03-05"),
  mv(1, "resgate", 20000, "2026-03-20"),
  mv(1, "saldo", 140000, "2026-04-30"),
];
{
  const p = position(cdb);
  assert.equal(p.balance, 140000, "último saldo conferido");
  assert.equal(p.invested, 130000, "aportes − resgates");
  assert.equal(p.deposits, 150000);
  assert.equal(p.withdrawals, 20000);
  assert.equal(p.gain, 10000, "saldo − aplicado");
  assert.equal(p.gainRatio, 10000 / 130000);
  assert.deepEqual([p.firstDate, p.lastDate, p.count], ["2026-01-10", "2026-04-30", 5]);

  // Até uma data
  assert.equal(position(cdb, "2026-03-05").balance, 155000, "saldo conferido + aporte depois dele");
  assert.equal(position(cdb, "2026-03-20").balance, 135000);
  assert.equal(position(cdb, "2026-01-09").balance, 0, "antes do primeiro registro");

  // A ordem em que chegam não importa (data, depois a ordem de registro)
  assert.deepEqual(position([...cdb].reverse()), p);

  // No mesmo dia: o que foi registrado depois vale por último
  const sameDay = [mv(9, "aporte", 1000, "2026-05-01"), mv(9, "saldo", 1200, "2026-05-01"), mv(9, "aporte", 300, "2026-05-01")];
  assert.equal(position(sameDay).balance, 1500);
  assert.equal(position(sameDay).gain, 200);

  // Vários investimentos juntos: a atualização de saldo de um não mexe no outro
  assert.equal(position([...sameDay, mv(7, "aporte", 500, "2026-04-01"), mv(7, "saldo", 450, "2026-05-02")]).balance, 1500 + 450);

  // Tirou mais do que colocou (sacou o rendimento): sem porcentagem
  const sacou = position([mv(8, "aporte", 1000, "2026-01-01"), mv(8, "saldo", 1300, "2026-06-01"), mv(8, "resgate", 1300, "2026-06-02")]);
  assert.deepEqual([sacou.balance, sacou.invested, sacou.gain, sacou.gainRatio], [0, -300, 300, null]);

  // Histórico: mais recente primeiro, com o saldo depois de cada registro e o rendimento das atualizações
  const h = history(cdb);
  assert.deepEqual(
    h.map((r) => [r.move.date, r.before, r.after, r.yieldCents]),
    [
      ["2026-04-30", 135000, 140000, 5000],
      ["2026-03-20", 155000, 135000, null],
      ["2026-03-05", 105000, 155000, null],
      ["2026-02-28", 100000, 105000, 5000],
      ["2026-01-10", 0, 100000, null],
    ],
  );

  // Evolução: fim de cada mês, e o mês atual até hoje
  assert.deepEqual(
    monthlySeries(cdb, "2026-05-15").map((s) => [s.month, s.balance, s.invested]),
    [
      ["2026-01", 100000, 100000],
      ["2026-02", 105000, 100000],
      ["2026-03", 135000, 130000],
      ["2026-04", 140000, 130000],
      ["2026-05", 140000, 130000],
    ],
  );
  assert.deepEqual(
    monthlySeries(cdb, "2026-05-15", 3).map((s) => s.month),
    ["2026-03", "2026-04", "2026-05"],
    "no máximo N meses",
  );
  assert.deepEqual(monthlySeries([], "2026-05-15"), []);

  // O mês atual: entrou 500 − 200 e não houve atualização de saldo (rendimento 0)
  assert.deepEqual(monthChange(cdb, "2026-03-25"), { start: 105000, change: 30000, flow: 30000, yieldCents: 0, updates: 0 });
  assert.deepEqual(monthChange(cdb, "2026-04-30"), { start: 135000, change: 5000, flow: 0, yieldCents: 5000, updates: 1 });
}

// ---------- visão geral ----------
{
  const today = "2026-05-15";
  const investments = [
    inv(1, { name: "CDB", kind: "renda_fixa", targetCents: 200000 }),
    inv(2, { name: "Bitcoin", kind: "cripto", institution: "Corretora X" }),
    inv(3, { name: "Caixinha", kind: "caixinha", institution: "Banco Y" }),
    inv(4, { name: "Antigo", kind: "acoes", archived: true }),
    inv(5, { name: "Vazio", kind: "outro" }),
  ];
  const moves = [
    ...cdb,
    mv(2, "aporte", 30000, "2026-04-01"),
    mv(2, "saldo", 24000, "2026-05-10"),
    mv(3, "aporte", 60000, "2026-05-02"),
    mv(4, "aporte", 10000, "2026-01-05"),
    mv(4, "resgate", 10000, "2026-03-01", "Encerramento"),
    mv(99, "aporte", 777, "2026-05-01"), // de um investimento que não está na lista: ignorado
  ];
  const p = portfolio(investments, moves, today);
  assert.deepEqual(
    p.holdings.map((h) => h.investment.name),
    ["CDB", "Caixinha", "Bitcoin", "Vazio"],
    "maior saldo primeiro",
  );
  assert.deepEqual(p.closed.map((h) => h.investment.name), ["Antigo"]);
  assert.equal(p.total.balance, 140000 + 24000 + 60000);
  assert.equal(p.total.invested, 130000 + 30000 + 60000);
  assert.equal(p.total.gain, 10000 - 6000);
  assert.deepEqual(
    p.allocation.map((a) => [a.kind, a.balance, Math.round(a.ratio * 1000)]),
    [
      ["caixinha", 60000, 268],
      ["renda_fixa", 140000, 625],
      ["cripto", 24000, 107],
    ],
    "ordem fixa dos tipos; sem saldo fica de fora",
  );
  // Mês de maio: aplicou 600 na caixinha; o bitcoin caiu 60
  assert.deepEqual(p.month, { start: 170000, change: 54000, flow: 60000, yieldCents: -6000, updates: 1 });
  assert.equal(p.series[0].month, "2026-01");
  assert.equal(p.series.at(-1)!.balance, p.total.balance, "o último ponto é o total de hoje");
  assert.equal(p.series.find((s) => s.month === "2026-02")!.balance, 105000 + 10000, "o encerrado conta enquanto existiu");

  // Saldo parado há mais de 30 dias: pede atualização
  const cdbHolding = p.holdings.find((h) => h.investment.id === 1)!;
  assert.equal(cdbHolding.daysSince, 15);
  assert.equal(cdbHolding.stale, false);
  assert.equal(holdingOf(investments[0], cdb, "2026-06-15").stale, true);
  assert.equal(holdingOf(investments[4], [], today).daysSince, null);
}

// ---------- textos ----------
assert.equal(nb(signedBRL(12345)), "+R$ 123,45");
assert.equal(nb(signedBRL(-8000)), "−R$ 80,00");
assert.equal(nb(signedBRL(0)), "R$ 0,00");
assert.equal(signedPercent(0.0523), "+5,2%");
assert.equal(signedPercent(-0.013), "−1,3%");
assert.equal(signedPercent(0.0001), "0%");
assert.equal(signedPercent(1.5), "+150%");
assert.deepEqual([0, 1, 5, 44, 60, 400, 800].map(agoText), ["hoje", "ontem", "há 5 dias", "há 44 dias", "há 2 meses", "há mais de 1 ano", "há mais de 2 anos"]);
assert.equal(daysBetween("2026-02-27", "2026-03-01"), 2);
assert.deepEqual(
  institutionsOf([{ institution: "Banco Y" }, { institution: " banco y " }, { institution: null }, { institution: "Corretora X" }, { institution: "" }]),
  ["Banco Y", "Corretora X"],
);

// ---------- banco ----------
{
  const db = await setupDb();
  const A = "11111111-1111-1111-1111-111111111111";
  const B = "22222222-2222-2222-2222-222222222222";
  await db.exec(`insert into auth.users (id) values ('${A}'), ('${B}')`);
  const gl = globalThis as { __atlasTestClient?: unknown };
  gl.__atlasTestClient = fakeSupabase(db, A);
  const data = await import("../lib/investments-data");

  const id = await data.createInvestment({ name: "Caixinha", kind: "caixinha", institution: "Banco Y", targetCents: 1000000 });
  const btc = await data.createInvestment({ name: "Bitcoin", kind: "cripto", institution: null, targetCents: null });
  await data.createMove({ investmentId: id, kind: "aporte", amountCents: 50000, date: "2026-11-02", note: "Valor inicial" });
  await data.createMove({ investmentId: id, kind: "saldo", amountCents: 50400, date: "2026-11-20", note: null });
  await data.createMove({ investmentId: id, kind: "aporte", amountCents: 10000, date: "2026-11-10", note: null });
  await data.createMove({ investmentId: btc, kind: "aporte", amountCents: 20000, date: "2026-11-05", note: null });

  const list = await data.listInvestments();
  assert.deepEqual(
    list.map((i) => [i.name, i.kind, i.institution, i.targetCents, i.archived]),
    [
      ["Caixinha", "caixinha", "Banco Y", 1000000, false],
      ["Bitcoin", "cripto", null, null, false],
    ],
  );
  const moves = await data.listMoves(id);
  assert.deepEqual(moves.map((m) => m.date), ["2026-11-02", "2026-11-10", "2026-11-20"], "em ordem de data");
  assert.equal(position(moves).balance, 50400);
  assert.equal((await data.listMoves()).length, 4, "todas as movimentações");

  await data.updateInvestment(id, { name: "Reserva", kind: "caixinha", institution: null, targetCents: null });
  assert.deepEqual(await data.getInvestment(id), { id, name: "Reserva", kind: "caixinha", institution: null, targetCents: null, archived: false });
  await data.setInvestmentArchived(id, true);
  assert.equal((await data.getInvestment(id))!.archived, true);
  await data.deleteMove(moves[1].id);
  assert.equal((await data.listMoves(id)).length, 2);
  assert.equal(await data.getInvestment(123456), null);

  // B não vê nada de A e não consegue lançar num investimento de A
  await db.exec(`set role authenticated; set request.jwt.claim.sub = '${B}';`);
  assert.equal((await db.query("select * from public.investments")).rows.length, 0);
  assert.equal((await db.query("select * from public.investment_moves")).rows.length, 0);
  await assert.rejects(db.query(`insert into public.investment_moves (investment_id, kind, amount_cents, date) values (${btc}, 'aporte', 100, '2026-11-01')`));
  await assert.rejects(db.query(`insert into public.investments (user_id, name) values ('${A}', 'Invasão')`));
  assert.equal((await db.query(`update public.investments set name = 'x' where id = ${btc} returning id`)).rows.length, 0);
  await db.exec("reset role; reset request.jwt.claim.sub;");

  // Regras dos valores
  await db.exec(`set role authenticated; set request.jwt.claim.sub = '${A}';`);
  const ins = (kind: string, amount: number, date = "2026-11-01") =>
    db.query(`insert into public.investment_moves (investment_id, kind, amount_cents, date) values (${btc}, '${kind}', ${amount}, '${date}')`);
  await assert.rejects(ins("aporte", 0), "aporte precisa de valor");
  await assert.rejects(ins("resgate", -5));
  await assert.rejects(ins("rendimento", 100), "tipo desconhecido");
  await assert.rejects(ins("aporte", 100, "01/11/2026"), "data no formato AAAA-MM-DD");
  await ins("saldo", 0); // saldo zerado é permitido
  await assert.rejects(db.query(`insert into public.investments (name, kind) values ('  ', 'cripto')`), "nome vazio");
  await assert.rejects(db.query(`insert into public.investments (name, kind) values ('X', 'imovel')`), "tipo desconhecido");
  await db.exec("reset role; reset request.jwt.claim.sub;");

  // Apagar o investimento leva as movimentações junto
  await data.deleteInvestment(btc);
  assert.equal((await data.listMoves()).length, 2);
  assert.equal((await db.query(`select * from public.investment_moves where investment_id = ${btc}`)).rows.length, 0);

  // Visitante sem login
  await db.exec("set role anon;");
  await assert.rejects(db.query("select * from public.investments"), /permission denied/);
  await assert.rejects(db.query("select * from public.investment_moves"), /permission denied/);
  await db.exec("reset role;");
}

console.log("✓ investimentos ok: saldo, aplicado, rendimento, histórico, evolução, mês, visão geral, banco com RLS");
process.exit(0);
