import Link from "next/link";
import { Money } from "./ui";
import { formatBRL0, statusLabel, type GoalProgress, type GoalStatus } from "@/lib/goals";
import { formatCompactBRL, monthShort } from "@/lib/format";

// Peças visuais das metas (tela Metas, Painel e a janela de editar): anel, barra, selo de status,
// cartão da meta, colunas do ano e o histórico dos últimos meses. As contas estão em lib/goals.ts.

/** Cor de cada status: verde = no caminho/cumprida, dourado = atenção, vermelho = passou, cinza = prevista. */
export const STATUS_STYLE: Record<GoalStatus, { color: string; onDark: string; chip: string; chipDark: string }> = {
  ok: { color: "#12a08a", onDark: "#5fd3bf", chip: "bg-brand-soft text-brand", chipDark: "bg-[#5fd3bf]/15 text-[#7fe0cf]" },
  cumprida: { color: "#12a08a", onDark: "#5fd3bf", chip: "bg-brand-soft text-brand", chipDark: "bg-[#5fd3bf]/15 text-[#7fe0cf]" },
  atencao: { color: "#e39a2d", onDark: "#f2b552", chip: "bg-[#fcefd9] text-[#8f5208]", chipDark: "bg-[#f2b552]/15 text-[#f6c977]" },
  passou: { color: "#c33d4b", onDark: "#ff9aa5", chip: "bg-danger-soft text-danger", chipDark: "bg-[#ff9aa5]/15 text-[#ffb3bb]" },
  nao_cumprida: { color: "#c33d4b", onDark: "#ff9aa5", chip: "bg-danger-soft text-danger", chipDark: "bg-[#ff9aa5]/15 text-[#ffb3bb]" },
  prevista: { color: "#8b95ab", onDark: "#c4cada", chip: "bg-paper text-ink-2", chipDark: "bg-white/10 text-white/75" },
};

const stripes = (color: string) => `repeating-linear-gradient(-45deg, ${color} 0 3px, transparent 3px 6px)`;

/** Anel de progresso com o emoji no meio. Cheio = chegou no valor da meta. */
export function GoalRing({
  ratio,
  status,
  size = 48,
  stroke = 4,
  dark = false,
  children,
}: {
  ratio: number;
  status: GoalStatus;
  size?: number;
  stroke?: number;
  dark?: boolean;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(ratio, 1));
  const color = dark ? STATUS_STYLE[status].onDark : STATUS_STYLE[status].color;
  return (
    <span className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={dark ? "rgb(255 255 255 / 0.12)" : "#eef1f5"} strokeWidth={stroke} />
        {v > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${c * v} ${c}`}
            className="transition-[stroke-dasharray] duration-700 ease-out motion-reduce:transition-none"
          />
        )}
      </svg>
      <span className="relative leading-none">{children}</span>
    </span>
  );
}

export function StatusChip({ p, dark = false, className = "" }: { p: Pick<GoalProgress, "status" | "saving">; dark?: boolean; className?: string }) {
  const s = STATUS_STYLE[p.status];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[12px] leading-none font-semibold ${dark ? s.chipDark : s.chip} ${className}`}
    >
      {(p.status === "cumprida" || p.status === "ok") && (
        <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      )}
      {statusLabel(p.status, p.saving)}
    </span>
  );
}

/**
 * Barra da meta. Até o limite, a parte usada; passou do limite, a parte até o limite e o que passou (listrado),
 * com um traço onde fica o limite. O traço "hoje" mostra quanto do período já passou.
 */
