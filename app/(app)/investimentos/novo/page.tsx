import { institutionsOf, isInvestmentKind } from "@/lib/investments";
import { listInvestments } from "@/lib/investments-data";
import { readParams, type SearchParams } from "@/lib/page";
import { InvestimentoTopBar } from "@/components/PageHeaders";
import { InvestmentForm } from "@/components/InvestmentForm";

export const dynamic = "force-dynamic";

// Aberta direto pelo endereço. Vindo de outra tela, abre numa janela (app/(app)/@modal/(.)investimentos/novo).
export default async function NovoInvestimento({ searchParams }: { searchParams: SearchParams }) {
  const { get } = await readParams(searchParams);
  const tipo = get("tipo") ?? "";
  const investments = await listInvestments();
  return (
    <div className="lg:mx-auto lg:max-w-xl">
      <InvestimentoTopBar title="Novo investimento" back="/investimentos" />
      <InvestmentForm initialKind={isInvestmentKind(tipo) ? tipo : "caixinha"} institutions={institutionsOf(investments)} />
    </div>
  );
}

