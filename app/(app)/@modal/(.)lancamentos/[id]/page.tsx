import { Modal } from "@/components/Modal";
import { EntryEditor } from "@/components/EditEntry";
import { loadEntryEditor } from "@/lib/edit";
import { EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

// Clicar num lançamento abre a edição por cima da página atual (janela no computador, folha no celular).
export default async function EditarLancamentoModal({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadEntryEditor(Number(id));
  return (
    <Modal label="Editar lançamento">
      {data ? (
        <EntryEditor data={data} mode="modal" back={`/lancamentos?m=${data.entry.month}`} />
      ) : (
        <EmptyState>Esse lançamento não existe mais.</EmptyState>
      )}
    </Modal>
  );
}
