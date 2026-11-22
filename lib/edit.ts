import { getEntry, getIncome, getIncomeSuggestions, getSuggestions, listCategories, listPaymentMethods } from "./data";
import { todayISO } from "./format";
import type { EntryEditorData, IncomeEditorData } from "@/components/EditEntry";

/** Dados para editar um gasto (janela e página). null se não existir mais. */
export async function loadEntryEditor(id: number): Promise<EntryEditorData | null> {
  const [entry, categories, suggestions, methods] = await Promise.all([
    getEntry(id),
    listCategories(),
    getSuggestions(),
    listPaymentMethods(),
  ]);
  if (!entry) return null;
  return {
    entry,
    recurringId: entry.recurringId,
    categories: categories.map(({ id, name, emoji }) => ({ id, name, emoji })),
    suggestions: suggestions.map(({ name, categoryId, paymentMethodId }) => ({ name, categoryId, paymentMethodId })),
    methods: methods.map(({ id, name, color, isCredit, closingDay }) => ({ id, name, color, isCredit, closingDay })),
    today: todayISO(),
  };
}

/** Dados para editar uma entrada (janela e página). null se não existir mais. */
export async function loadIncomeEditor(id: number): Promise<IncomeEditorData | null> {
  const [income, suggestions] = await Promise.all([getIncome(id), getIncomeSuggestions()]);
  if (!income) return null;
  return { income, suggestions, today: todayISO() };
}

/** Para onde voltar depois de editar na página inteira. */
export function safeBack(raw: string | undefined, fallback: string) {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : fallback;
}
