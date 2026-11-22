import { QuickAdd } from "@/components/QuickAdd";
import { loadQuickAddData } from "@/lib/quickadd";
import { readParams, type SearchParams } from "@/lib/page";

export const dynamic = "force-dynamic";

// "Lançar" aberto a partir de qualquer página: abre por cima dela (janela no computador, folha no celular).
// A janela em si fica no layout.tsx desta pasta.
export default async function NovoModal({ searchParams }: { searchParams: SearchParams }) {
  const { month, get } = await readParams(searchParams);
  const data = await loadQuickAddData();
  return <QuickAdd data={data} mode="modal" month={month} initialTab={get("tipo") === "entrada" ? "entrada" : "gasto"} />;
}
