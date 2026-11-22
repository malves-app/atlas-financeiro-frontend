import Link from "next/link";
import { formatBRL, formatDay, monthLabel, MONTH_NAMES } from "@/lib/format";
import {
  agoText,
  INVESTMENT_KINDS,
  KIND_INFO,
  signedBRL,
  signedPercent,
  type HistoryRow,
  type Holding,
  type InvestmentKind,
  type Portfolio,
  type Position,
  type SeriesPoint,
} from "@/lib/investments";
import { EvolutionChart } from "./InvestmentChart";
import { MoveDelete } from "./MoveForm";
import { StackedBar } from "./ui";
import { ShowMore } from "./ShowMore";

// Peças visuais dos Investimentos (lista, detalhe e editar). As contas estão em lib/investments.ts.

const GOLD = "#e39a2d"; // meta alcançada (o gomo dourado da marca)
const GREEN = "#12a08a";

/** Emoji do tipo num quadradinho com a cor do tipo bem clara. */
export function KindTile({ kind, dark = false, size = "md" }: { kind: InvestmentKind; dark?: boolean; size?: "md" | "lg" }) {
  const info = KIND_INFO[kind];
  return (
    <span
      className={`grid shrink-0 place-items-center ${size === "lg" ? "size-12 rounded-2xl text-[24px]" : "size-11 rounded-[14px] text-[21px]"}`}
      style={{ background: dark ? "rgb(255 255 255 / 0.1)" : `${info.color}1f` }}
      aria-hidden
    >
      {info.emoji}
    </span>
  );
}

function Arrow({ up }: { up: boolean }) {
  return (
    <svg viewBox="0 0 12 12" className="size-2.5 shrink-0" aria-hidden>
      <path d={up ? "M6 2l4.5 7h-9z" : "M6 10L1.5 3h9z"} fill="currentColor" />
    </svg>
  );
}

/** Rendimento com sinal, seta e porcentagem (a cor nunca aparece sozinha). */
export function Gain({ cents, ratio, dark = false, className = "" }: { cents: number; ratio?: number | null; dark?: boolean; className?: string }) {
  const up = cents > 0;
  const down = cents < 0;
  const color = dark
    ? up
      ? "text-[#7fe0cf]"
      : down
        ? "text-[#ffb3bb]"
        : "text-white/70"
    : up
      ? "text-brand"
      : down
        ? "text-danger"
        : "text-ink-3";
  return (
    <span className={`num inline-flex flex-wrap items-center gap-x-1 font-semibold ${color} ${className}`}>
      <span className="inline-flex items-center gap-1 whitespace-nowrap">
        {(up || down) && <Arrow up={up} />}
        {signedBRL(cents)}
      </span>
      {ratio != null && cents !== 0 && <span className="font-medium whitespace-nowrap opacity-85">({signedPercent(ratio)})</span>}
    </span>
  );
}

/** Barra da meta de um investimento: verde enquanto junta, dourada quando chega. */
function TargetBar({ balance, target, dark = false }: { balance: number; target: number; dark?: boolean }) {
  const ratio = Math.max(0, balance / target);
  const done = ratio >= 1;
  return (
    <div>
      <div
        className={`h-2 overflow-hidden rounded-full ${dark ? "bg-white/10" : "bg-paper"}`}
        role="img"
        aria-label={`${Math.round(ratio * 100)}% da meta`}
      >
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none"
          style={{ width: `${Math.min(ratio, 1) * 100}%`, background: done ? GOLD : dark ? "#5fd3bf" : GREEN }}
        />
      </div>
      <p className={`mt-1.5 flex items-baseline justify-between gap-3 text-[12.5px] ${dark ? "text-white/65" : "text-ink-3"}`}>
        <span>
          {done ? (
            <span className={`font-semibold ${dark ? "text-[#f6c977]" : "text-[#8f5208]"}`}>Meta alcançada</span>
          ) : (
            <>
              Faltam{" "}
              <span className={`font-semibold ${dark ? "text-white" : "text-ink-2"}`}>
                {formatBRL(target - balance)}
              </span>
            </>
          )}{" "}
          · meta {formatBRL(target)}
        </span>
        <span className={`num font-semibold ${dark ? "text-white/85" : "text-ink-2"}`}>{Math.round(ratio * 100)}%</span>
      </p>
    </div>
  );
}

