import { getIncomeSuggestions, getSuggestions, listCategoriesByUse, listPaymentMethods } from "./data";
import { todayISO } from "./format";
import type { QuickAddData } from "@/components/QuickAdd";

/** Tudo o que o lançamento rápido precisa (para a janela e para a página /novo). */
export async function loadQuickAddData(): Promise<QuickAddData> {
  const methods = await listPaymentMethods();
  const [categories, suggestions, incomeSuggestions] = await Promise.all([
    listCategoriesByUse(),
    getSuggestions(),
    getIncomeSuggestions(),
  ]);
  return {
    categories: categories.map(({ id, name, emoji }) => ({ id, name, emoji })),
    suggestions: suggestions.map(({ name, categoryId, paymentMethodId }) => ({ name, categoryId, paymentMethodId })),
    methods: methods.map(({ id, name, color, isCredit, closingDay }) => ({ id, name, color, isCredit, closingDay })),
    incomeSuggestions,
    today: todayISO(),
  };
}
