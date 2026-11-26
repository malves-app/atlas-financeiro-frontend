import type { NextRequest } from "next/server";
import { categoryNames, getMonth, listPaymentMethods, subcategoryLookup } from "@/lib/data";
import { currentMonth, isMonth } from "@/lib/format";
import { expensesCsv, exportFilename, filterEntries, incomesCsv, readEntryFilter } from "@/lib/entries-export";

export const dynamic = "force-dynamic";

/**
 * Planilha (CSV) dos lançamentos com o mesmo filtro da tela Lançamentos:
 * /exportar/lancamentos?m=2026-11&tab=gastos&f=todos&pm=3&cat=1&q=uber
 * Fora de app/(app): é um download (sem layout, sem janela interceptada).
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const m = sp.get("m");
  const month = isMonth(m) ? m : currentMonth();
  const tab = sp.get("tab") === "entradas" ? "entradas" : "gastos";
  const filter = readEntryFilter((k) => sp.get(k));

  let csv: string;
  let filename: string;
  if (tab === "entradas") {
    const summary = await getMonth(month);
    csv = incomesCsv(summary.incomes);
    filename = exportFilename(month, tab, filter);
  } else {
    const [summary, methods, categories, subcategories] = await Promise.all([
      getMonth(month),
      listPaymentMethods(),
      categoryNames(),
      subcategoryLookup(),
    ]);
    const methodById = new Map(methods.map((x) => [x.id, x]));
    csv = expensesCsv(filterEntries(summary.entries, filter), { categories, subcategories, methods: methodById });
    filename = exportFilename(month, tab, filter, {
      method: filter.pm ? methodById.get(Number(filter.pm))?.name : undefined,
      category: filter.cat && filter.cat !== "sem" ? categories.get(Number(filter.cat))?.name : undefined,
    });
  }

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}