const bigNumber = "display text-[clamp(40px,11.5vw,60px)] leading-[0.95] font-[750] tracking-[-0.02em]";

function MiniStat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[12.5px] text-white/60">{label}</p>
      <p className="mt-0.5 text-[16px] font-semibold">{children}</p>
    </div>
  );
}

/** Destaque da tela Investimentos: total, rendimento, o mês e a evolução. */
export function PortfolioHero({ p, today }: { p: Portfolio; today: string }) {
  const monthName = MONTH_NAMES[Number(today.slice(5, 7)) - 1].toLowerCase();
  const { month, total } = p;
  return (
    <section aria-labelledby="inv-total" className="mx-3 rounded-[24px] bg-ink p-5 text-white lg:mx-0 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] lg:items-end lg:gap-10 lg:p-7">
      <div>
        <h2 id="inv-total" className="text-[15px] text-white/70">
          Total guardado
        </h2>
        <p className={`${bigNumber} mt-2`} style={{ fontStretch: "82%" }}>
          {formatBRL(total.balance)}
        </p>
        <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] text-white/70">
          <span>Rendimento</span>
          <Gain cents={total.gain} ratio={total.gainRatio} dark />
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/10 pt-4">
          <MiniStat label="Aplicado">
            <span className="num">
              {formatBRL(total.invested)}
            </span>
          </MiniStat>
          <MiniStat label={`Rendeu em ${monthName}`}>
            {month.updates > 0 || month.yieldCents !== 0 ? (
              <Gain cents={month.yieldCents} dark />
            ) : (
              <span className="text-[13px] font-medium text-white/50">Atualize o saldo</span>
            )}
          </MiniStat>
          {month.flow !== 0 && (
            <p className="col-span-2 text-[13px] text-white/60">
              {month.flow > 0 ? "Você aplicou" : "Você resgatou"}{" "}
              <span className="num font-semibold text-white/90">
                {formatBRL(Math.abs(month.flow))}
              </span>{" "}
              em {monthName}
              {month.start > 0 && (
                <>
                  {" "}
                  · o total {month.change >= 0 ? "subiu" : "caiu"}{" "}
                  <span className="num font-semibold text-white/90">
                    {formatBRL(Math.abs(month.change))}
                  </span>
                </>
              )}
            </p>
          )}
        </div>
      </div>

      {p.series.length >= 2 ? (
        <div className="mt-6 lg:mt-0">
          <EvolutionChart points={p.series} tone="dark" height={132} label="Evolução do total guardado" />
        </div>
      ) : (
        <p className="mt-5 rounded-2xl bg-white/[0.06] px-4 py-3 text-[13px] text-white/65 lg:mt-0">
          O gráfico da evolução aparece a partir do segundo mês com registros. Atualize o saldo de cada investimento de vez em
          quando para ver quanto ele rende.
        </p>
      )}
    </section>
  );
}

