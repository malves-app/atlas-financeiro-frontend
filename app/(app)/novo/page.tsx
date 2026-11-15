import { QuickAdd } from "@/components/QuickAdd";
import { loadQuickAddData } from "@/lib/quickadd";
import { readParams, type SearchParams } from "@/lib/page";

export const dynamic = "force-dynamic";

// Página inteira de lançar: quando o endereço /novo é aberto direto (atalho, recarregar a página).
export default async function Novo({ searchParams }: { searchParams: SearchParams }) {
  const { month, get } = await readParams(searchParams);
  const data = await loadQuickAddData();
  const nonce = get("n") ?? "0";
  return (
    <div className="lg:mx-auto lg:max-w-xl">
      <QuickAdd key={nonce} data={data} mode="page" month={month} initialTab={get("tipo") === "entrada" ? "entrada" : "gasto"} />
    </div>
  );
}
