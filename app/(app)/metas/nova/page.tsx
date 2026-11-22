import Link from "next/link";
import { getMonthTotals, listCategories, listGoals } from "@/lib/data";
import { currentMonth, shiftMonth, todayISO } from "@/lib/format";
import { averages, goalKey, GOAL_KINDS, isGoalKind } from "@/lib/goals";
import { readParams, type SearchParams } from "@/lib/page";
import { GoalForm } from "@/components/GoalForm";

export const dynamic = "force-dynamic";

export default async function NovaMeta({ searchParams }: { searchParams: SearchParams }) {
  const { month, get } = await readParams(searchParams);
  const today = todayISO();
  const cur = currentMonth();
  const [categories, goals, totals] = await Promise.all([
    listCategories(),
    listGoals(),
    getMonthTotals(shiftMonth(cur, -6), shiftMonth(cur, -1)),
  ]);
  // Metas que já valem do mês na tela em diante (ou que começam depois dele) e as de cada ano,
  // para avisar antes de criar outra igual
  const existing = goals
    .filter((g) => g.period === "ano" || g.endMonth == null || g.endMonth >= month)
    .sort((a, b) => a.startMonth.localeCompare(b.startMonth))
    .map((g) => ({
      id: g.id,
      key: g.period === "ano" ? `${goalKey(g)}@${g.startMonth.slice(0, 4)}` : goalKey(g),
      startMonth: g.startMonth,
    }));
  // Sem tipo no endereço: o primeiro tipo que ainda não tem meta no mês
  const tipo = get("tipo") ?? "";
  const keys = new Set(existing.map((e) => e.key));
  const firstFree = GOAL_KINDS.find((k) => k === "categoria" || !keys.has(goalKey({ kind: k, period: "mes", categoryId: null }))) ?? "total";
  return (
    <div className="lg:mx-auto lg:max-w-xl">
      <header className="flex items-center gap-2 px-2 pt-[max(env(safe-area-inset-top),10px)] pb-1 lg:px-0 lg:pt-2 lg:pb-4">
        <Link href={`/metas?m=${month}`} aria-label="Voltar" className="grid size-10 place-items-center rounded-full text-ink-2 hover:bg-surface">
          <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </Link>
        <h1 className="display text-[20px] font-bold">Nova meta</h1>
      </header>
      <GoalForm
        month={month}
        currentYear={Number(cur.slice(0, 4))}
        categories={categories.map(({ id, name, emoji }) => ({ id, name, emoji }))}
        existing={existing}
        avg={averages([...totals.values()], today)}
        initialKind={isGoalKind(tipo) ? tipo : firstFree}
      />
    </div>
  );
}
