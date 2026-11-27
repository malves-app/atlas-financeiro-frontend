// Sugestão de nome e categoria para o que falta lançar, para a pessoa só aprovar.
//
// De onde vem a sugestão, nesta ordem:
//   1. regra: como essa mesma linha do banco foi lançada antes (aprovada aqui, ou um lançamento que bateu com ela)
//   2. histórico: um lançamento com o mesmo nome (fm_suggestions)
//   3. nome da loja: palavras conhecidas ("posto", "farmácia", "ifood"...) → a categoria da pessoa com esse nome
//   4. histórico parecido (todas as palavras de um nome já usado aparecem na linha do banco)
//   5. "Outros", se a pessoa tiver essa categoria
// As categorias são sempre as da pessoa: "Supermercado" vale tanto para a categoria quanto para a subcategoria
// (Alimentação › Supermercado) com esse nome.

export interface CategoryLite {
  id: number;
  name: string;
  subs: { id: number; name: string }[];
}

/** Como uma linha do banco foi lançada (chave = ruleKey). */
export interface Rule {
  key: string;
  name: string;
  categoryId: number | null;
  subcategoryId: number | null;
}

/** Nome já usado no Atlas, com a categoria da última vez (fm_suggestions). */
export interface Hint {
  name: string;
  categoryId: number | null;
  subcategoryId: number | null;
}

export type SuggestionSource = "regra" | "historico" | "loja" | "outros" | "nenhuma";

export interface Suggestion {
  name: string;
  categoryId: number | null;
  subcategoryId: number | null;
  source: SuggestionSource;
}

export const fold = (s: string | null | undefined) =>
  (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9+]+/g, " ")
    .trim();

/* ---------- chave da linha ---------- */

const NOISE = new Set(["ltda", "me", "eireli", "sa", "epp", "mei", "pos", "com", "br", "bra", "de", "da", "do", "das", "dos", "e"]);

/**
 * Chave para lembrar como uma linha do banco foi lançada: o tipo + até 4 palavras, sem números ("IFD*49 237 511
 * DAVI GA" e o mesmo restaurante no mês seguinte dão a mesma chave).
 */
export function ruleKey(kind: "cartao" | "conta" | "entrada", text: string): string {
  const words = fold(text)
    .replace(/\d+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !NOISE.has(w));
  return `${kind}:${words.slice(0, 4).join(" ")}`;
}

/* ---------- categorias da pessoa ---------- */

const same = (a: string, b: string) => {
  const x = fold(a);
  const y = fold(b);
  return x === y || x.replace(/s$/, "") === y.replace(/s$/, "");
};

/** "Categoria › Sub" (exato) ou só um nome (categoria com esse nome, senão subcategoria com esse nome). */
function findTarget(target: string, cats: CategoryLite[]): { categoryId: number; subcategoryId: number | null } | null {
  const [a, b] = target.split(" > ");
  if (b) {
    const c = cats.find((x) => same(x.name, a));
    const s = c?.subs.find((x) => same(x.name, b));
    return c && s ? { categoryId: c.id, subcategoryId: s.id } : null;
  }
  const c = cats.find((x) => same(x.name, a));
  if (c) return { categoryId: c.id, subcategoryId: null };
  for (const x of cats) {
    const s = x.subs.find((y) => same(y.name, a));
    if (s) return { categoryId: x.id, subcategoryId: s.id };
  }
  return null;
}

/** A categoria (e subcategoria) ainda existem e combinam? */
function valid(cats: CategoryLite[], categoryId: number | null, subcategoryId: number | null) {
  const c = categoryId == null ? null : cats.find((x) => x.id === categoryId);
  if (!c) return null;
  return { categoryId: c.id, subcategoryId: subcategoryId != null && c.subs.some((s) => s.id === subcategoryId) ? subcategoryId : null };
}

/* ---------- nome da loja → categoria ---------- */

