import Link from "next/link";
import { notFound } from "next/navigation";
import { todayISO } from "@/lib/format";
import { history, isMoveKind, monthlySeries, position } from "@/lib/investments";
import { getInvestment, listMoves } from "@/lib/investments-data";
import { readParams, type SearchParams } from "@/lib/page";
import { reopenInvestmentAction } from "@/app/actions";
import { InvestimentoTopBar } from "@/components/PageHeaders";
import { HistoryList, InvestmentHero } from "@/components/InvestmentVisuals";
import { MoveForm } from "@/components/MoveForm";
import { SubmitButton } from "@/components/SubmitButton";

export const dynamic = "force-dynamic";

// Um investimento: saldo, aplicado, rendimento e evolução; registrar aporte, resgate ou o saldo de hoje; histórico.
export default async function Investimento({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { id } = await params;
  const { get } = await readParams(searchParams);
  const investment = await getInvestment(Number(id));
  if (!investment) notFound();
  const moves = await listMoves(investment.id);
  const today = todayISO();
  const p = position(moves);
  const acao = get("acao") ?? "";

  return (
    <div>
      <InvestimentoTopBar
        title={investment.name}
        back="/investimentos"
        right={
          <Link
            href={`/investimentos/${investment.id}/editar`}
            className="mr-2 inline-flex shrink-0 items-center gap-1.5 rounded-full bg-surface px-3.5 py-2 text-[14px] font-semibold text-ink-2 ring-1 ring-line hover:text-ink lg:mr-0"
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" />
            </svg>
            Editar
          </Link>
        }
      />

      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-4">
        <div className="lg:col-start-1 lg:row-start-1">
          <InvestmentHero
            kind={investment.kind}
            institution={investment.institution}
            target={investment.targetCents}
            position={p}
            series={monthlySeries(moves, today)}
            archived={investment.archived}
          />
        </div>

        <div className="lg:sticky lg:top-4 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          {investment.archived ? (
            <section className="mx-3 rounded-[24px] bg-surface p-4 lg:mx-0 lg:p-5">
              <h2 className="text-[15px] font-semibold">Investimento encerrado</h2>
              <p className="mt-1 text-[14px] text-ink-2">Não aparece na lista nem no total. O histórico continua na evolução.</p>
              <form action={reopenInvestmentAction} className="mt-3">
                <input type="hidden" name="id" value={investment.id} />
                <SubmitButton pendingLabel="Reabrindo…" className="rounded-full bg-ink px-4 py-2.5 text-[14px] font-semibold text-white">
                  Reabrir investimento
                </SubmitButton>
              </form>
            </section>
          ) : (
            <MoveForm
              key={investment.id}
              investmentId={investment.id}
              balance={p.balance}
              lastDate={p.lastDate}
              today={today}
              initialKind={isMoveKind(acao) ? acao : "aporte"}
            />
          )}
        </div>

        <div className="lg:col-start-1 lg:row-start-2">
          <HistoryList rows={history(moves)} canDelete={!investment.archived} />
        </div>
      </div>
    </div>
  );
}
