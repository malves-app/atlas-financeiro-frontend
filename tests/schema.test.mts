// Testa o SQL de supabase/migrations num Postgres local (PGlite) que imita o Supabase:
// tabelas, segurança por usuário (RLS) e as funções usadas pelo site.
// Rodar: npm test
import { readFileSync, readdirSync } from "node:fs";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";

const db = await PGlite.create();

// O que o Supabase já tem pronto: schema auth, auth.uid() e os papéis anon/authenticated
await db.exec(`
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role anon nologin;
  create role authenticated nologin;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  grant usage on schema public to anon;
  -- Como no Supabase atual: tabelas novas não recebem acesso automático (o SQL do projeto precisa conceder).
`);

const dir = new URL("../supabase/migrations/", import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const runFile = async (f: string) => {
  await db.exec(readFileSync(new URL(f, dir), "utf8"));
  await db.exec(readFileSync(new URL(f, dir), "utf8")); // rodar duas vezes não pode quebrar
};
const pmIndex = files.findIndex((f) => f.includes("payment_methods"));
for (const f of files.slice(0, pmIndex)) await runFile(f);

const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";
const L = "33333333-3333-3333-3333-333333333333"; // usuário com dados da versão anterior
await db.exec(`insert into auth.users (id) values ('${A}'), ('${B}'), ('${L}')`);

// ---------- conversão dos dados antigos (coluna payment 'conta'/'credito') ----------
await db.exec(`
  insert into public.categories (user_id, name) values ('${L}', 'Uber');
  insert into public.recurring (user_id, kind, name, amount_cents, payment, start_month) values
    ('${L}', 'cartao', 'Netflix', 5990, 'credito', '2026-11'),
    ('${L}', 'fixo', 'Aluguel', 160000, 'conta', '2026-11');
  insert into public.entries (user_id, month, kind, name, amount_cents, payment) values
    ('${L}', '2026-11', 'avulso', 'Uber', 1200, 'credito'),
    ('${L}', '2026-11', 'avulso', 'Padaria', 800, 'conta');
  insert into public.settings (user_id, key, value) values ('${L}', 'closing_day', '24');
`);
for (const f of files.slice(pmIndex)) await runFile(f);

{
  const methods = (await db.query<{ name: string; is_credit: boolean; closing_day: number | null }>(
    `select name, is_credit, closing_day from public.payment_methods where user_id = '${L}' order by sort`,
  )).rows;
  assert.deepEqual(methods, [
    { name: "Conta Corrente", is_credit: false, closing_day: null },
    { name: "Crédito", is_credit: true, closing_day: 24 },
  ]);
  const conv = (await db.query<{ name: string; method: string }>(
    `select e.name, pm.name as method from public.entries e join public.payment_methods pm on pm.id = e.payment_method_id
      where e.user_id = '${L}' union all
     select r.name, pm.name from public.recurring r join public.payment_methods pm on pm.id = r.payment_method_id
      where r.user_id = '${L}' order by 1`,
  )).rows;
  assert.deepEqual(conv.map((c) => `${c.name}:${c.method}`), ["Aluguel:Conta Corrente", "Netflix:Crédito", "Padaria:Conta Corrente", "Uber:Crédito"]);
  const cols = (await db.query<{ column_name: string }>(
    "select column_name from information_schema.columns where table_schema = 'public' and table_name in ('entries','recurring') and column_name = 'payment'",
  )).rows;
  assert.equal(cols.length, 0, "coluna antiga removida");
  assert.equal((await db.query("select 1 from public.settings where key = 'closing_day'")).rows.length, 0);
}

async function as<T>(user: string | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(user ? `set role authenticated; set request.jwt.claim.sub = '${user}';` : `set role anon; set request.jwt.claim.sub = '';`);
  try {
    return await fn();
  } finally {
    await db.exec("reset role; reset request.jwt.claim.sub;");
  }
}
const q = async <T extends object = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows;

// Usuário A cria dados (user_id vem sozinho de auth.uid())
await as(A, async () => {
  const [uber] = await q<{ id: number }>("insert into public.categories (name, emoji) values ('Uber', '🚕') returning id");
  await q("insert into public.categories (name) values ('Restaurante')");
  const [card] = await q<{ id: number }>("insert into public.payment_methods (name, is_credit, closing_day) values ('Nubank', true, 3) returning id");
  await q(
    `insert into public.entries (month, kind, name, amount_cents, date, payment_method_id, category_id) values
      ('2026-10', 'avulso', 'Uber', 1200, '2026-10-05', $2, $1),
      ('2026-10', 'avulso', 'Uber', 900, '2026-10-06', $2, $1),
      ('2026-11', 'avulso', 'uber ', 1500, '2026-11-02', null, null),
      ('2026-11', 'avulso', 'Padaria', 800, '2026-11-02', null, null)`,
    [uber.id, card.id],
  );
  await q("insert into public.incomes (month, name, amount_cents) values ('2026-11', 'Salário', 500000)");
  await q("insert into public.settings (key, value) values ('closing_day', '25') on conflict (user_id, key) do update set value = excluded.value");
  await q("insert into public.settings (key, value) values ('closing_day', '26') on conflict (user_id, key) do update set value = excluded.value");
  await q("insert into public.generated_months (month) values ('2026-11') on conflict do nothing");

  const sugg = await q<{ name: string; category_id: number; payment_method_id: number; uses: number }>("select * from public.fm_suggestions()");
  const uberSugg = sugg.find((s) => s.name.toLowerCase() === "uber")!;
  assert.equal(uberSugg.uses, 3, "Uber usado 3 vezes (ignorando maiúsculas e espaços)");
  assert.equal(Number(uberSugg.category_id), uber.id, "sugestão usa a última categoria preenchida");
  assert.equal(Number(uberSugg.payment_method_id), card.id, "e a forma de pagamento daquele lançamento");

  const usage = await q<{ category_id: number; uses: number }>("select * from public.fm_category_usage('2026-01')");
  assert.deepEqual(usage.map((u) => [Number(u.category_id), u.uses]), [[uber.id, 2]]);

  const [filled] = await q<{ fm_fill_categories: number }>("select public.fm_fill_categories('2026-11')");
  assert.equal(filled.fm_fill_categories, 1, "só o 'uber ' de novembro tem histórico");
  const nov = await q<{ name: string; category_id: number | null }>("select name, category_id from public.entries where month = '2026-11' order by id");
  assert.equal(Number(nov[0].category_id), uber.id);
  assert.equal(nov[1].category_id, null);

  const settings = await q<{ value: string }>("select value from public.settings");
  assert.deepEqual(settings.map((s) => s.value), ["26"]);
});

// Usuário B não vê nem altera nada de A
await as(B, async () => {
  assert.equal((await q("select * from public.entries")).length, 0);
  assert.equal((await q("select * from public.categories")).length, 0);
  assert.equal((await q("select * from public.payment_methods")).length, 0);
  assert.equal((await q("select * from public.fm_suggestions()")).length, 0);
  await q("update public.entries set amount_cents = 1");
  await q("select public.fm_reset_data()");
  await assert.rejects(q(`insert into public.entries (user_id, month, kind, name, amount_cents) values ('${A}', '2026-11', 'avulso', 'x', 1)`));
  await assert.rejects(q(`insert into public.payment_methods (user_id, name) values ('${A}', 'Pix')`));
  // B pode ter uma categoria com o mesmo nome que A
  await q("insert into public.categories (name) values ('Uber')");
});

// Visitante sem login não vê nada
await as(null, async () => {
  await assert.rejects(q("select * from public.entries"), /permission denied/);
  await assert.rejects(q("insert into public.categories (name) values ('x')"), /permission denied/);
  await assert.rejects(q("select * from public.fm_suggestions()"));
});

// Dados de A continuam intactos; reset de A apaga só os dele
await as(A, async () => {
  const rows = await q<{ amount_cents: number }>("select amount_cents from public.entries order by id");
  assert.deepEqual(rows.map((r) => r.amount_cents), [1200, 900, 1500, 800]);
  await q("select public.fm_reset_data()");
  assert.equal((await q("select * from public.entries")).length, 0);
  assert.equal((await q("select * from public.categories")).length, 2, "categorias ficam");
});
assert.equal((await q("select * from public.categories")).length, 4);

console.log("✓ banco ok: tabelas, RLS por usuário e funções fm_*");
process.exit(0);