// A ordem importa: o mais específico primeiro (iFood de supermercado é Delivery; Amazon Prime é Streaming).
const STORES: { re: RegExp; to: string[] }[] = [
  { re: /\b(ifood|ifd|rappi|aiqfome|ze delivery|james delivery)\b/, to: ["Alimentação > Delivery", "Delivery", "iFood", "Alimentação"] },
  { re: /\b(uber|uberrides|99 ?app|99 ?pop|99 ?taxi|cabify|indrive|indriver)\b/, to: ["Transporte > Aplicativo", "Aplicativo", "Uber", "Transporte"] },
  { re: /\b(posto|postos|combust\w*|shell|ipiranga|petrobras|gasolina)\b/, to: ["Transporte > Combustível", "Combustível", "Gasolina", "Transporte"] },
  { re: /estacion|parking|zona azul/, to: ["Transporte > Estacionamento", "Estacionamento", "Transporte"] },
  { re: /oficina|auto ?pecas|pneu|lava ?jato|mecanica|autocenter/, to: ["Transporte > Manutenção", "Transporte"] },
  { re: /\b(metro|onibus|bilhete unico|brt|vlt)\b/, to: ["Transporte > Transporte público", "Transporte público", "Transporte"] },
  { re: /netflix|spotify|hbo|\bmax\b|disney|prime video|amazon prime|globoplay|deezer|youtube|paramount|crunchyroll|apple tv|telecine/, to: ["Assinaturas > Streaming", "Streaming", "Assinaturas"] },
  { re: /\b(apple|icloud|google|claude|anthropic|openai|chatgpt|microsoft|adobe|canva|dropbox|notion|meli\+?|melimais|esfera)\b/, to: ["Assinaturas > Apps", "Apps", "Assinaturas"] },
  { re: /internet|fibra|brisanet|starlink/, to: ["Moradia > Internet", "Internet", "Moradia"] },
  { re: /\b(claro|vivo|tim|recarga celular)\b/, to: ["Assinaturas > Celular", "Celular", "Telefone", "Assinaturas"] },
  { re: /energisa|\benel\b|coelce|cemig|celpe|neoenergia|coelba|cosern|copel|equatorial|energia/, to: ["Moradia > Energia", "Energia", "Luz", "Moradia"] },
  { re: /cagepa|cagece|sabesp|compesa|embasa|caern|saneamento|\bagua\b/, to: ["Moradia > Água", "Água", "Moradia"] },
  { re: /condomin/, to: ["Moradia > Condomínio", "Condomínio", "Moradia"] },
  { re: /aluguel|imobiliar|quinto ?andar/, to: ["Moradia > Aluguel", "Aluguel", "Moradia"] },
  { re: /constru|contruc|ferrag|leroy|telhanorte|tintas|madeireira|vidracaria|material de constr|hidraul|marcenar/, to: ["Moradia > Manutenção", "Moradia"] },
  { re: /supermerc|\bmercado\b(?! ?livre)|mercadinho|atacad|atacarejo|carrefour|assai|sendas|\bk ?preco\b|pao de acucar|hortifruti|hiper|mateus|bompreco/, to: ["Alimentação > Supermercado", "Supermercado", "Mercado", "Alimentação"] },
  { re: /padaria|panific|confeitar|doceria/, to: ["Alimentação > Padaria", "Padaria", "Alimentação"] },
  { re: /lanch|burger|\bbobs\b|mc ?donald|subway|\bkfc\b|habib|acai|sorvet|gelat|pastel|hot ?dog|\bcafe|starbucks|cacau show|chocolat/, to: ["Alimentação > Lanches", "Lanches", "Lanche", "Alimentação"] },
  { re: /restaur|grill|churrasc|marmit|pizza|sushi|massas|cantina|bistro|comida|cozinha|espetinho|galeteria|peixaria|outback|giraffas|madero|coco bambu/, to: ["Alimentação > Restaurante", "Restaurante", "Restaurantes", "Alimentação"] },
  { re: /farmac|drogar|\bdroga\b|drogasil|\braia\b|pague menos|panvel|extrafarma|pacheco|nissei/, to: ["Saúde > Farmácia", "Farmácia", "Remédios", "Saúde"] },
  { re: /unimed|hapvida|\bamil\b|sulamerica|bradesco saude|notredame|plano de saude|odontoprev/, to: ["Saúde > Plano de saúde", "Plano de saúde", "Saúde"] },
  { re: /laborat|exame|diagnost|radiolog/, to: ["Saúde > Exames", "Exames", "Saúde"] },
  { re: /clinica|hospital|consult|medic|odonto|dentist|psicolog|fisioter|otica|oculos/, to: ["Saúde > Consultas", "Consultas", "Saúde"] },
  { re: /academia|\bgym\b|\bfit\b|smart ?fit|crossfit|bodytech|selfit|pilates|yoga|natacao/, to: ["Cuidados pessoais > Academia", "Academia", "Saúde > Academia", "Cuidados pessoais", "Saúde"] },
  { re: /salao|barbear|barber|cabelei|estetica|laser|depil|manicure|cosmetic|boticario|natura|sephora|perfum/, to: ["Cuidados pessoais > Beleza", "Beleza", "Cuidados pessoais"] },
  { re: /\b(pet|pets|petz|cobasi|petlove|veterin\w*|racao|prontocao|cao|dog)\b/, to: ["Pet", "Pets", "Animais"] },
  { re: /renner|riachuelo|zara|hering|centauro|netshoes|marisa|pernambucanas|calcad|sapat|roupa|confecc/, to: ["Compras > Roupas", "Roupas", "Vestuário", "Compras"] },
  { re: /eletron|fast ?shop|kabum|pichau|terabyte|samsung|xiaomi/, to: ["Compras > Eletrônicos", "Eletrônicos", "Compras"] },
  { re: /tok ?stok|camicado|\betna\b|mobly|utilidades|decor/, to: ["Compras > Casa e decoração", "Casa e decoração", "Compras"] },
  { re: /shopee|mercado ?livre|amazon|aliexpress|shein|magalu|magazine luiza|americanas|submarino|casas bahia|\btemu\b/, to: ["Compras"] },
  { re: /curso|escola|faculdade|universidade|colegio|udemy|alura|estrategia|concurso|qconcursos|idiomas/, to: ["Educação > Cursos", "Cursos", "Educação"] },
  { re: /livrar|livro|kindle|saraiva/, to: ["Educação > Livros", "Livros", "Educação"] },
  { re: /papelar|grafica|copias|xerox|kalunga/, to: ["Educação > Material", "Material", "Educação"] },
  { re: /\bcine|cinema|ingresso|sympla|eventim|teatro|\bshow\b/, to: ["Lazer > Cinema e shows", "Cinema e shows", "Cinema", "Lazer"] },
  { re: /\bbar\b|choper|cervej|\bpub\b|boteco|adega/, to: ["Lazer > Bares", "Bares", "Bar", "Lazer"] },
  { re: /hotel|pousada|airbnb|booking|hostel|resort/, to: ["Viagem > Hospedagem", "Hospedagem", "Viagem"] },
  { re: /latam|\bgol\b|azul linhas|voeazul|smiles|decolar|123 ?milhas|maxmilhas|rodoviar|buser|passagem/, to: ["Viagem > Passagens", "Passagens", "Viagem"] },
  { re: /turismo|viagens|\btour\b|passeio/, to: ["Viagem > Passeios", "Viagem"] },
  { re: /\biof\b/, to: ["Taxas e impostos > Impostos", "Impostos", "Taxas e impostos"] },
  { re: /anuidade|tarifa|cesta de servicos|pacote de servicos/, to: ["Taxas e impostos > Tarifas bancárias", "Tarifas bancárias", "Taxas", "Taxas e impostos"] },
  { re: /\bjuros\b|\bmulta\b|encargo/, to: ["Taxas e impostos > Juros e multas", "Juros e multas", "Taxas e impostos"] },
  { re: /receita federal|ministerio da fazenda|\bdarf\b|simples nacional|\bipva\b|\biptu\b|detran|prefeitura|sefaz/, to: ["Taxas e impostos > Impostos", "Impostos", "Taxas e impostos"] },
];

