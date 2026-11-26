// Ícones (emojis) que dá para escolher para uma categoria, em grupos e com palavras para a busca.
// A categoria guarda o emoji no campo `emoji`; a lista aqui é só o cardápio do seletor.

/** Categorias de uma conta nova: amplas, cada uma com subcategorias comuns (dá para mudar tudo depois). */
export const DEFAULT_CATEGORIES: { name: string; emoji: string; subs: { name: string; emoji: string }[] }[] = [
  {
    name: "Alimentação",
    emoji: "🍽️",
    subs: [
      { name: "Supermercado", emoji: "🛒" },
      { name: "Restaurante", emoji: "🍝" },
      { name: "Delivery", emoji: "🛵" },
      { name: "Padaria", emoji: "🥖" },
      { name: "Lanches", emoji: "🍔" },
    ],
  },
  {
    name: "Moradia",
    emoji: "🏠",
    subs: [
      { name: "Aluguel", emoji: "🔑" },
      { name: "Condomínio", emoji: "🏢" },
      { name: "Energia", emoji: "💡" },
      { name: "Água", emoji: "💧" },
      { name: "Internet", emoji: "📶" },
      { name: "Manutenção", emoji: "🔧" },
    ],
  },
  {
    name: "Transporte",
    emoji: "🚗",
    subs: [
      { name: "Combustível", emoji: "⛽" },
      { name: "Aplicativo", emoji: "🚕" },
      { name: "Transporte público", emoji: "🚌" },
      { name: "Estacionamento", emoji: "🅿️" },
      { name: "Manutenção", emoji: "🛞" },
    ],
  },
  {
    name: "Saúde",
    emoji: "🩺",
    subs: [
      { name: "Farmácia", emoji: "💊" },
      { name: "Consultas", emoji: "🏥" },
      { name: "Exames", emoji: "🧪" },
      { name: "Plano de saúde", emoji: "🛡️" },
    ],
  },
  {
    name: "Educação",
    emoji: "🎓",
    subs: [
      { name: "Cursos", emoji: "📝" },
      { name: "Livros", emoji: "📚" },
      { name: "Material", emoji: "✏️" },
    ],
  },
  {
    name: "Lazer",
    emoji: "🎉",
    subs: [
      { name: "Passeios", emoji: "🗺️" },
      { name: "Bares", emoji: "🍻" },
      { name: "Cinema e shows", emoji: "🎬" },
      { name: "Hobbies", emoji: "🎨" },
    ],
  },
  {
    name: "Compras",
    emoji: "🛍️",
    subs: [
      { name: "Roupas", emoji: "👕" },
      { name: "Eletrônicos", emoji: "🖥️" },
      { name: "Casa e decoração", emoji: "🛋️" },
      { name: "Presentes", emoji: "🎁" },
    ],
  },
  {
    name: "Cuidados pessoais",
    emoji: "💆",
    subs: [
      { name: "Beleza", emoji: "💅" },
      { name: "Academia", emoji: "🏋️" },
      { name: "Higiene", emoji: "🧴" },
    ],
  },
  {
    name: "Assinaturas",
    emoji: "📺",
    subs: [
      { name: "Streaming", emoji: "🎞️" },
      { name: "Apps", emoji: "💻" },
      { name: "Celular", emoji: "📱" },
    ],
  },
  {
    name: "Viagem",
    emoji: "✈️",
    subs: [
      { name: "Passagens", emoji: "🎟️" },
      { name: "Hospedagem", emoji: "🏨" },
      { name: "Passeios", emoji: "🗺️" },
    ],
  },
  {
    name: "Taxas e impostos",
    emoji: "🧾",
    subs: [
      { name: "Tarifas bancárias", emoji: "🏦" },
      { name: "Impostos", emoji: "🏛️" },
      { name: "Juros e multas", emoji: "💸" },
    ],
  },
  { name: "Outros", emoji: "📦", subs: [] },
];

export interface IconGroup {
  id: string;
  label: string;
  icons: [emoji: string, keywords: string][];
}