export function GoalBar({ p, dark = false, className = "", height = "h-2.5", showToday = false }: {
  p: GoalProgress;
  dark?: boolean;
  className?: string;
  height?: string;
  showToday?: boolean;
}) {
  const color = dark ? STATUS_STYLE[p.status].onDark : STATUS_STYLE[p.status].color;
  // Guardar mais que a meta é bom: a barra só enche. Limite estourado: a parte além do limite fica listrada.
  const over = !p.saving && p.ratio > 1;
  const base = over ? 1 / p.ratio : Math.max(0, Math.min(p.ratio, 1));
  const pace = p.pace != null && !(p.saving && p.goal.period === "mes") && !over ? p.pace : null;
  const label = p.saving
    ? `Guardado ${Math.round(p.ratio * 100)}% da meta`
    : `Usado ${Math.round(p.ratio * 100)}% da meta${pace != null ? `; ${Math.round(pace * 100)}% do período já passou` : ""}`;
  return (
    <div className={`relative ${className}`} role="img" aria-label={label}>
      <div className={`flex ${height} gap-[2px] overflow-hidden rounded-full ${dark ? "bg-white/10" : "bg-paper"}`}>
        {base > 0 && (
          <div
            className="h-full rounded-l-full transition-[width] duration-700 ease-out last:rounded-r-full motion-reduce:transition-none"
            style={{ width: `${base * 100}%`, background: color }}
          />
        )}
        {over && <div className="h-full flex-1 rounded-r-full" style={{ background: stripes(color), boxShadow: `inset 0 0 0 1px ${color}` }} />}
      </div>
      {pace != null && pace > 0.02 && pace < 0.98 && (
        <span className="absolute inset-y-[-3px] flex flex-col items-center" style={{ left: `${pace * 100}%`, transform: "translateX(-50%)" }} aria-hidden>
          <span className={`w-[2px] flex-1 rounded-full ${dark ? "bg-white/80" : "bg-ink/55"}`} />
          {showToday && <span className={`absolute top-full mt-1 text-[11px] font-medium ${dark ? "text-white/60" : "text-ink-3"}`}>hoje</span>}
        </span>
      )}
    </div>
  );
}

/** Meta do ano: uma coluna por mês e a linha tracejada da média que cabe na meta. */
export function YearBars({ p }: { p: GoalProgress }) {
  if (!p.months) return null;
  const perMonth = p.target / 12;
  const values = p.months.map((m) => m.value ?? 0);
  const max = Math.max(perMonth, ...values.map(Math.abs), 1) * 1.08;
  const line = (perMonth / max) * 100;
  return (
    <div className="mt-4">
      <div className="relative h-14" role="img" aria-label={`Por mês; para caber na meta, ${formatBRL0(perMonth)} em média`}>
        <div className="absolute inset-x-0 border-t border-dashed border-ink-3/50" style={{ bottom: `${line}%` }} aria-hidden />
        <div className="relative grid h-full grid-cols-12 items-end gap-1" aria-hidden>
          {p.months.map((m) => {
            if (m.value == null) return <span key={m.month} className="h-1 rounded-full bg-paper" />;
            const bad = p.saving ? m.value < perMonth : m.value > perMonth;
            const color = p.saving ? (m.value < 0 ? "#c33d4b" : bad ? "#a9b4c8" : "#12a08a") : bad ? "#e39a2d" : "#5b6b8c";
            return (
              <span
                key={m.month}
                title={`${monthShort(m.month)}: ${formatCompactBRL(m.value)}`}
                className="min-h-1 rounded-t-[4px] rounded-b-[2px]"
                style={{ height: `${Math.max((Math.abs(m.value) / max) * 100, 4)}%`, background: color }}
              />
            );
          })}
        </div>
      </div>
      <div className="mt-1 grid grid-cols-12 gap-1 text-center text-[10px] font-medium text-ink-3 uppercase" aria-hidden>
        {p.months.map((m) => (
          <span key={m.month}>{monthShort(m.month).charAt(0)}</span>
        ))}
      </div>
      <p className="mt-1.5 text-[12px] text-ink-3">
        <span className="mr-1 inline-block w-4 border-t border-dashed border-ink-3/70 align-middle" aria-hidden />
        {p.saving ? "Guardar por mês para chegar na meta" : "Média por mês que cabe na meta"}: {formatBRL0(perMonth)}
      </p>
    </div>
  );
}

/** Meta do mês: como foi nos últimos meses (✓ cumprida, ✕ não cumprida, — sem a meta). */
export function HistoryDots({ p }: { p: GoalProgress }) {
  if (!p.history?.length) return null;
  const okCount = p.history.filter((h) => h.ok === true).length;
  const counted = p.history.filter((h) => h.ok != null).length;
  return (
    <div className="mt-3.5 flex items-center justify-between gap-3 border-t border-line pt-3">
      <ol className="flex gap-1.5" aria-label={`Cumprida em ${okCount} de ${counted} meses`}>
        {p.history.map((h) => (
          <li key={h.month} className="flex flex-col items-center gap-0.5">
            <span
              className={`grid size-5 place-items-center rounded-full text-[11px] font-bold ${
                h.ok === true ? "bg-brand-soft text-brand" : h.ok === false ? "bg-danger-soft text-danger" : "bg-paper text-ink-3"
              }`}
              title={`${monthShort(h.month)}: ${h.ok === true ? "cumprida" : h.ok === false ? "não cumprida" : "sem meta"}`}
            >
              {h.ok === true ? "✓" : h.ok === false ? "✕" : "·"}
            </span>
            <span className="text-[10px] text-ink-3">{monthShort(h.month)}</span>
          </li>
        ))}
      </ol>
      <span className="text-right text-[12px] leading-tight text-ink-3">
        {p.streak && p.streak >= 2 ? (
          <>
            <span className="font-semibold text-brand">{p.streak} meses seguidos</span>
            <br />
            dentro da meta
          </>
        ) : (
          <>
            {okCount} de {counted} {counted === 1 ? "mês" : "meses"}
            <br />
            dentro da meta
          </>
        )}
      </span>
    </div>
  );
}

