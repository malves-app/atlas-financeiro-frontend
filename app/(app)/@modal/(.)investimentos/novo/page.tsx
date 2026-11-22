import { institutionsOf, isInvestmentKind } from "@/lib/investments";
import { listInvestments } from "@/lib/investments-data";
import { readParams, type SearchParams } from "@/lib/page";
import { InvestmentForm } from "@/components/InvestmentForm";
import { SheetHeader } from "@/components/Modal";

export const dynamic = "force-dynamic";

export default async function NovoInvestimentoModal({ searchParams }: { searchParams: SearchParams }) {
  const { get } = await readParams(searchParams);
  const tipo = get("tipo") ?? "";
  const investments = await listInvestments();
  return (
    <>
      <SheetHeader title="Novo investimento" />
      <InvestmentForm initialKind={isInvestmentKind(tipo) ? tipo : "caixinha"} institutions={institutionsOf(investments)} mode="modal" />
    </>
  );
}
