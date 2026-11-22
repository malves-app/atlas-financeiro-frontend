import Link from "next/link";
import { categoryNames, ensureMonthGenerated, getMonthTotals, listGoals } from "@/lib/data";
import { monthLabel, todayISO } from "@/lib/format";
import { goalBoard, GOAL_KINDS, KIND_INFO, monthNameLower, monthsNeeded } from "@/lib/goals";
import { readParams, type SearchParams } from "@/lib/page";
import { MetasHeader } from "@/components/PageHeaders";
import { PendingSwap } from "@/components/NavState";
import { MetasBodySkeleton } from "@/components/PageSkeletons";
import { GoalCard, GoalsHero } from "@/components/GoalVisuals";

export const dynamic = "force-dynamic";

// Metas do mês na tela (limites e guardar) e as do ano daquele mês. Tocar numa meta abre para mudar o valor.
export default async function Metas({ searchParams }: { searchParams: SearchParams }) {
  const { month } = await readParams(searchParams);
  const today = todayISO();
  const { from, to } = monthsNeeded(month, today);
  await ensureMonthGenerated(month);
  const [goals, categories, totals] = await Promise.all([listGoals(), categoryNames(), getMonthTotals(from, to)]);
  const board = goalBoard(goals, { month, today, totals, categories, history: true });
  // O limite de gastos do mês fica no destaque e também na lista (o cartão dele tem o histórico)
  const total = board.monthly.find((p) => p.goal.kind === "total");
  const all = [...board.monthly, ...board.annual];
  const monthName = monthNameLower(month);
  const year = month.slice(0, 4);
  const edit = (id: number) => `/metas/${id}?m=${month}`;
  const nova = (kind?: string) => `/metas/nova?m=${month}${kind ? `&tipo=${kind}` : ""}`;

  return (
    <>
      <MetasHeader month={month} />

      <PendingSwap keys={["m"]} fallback={<MetasBodySkeleton />}>
        {all.length === 0 ? (
          <EmptyGoals month={month} hasOthers={goals.length > 0} nova={nova} />
        ) : (
          <div className="flex flex-col gap-3 lg:gap-4">
            <GoalsHero
              monthName={monthName}
              total={total}
              all={all}
              editHref={total ? edit(total.goal.id) : undefined}
              newTotalHref={nova("total")}
            />

            {board.monthly.length > 0 && (
              <section aria-labelledby="metas-mes" className="mt-2">
                <h2 id="metas-mes" className="px-4 pb-2 text-[15px] font-semibold lg:px-1">
                  Do mês
                </h2>
                <div className="grid gap-3 px-3 lg:grid-cols-2 lg:gap-4 lg:px-0">
                  {board.monthly.map((p) => (
                    <GoalCard key={p.goal.id} p={p} href={edit(p.goal.id)} />
                  ))}
                </div>
              </section>
            )}

            {board.annual.length > 0 && (
              <section aria-labelledby="metas-ano" className="mt-2">
                <h2 id="metas-ano" className="px-4 pb-2 text-[15px] font-semibold lg:px-1">
                  No ano de {year}
                </h2>
                <div className="grid gap-3 px-3 lg:grid-cols-2 lg:gap-4 lg:px-0">
                  {board.annual.map((p) => (
                    <GoalCard key={p.goal.id} p={p} href={edit(p.goal.id)} />
                  ))}
                </div>
              </section>
            )}

            <Link
              href={nova()}
              className="mx-3 mt-1 flex items-center gap-3 rounded-[20px] border-2 border-dashed border-line px-4 py-4 text-ink-2 transition-colors hover:border-ink-3/50 hover:bg-surface/60 lg:mx-0"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface text-ink" aria-hidden>
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </span>
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold text-ink">Nova meta</span>
                <span className="block text-[13px] text-ink-3">Limite por categoria, do cartão, do dia a dia ou quanto guardar</span>
              </span>
            </Link>
          </div>
        )}
      </PendingSwap>
    </>
  );
}

/** Sem metas no mês: o que dá para criar, cada tipo com um atalho. */
function EmptyGoals({ month, hasOthers, nova }: { month: string; hasOthers: boolean; nova: (kind?: string) => string }) {
  return (
    <section className="mx-3 mt-1 overflow-hidden rounded-[24px] bg-surface lg:mx-0">
      <div className="relative overflow-hidden bg-ink px-5 pt-6 pb-7 text-white lg:px-7">
        <svg viewBox="0 0 120 120" className="absolute -top-10 -right-10 size-36 opacity-70 lg:top-1/2 lg:right-8 lg:size-40 lg:-translate-y-1/2 lg:opacity-90" aria-hidden>
          <circle cx="60" cy="60" r="54" fill="none" stroke="rgb(255 255 255 / 0.08)" strokeWidth="10" />
          <circle cx="60" cy="60" r="36" fill="none" stroke="rgb(255 255 255 / 0.12)" strokeWidth="10" />
          <circle cx="60" cy="60" r="54" fill="none" stroke="#17b39b" strokeWidth="10" strokeLinecap="round" strokeDasharray="250 340" transform="rotate(-90 60 60)" />
          <circle cx="60" cy="60" r="36" fill="none" stroke="#e9a531" strokeWidth="10" strokeLinecap="round" strokeDasharray="150 227" transform="rotate(-90 60 60)" />
          <circle cx="60" cy="60" r="12" fill="#eef1f5" />
        </svg>
        <p className="relative text-[14px] text-white/65">{monthLabel(month)}</p>
        <h2 className="display relative mt-1 max-w-[14rem] text-[26px] leading-tight font-bold sm:max-w-none lg:max-w-[28rem]">
          {hasOthers ? "Nenhuma meta neste mês" : "Dê um rumo para o seu dinheiro"}
        </h2>
        <p className="relative mt-2 max-w-md text-[15px] text-white/75">
          Diga quanto quer gastar no mês, por categoria ou no cartão, ou quanto quer guardar. O Painel e a janela de lançar
          mostram como você está indo.
        </p>
      </div>
      <ul className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3 lg:p-4">
        {GOAL_KINDS.map((k) => {
          const info = KIND_INFO[k];
          return (
            <li key={k}>
              <Link href={nova(k)} className="flex h-full items-center gap-3 rounded-2xl bg-paper/70 px-3.5 py-3 transition-colors hover:bg-paper">
                <span className="grid size-10 shrink-0 place-items-center rounded-full text-[19px]" style={{ background: `${info.color}1f` }} aria-hidden>
                  {info.emoji}
                </span>
                <span className="min-w-0">
                  <span className="block text-[15px] font-semibold">{info.title}</span>
                  <span className="block text-[13px] leading-snug text-ink-3">{info.desc}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
