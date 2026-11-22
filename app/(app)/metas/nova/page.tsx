import Link from "next/link";
import { newGoalFormProps } from "@/lib/goal-form";
import { readParams, type SearchParams } from "@/lib/page";
import { GoalForm } from "@/components/GoalForm";

export const dynamic = "force-dynamic";

// Aberta direto pelo endereço. Vindo de outra tela, a nova meta abre numa janela (app/(app)/@modal/(.)metas/nova).
export default async function NovaMeta({ searchParams }: { searchParams: SearchParams }) {
  const { month, get } = await readParams(searchParams);
  const props = await newGoalFormProps(month, get("tipo") ?? "");
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
      <GoalForm {...props} />
    </div>
  );
}