/** Cartão de uma meta. Com href, o cartão todo abre a meta para editar. */
export function GoalCard({ p, href, className = "" }: { p: GoalProgress; href?: string; className?: string }) {
  const body = (
    <>
      <div className="flex items-start gap-3">
        <GoalRing ratio={p.ratio} status={p.status} size={46}>
          <span className="text-[19px]" aria-hidden>
            {p.emoji}
          </span>
        </GoalRing>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-[16px] font-semibold">{p.name}</h3>
              <p className="text-[13px] text-ink-3">{p.sub}</p>
            </div>
            <StatusChip p={p} />
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate">
          <Money cents={p.value} className={`display text-[22px] font-bold ${p.value < 0 ? "text-danger" : ""}`} />
          <span className="ml-1.5 text-[14px] text-ink-3">
            de <Money cents={p.target} />
          </span>
        </span>
        <span className="num shrink-0 text-[13px] font-semibold text-ink-2">{Math.round(Math.max(p.ratio, 0) * 100)}%</span>
      </div>
      <GoalBar p={p} className="mt-2" />
      <p className="mt-2.5 text-[14px] leading-snug">
        <span className="font-semibold">{p.headline}</span>
        <span className="text-ink-3"> · {p.detail}</span>
      </p>
      <YearBars p={p} />
      <HistoryDots p={p} />
    </>
  );
  const cls = `block rounded-[20px] bg-surface p-4 lg:p-5 ${className}`;
  return href ? (
    <Link
      href={href}
      className={`${cls} transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_28px_-14px_rgba(23,32,51,0.35)] motion-reduce:transition-none`}
    >
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** Linha compacta (Painel): anel, nome, frase e o valor. */
export function GoalRow({ p, href }: { p: GoalProgress; href: string }) {
  return (
    <li>
      <Link href={href} className="flex items-center gap-3 px-4 py-2.5 hover:bg-paper/60">
        <GoalRing ratio={p.ratio} status={p.status} size={40} stroke={3.5}>
          <span className="text-[16px]" aria-hidden>
            {p.emoji}
          </span>
        </GoalRing>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-[15px] font-medium">{p.name}</span>
            {p.goal.period === "ano" && <span className="shrink-0 rounded-md bg-paper px-1.5 py-0.5 text-[11px] font-semibold text-ink-2">{p.goal.startMonth.slice(0, 4)}</span>}
          </span>
          <span className={`block truncate text-[13px] ${p.status === "passou" || p.status === "nao_cumprida" ? "font-medium text-danger" : p.status === "atencao" ? "font-medium text-[#8f5208]" : "text-ink-3"}`}>
            {p.headline}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span className="num text-[13px] whitespace-nowrap text-ink-3">
            <span className={`text-[15px] font-semibold ${p.value < 0 ? "text-danger" : "text-ink"}`}>
              {p.value < 0 ? "−" : ""}
              {formatBRL0(p.value)}
            </span>{" "}
            / {formatBRL0(p.target).replace("R$", "").trim()}
          </span>
          <span className="block h-1.5 w-20 overflow-hidden rounded-full bg-paper" aria-hidden>
            <span
              className="block h-full rounded-full"
              style={{ width: `${Math.max(0, Math.min(p.ratio, 1)) * 100}%`, background: STATUS_STYLE[p.status].color }}
            />
          </span>
        </span>
      </Link>
    </li>
  );
}

const COUNT_TEXT: Record<GoalStatus, [string, string]> = {
  ok: ["no caminho", "no caminho"],
  cumprida: ["cumprida", "cumpridas"],
  atencao: ["em atenção", "em atenção"],
  passou: ["passou", "passaram"],
  nao_cumprida: ["não cumprida", "não cumpridas"],
  prevista: ["prevista", "previstas"],
};

/**
 * Destaque da tela Metas. Com limite de gastos do mês: quanto ainda dá para gastar, a barra com o "hoje"
 * e quanto dá por dia. Sem ele: quantas metas estão no caminho e um atalho para criar o limite.
 */
export function GoalsHero({ monthName, total, all, editHref, newTotalHref }: {
  monthName: string;
  total?: GoalProgress;
  all: GoalProgress[];
  editHref?: string;
  newTotalHref: string;
}) {
  const statuses = (Object.keys(COUNT_TEXT) as GoalStatus[])
    .map((s) => ({ s, n: all.filter((p) => p.status === s).length }))
    .filter((x) => x.n > 0)
    .sort((a, b) => order(a.s) - order(b.s));
  const good = all.filter((p) => p.status === "ok" || p.status === "cumprida").length;
  const over = total && total.ratio > 1;
  const heroLabel = !total
    ? ""
    : total.phase === "passado"
      ? over
        ? `Passou do limite de ${monthName} em`
        : `Sobrou do limite de ${monthName}`
      : over
        ? "Passou do limite do mês em"
        : total.phase === "futuro"
          ? `Livre no limite de ${monthName}`
          : "Ainda dá para gastar";
  return (
    <section aria-labelledby="metas-titulo" className="mx-3 overflow-hidden rounded-[24px] bg-ink p-5 text-white lg:mx-0 lg:p-7">
      <div className="flex items-center justify-between gap-3">
        <h2 id="metas-titulo" className="text-[15px] text-white/70">
          Metas de {monthName}
        </h2>
        {total && editHref && (
          <Link href={editHref} className="rounded-full bg-white/10 px-3 py-1.5 text-[13px] font-semibold text-white/90 hover:bg-white/15">
            Editar limite
          </Link>
        )}
      </div>

      {total ? (
        <>
          <p className="mt-3 text-[14px] text-white/70">{heroLabel}</p>
          <p
            className={`display mt-0.5 text-[clamp(40px,11.5vw,60px)] leading-[0.95] font-[750] tracking-[-0.02em] ${over ? "text-[#ff9aa5]" : ""}`}
            style={{ fontStretch: "82%" }}
          >
            <Money cents={Math.abs(total.remaining)} />
          </p>
          <GoalBar p={total} dark height="h-3" className="mt-5" showToday />
          <div className="mt-6 flex items-baseline justify-between gap-3 text-[13px] text-white/65">
            <span>
              Gastos <Money cents={total.value} className="font-semibold text-white" />
            </span>
            <span>
              Limite <Money cents={total.target} className="font-semibold text-white" />
            </span>
          </div>
          <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/[0.08] px-3 py-1.5 text-[13px] font-medium text-white/85">
            <span className="size-2 rounded-full" style={{ background: STATUS_STYLE[total.status].onDark }} aria-hidden />
            {total.detail}
          </p>
        </>
      ) : (
        <>
          <p className="display mt-3 text-[clamp(40px,11.5vw,56px)] leading-none font-[750] tracking-[-0.02em]" style={{ fontStretch: "82%" }}>
            {good}
            <span className="text-white/45"> de {all.length}</span>
          </p>
          <p className="mt-1.5 text-[14px] text-white/70">{all.length === 1 ? "meta no caminho" : "metas no caminho"}</p>
          <Link
            href={newTotalHref}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#17b39b] py-1.5 pr-4 pl-1.5 text-[14px] font-semibold text-white transition-transform hover:-translate-y-0.5"
          >
            <span className="grid size-7 place-items-center rounded-full bg-white/20" aria-hidden>
              🎯
            </span>
            Definir um limite de gastos do mês
          </Link>
        </>
      )}

      {statuses.length > 0 && (
        <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-white/10 pt-4 text-[13px] text-white/75" aria-label="Resumo das metas">
          {statuses.map(({ s, n }) => (
            <li key={s} className="flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ background: STATUS_STYLE[s].onDark }} aria-hidden />
              <span className="num font-semibold text-white">{n}</span> {COUNT_TEXT[s][n === 1 ? 0 : 1]}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function order(s: GoalStatus) {
  return ["ok", "cumprida", "atencao", "prevista", "passou", "nao_cumprida"].indexOf(s);
}
