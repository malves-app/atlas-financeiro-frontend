import { IncomeEditor } from "@/components/EditEntry";
import { loadIncomeEditor } from "@/lib/edit";
import { EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

// Clicar numa entrada abre a edição por cima da página atual.
// A janela em si fica no layout.tsx desta pasta.
export default async function EditarEntradaModal({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadIncomeEditor(Number(id));
  return data ? (
    <IncomeEditor data={data} mode="modal" back={`/lancamentos?m=${data.income.month}&tab=entradas`} />
  ) : (
    <EmptyState>Essa entrada não existe mais.</EmptyState>
  );
}
