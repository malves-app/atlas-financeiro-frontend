import { notFound } from "next/navigation";
import { EntryEditor } from "@/components/EditEntry";
import { loadEntryEditor, safeBack } from "@/lib/edit";
import { readParams, type SearchParams } from "@/lib/page";

export const dynamic = "force-dynamic";

// Página inteira de edição: quando o endereço é aberto direto (recarregar, link salvo).
export default async function EditarLancamento({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const { get } = await readParams(searchParams);
  const data = await loadEntryEditor(Number(id));
  if (!data) notFound();
  const back = safeBack(
    get("back"),
    data.entry.kind === "avulso" ? `/lancamentos?m=${data.entry.month}` : `/fixos?m=${data.entry.month}`,
  );
  return (
    <div className="lg:mx-auto lg:max-w-xl">
      <EntryEditor data={data} mode="page" back={back} />
    </div>
  );
}
