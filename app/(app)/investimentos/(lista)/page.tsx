import Link from "next/link";
import { todayISO } from "@/lib/format";
import { portfolio } from "@/lib/investments";
import { listInvestments, listMoves } from "@/lib/investments-data";
import { InvestimentosHeader } from "@/components/PageHeaders";
import { AllocationPanel, ClosedRow, EmptyInvestments, InvestmentCard, PortfolioHero } from "@/components/InvestmentVisuals";
import { ShowMore } from "@/components/ShowMore";

export const dynamic = "force-dynamic";

// Investimentos: o total guardado, quanto rendeu, a evolução, onde está o dinheiro e cada investimento.
// À parte do resto do site (não entra no saldo do mês, nas metas nem nas estatísticas).
export default async function Investimentos() {
  const today = todayISO();
  const [investments, moves] = await Promise.all([listInvestments(), listMoves()]);
  const p = portfolio(investments, moves, today);

  return (
    <div>
      <InvestimentosHeader />

      {investments.length === 0 ? (
        <EmptyInvestments />
      ) : (
        <div className="flex flex-col gap-3 lg:gap-4">
          <PortfolioHero p={p} today={today} />

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-4">
            <section aria-labelledby="inv-lista" className="min-w-0">
              <h2 id="inv-lista" className="px-4 pt-2 pb-2 text-[15px] font-semibold lg:px-1 lg:pt-1">
                Seus investimentos
                {p.holdings.length > 0 && <span className="font-normal text-ink-3"> · {p.holdings.length}</span>}
              </h2>
              {p.holdings.length === 0 ? (
                <p className="mx-3 rounded-[20px] bg-surface px-4 py-6 text-center text-[15px] text-ink-3 lg:mx-0">
                  Nenhum investimento aberto. Os encerrados estão no fim da lista.
                </p>
              ) : (
                <div className="grid gap-3 px-3 lg:px-0 2xl:grid-cols-2">
                  {p.holdings.map((h) => (
                    <InvestmentCard key={h.investment.id} h={h} />
                  ))}
                </div>
              )}

              <Link
                href="/investimentos/novo"
                className="mx-3 mt-3 flex items-center gap-3 rounded-[20px] border-2 border-dashed border-line px-4 py-4 text-ink-2 transition-colors hover:border-ink-3/50 hover:bg-surface/60 lg:mx-0"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface text-ink" aria-hidden>
                  <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </span>
                <span className="min-w-0">
                  <span className="block text-[15px] font-semibold text-ink">Novo investimento</span>
                  <span className="block text-[13px] text-ink-3">Caixinha, renda fixa, Tesouro, ações, cripto…</span>
                </span>
              </Link>

              {p.closed.length > 0 && (
                <div className="mx-3 mt-3 rounded-[20px] bg-surface pb-2 lg:mx-0">
                  <ShowMore more={`Encerrados · ${p.closed.length}`} less="Esconder encerrados">
                    <ul className="divide-y divide-line/70 pt-1">
                      {p.closed.map((h) => (
                        <ClosedRow key={h.investment.id} h={h} />
                      ))}
                    </ul>
                  </ShowMore>
                </div>
              )}
            </section>

            <aside className="lg:sticky lg:top-4">
              <AllocationPanel p={p} />
            </aside>
          </div>
        </div>
      )}
    </div>
  );
}
