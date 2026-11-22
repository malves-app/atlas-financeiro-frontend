import { getMonthTotals, listCategories, listGoals } from "./data";
import { currentMonth, shiftMonth, todayISO } from "./format";
import { averages, goalKey, GOAL_KINDS, isGoalKind } from "./goals";

/** Dados do formulário de nova meta (página /metas/nova e a janela aberta por cima de outra tela). */
export async function newGoalFormProps(month: string, tipo: string) {
  const today = todayISO();
  const cur = currentMonth();
  const [categories, goals, totals] = await Promise.all([
    listCategories(),
    listGoals(),
    getMonthTotals(shiftMonth(cur, -6), shiftMonth(cur, -1)),
  ]);
  // Metas que já valem do mês na tela em diante (ou que começam depois dele) e as de cada ano,
  // para avisar antes de criar outra igual
  const existing = goals
    .filter((g) => g.period === "ano" || g.endMonth == null || g.endMonth >= month)
    .sort((a, b) => a.startMonth.localeCompare(b.startMonth))
    .map((g) => ({
      id: g.id,
      key: g.period === "ano" ? `${goalKey(g)}@${g.startMonth.slice(0, 4)}` : goalKey(g),
      startMonth: g.startMonth,
    }));
  // Sem tipo no endereço: o primeiro tipo que ainda não tem meta no mês
  const keys = new Set(existing.map((e) => e.key));
  const firstFree = GOAL_KINDS.find((k) => k === "categoria" || !keys.has(goalKey({ kind: k, period: "mes", categoryId: null }))) ?? "total";
  return {
    month,
    currentYear: Number(cur.slice(0, 4)),
    categories: categories.map(({ id, name, emoji }) => ({ id, name, emoji })),
    existing,
    avg: averages([...totals.values()], today),
    initialKind: isGoalKind(tipo) ? tipo : firstFree,
  };
}
