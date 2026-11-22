import {
  categoryNames,
  ensureMonthGenerated,
  getIncomeSuggestions,
  getMonthTotals,
  getSuggestions,
  listCategoriesByUse,
  listGoals,
  listPaymentMethods,
} from "./data";
import { currentMonth, shiftMonth, todayISO } from "./format";
import { goalHints, goalsFor } from "./goals";
import type { QuickAddData } from "@/components/QuickAdd";

/** Tudo o que o lançamento rápido precisa (para a janela e para a página /novo). */
export async function loadQuickAddData(): Promise<QuickAddData> {
  const methodsP = listPaymentMethods();
  const [methods, categories, suggestions, incomeSuggestions, goals, names] = await Promise.all([
    methodsP,
    methodsP.then(() => listCategoriesByUse()),
    getSuggestions(),
    getIncomeSuggestions(),
    listGoals(),
    categoryNames(),
  ]);
  // Metas de limite do mês atual e do próximo (no cartão, compras depois do fechamento caem no próximo)
  const months = [currentMonth(), shiftMonth(currentMonth(), 1)];
  const limited = months.some((m) => goalsFor(goals, m).monthly.some((g) => g.kind !== "guardar"));
  let hints: QuickAddData["goalHints"] = [];
  if (limited) {
    await Promise.all(months.map((m) => ensureMonthGenerated(m)));
    hints = goalHints(goals, await getMonthTotals(months[0], months[1]), months, names);
  }
  return {
    categories: categories.map(({ id, name, emoji }) => ({ id, name, emoji })),
    suggestions: suggestions.map(({ name, categoryId, paymentMethodId }) => ({ name, categoryId, paymentMethodId })),
    methods: methods.map(({ id, name, color, isCredit, closingDay }) => ({ id, name, color, isCredit, closingDay })),
    incomeSuggestions,
    today: todayISO(),
    goalHints: hints,
  };
}