/** Distribuição por tipo: barra empilhada + lista com % e valor. */
export function AllocationPanel({ p }: { p: Portfolio }) {
  if (p.allocation.length === 0) return null;
  return (
    <section aria-labelledby="inv-onde" className="mx-3 rounded-[24px] bg-surface p-4 lg:mx-0 lg:p-5">
      <h2 id="inv-onde" className="text-[15px] font-semibold">
        Onde está o dinheiro
      </h2>
      <div className="mt-3">
        <StackedBar parts={p.allocation.map((a) => ({ key: a.kind, value: a.balance, color: KIND_INFO[a.kind].color }))} height="h-3" />
      </div>
      <ul className="mt-2 divide-y divide-line/70">
        {p.allocation.map((a) => {
          const info = KIND_INFO[a.kind];
          return (
            <li key={a.kind} className="flex items-center gap-2.5 py-2.5">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: info.color }} aria-hidden />
              <span className="min-w-0 flex-1 truncate text-[14.5px]">
                {info.label}
                {a.count > 1 && <span className="text-[13px] text-ink-3"> · {a.count}</span>}
              </span>
              <span className="num w-11 shrink-0 text-right text-[13px] text-ink-3">{Math.round(a.ratio * 100)}%</span>
              <span className="num shrink-0 text-right text-[14.5px] font-semibold">
                {formatBRL(a.balance)}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function lastUpdateText(h: Holding) {
  if (h.daysSince == null) return "Nenhum registro ainda";
  if (h.stale) return `Saldo sem atualizar ${agoText(h.daysSince)}`;
  return `Último registro ${agoText(h.daysSince)}`;
}

/** Cartão de um investimento na lista. */
export function InvestmentCard({ h }: { h: Holding }) {
  const { investment: inv, position: p } = h;
  const info = KIND_INFO[inv.kind];
  const href = `/investimentos/${inv.id}${h.stale ? "?acao=saldo#movimentar" : ""}`;
  return (
    <Link
      href={href}
      className="group block rounded-[20px] bg-surface p-4 transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_28px_-14px_rgba(23,32,51,0.35)] motion-reduce:transition-none lg:p-5"
    >
      <div className="flex items-center gap-3">
        <KindTile kind={inv.kind} />
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-[16px] leading-snug font-semibold">{inv.name}</h3>
          <p className="truncate text-[13px] text-ink-3">{[inv.institution, info.label].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="display num text-[19px] leading-tight font-bold">
            {formatBRL(p.balance)}
          </p>
          {p.gain !== 0 ? (
            <Gain cents={p.gain} ratio={p.gainRatio} className="text-[12.5px]" />
          ) : (
            <span className="text-[12.5px] text-ink-3">Sem rendimento ainda</span>
          )}
        </div>
      </div>
      {inv.targetCents != null && (
        <div className="mt-3.5">
          <TargetBar balance={p.balance} target={inv.targetCents} />
        </div>
      )}
      <p
        className={`mt-3 flex items-center gap-1.5 border-t border-line/70 pt-2.5 text-[12.5px] ${
          h.stale ? "font-medium text-[#8f5208]" : "text-ink-3"
        }`}
      >
        <svg viewBox="0 0 24 24" className="size-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          {h.stale ? <path d="M12 8v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z" /> : <path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v4.5h-4.5" />}
        </svg>
        {lastUpdateText(h)}
        {h.stale && <span className="ml-auto font-semibold underline-offset-2 group-hover:underline">Atualizar</span>}
      </p>
    </Link>
  );
}

/** Linha compacta de um investimento encerrado. */
export function ClosedRow({ h }: { h: Holding }) {
  const { investment: inv, position: p } = h;
  return (
    <li>
      <Link href={`/investimentos/${inv.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-paper/60">
        <KindTile kind={inv.kind} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium">{inv.name}</span>
          <span className="block truncate text-[13px] text-ink-3">Encerrado{p.lastDate ? ` · ${formatDay(p.lastDate)}` : ""}</span>
        </span>
        {p.gain !== 0 && <Gain cents={p.gain} className="text-[13px]" />}
      </Link>
    </li>
  );
}

/** Destaque do detalhe de um investimento. */
export function InvestmentHero({
  kind,
  institution,
  target,
  position: p,
  series,
  archived,
}: {
  kind: InvestmentKind;
  institution: string | null;
  target: number | null;
  position: Position;
  series: SeriesPoint[];
  archived: boolean;
}) {
  const info = KIND_INFO[kind];
  return (
    <section className="mx-3 rounded-[24px] bg-ink p-5 text-white lg:mx-0 lg:p-7">
      <div className="flex items-center gap-3">
        <KindTile kind={kind} dark />
        <p className="min-w-0 flex-1 text-[14px] leading-snug text-white/70">
          {info.label}
          {institution && (
            <>
              <br />
              <span className="text-white/90">{institution}</span>
            </>
          )}
        </p>
      </div>
      <p className="mt-5 text-[14px] text-white/70">{archived ? "Saldo (encerrado)" : "Saldo"}</p>
      <p className={`${bigNumber} mt-0.5`} style={{ fontStretch: "82%" }}>
        {formatBRL(p.balance)}
      </p>
      <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/10 pt-4">
        <MiniStat label="Aplicado">
          <span className="num">
            {formatBRL(p.invested)}
          </span>
        </MiniStat>
        <MiniStat label="Rendimento">
          <Gain cents={p.gain} ratio={p.gainRatio} dark />
        </MiniStat>
      </div>
      {target != null && !archived && (
        <div className="mt-5">
          <TargetBar balance={p.balance} target={target} dark />
        </div>
      )}
      {series.length >= 2 && (
        <div className="mt-6">
          <EvolutionChart points={series} tone="dark" height={112} label="Evolução do saldo" />
        </div>
      )}
    </section>
  );
}

const MOVE_STYLE = {
  aporte: { label: "Aporte", icon: "M12 5v14M5 12h14", tile: "bg-brand-soft text-brand" },
  resgate: { label: "Resgate", icon: "M5 12h14", tile: "bg-paper text-ink-2" },
  saldo: { label: "Saldo atualizado", icon: "M20 12a8 8 0 1 1-2.3-5.7M20 4v4.5h-4.5", tile: "bg-[#e8eefc] text-[#3355cc]" },
} as const;

const HISTORY_FIRST = 8;

function byMonth(rows: HistoryRow[]) {
  const groups: { month: string; rows: HistoryRow[] }[] = [];
  for (const r of rows) {
    const m = r.move.date.slice(0, 7);
    const g = groups[groups.length - 1];
    if (g && g.month === m) g.rows.push(r);
    else groups.push({ month: m, rows: [r] });
  }
  return groups;
}

function HistoryGroups({ rows, canDelete }: { rows: HistoryRow[]; canDelete: boolean }) {
  const groups = byMonth(rows);
  return (
    <>
      {groups.map((g) => (
        <div key={g.month}>
          <h3 className="px-4 pt-4 pb-1 text-[12px] font-semibold tracking-wide text-ink-3 uppercase lg:px-5">{monthLabel(g.month)}</h3>
          <ul className="divide-y divide-line/70">
            {g.rows.map(({ move: m, after, yieldCents }) => {
              const st = MOVE_STYLE[m.kind];
              return (
                <li key={m.id} className="flex items-center gap-3 px-4 py-3 lg:px-5">
                  <span className={`grid size-10 shrink-0 place-items-center rounded-full ${st.tile}`} aria-hidden>
                    <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d={st.icon} />
                    </svg>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium">{st.label}</span>
                    <span className="block truncate text-[13px] text-ink-3">
                      {formatDay(m.date)}
                      {m.note && ` · ${m.note}`}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="num block text-[15px] font-semibold">
                      {m.kind === "aporte" ? `+${formatBRL(m.amountCents)}` : m.kind === "resgate" ? `−${formatBRL(m.amountCents)}` : formatBRL(m.amountCents)}
                    </span>
                    {yieldCents != null ? (
                      yieldCents === 0 ? (
                        <span className="block text-[12.5px] text-ink-3">sem mudança</span>
                      ) : (
                        <span className="block text-[12.5px]" title={yieldCents > 0 ? "Rendeu desde o registro anterior" : "Caiu desde o registro anterior"}>
                          <Gain cents={yieldCents} />
                        </span>
                      )
                    ) : (
                      <span className="num block text-[12.5px] text-ink-3">
                        saldo {formatBRL(after)}
                      </span>
                    )}
                  </span>
                  {canDelete && <MoveDelete id={m.id} />}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </>
  );
}

/** Histórico das movimentações, por mês, do mais recente para o mais antigo. Os mais antigos abrem em "Ver mais". */
export function HistoryList({ rows, canDelete }: { rows: HistoryRow[]; canDelete: boolean }) {
  // Não corta um mês no meio: mostra até o fim do mês da 8ª linha
  let cut = rows.length;
  if (rows.length > HISTORY_FIRST + 3) {
    const m = rows[HISTORY_FIRST - 1].move.date.slice(0, 7);
    cut = rows.findIndex((r, i) => i >= HISTORY_FIRST && r.move.date.slice(0, 7) !== m);
    if (cut < 0) cut = rows.length;
  }
  const rest = rows.slice(cut);
  return (
    <section aria-labelledby="inv-hist" className="mx-3 rounded-[24px] bg-surface pb-2 lg:mx-0">
      <h2 id="inv-hist" className="px-4 pt-4 text-[15px] font-semibold lg:px-5">
        Histórico
      </h2>
      {rows.length === 0 && <p className="px-4 py-6 text-center text-[15px] text-ink-3">Nenhuma movimentação ainda.</p>}
      <HistoryGroups rows={rows.slice(0, cut)} canDelete={canDelete} />
      {rest.length > 0 && (
        <ShowMore more={`Ver mais ${rest.length} ${rest.length === 1 ? "movimentação" : "movimentações"}`}>
          <HistoryGroups rows={rest} canDelete={canDelete} />
        </ShowMore>
      )}
    </section>
  );
}

/** Sem investimentos: o que é e um atalho para cada tipo. */
export function EmptyInvestments() {
  return (
    <section className="mx-3 mt-1 overflow-hidden rounded-[24px] bg-surface lg:mx-0">
      <div className="relative overflow-hidden bg-ink px-5 pt-6 pb-7 text-white lg:px-7 lg:pb-8">
        {/* As 4 barras subindo da marca; a última, dourada, é a meta alcançada */}
        <div className="absolute right-5 bottom-0 flex h-28 items-end gap-2 opacity-60 lg:right-10 lg:h-36 lg:opacity-90" aria-hidden>
          {[28, 50, 71, 90].map((h, i) => (
            <span key={h} className="w-5 rounded-t-lg lg:w-7" style={{ height: `${h}%`, background: i === 3 ? "#e9a531" : i === 2 ? "#17b39b" : "rgb(255 255 255 / 0.14)" }} />
          ))}
        </div>
        <p className="relative text-[14px] text-white/65">Investimentos</p>
        <h2 className="display relative mt-1 max-w-[15rem] text-[26px] leading-tight font-bold sm:max-w-md">
          Todo o seu dinheiro guardado num lugar só
        </h2>
        <p className="relative mt-2 max-w-[17rem] text-[15px] text-white/75 sm:max-w-md">
          Cadastre a caixinha, o CDB, o Tesouro, as ações ou a cripto. Registre aportes e resgates e, de vez em quando, atualize o
          saldo: você vê quanto tem, quanto rendeu e como está crescendo.
        </p>
        <p className="relative mt-3 max-w-[17rem] text-[13px] text-white/50 sm:max-w-md">Fica à parte: não entra no saldo do mês nem nas metas.</p>
      </div>
      <ul className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-4 lg:p-4">
        {INVESTMENT_KINDS.map((k) => {
          const info = KIND_INFO[k];
          return (
            <li key={k}>
              <Link href={`/investimentos/novo?tipo=${k}`} className="flex h-full items-center gap-3 rounded-2xl bg-paper/70 px-3.5 py-3 transition-colors hover:bg-paper">
                <span className="grid size-10 shrink-0 place-items-center rounded-full text-[19px]" style={{ background: `${info.color}1f` }} aria-hidden>
                  {info.emoji}
                </span>
                <span className="min-w-0">
                  <span className="block text-[15px] font-semibold">{info.label}</span>
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
