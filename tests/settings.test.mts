// Configurações (26/11/2026): subcategorias (banco, RLS, lançamento, fixos, sugestões e histórico),
// formas de pagamento com tipo e banco, categorias padrão de uma conta nova e o seletor de ícones.
// Rodar: npm test
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fakeSupabase, setupDb } from "./helpers.mts";

process.env.TZ = "America/Fortaleza";

const { guessBank, guessPaymentType, bankById, paymentType, methodColor } = await import("../lib/payment-icons");
const { searchCategoryIcons, ALL_CATEGORY_ICONS, suggestedSubcategories, DEFAULT_CATEGORIES, guessCategoryIcon } = await import("../lib/category-icons");

// ---------- tipo e banco pelo nome ----------
assert.equal(guessBank("Crédito Nubank"), "nubank");
assert.equal(guessBank("Itaú conta"), "itau");
assert.equal(guessBank("Banco do Brasil"), "bb");
assert.equal(guessBank("Caixinha do Nubank"), "nubank", "caixinha não é a Caixa");
assert.equal(guessBank("Caixa"), "caixa");
assert.equal(guessBank("Conta Corrente"), null);
assert.equal(guessBank("Internet"), null, "inter só como palavra inteira");
assert.equal(guessPaymentType("Pix"), "pix");
assert.equal(guessPaymentType("Dinheiro"), "dinheiro");
assert.equal(guessPaymentType("VR"), "vale");
assert.equal(guessPaymentType("Débito Itaú"), "debito");
assert.equal(guessPaymentType("Nubank", true), "credito");
assert.equal(guessPaymentType("Conta Corrente"), "conta");
assert.equal(paymentType("nao-existe").id, "conta", "tipo desconhecido vira conta");
assert.equal(bankById("xyz"), null);
assert.equal(methodColor("itau", "#2a78d6"), bankById("itau")!.bg, "com banco, a cor do banco");
assert.equal(methodColor(null, "#2a78d6"), "#2a78d6");

// ---------- seletor de ícones ----------
assert.equal(new Set(ALL_CATEGORY_ICONS).size, ALL_CATEGORY_ICONS.length, "sem ícone repetido");
assert.ok(ALL_CATEGORY_ICONS.length >= 100, "uma boa variedade de ícones");
assert.ok(searchCategoryIcons("mercado").includes("🛒"));
assert.ok(searchCategoryIcons("Farmácia").includes("💊"), "busca sem acento");
assert.ok(["🐶", "🐱", "🐾"].every((e) => searchCategoryIcons("pet").includes(e)));
assert.deepEqual(searchCategoryIcons(""), ALL_CATEGORY_ICONS);
assert.equal(searchCategoryIcons("zzzz").length, 0);
assert.ok(DEFAULT_CATEGORIES.every((c) => ALL_CATEGORY_ICONS.includes(c.emoji)), "padrões usam ícones da lista");
assert.ok(
  DEFAULT_CATEGORIES.every((c) => c.subs.every((s) => ALL_CATEGORY_ICONS.includes(s.emoji))),
  "subcategorias padrão também usam ícones da lista",
);
assert.deepEqual(
  suggestedSubcategories("alimentacao").slice(0, 2),
  [
    { name: "Supermercado", emoji: "🛒" },
    { name: "Restaurante", emoji: "🍝" },
  ],
);
assert.deepEqual(suggestedSubcategories("Pets"), []);

// Ícone pelo nome (subcategoria já nasce com ícone)
assert.equal(guessCategoryIcon("Padaria"), "🥖");
assert.equal(guessCategoryIcon("supermercado"), "🛒");
assert.equal(guessCategoryIcon("Pet shop"), "🐶");
assert.equal(guessCategoryIcon("Farmácia"), "💊");
assert.equal(guessCategoryIcon("Gasolina"), "⛽");
assert.equal(guessCategoryIcon("Netflix"), "🎞️");
assert.equal(guessCategoryIcon("xyzw"), null);
assert.equal(guessCategoryIcon(""), null);

