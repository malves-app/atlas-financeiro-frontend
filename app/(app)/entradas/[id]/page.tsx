import { notFound } from "next/navigation";
import { IncomeEditor } from "@/components/EditEntry";
import { loadIncomeEditor } from "@/lib/edit";

export const dynamic = "force-dynamic";

// Página inteira de edição de entrada: quando o endereço é aberto direto.
export default async function EditarEntrada({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadIncomeEditor(Number(id));
  if (!data) notFound();
  return (
    <div className="lg:mx-auto lg:max-w-xl">
      <IncomeEditor data={data} mode="page" back={`/lancamentos?m=${data.income.month}&tab=entradas`} />
    </div>
  );
}
