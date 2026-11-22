import Link from "next/link";
import { notFound } from "next/navigation";
import { categoryNames, ensureMonthGenerated, getMonthTotals, listCategories, listGoals } from "@/lib/data";
import { currentMonth, shiftMonth, todayISO } from "@/lib/format";
import { averages, goalName, goalProgress, monthNameLower, monthsNeeded } from "@/lib/goals";
import { readParams, type SearchParams } from "@/lib/page";
import { endGoalAction } from "@/app/actions";
import { GoalForm } from "@/components/GoalForm";
import { GoalCard } from "@/components/GoalVisuals";
import { SubmitButton } from "@/components/SubmitButton";

export const dynamic = "force-dynamic";

export default async function EditarMeta({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { id } = await params;
  const { month: viewMonth } = await readParams(searchParams);
  const today = todayISO();
  const cur = currentMonth();
  const goals = await listGoals();
  const goal = goals.find((g) => g.id === Number(id));
  if (!goal) notFound();
  // Meta do ano: o mês na tela é um mês daquele ano; meta do mês: um mês em que ela vale
  const month =
    goal.period === "ano"
      ? viewMonth.slice(0, 4) === goal.startMonth.slice(0, 4)
        ? viewMonth
        : `${goal.startMonth.slice(0, 4)}-${cur.slice(5, 7)}`
      : viewMonth < goal.startMonth
        ? goal.startMonth
        : goal.endMonth && viewMonth > goal.endMonth
          ? goal.endMonth
          : viewMonth;
  const { from, to } = monthsNeeded(month, today);
  await ensureMonthGenerated(month);
  const [categories, names, totals, recent] = await Promise.all([
    listCategories(),
    categoryNames(),
    getMonthTotals(from, to),
    getMonthTotals(shiftMonth(cur, -6), shiftMonth(cur, -1)),
  ]);
  const p = goalProgress(goal, { month, today, totals, categories: names, allGoals: goals });
  const { name, emoji, sub } = goalName(goal, names);
  const startsHere = goal.period === "ano" || goal.startMonth >= month;

  return (
    <div className="lg:mx-auto lg:max-w-xl">
      <header className="flex items-center gap-2 px-2 pt-[max(env(safe-area-inset-top),10px)] pb-1 lg:px-0 lg:pt-2 lg:pb-4">
        <Link href={`/metas?m=${viewMonth}`} aria-label="Voltar" className="grid size-10 place-items-center rounded-full text-ink-2 hover:bg-surface">
          <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </Link>
        <h1 className="display text-[20px] font-bold">Editar meta</h1>
      </header>

      <div className="px-3 pb-4 lg:px-0">
        <GoalCard p={p} />
      </div>

      <GoalForm
        month={month}
        currentYear={Number(cur.slice(0, 4))}
        categories={categories.map(({ id, name, emoji }) => ({ id, name, emoji }))}
        existing={[]}
        avg={averages([...recent.values()], today)}
        goal={{ ...goal, name, emoji, sub }}
      />

      <form action={endGoalAction} className="mx-5 mt-4 mb-6 rounded-2xl bg-surface p-4">
        <input type="hidden" name="id" value={goal.id} />
        <input type="hidden" name="month" value={month} />
        <h2 className="text-[15px] font-semibold">{startsHere ? "Apagar esta meta" : "Encerrar esta meta"}</h2>
        <p className="mt-1 text-[14px] text-ink-2">
          {startsHere
            ? "A meta some da tela Metas, do Painel e da janela de lançar."
            : `Ela deixa de valer a partir de ${monthNameLower(month)}. Os meses anteriores continuam com ela no histórico.`}
        </p>
        <SubmitButton
          tone="light"
          pendingLabel={startsHere ? "Apagando…" : "Encerrando…"}
          loaderClassName="size-4"
          className="mt-3 rounded-full bg-danger-soft px-4 py-2.5 text-[14px] font-semibold text-danger"
        >
          {startsHere ? "Apagar meta" : "Encerrar meta"}
        </SubmitButton>
      </form>
    </div>
  );
}
