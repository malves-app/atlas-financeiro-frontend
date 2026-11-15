// Máscara de dinheiro do campo de valor (como nos apps de banco).

const number2 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 4590 -> "45,90" */
export const centsText = (cents: number) => number2.format(cents / 100);

/**
 * Novo valor em centavos a partir do texto do campo depois de uma tecla.
 * O que for digitado entra sempre no fim (como numa calculadora), esteja o cursor onde estiver;
 * apagar tira o último dígito; colar "R$ 12,34" vira 12,34.
 */
export function nextCents(current: number, typed: string): number {
  const before = centsText(current).replace(/\D/g, "");
  const after = typed.replace(/\D/g, "");
  let value: string;
  if (after.length > before.length) {
    let p = 0;
    while (p < before.length && before[p] === after[p]) p++;
    let q = 0;
    while (q < before.length - p && before[before.length - 1 - q] === after[after.length - 1 - q]) q++;
    value = String(current) + after.slice(p, after.length - q);
  } else if (after.length < before.length) {
    value = String(current).slice(0, -(before.length - after.length));
  } else {
    value = after;
  }
  const digits = value.replace(/^0+/, "").slice(0, 10);
  return Number(digits || "0");
}
