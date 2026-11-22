import Link from "next/link";
import { Money } from "./ui";
import { ShowMore } from "./ShowMore";
import { formatBRL } from "@/lib/format";

export interface CategoryRow {
  id: number | null;
  name: string;
  emoji: string;
  total: number;
  count: number;
  budget: number | null;
}

const VISIBLE = 6;

/** Gastos por categoria: barras numa cor só, da maior para a menor. */
export function CategoryBars({ rows, month }: { rows: CategoryRow[]; month: string }) {
  const max = Math.max(...rows.map((r) => r.total), 1);
  const total = rows.reduce((a, r) => a + Math.max(r.total, 0), 0) || 1;
  const head = rows.slice(0, VISIBLE);
  const tail = rows.slice(VISIBLE);
  const tailTotal = tail.reduce((a, r) => a + r.total, 0);

  const Row = ({ r }: { r: CategoryRow }) => {
    // Meta da categoria (tela Metas): passou = vermelho, perto (90%) = dourado
    const over = r.budget != null && r.total > r.budget;
    const near = !over && r.budget != null && r.total >= r.budget * 0.9;
    const share = Math.round((Math.max(r.total, 0) / total) * 100);
    const width = Math.max((Math.max(r.total, 0) / max) * 100, 2);
    return (
      <li>
        <Link href={`/lancamentos?m=${month}&cat=${r.id ?? "sem"}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-paper/60">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-paper text-[17px]" aria-hidden>
            {r.emoji}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline justify-between gap-3">
              <span className="truncate text-[15px] font-medium">{r.name}</span>
              <Money cents={r.total} className="text-[15px] font-semibold" />
            </span>
            <span className="mt-1.5 flex items-center gap-2.5">
              <span className="h-2 flex-1 rounded-full bg-paper">
                <span className={`block h-full rounded-full ${over ? "bg-danger" : near ? "bg-[#e39a2d]" : "bg-ink"}`} style={{ width: `${width}%` }} />
              </span>
              <span className="num w-9 text-right text-[12px] text-ink-3">{share}%</span>
            </span>
            {r.budget != null && (
              <span className={`mt-1 block text-[12px] ${over ? "font-medium text-danger" : near ? "font-medium text-[#8f5208]" : "text-ink-3"}`}>
                <span aria-hidden>🎯 </span>
                {over
                  ? `${formatBRL(r.total - r.budget)} acima da meta (${formatBRL(r.budget)})`
                  : `Meta ${formatBRL(r.budget)}, sobram ${formatBRL(r.budget - r.total)}`}
              </span>
            )}
          </span>
        </Link>
      </li>
    );
  };

  return (
    <>
      <ul>
        {head.map((r) => (
          <Row key={r.id ?? "sem"} r={r} />
        ))}
      </ul>
      {tail.length > 0 && (
        <ShowMore
          more={
            <>
              Ver mais {tail.length} {tail.length === 1 ? "categoria" : "categorias"}
              <span className="font-medium text-ink-3">
                · <Money cents={tailTotal} />
              </span>
            </>
          }
        >
          <ul>
            {tail.map((r) => (
              <Row key={r.id ?? "sem"} r={r} />
            ))}
          </ul>
        </ShowMore>
      )}
    </>
  );
}