// ---------- banco ----------
const db = await setupDb();
const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";
await db.exec(`insert into auth.users (id) values ('${A}'), ('${B}')`);
const asUser = async <T,>(user: string, sql: string) => {
  await db.exec(`set role authenticated; set request.jwt.claim.sub = '${user}';`);
  try {
    return (await db.query<T>(sql)).rows;
  } finally {
    await db.exec("reset role; reset request.jwt.claim.sub;");
  }
};

// Formas de pagamento que já existiam: o tipo e o banco saem do nome (rodando a migração de novo)
await db.exec(`
  insert into public.payment_methods (user_id, name, is_credit, closing_day, sort) values
    ('${B}', 'Nubank', true, 3, 1), ('${B}', 'Pix', false, null, 2), ('${B}', 'Itaú conta', false, null, 3),
    ('${B}', 'Dinheiro', false, null, 4), ('${B}', 'VR', false, null, 5), ('${B}', 'Conta Corrente', false, null, 6);
`);
const dir = new URL("../supabase/migrations/", import.meta.url);
const mig = readdirSync(dir).find((f) => f.includes("subcategories_payment_icons"))!;
await db.exec(readFileSync(new URL(mig, dir), "utf8"));
assert.deepEqual(
  (await db.query<{ name: string; icon: string; bank: string | null }>(`select name, icon, bank from public.payment_methods where user_id = '${B}' order by sort`)).rows,
  [
    { name: "Nubank", icon: "credito", bank: "nubank" },
    { name: "Pix", icon: "pix", bank: null },
    { name: "Itaú conta", icon: "conta", bank: "itau" },
    { name: "Dinheiro", icon: "dinheiro", bank: null },
    { name: "VR", icon: "vale", bank: null },
    { name: "Conta Corrente", icon: "conta", bank: null },
  ],
);
await assert.rejects(db.query(`update public.payment_methods set icon = 'Ícone!' where user_id = '${B}'`), "tipo só com letras minúsculas");

// Subcategorias padrão criadas antes dos ícones ganham o ícone (rodando a migração de novo)
{
  const [{ id: catB }] = (await db.query<{ id: number }>(`insert into public.categories (user_id, name) values ('${B}', 'Alimentação') returning id`)).rows;
  await db.exec(`insert into public.subcategories (user_id, category_id, name) values ('${B}', ${catB}, 'Supermercado'), ('${B}', ${catB}, 'iFood')`);
  const iconMig = readdirSync(dir).find((f) => f.includes("subcategory_icons"))!;
  await db.exec(readFileSync(new URL(iconMig, dir), "utf8"));
  assert.deepEqual(
    (await db.query<{ name: string; emoji: string | null }>(`select name, emoji from public.subcategories where user_id = '${B}' order by lower(name)`)).rows,
    [
      { name: "iFood", emoji: null },
      { name: "Supermercado", emoji: "🛒" },
    ],
  );
}

const g = globalThis as { __atlasTestClient?: unknown };
g.__atlasTestClient = fakeSupabase(db, A);
const data = await import("../lib/data");

// Conta nova: formas de pagamento padrão (com tipo) e categorias amplas com subcategorias
const methods = await data.listPaymentMethods();
assert.deepEqual(
  methods.map((m) => [m.name, m.icon, m.bank]),
  [
    ["Conta Corrente", "conta", null],
    ["Crédito", "credito", null],
  ],
);
const cats = await data.listCategories();
assert.deepEqual(
  cats.map((c) => c.name),
  DEFAULT_CATEGORIES.map((c) => c.name),
);
const subs = await data.listSubcategories();
const food = cats.find((c) => c.name === "Alimentação")!;
const transport = cats.find((c) => c.name === "Transporte")!;
assert.deepEqual(
  subs.filter((s) => s.categoryId === food.id).map((s) => s.name),
  ["Supermercado", "Restaurante", "Delivery", "Padaria", "Lanches"],
);
assert.equal(subs.filter((s) => s.categoryId === cats.find((c) => c.name === "Outros")!.id).length, 0);
assert.deepEqual(
  subs.filter((s) => s.categoryId === food.id).map((s) => s.emoji),
  ["🛒", "🍝", "🛵", "🥖", "🍔"],
  "padrões já vêm com ícone",
);
await data.listPaymentMethods();
assert.equal((await data.listSubcategories()).length, subs.length, "não cria de novo");

