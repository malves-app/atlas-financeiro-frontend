import Link from "next/link";
import { Panel, SectionTitle } from "./ui";
import { GoalRow } from "./GoalVisuals";
import { TargetGlyph } from "./PageHeaders";
import { STATUS_WEIGHT, type GoalProgress } from "@/lib/goals";

const VISIBLE = 4;

/**
 * Metas no Painel: as mais urgentes primeiro (passou, atenção, no caminho), com anel e barra.
 * Sem metas, no mês atual, um convite curto para criar a primeira.
 */
export function GoalsPanel({
  month,
  items,
  invite,
  className = "",
}: {
  month: string;
  items: GoalProgress[];
  invite: boolean;
  className?: string;
}) {
  if (!items.length) {
    if (!invite) return null;
    return (
      <Panel className={`flex items-center gap-3 px-4 py-3.5 ${className}`}>
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft text-brand" aria-hidden>
          <TargetGlyph className="size-5" width={2} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold">Defina metas para o mês</div>
          <div className="text-[13px] text-ink-3">Quanto gastar no total, por categoria ou quanto guardar</div>
        </div>
        <Link href={`/metas/nova?m=${month}`} className="shrink-0 rounded-full bg-ink px-3.5 py-2 text-[13px] font-semibold text-white">
          Criar meta
        </Link>
      </Panel>
    );
  }
  // Mais urgente primeiro; no mesmo status, o limite mais perto de estourar (guardar vem depois)
  const urgency = (p: GoalProgress) => (p.saving ? -1 : p.ratio);
  const sorted = [...items].sort((a, b) => STATUS_WEIGHT[a.status] - STATUS_WEIGHT[b.status] || urgency(b) - urgency(a));
  const good = items.filter((p) => p.status === "ok" || p.status === "cumprida").length;
  const rest = sorted.length - VISIBLE;
  return (
    <Panel className={`pb-2 ${className}`}>
      <SectionTitle
        right={
          <Link href={`/metas?m=${month}`} className="text-[14px] font-medium text-brand">
            Ver metas
          </Link>
        }
      >
        Metas{" "}
        <span className="ml-1 text-[13px] font-normal text-ink-3">
          {good} de {items.length} no caminho
        </span>
      </SectionTitle>
      <ul>
        {sorted.slice(0, VISIBLE).map((p) => (
          <GoalRow key={p.goal.id} p={p} href={`/metas/${p.goal.id}?m=${month}`} />
        ))}
      </ul>
      {rest > 0 && (
        <Link href={`/metas?m=${month}`} className="mt-1 block border-t border-line px-4 py-3 text-[14px] font-medium text-brand">
          {rest === 1 ? "Ver a outra meta" : `Ver as outras ${rest} metas`}
        </Link>
      )}
    </Panel>
  );
}
