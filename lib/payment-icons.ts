// Tipos e bancos das formas de pagamento (só visual; quem decide a fatura é is_credit).
// Usado no servidor (importar, valores padrão) e nas telas (selo da forma de pagamento).

export type PaymentType = "conta" | "pix" | "dinheiro" | "credito" | "debito" | "vale" | "carteira" | "boleto" | "poupanca" | "outro";

export const PAYMENT_TYPES: { id: PaymentType; label: string; short: string; icon: string }[] = [
  { id: "conta", label: "Conta corrente", short: "Conta", icon: "M3 10l9-6 9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18" },
  { id: "credito", label: "Cartão de crédito", short: "Crédito", icon: "M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM2 10h20M6 15h4" },
  { id: "debito", label: "Cartão de débito", short: "Débito", icon: "M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM6 9h3.5v3H6zM14 15h4" },
  { id: "pix", label: "Pix", short: "Pix", icon: "M13 2.5L4.5 13.5H11l-1 8 8.5-11H12l1-8z" },
  { id: "dinheiro", label: "Dinheiro", short: "Dinheiro", icon: "M3 7h18v10H3zM12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM6.5 10v4M17.5 10v4" },
  { id: "vale", label: "Vale-refeição / alimentação", short: "Vale", icon: "M6 3v6a2 2 0 0 0 4 0V3M8 11v10M17 21V3c-1.8 1-3 3.6-3 7v3h3" },
  { id: "carteira", label: "Carteira digital", short: "Carteira", icon: "M19 7V5.5A1.5 1.5 0 0 0 17.5 4h-12A2.5 2.5 0 0 0 3 6.5v11A2.5 2.5 0 0 0 5.5 20h14a1.5 1.5 0 0 0 1.5-1.5v-10A1.5 1.5 0 0 0 19.5 7H5.5A2.5 2.5 0 0 1 3 4.5M16.5 13.5h.01" },
  { id: "boleto", label: "Boleto", short: "Boleto", icon: "M4 6v12M7 6v12M10.5 6v12M13 6v12M16.5 6v12M20 6v12" },
  { id: "poupanca", label: "Poupança / reserva", short: "Poupança", icon: "M12 9c4.4 0 8-1.3 8-3s-3.6-3-8-3-8 1.3-8 3 3.6 3 8 3zM4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" },
  { id: "outro", label: "Outro", short: "Outro", icon: "M5.5 12h.01M12 12h.01M18.5 12h.01" },
];

const TYPE_IDS = new Set<string>(PAYMENT_TYPES.map((t) => t.id));
export const isPaymentType = (v: unknown): v is PaymentType => typeof v === "string" && TYPE_IDS.has(v);
export const paymentType = (id: string | null | undefined) => PAYMENT_TYPES.find((t) => t.id === id) ?? PAYMENT_TYPES[0];

/**
 * Bancos mais comuns: selo com as iniciais na cor do banco (não são os logotipos oficiais).
 * `logo`: para usar uma imagem própria, coloque o arquivo em public/bancos/ e o caminho aqui
 * (ex.: "/bancos/nubank.svg"); o selo passa a mostrar a imagem.
 */
export interface Bank {
  id: string;
  name: string;
  initials: string;
  bg: string;
  fg: string;
  logo?: string;
  /** Para reconhecer o banco pelo nome digitado (sem acento, minúsculas). */
  match: RegExp;
}

export const BANKS: Bank[] = [
  { id: "nubank", name: "Nubank", initials: "NU", bg: "#820ad1", fg: "#ffffff", match: /nubank|\bnu\b|roxinho/ },
  { id: "itau", name: "Itaú", initials: "IT", bg: "#ec7000", fg: "#ffffff", match: /itau/ },
  { id: "bradesco", name: "Bradesco", initials: "BR", bg: "#cc092f", fg: "#ffffff", match: /bradesco/ },
  { id: "santander", name: "Santander", initials: "SA", bg: "#e30613", fg: "#ffffff", match: /santander/ },
  { id: "bb", name: "Banco do Brasil", initials: "BB", bg: "#f7d117", fg: "#24358a", match: /banco do brasil|\bbb\b/ },
  { id: "caixa", name: "Caixa", initials: "CX", bg: "#0066b3", fg: "#ffffff", match: /\bcaixa\b|\bcef\b/ },
  { id: "inter", name: "Inter", initials: "IN", bg: "#ff7a00", fg: "#ffffff", match: /\binter\b/ },
  { id: "c6", name: "C6 Bank", initials: "C6", bg: "#242424", fg: "#ffffff", match: /\bc6\b/ },
  { id: "picpay", name: "PicPay", initials: "PP", bg: "#11c76f", fg: "#ffffff", match: /picpay/ },
  { id: "mercadopago", name: "Mercado Pago", initials: "MP", bg: "#009ee3", fg: "#ffffff", match: /mercado ?pago/ },
  { id: "btg", name: "BTG Pactual", initials: "BTG", bg: "#0d2a4d", fg: "#ffffff", match: /\bbtg\b/ },
  { id: "xp", name: "XP", initials: "XP", bg: "#151515", fg: "#f5c518", match: /\bxp\b/ },
  { id: "neon", name: "Neon", initials: "NE", bg: "#0bc5e8", fg: "#06283d", match: /\bneon\b/ },
  { id: "pagbank", name: "PagBank", initials: "PB", bg: "#19a959", fg: "#ffffff", match: /pagbank|pagseguro/ },
  { id: "sicoob", name: "Sicoob", initials: "SC", bg: "#00a091", fg: "#ffffff", match: /sicoob/ },
  { id: "sicredi", name: "Sicredi", initials: "SI", bg: "#3fa110", fg: "#ffffff", match: /sicredi/ },
  { id: "banrisul", name: "Banrisul", initials: "BA", bg: "#0060a8", fg: "#ffffff", match: /banrisul/ },
  { id: "will", name: "Will Bank", initials: "WB", bg: "#ffd900", fg: "#1d1d1b", match: /\bwill\b/ },
  { id: "pan", name: "Banco Pan", initials: "PN", bg: "#00a3e0", fg: "#ffffff", match: /\bpan\b/ },
  { id: "mercantil", name: "Mercantil", initials: "ME", bg: "#003a70", fg: "#ffffff", match: /mercantil/ },
];

export const bankById = (id: string | null | undefined) => (id ? BANKS.find((b) => b.id === id) ?? null : null);

/** Cor da forma de pagamento (selo, pontos e gráficos): com banco, a cor do banco; sem, a cor guardada. */
export const methodColor = (bank: string | null | undefined, stored: string) => bankById(bank)?.bg ?? stored;
export const isBankId = (v: unknown): v is string => typeof v === "string" && BANKS.some((b) => b.id === v);

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();

/** Banco pelo nome (ex.: "Crédito Nubank" → nubank). */
export function guessBank(name: string): string | null {
  const n = fold(name);
  return BANKS.find((b) => b.match.test(n))?.id ?? null;
}

/** Tipo pelo nome (o crédito vem de is_credit). */
export function guessPaymentType(name: string, isCredit = false): PaymentType {
  if (isCredit) return "credito";
  const n = fold(name);
  if (/\bpix\b/.test(n)) return "pix";
  if (/dinheiro|especie/.test(n)) return "dinheiro";
  if (/\b(vr|va|vale|ticket|alelo|sodexo|pluxee|caju|flash)\b/.test(n)) return "vale";
  if (/debito/.test(n)) return "debito";
  if (/boleto/.test(n)) return "boleto";
  if (/poupanca|caixinha/.test(n)) return "poupanca";
  return "conta";
}