// RLS: a outra pessoa não vê as subcategorias e não consegue pendurar uma na categoria alheia
{
  const seen = await asUser<{ user_id: string }>(B, "select user_id from public.subcategories");
  assert.ok(seen.length === 2 && seen.every((r) => r.user_id === B), "cada um só vê as suas");
}
await assert.rejects(asUser(B, `insert into public.subcategories (category_id, name) values (${food.id}, 'Intrusa')`));
await assert.rejects(asUser(A, `insert into public.subcategories (category_id, name) values (${food.id}, '   ')`), "nome vazio");

// Criar, renomear, reativar e remover
await data.createSubcategory(food.id, "iFood");
let foodSubs = (await data.listSubcategories()).filter((s) => s.categoryId === food.id);
assert.equal(foodSubs.at(-1)!.name, "iFood", "nova vai para o fim");
const ifood = foodSubs.at(-1)!;
await data.renameSubcategory(ifood.id, "Aplicativos de comida", "🛵");
assert.equal((await data.listSubcategories()).find((s) => s.id === ifood.id)!.emoji, "🛵");
await data.renameSubcategory(ifood.id, "Aplicativos de comida");
assert.equal((await data.listSubcategories()).find((s) => s.id === ifood.id)!.emoji, "🛵", "sem ícone na chamada, mantém");
await data.createSubcategory(food.id, "Doceria", null);
assert.equal((await data.listSubcategories()).find((s) => s.name === "Doceria")!.emoji, null, "sem ícone de propósito");
await assert.rejects(data.renameSubcategory(ifood.id, "Padaria"), "nome repetido na mesma categoria");
await data.createSubcategory(transport.id, "Padaria"); // em outra categoria pode
assert.equal((await data.listSubcategories()).find((s) => s.categoryId === transport.id && s.name === "Padaria")!.emoji, "🥖", "ícone pelo nome");
await assert.rejects(asUser(A, `update public.subcategories set emoji = '' where id = ${ifood.id}`), "ícone vazio não vale (sem ícone = null)");
const supermercado = foodSubs.find((s) => s.name === "Supermercado")!;
const restaurante = foodSubs.find((s) => s.name === "Restaurante")!;
const combustivel = (await data.listSubcategories()).find((s) => s.categoryId === transport.id && s.name === "Combustível")!;

// A subcategoria tem que ser da categoria
assert.equal(await data.checkSubcategory(food.id, supermercado.id), supermercado.id);
assert.equal(await data.checkSubcategory(transport.id, supermercado.id), null);
assert.equal(await data.checkSubcategory(null, supermercado.id), null);
assert.equal(await data.checkSubcategory(food.id, 999999), null);
await assert.rejects(
  asUser(A, `insert into public.entries (month, kind, name, amount_cents, category_id, subcategory_id) values ('2026-11', 'avulso', 'x', 1, ${transport.id}, ${supermercado.id})`),
  "o banco recusa subcategoria de outra categoria",
);