export const CATEGORY_ICON_GROUPS: IconGroup[] = [
  {
    id: "alimentacao",
    label: "Alimentação",
    icons: [
      ["🍽️", "alimentacao comida refeicao prato"],
      ["🍝", "restaurante massa italiano jantar almoco"],
      ["🛒", "mercado supermercado compras feira carrinho"],
      ["🍔", "lanche hamburguer fast food"],
      ["🍕", "pizza delivery"],
      ["🍜", "japones lamen sopa"],
      ["🍣", "sushi japones"],
      ["🥗", "salada saudavel dieta"],
      ["🥖", "padaria pao"],
      ["☕", "cafe cafeteria"],
      ["🍰", "doce bolo sobremesa confeitaria"],
      ["🍦", "sorvete doce"],
      ["🍺", "cerveja bar bebida"],
      ["🍷", "vinho bebida"],
      ["🥤", "refrigerante bebida"],
      ["🍎", "fruta hortifruti feira"],
      ["🥩", "carne acougue churrasco"],
      ["🍳", "cozinha cafe da manha ovos"],
      ["🍿", "pipoca petisco"],
    ],
  },
  {
    id: "casa",
    label: "Casa",
    icons: [
      ["🏠", "casa moradia lar aluguel"],
      ["🏢", "apartamento predio condominio"],
      ["🛋️", "moveis sofa sala decoracao"],
      ["🛏️", "cama quarto"],
      ["🧹", "limpeza faxina diarista"],
      ["🧺", "lavanderia roupa"],
      ["🔧", "manutencao conserto reparo"],
      ["🛠️", "ferramentas reforma obra"],
      ["💡", "luz energia eletricidade"],
      ["🔌", "energia tomada eletrica"],
      ["💧", "agua"],
      ["🔥", "gas"],
      ["📶", "internet wifi"],
      ["🪴", "plantas jardim"],
      ["🔑", "chave aluguel imovel"],
    ],
  },
  {
    id: "transporte",
    label: "Transporte",
    icons: [
      ["🚗", "carro transporte veiculo"],
      ["🚕", "taxi uber aplicativo 99"],
      ["🚌", "onibus transporte publico"],
      ["🚇", "metro trem"],
      ["🚲", "bicicleta bike"],
      ["🛵", "moto delivery entrega"],
      ["🏍️", "moto motocicleta"],
      ["⛽", "combustivel gasolina posto"],
      ["🅿️", "estacionamento"],
      ["🛞", "pneu oficina"],
      ["🚙", "suv carro"],
      ["🛣️", "pedagio estrada viagem"],
    ],
  },
  {
    id: "saude",
    label: "Saúde e cuidados",
    icons: [
      ["🩺", "saude medico consulta"],
      ["💊", "farmacia remedio medicamento"],
      ["🏥", "hospital plano de saude"],
      ["🦷", "dentista odontologia"],
      ["👓", "oculos otica"],
      ["🧘", "yoga meditacao terapia"],
      ["💪", "academia treino"],
      ["🏋️", "academia musculacao"],
      ["🧴", "higiene cosmeticos"],
      ["💆", "cuidados pessoais massagem spa"],
      ["💅", "beleza unha manicure"],
      ["💇", "cabelo salao barbearia"],
      ["🧠", "psicologo terapia"],
      ["🩹", "curativo saude"],
      ["🧪", "exames laboratorio"],
    ],
  },
  {
    id: "educacao",
    label: "Educação e trabalho",
    icons: [
      ["🎓", "educacao faculdade escola formatura"],
      ["📚", "livros estudo"],
      ["✏️", "material escolar"],
      ["🏫", "escola mensalidade"],
      ["💻", "computador notebook trabalho"],
      ["📱", "celular telefone"],
      ["💼", "trabalho escritorio"],
      ["📝", "curso prova"],
      ["🗂️", "documentos"],
      ["🖨️", "impressao"],
    ],
  },
  {
    id: "lazer",
    label: "Lazer",
    icons: [
      ["🎉", "lazer festa diversao"],
      ["🎬", "cinema filme"],
      ["📺", "tv televisao assinatura"],
      ["🎞️", "streaming netflix filmes series"],
      ["🎮", "games jogos videogame"],
      ["🎵", "musica spotify"],
      ["🎧", "musica podcast fone"],
      ["🎤", "show karaoke"],
      ["🎭", "teatro"],
      ["🎟️", "ingresso evento"],
      ["🎨", "arte hobby"],
      ["📷", "fotografia"],
      ["⚽", "futebol esporte"],
      ["🎾", "tenis esporte"],
      ["🏊", "natacao piscina"],
      ["🎲", "jogos tabuleiro"],
      ["🍻", "bar happy hour amigos"],
    ],
  },
  {
    id: "viagem",
    label: "Viagem",
    icons: [
      ["✈️", "viagem passagem aviao"],
      ["🏖️", "praia ferias"],
      ["🏨", "hotel hospedagem"],
      ["🧳", "mala bagagem"],
      ["🏕️", "camping"],
      ["🗺️", "turismo passeio"],
      ["🌎", "internacional exterior"],
      ["🚢", "cruzeiro navio"],
    ],
  },
  {
    id: "compras",
    label: "Compras",
    icons: [
      ["🛍️", "compras shopping"],
      ["👕", "roupa camiseta"],
      ["👗", "roupa vestido moda"],
      ["👟", "tenis calcado sapato"],
      ["👜", "bolsa acessorios"],
      ["💍", "joias"],
      ["⌚", "relogio"],
      ["🕶️", "oculos de sol"],
      ["🎁", "presente aniversario"],
      ["🧸", "brinquedo"],
      ["📦", "encomenda online outros"],
      ["🖥️", "eletronicos"],
    ],
  },
  {
    id: "familia",
    label: "Família e pets",
    icons: [
      ["👶", "bebe filho"],
      ["🧒", "crianca filhos"],
      ["🍼", "bebe fralda"],
      ["👪", "familia"],
      ["❤️", "relacionamento amor doacao"],
      ["🐶", "cachorro pet"],
      ["🐱", "gato pet"],
      ["🐾", "pets veterinario racao"],
    ],
  },
  {
    id: "financas",
    label: "Finanças",
    icons: [
      ["💰", "dinheiro financas"],
      ["💵", "dinheiro especie"],
      ["💳", "cartao credito"],
      ["🏦", "banco tarifa"],
      ["🧾", "contas boleto imposto"],
      ["📊", "investimento"],
      ["💸", "divida emprestimo"],
      ["🪙", "moeda poupanca"],
      ["🏛️", "governo imposto taxa"],
      ["🤝", "doacao ajuda"],
      ["🛡️", "seguro protecao"],
      ["📄", "contrato documento"],
    ],
  },
  {
    id: "outros",
    label: "Outros",
    icons: [
      ["🏷️", "etiqueta geral outros"],
      ["⭐", "favorito especial"],
      ["📌", "fixo importante"],
      ["✨", "outros extra"],
      ["🌱", "sustentavel natureza"],
      ["🙏", "igreja dizimo religiao"],
      ["🎯", "meta objetivo"],
      ["❓", "outros desconhecido"],
    ],
  },
];

