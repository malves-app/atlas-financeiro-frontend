// Nomes legíveis das linhas do banco: "UBER UBER *TRIP HELP U" → "Uber"; "Pix enviado · Fulano de tal" → "Fulano de Tal".
// Os prefixos (MP*, PG*, IFD*...) são das maquininhas e servem para qualquer banco.

import type { ExtratoLine } from "./types";

const MERCHANTS: [RegExp, string][] = [
  [/\bUBER\b|UBERRIDES|UBER\s*\*/i, "Uber"],
  [/^IFD\*|\bIFOOD\b/i, "iFood"],
  [/^SHOPEE/i, "Shopee"],
  [/^MERCADO\s?LIVRE/i, "Mercado Livre"],
  [/^AMAZON PRIME/i, "Amazon Prime"],
  [/^AMAZON/i, "Amazon"],
  [/APPLE\s?\.?\s?COM\s*\/?\s*BILL/i, "Apple"],
  [/NETFLIX/i, "Netflix"],
  [/SPOTIFY/i, "Spotify"],
  [/SHEIN/i, "Shein"],
  [/ALIEXPRESS/i, "AliExpress"],
  [/ANTHROPIC|CLAUDE/i, "Claude"],
  [/HBO\s?MAX/i, "HBO Max"],
  [/DISNEY/i, "Disney+"],
  [/GLOBOPLAY/i, "Globoplay"],
  [/YOUTUBE/i, "YouTube"],
  [/MELI\s?MAIS|MELI\+/i, "Meli+"],
  [/OPENAI|CHATGPT/i, "ChatGPT"],
  [/GOOGLE/i, "Google"],
  [/MICROSOFT/i, "Microsoft"],
  [/SMART\s?FIT/i, "Smart Fit"],
  [/PAGUE\s?MENOS/i, "Pague Menos"],
  [/DROGASIL/i, "Drogasil"],
  [/RAIA\b/i, "Droga Raia"],
  [/ENERGISA/i, "Energisa"],
  [/MC\s?DONALDS?/i, "McDonald's"],
  [/BURGER\s?KING/i, "Burger King"],
  [/\b99\s?(APP|POP|TAXI)/i, "99"],
  [/ESTACION/i, "Estacionamento"],
  [/^IOF\b/i, "IOF"],
  [/^ANUIDADE/i, "Anuidade do cartão"],
];

const SMALL = new Set(["de", "da", "do", "das", "dos", "e"]);
const COMPANY = /\b(LTDA|ME|EIRELI|S\/?A|EPP|MEI)\b\.?/gi;

/** Até `n` palavras, sem terminar em "de", "dos"... */
function firstWords(words: string[], n = 3) {
  const out = words.slice(0, n);
  while (out.length > 1 && SMALL.has(out[out.length - 1].toLowerCase())) out.pop();
  return out;
}
export const titleCase = (s: string) =>
  s
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w, i) => (i > 0 && SMALL.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");

/** Nome legível de uma compra do cartão: "UBER UBER *TRIP HELP U" → "Uber"; "PG *TEC CONCURSOS" → "Tec Concursos". */
export function merchantName(description: string): string {
  for (const [re, name] of MERCHANTS) if (re.test(description)) return name;
  const cleaned = description
    .replace(/^(MP|PG|EC|DL|PAG|IFD|BRS|PP)\s*\*\s*/i, "")
    .replace(/\*/g, " ")
    .replace(/\b\d{1,2}\/\d{1,2}\b/g, " ")
    .replace(COMPANY, " ")
    .replace(/\b(POS|COM|BR|BRA)\b/gi, " ")
    .replace(/\b[A-Z]{1,3}\d+\w*\b/g, " ")
    .replace(/[^\p{L}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = firstWords([...new Set(cleaned.split(" ").filter((w) => w.length > 1))]);
  return words.length ? titleCase(words.join(" ")) : titleCase(description).slice(0, 40);
}

/** Nome de uma linha do extrato: quem recebeu/pagou; sem isso, a descrição. */
export function extratoName(l: Pick<ExtratoLine, "counterpart" | "kind">): string {
  if (l.counterpart) {
    const words = firstWords(l.counterpart.replace(COMPANY, " ").trim().split(/\s+/).filter(Boolean));
    if (words.length) return titleCase(words.join(" ")).slice(0, 60);
  }
  return l.kind ? l.kind.charAt(0).toUpperCase() + l.kind.slice(1).toLowerCase() : "Sem nome";
}