// Lançar com subcategoria; mudar a categoria limpa a subcategoria
const conta = methods.find((m) => !m.isCredit)!;
const card = methods.find((m) => m.isCredit)!;
await data.createEntry({ month: "2026-11", kind: "avulso", name: "Assaí", amountCents: 25000, date: "2026-11-02", paymentMethodId: conta.id, categoryId: food.id, subcategoryId: supermercado.id });
await data.createEntry({ month: "2026-11", kind: "avulso", name: "Pizza", amountCents: 9000, date: "2026-11-03", paymentMethodId: card.id, categoryId: food.id, subcategoryId: restaurante.id });
const nov = await data.getMonth("2026-11");
const assai = nov.entries.find((e) => e.name === "Assaí")!;
assert.equal(assai.subcategoryId, supermercado.id);
assert.equal(nov.byCategory.find((c) => c.categoryId === food.id)!.total, 34000, "a categoria soma as subcategorias");
await data.updateEntry(assai.id, { month: "2026-11", name: "Assaí", amountCents: 25000, date: "2026-11-02", paymentMethodId: conta.id, categoryId: transport.id });
assert.equal((await data.getEntry(assai.id))!.subcategoryId, null);
await data.updateEntry(assai.id, { month: "2026-11", name: "Assaí", amountCents: 25000, date: "2026-11-02", paymentMethodId: conta.id, categoryId: food.id, subcategoryId: supermercado.id });
await data.createEntry({ month: "2026-11", kind: "avulso", name: "Sem categoria", amountCents: 100, date: null, paymentMethodId: conta.id, categoryId: null, subcategoryId: supermercado.id });
assert.equal((await data.getMonth("2026-11")).entries.find((e) => e.name === "Sem categoria")!.subcategoryId, null, "sem categoria, sem subcategoria");

// Sugestões trazem a subcategoria; preencher pelo histórico também
const sugg = (await data.getSuggestions()).find((s) => s.name === "Assaí")!;
assert.equal(sugg.categoryId, food.id);
assert.equal(sugg.subcategoryId, supermercado.id);
await data.createEntry({ month: "2026-12", kind: "avulso", name: "assaí ", amountCents: 18000, date: "2026-12-01", paymentMethodId: conta.id, categoryId: null });
assert.equal(await data.fillCategoriesFromHistory("2026-12"), 1);
const filled = (await data.getMonth("2026-12")).entries.find((e) => e.name === "assaí ")!;
assert.deepEqual([filled.categoryId, filled.subcategoryId], [food.id, supermercado.id]);

// Fixos levam a subcategoria para os meses gerados e para as mudanças
await data.ensureMonthGenerated("2027-01");
await data.createRecurring({ kind: "fixo", name: "Posto", amountCents: 30000, day: 10, paymentMethodId: conta.id, categoryId: transport.id, subcategoryId: combustivel.id, installments: null, startMonth: "2026-11" });
const rec = (await data.listRecurring()).find((r) => r.name === "Posto")!;
assert.equal(rec.subcategoryId, combustivel.id);
assert.equal((await data.getMonth("2027-01")).entries.find((e) => e.name === "Posto")!.subcategoryId, combustivel.id);
assert.equal((await data.getMonth("2027-02")).entries.find((e) => e.name === "Posto")!.subcategoryId, combustivel.id, "mês gerado depois");
await data.updateRecurring(rec.id, { ...rec, subcategoryId: null }, "2027-02");
assert.equal((await data.getMonth("2027-02")).entries.find((e) => e.name === "Posto")!.subcategoryId, null);
assert.equal((await data.getMonth("2027-01")).entries.find((e) => e.name === "Posto")!.subcategoryId, combustivel.id, "mês anterior fica igual");

// Remover subcategoria: sai da lista, os lançamentos continuam com ela (e o nome continua conhecido)
await data.archiveSubcategory(supermercado.id);
assert.ok(!(await data.listSubcategories()).some((s) => s.id === supermercado.id));
assert.equal((await data.getEntry(assai.id))!.subcategoryId, supermercado.id);
assert.deepEqual((await data.subcategoryLookup()).get(supermercado.id), { name: "Supermercado", emoji: "🛒" });
await data.createSubcategory(food.id, "Supermercado");
assert.ok((await data.listSubcategories()).some((s) => s.id === supermercado.id), "criar de novo reativa a mesma");
// Apagar de vez (só acontece se a conta for apagada): o lançamento fica com a categoria
await db.exec(`delete from public.subcategories where id = ${restaurante.id}`);
const pizza = (await data.getMonth("2026-11")).entries.find((e) => e.name === "Pizza")!;
assert.deepEqual([pizza.categoryId, pizza.subcategoryId], [food.id, null]);