/** Todos os emojis do seletor, sem repetição. */
export const ALL_CATEGORY_ICONS = CATEGORY_ICON_GROUPS.flatMap((g) => g.icons.map(([e]) => e));

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();

/** Busca por palavra (sem acento): "mercado" → 🛒, "pet" → 🐶 🐱 🐾. */
export function searchCategoryIcons(q: string): string[] {
  const t = fold(q);
  if (!t) return ALL_CATEGORY_ICONS;
  const out: string[] = [];
  for (const g of CATEGORY_ICON_GROUPS) {
    const groupHit = fold(g.label).includes(t);
    for (const [e, k] of g.icons) if (groupHit || k.split(" ").some((w) => w.startsWith(t)) || k.includes(t)) out.push(e);
  }
  return [...new Set(out)];
}

/** Subcategorias sugeridas (com ícone) para uma categoria com o nome de uma das padrão (ex.: "alimentacao"). */
export function suggestedSubcategories(categoryName: string): { name: string; emoji: string }[] {
  const n = fold(categoryName);
  return DEFAULT_CATEGORIES.find((c) => fold(c.name) === n)?.subs ?? [];
}

/**
 * Ícone que combina com um nome ("Padaria" → 🥖, "Supermercado" → 🛒), para a subcategoria já nascer
 * com ícone. Palavra inteira primeiro; depois começo de palavra (4+ letras). null se nada combinar.
 */
export function guessCategoryIcon(name: string): string | null {
  const words = fold(name)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 2);
  if (!words.length) return null;
  const known = new Map(DEFAULT_CATEGORIES.flatMap((c) => [[fold(c.name), c.emoji] as const, ...c.subs.map((s) => [fold(s.name), s.emoji] as const)]));
  const whole = known.get(words.join(" "));
  if (whole) return whole;
  const all = CATEGORY_ICON_GROUPS.flatMap((g) => g.icons);
  for (const w of words) for (const [e, k] of all) if (k.split(" ").includes(w)) return e;
  for (const w of words) if (w.length >= 4) for (const [e, k] of all) if (k.split(" ").some((x) => x.startsWith(w) || (x.length >= 4 && w.startsWith(x)))) return e;
  return null;
}