const OTHERS = ["Outros", "Outro", "Diversos", "Geral"];

/** Categoria pelo nome da loja (null se nenhuma palavra conhecida ou a pessoa não tem a categoria). */
export function storeCategory(text: string, cats: CategoryLite[]): { categoryId: number; subcategoryId: number | null } | null {
  const t = fold(text);
  for (const s of STORES) {
    if (!s.re.test(t)) continue;
    for (const target of s.to) {
      const found = findTarget(target, cats);
      if (found) return found;
    }
    return null; // a loja é conhecida, mas a pessoa não tem nenhuma das categorias: não chuta outra
  }
  return null;
}

/* ---------- a sugestão ---------- */

const words = (s: string) => fold(s).split(" ").filter((w) => w.length >= 3);

/** Nome do histórico cujas palavras aparecem todas na linha do banco (o mais longo). */
function looseHint(bankText: string, name: string, hints: Hint[]): Hint | null {
  const have = new Set([...words(bankText), ...words(name)]);
  let best: Hint | null = null;
  for (const h of hints) {
    const ws = words(h.name);
    if (h.categoryId != null && ws.length && ws.every((w) => have.has(w)) && (!best || fold(h.name).length > fold(best.name).length)) best = h;
  }
  return best;
}

export function suggest(input: {
  key: string;
  /** Texto do banco (descrição, ou tipo + quem recebeu). */
  bankText: string;
  /** Nome limpo (merchantName / extratoName). */
  name: string;
  rules: Map<string, Rule>;
  hints: Hint[];
  categories: CategoryLite[];
}): Suggestion {
  const { categories: cats } = input;
  const rule = input.rules.get(input.key);
  if (rule) {
    const v = valid(cats, rule.categoryId, rule.subcategoryId);
    if (v) return { name: rule.name, ...v, source: "regra" };
  }
  const n = fold(input.name);
  const exact = input.hints.find((h) => fold(h.name) === n);
  const exactCat = exact ? valid(cats, exact.categoryId, exact.subcategoryId) : null;
  const name = rule?.name ?? exact?.name ?? input.name;
  if (exactCat) return { name, ...exactCat, source: "historico" };
  const store = storeCategory(`${input.bankText} ${input.name}`, cats);
  if (store) return { name, ...store, source: "loja" };
  const loose = looseHint(input.bankText, input.name, input.hints);
  const looseCat = loose ? valid(cats, loose.categoryId, loose.subcategoryId) : null;
  if (looseCat) return { name, ...looseCat, source: "historico" };
  for (const o of OTHERS) {
    const found = findTarget(o, cats);
    if (found) return { name, ...found, source: "outros" };
  }
  return { name, categoryId: null, subcategoryId: null, source: "nenhuma" };
}