// withSubcategories: o que o lançamento recebe
const opts = data.withSubcategories(await data.listCategories(), await data.listSubcategories());
assert.ok(opts.find((c) => c.id === food.id)!.subs.some((s) => s.name === "Aplicativos de comida" && s.emoji === "🛵"));

// Categoria nova devolve o id (e reativa a removida com o mesmo nome)
const petsId = await data.upsertCategory({ name: "Pets", emoji: "🐾" });
assert.equal((await data.getCategory(petsId))!.emoji, "🐾");
await data.archiveCategory(petsId);
assert.equal(await data.getCategory(petsId), null);
assert.equal(await data.upsertCategory({ name: "Pets", emoji: "🐶" }), petsId);
assert.equal((await data.getCategory(petsId))!.emoji, "🐶");

// Formas de pagamento: tipo, banco e crédito andam juntos
const { PAYMENT_COLORS } = await import("../lib/format");
const NU = bankById("nubank")!.bg;
await data.upsertPaymentMethod({ name: "Nubank", isCredit: true, closingDay: 3 });
let nu = (await data.listPaymentMethods()).find((m) => m.name === "Nubank")!;
assert.deepEqual([nu.icon, nu.bank, nu.closingDay, nu.color], ["credito", "nubank", 3, NU], "banco adivinhado ao criar, com a cor dele");
await data.upsertPaymentMethod({ id: nu.id, name: "Nubank", isCredit: false, closingDay: 3, icon: "pix", bank: null });
nu = (await data.getPaymentMethod(nu.id))!;
assert.deepEqual([nu.icon, nu.bank, nu.isCredit, nu.closingDay], ["pix", null, false, null]);
assert.ok(PAYMENT_COLORS.includes(nu.color), "sem banco, volta para uma cor da paleta");
const others = (await data.listPaymentMethods()).filter((m) => m.id !== nu.id).map((m) => m.color);
assert.ok(!others.includes(nu.color), "a cor livre não repete a de outra forma");
await data.upsertPaymentMethod({ id: nu.id, name: "Nubank", isCredit: true, closingDay: 5, icon: "pix", bank: "nubank", color: PAYMENT_COLORS[0] });
nu = (await data.getPaymentMethod(nu.id))!;
assert.deepEqual([nu.icon, nu.bank, nu.isCredit, nu.color], ["credito", "nubank", true, NU], "crédito sempre com o tipo crédito; banco manda na cor");
assert.equal((await db.query<{ color: string }>(`select color from public.payment_methods where id = ${nu.id}`)).rows[0].color, NU, "guarda a cor do banco");
// Forma com banco e cor antiga da paleta (de antes desta regra): aparece com a cor do banco, também nas estatísticas
await db.exec(`update public.payment_methods set color = '${PAYMENT_COLORS[3]}' where id = ${nu.id}`);
assert.equal((await data.getPaymentMethod(nu.id))!.color, NU);
const { loadLookups } = await import("../lib/stats");
assert.equal((await loadLookups()).methods.get(nu.id)!.color, NU);
await data.upsertPaymentMethod({ id: nu.id, name: "Roxinho", isCredit: true, closingDay: 5 });
assert.equal((await data.getPaymentMethod(nu.id))!.bank, "nubank", "editar sem mandar banco não mexe nele");
await data.upsertPaymentMethod({ name: "Carteira", isCredit: false, closingDay: null, icon: "carteira", bank: "banco-que-nao-existe" });
assert.equal((await data.listPaymentMethods()).find((m) => m.name === "Carteira")!.bank, null, "banco desconhecido vira nenhum");
await data.archivePaymentMethod(nu.id);
assert.equal(await data.getPaymentMethod(nu.id), null);

console.log("✓ configurações ok: subcategorias (RLS, lançamento, fixos, sugestões, histórico), tipo e banco das formas de pagamento, padrões e ícones");
