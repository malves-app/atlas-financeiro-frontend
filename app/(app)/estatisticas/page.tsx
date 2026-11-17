import Link from "next/link";
import { isDefaultPeriod, loadLookups, loadStats, resolvePeriod, type Stats } from "@/lib/stats";
import { currentMonth, formatBRL, formatPercent, formatShortDate, monthLabel, monthPhrase, monthShort } from "@/lib/format";
import type { SearchParams } from "@/lib/page";
import { EmptyState, EntryIcon, Money, Panel, SectionTitle, StackedBar } from "@/components/ui";
import { ColumnChart } from "@/components/ColumnChart";
import { PeriodFilter } from "@/components/PeriodFilter";

export const dynamic = "force-dynamic";

// Cores dos gráficos (validadas para daltonismo): entradas x gastos; saldo negativo usa o vermelho de alerta
const INCOME = "#0f9a83";
const SPEND = "#eb6834";
const NEGATIVE = "#c33d4b";
// Partes de um todo: tons de uma cor só, como no Painel
const COMPOSITION = ["#172033", "#5b6b8c", "#a9b4c8"];
const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const WEEKDAYS_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const CATEGORY_VISIBLE = 8;

const lower = (m: string) => monthLabel(m, false).toLowerCase();

export default async function Estatisticas({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const get = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const now = currentMonth();
  const period = resolvePeriod(get("de"), get("ate"), now);

  const [stats, lookups] = await Promise.all([loadStats(period), loadLookups()]);
  const { months, monthly, totals, spend } = stats;

  const selfHref = isDefaultPeriod(period, now) ? "/estatisticas" : `/estatisticas?de=${period.from}&ate=${period.to}`;
  const back = encodeURIComponent(selfHref);
  const fromYear = period.from.slice(0, 4);
  const toYear = period.to.slice(0, 4);
  const multiYear = fromYear !== toYear;
  // Ano inteiro (ou o ano atual até agora) vira "de 2026"; o resto é "do período"
  const wholeYear = !multiYear && period.from.endsWith("-01") && (period.to.endsWith("-12") || period.to === now);
  const periodName = wholeYear ? `de ${fromYear}` : "do período";
  const span = (a: string, b: string) =>
    a === b
      ? monthLabel(a)
      : a.slice(0, 4) === b.slice(0, 4)
        ? `${monthLabel(a, false)} a ${lower(b)} de ${a.slice(0, 4)}`
        : `${monthLabel(a)} a ${monthLabel(b).toLowerCase()}`;
  const rangeText = months.length ? span(months[0], months[months.length - 1]) : "";
  const emptyText = wholeYear ? `em ${fromYear}` : period.from === period.to ? `em ${monthPhrase(period.from)}` : `de ${span(period.from, period.to).toLowerCase()}`;
  const hasPartial = monthly.some((r) => r.partial);
  const empty = totals.gastos === 0 && totals.entradas === 0;

  // Até 12 meses, todos os rótulos; em períodos longos, um a cada trimestre/semestre/ano, com o ano no lugar de janeiro
  const step = months.length <= 12 ? 1 : months.length <= 36 ? 3 : months.length <= 72 ? 6 : 12;
  const labels = months.map((m) => {
    const mi = Number(m.slice(5, 7)) - 1;
    if (mi % step !== 0) return "";
    return step > 1 && multiYear && mi === 0 ? m.slice(0, 4) : monthShort(m);
  });
  const titles = months.map((m) => monthLabel(m));
  const partial = monthly.map((r) => r.partial);

  return (
    <>
      <header className="px-4 pt-[max(env(safe-area-inset-top),10px)] pb-2 lg:px-0 lg:pt-2 lg:pb-3">
        <h1 className="display text-[22px] font-bold tracking-tight lg:text-[28px]">Estatísticas</h1>
      </header>

      {/* Período: de um mês a outro (padrão: o ano atual) */}
      <PeriodFilter key={`${period.from}:${period.to}`} from={period.from} to={period.to} firstMonth={lookups.firstMonth} now={now} />

      {empty ? (
        <Panel>
          <EmptyState>Nenhum lançamento {emptyText}.</EmptyState>
        </Panel>
      ) : (
        <div className="flex flex-col gap-3 lg:gap-4">
          {/* Resumo do período */}
          <section aria-labelledby="saldo-ano" className="mx-3 overflow-hidden rounded-[24px] bg-ink p-5 text-white lg:mx-0 lg:p-7">
            <h2 id="saldo-ano" className="text-[15px] text-white/70">
              Saldo {periodName}
            </h2>
            <p
              className={`display mt-1 text-[clamp(40px,12vw,60px)] leading-[0.95] font-[750] tracking-[-0.02em] ${totals.saldo < 0 ? "text-[#ff9aa5]" : "text-white"}`}
              style={{ fontStretch: "82%" }}
            >
              <Money cents={totals.saldo} />
            </p>
            <p className="mt-2 text-[14px] text-white/70">
              {rangeText}
              {hasPartial && `, com ${lower(now)} ainda em andamento`}
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <div className="rounded-2xl bg-white/[0.08] p-3.5">
                <div className="text-[13px] text-white/70">Entrou</div>
                <Money cents={totals.entradas} className="mt-0.5 block text-[18px] font-semibold text-[#7fd8c8]" />
              </div>
              <div className="rounded-2xl bg-white/[0.08] p-3.5">
                <div className="text-[13px] text-white/70">Gastou</div>
                <Money cents={totals.gastos} className="mt-0.5 block text-[18px] font-semibold" />
              </div>
            </div>
            {totals.savingsRate != null && (
              <p className={`mt-4 text-[14px] ${totals.savingsRate < 0 ? "font-medium text-[#ff9aa5]" : "text-white/80"}`}>
                {totals.savingsRate >= 0
                  ? `Você guardou ${formatPercent(totals.savingsRate)} do que entrou.`
                  : `Os gastos passaram o que entrou em ${formatBRL(-totals.saldo)}.`}
              </p>
            )}
          </section>

          {/* Números do período */}
          <Panel className="grid grid-cols-2 sm:grid-cols-4">
            <Kpi label="Gasto médio por mês" value={<Money cents={spend.mean} />} note={`Mediana ${formatBRL(spend.median)}`} />
            <Kpi
              label="Mês mais caro"
              value={spend.max ? monthLabel(spend.max.month, false) : "—"}
              note={spend.max ? formatBRL(spend.max.value) : undefined}
            />
            <Kpi label="Dia a dia, por dia" value={<Money cents={stats.dailyAvg} />} note={`Em ${stats.dayToDayDays} dias`} />
            <Kpi
              label="Meses no vermelho"
              value={`${stats.negativeMonths.length} de ${monthly.filter((r) => !r.partial).length || months.length}`}
              note={stats.negativeMonths.length ? stats.negativeMonths.map(monthShort).join(", ") : "Nenhum"}
              alert={stats.negativeMonths.length > 0}
            />
          </Panel>

          {/* Entradas e gastos */}
          <Panel className="px-4 pt-4 pb-4">
            <h2 className="mb-3 text-[15px] font-semibold">Entradas e gastos por mês</h2>
            <ColumnChart
              label="Entradas e gastos por mês"
              labels={labels}
              titles={titles}
              partial={partial}
              series={[
                { key: "entradas", label: "Entradas", color: INCOME, values: monthly.map((r) => r.entradas) },
                { key: "gastos", label: "Gastos", color: SPEND, values: monthly.map((r) => r.gastos) },
              ]}
            />
            {hasPartial && <p className="mt-3 text-[12px] text-ink-3">A coluna mais clara é {lower(now)}, que ainda está em andamento.</p>}
          </Panel>

          {/* Saldo mês a mês */}
          <Panel className="px-4 pt-4 pb-4">
            <h2 className="text-[15px] font-semibold">Saldo de cada mês</h2>
            <p className="mb-3 text-[13px] text-ink-3">Acima da linha sobrou dinheiro; abaixo, faltou.</p>
            <ColumnChart
              label="Saldo de cada mês"
              labels={labels}
              titles={titles}
              partial={partial}
              height={180}
              series={[{ key: "saldo", label: "Saldo", color: INCOME, negColor: NEGATIVE, values: monthly.map((r) => r.saldo) }]}
              extra={[{ label: "acumulado", values: stats.cumulative }]}
            />
          </Panel>

          {/* Composição mês a mês */}
          <Composition stats={stats} labels={labels} titles={titles} partial={partial} />

          {/* Categorias */}
          <Categories stats={stats} lookups={lookups} />

          {/* Formas de pagamento */}
          <Payments stats={stats} lookups={lookups} />

          {/* Onde mais gasta */}
          {stats.topNames.length > 0 && (
            <Panel className="pb-2">
              <SectionTitle>Onde você mais gasta</SectionTitle>
              <p className="-mt-1 px-4 pb-2 text-[13px] text-ink-3">Gastos do dia a dia agrupados pela descrição.</p>
              <ol>
                {stats.topNames.map((t, i) => (
                  <li key={t.name} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="num grid size-8 shrink-0 place-items-center rounded-full bg-paper text-[13px] font-semibold text-ink-2">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium">{t.name}</span>
                      <span className="block text-[13px] text-ink-3">
                        {t.count} {t.count === 1 ? "vez" : "vezes"}, média de {formatBRL(t.avg)}
                      </span>
                    </span>
                    <Money cents={t.total} className="text-[15px] font-semibold" />
                  </li>
                ))}
              </ol>
            </Panel>
          )}

          {/* Maiores gastos */}
          {stats.biggest.length > 0 && (
            <Panel className="pb-2">
              <SectionTitle>Maiores gastos do dia a dia</SectionTitle>
              <ul>
                {stats.biggest.map((e) => {
                  const cat = e.categoryId != null ? lookups.categories.get(e.categoryId) : undefined;
                  return (
                    <li key={e.id}>
                      <Link href={`/lancamentos/${e.id}?back=${back}`} className="flex items-center gap-3 px-4 py-2 hover:bg-paper/60">
                        <EntryIcon emoji={cat?.emoji} name={e.name} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-medium">{e.name}</span>
                          <span className="block truncate text-[13px] text-ink-3">
                            {e.date ? formatShortDate(e.date) : monthLabel(e.month)}
                            {cat ? `, ${cat.name}` : ""}
                          </span>
                        </span>
                        <Money cents={e.amountCents} className="text-[15px] font-semibold" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          )}

          {/* Dia da semana */}
          <Weekdays stats={stats} />

          {/* De onde vem o dinheiro */}
          {stats.incomeSources.length > 0 && (
            <Panel className="pb-3">
              <SectionTitle>De onde veio o dinheiro</SectionTitle>
              <ul>
                {stats.incomeSources.map((s) => {
                  const share = totals.entradas > 0 ? s.total / totals.entradas : 0;
                  return (
                    <li key={s.name} className="px-4 py-2">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="truncate text-[15px] font-medium">{s.name}</span>
                        <Money cents={s.total} className="text-[15px] font-semibold" />
                      </span>
                      <span className="mt-1.5 flex items-center gap-2.5">
                        <span className="h-2 flex-1 rounded-full bg-paper">
                          <span className="block h-full rounded-full" style={{ width: `${Math.max(share * 100, 2)}%`, background: INCOME }} />
                        </span>
                        <span className="num w-10 text-right text-[12px] text-ink-3">{formatPercent(share)}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          )}

          {/* Tabela */}
          <Panel>
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-4 text-[15px] font-semibold marker:hidden">
                Tabela mês a mês
                <span className="text-[14px] font-medium text-brand">
                  <span className="group-open:hidden">Mostrar</span>
                  <span className="hidden group-open:inline">Esconder</span>
                </span>
              </summary>
              <div className="overflow-x-auto px-2 pb-3">
                <table className="w-full min-w-[460px] text-[14px]">
                  <thead>
                    <tr className="text-left text-[12px] text-ink-3">
                      <th className="px-2 py-2 font-medium">Mês</th>
                      <th className="px-2 py-2 text-right font-medium">Entrou</th>
                      <th className="px-2 py-2 text-right font-medium">Gastou</th>
                      <th className="px-2 py-2 text-right font-medium">Saldo</th>
                      <th className="px-2 py-2 text-right font-medium">Acumulado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthly.map((r, i) => (
                      <tr key={r.month} className="border-t border-line">
                        <td className="px-2 py-2">
                          {monthLabel(r.month, multiYear)}
                          {r.partial && <span className="text-ink-3"> (parcial)</span>}
                        </td>
                        <td className="px-2 py-2 text-right">
                          <Money cents={r.entradas} />
                        </td>
                        <td className="px-2 py-2 text-right">
                          <Money cents={r.gastos} />
                        </td>
                        <td className={`px-2 py-2 text-right font-medium ${r.saldo < 0 ? "text-danger" : ""}`}>
                          <Money cents={r.saldo} />
                        </td>
                        <td className={`px-2 py-2 text-right ${stats.cumulative[i] < 0 ? "text-danger" : "text-ink-2"}`}>
                          <Money cents={stats.cumulative[i]} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-line font-semibold">
                      <td className="px-2 py-2">Total</td>
                      <td className="px-2 py-2 text-right">
                        <Money cents={totals.entradas} />
                      </td>
                      <td className="px-2 py-2 text-right">
                        <Money cents={totals.gastos} />
                      </td>
                      <td className={`px-2 py-2 text-right ${totals.saldo < 0 ? "text-danger" : ""}`}>
                        <Money cents={totals.saldo} />
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </details>
          </Panel>
        </div>
      )}
    </>
  );
}

function Kpi({ label, value, note, alert = false }: { label: string; value: React.ReactNode; note?: string; alert?: boolean }) {
  return (
    <div className="border-line p-4 [&:nth-child(-n+2)]:border-b odd:border-r sm:[&:nth-child(-n+2)]:border-b-0 sm:[&:not(:last-child)]:border-r">
      <div className="text-[13px] text-ink-3">{label}</div>
      <div className={`mt-1 text-[19px] leading-tight font-semibold ${alert ? "text-danger" : ""}`}>{value}</div>
      {note && <div className="mt-0.5 truncate text-[12px] text-ink-3">{note}</div>}
    </div>
  );
}

function Composition({ stats, labels, titles, partial }: { stats: Stats; labels: string[]; titles: string[]; partial: boolean[] }) {
  const parts = [
    { key: "fixo", label: "Fixos do mês", values: stats.monthly.map((r) => r.fixo) },
    { key: "cartao", label: "Fixos do cartão", values: stats.monthly.map((r) => r.cartao) },
    { key: "avulso", label: "Dia a dia", values: stats.monthly.map((r) => r.avulso) },
  ].map((p, i) => ({ ...p, color: COMPOSITION[i], total: p.values.reduce((a, v) => a + v, 0) }));
  const sum = parts.reduce((a, p) => a + Math.max(p.total, 0), 0) || 1;
  return (
    <Panel className="px-4 pt-4 pb-4">
      <h2 className="mb-3 text-[15px] font-semibold">Para onde foi, mês a mês</h2>
      <ColumnChart label="Gastos por tipo, mês a mês" layout="stacked" showTotal labels={labels} titles={titles} partial={partial} series={parts} />
      <ul className="mt-3 divide-y divide-line border-t border-line">
        {parts.map((p) => (
          <li key={p.key} className="flex items-center gap-3 py-2.5">
            <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: p.color }} aria-hidden />
            <span className="min-w-0 flex-1 truncate text-[15px]">{p.label}</span>
            <span className="num text-[12px] text-ink-3">{formatPercent(Math.max(p.total, 0) / sum)}</span>
            <Money cents={p.total} className="w-28 text-right text-[15px] font-semibold" />
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function Categories({ stats, lookups }: { stats: Stats; lookups: Awaited<ReturnType<typeof loadLookups>> }) {
  const named = stats.byCategory.filter((c) => c.categoryId != null);
  const none = stats.byCategory.find((c) => c.categoryId == null);
  if (!named.length && !none) return null;
  const max = Math.max(...named.map((c) => c.total), 1);
  const rows = named.map((c) => {
    const cat = lookups.categories.get(c.categoryId!);
    return { ...c, name: cat?.name ?? "Categoria removida", emoji: cat?.emoji ?? "🏷️" };
  });
  const Row = ({ r }: { r: (typeof rows)[number] }) => (
    <li className="flex items-center gap-3 px-4 py-2.5">
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
            <span className="block h-full rounded-full bg-ink" style={{ width: `${Math.max((Math.max(r.total, 0) / max) * 100, 2)}%` }} />
          </span>
          <span className="num w-10 text-right text-[12px] text-ink-3">{formatPercent(Math.max(r.share, 0))}</span>
        </span>
        <span className="mt-1 block text-[12px] text-ink-3">
          {formatBRL(r.monthlyAvg)} por mês em média, {r.count} {r.count === 1 ? "lançamento" : "lançamentos"}
        </span>
      </span>
    </li>
  );
  const head = rows.slice(0, CATEGORY_VISIBLE);
  const tail = rows.slice(CATEGORY_VISIBLE);
  return (
    <Panel className="pb-3">
      <SectionTitle>Categorias</SectionTitle>
      <ul>
        {head.map((r) => (
          <Row key={r.categoryId} r={r} />
        ))}
      </ul>
      {tail.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer list-none px-4 py-2 text-[14px] font-medium text-brand marker:hidden">
            <span className="group-open:hidden">
              Mostrar mais {tail.length} {tail.length === 1 ? "categoria" : "categorias"}
            </span>
            <span className="hidden group-open:inline">Mostrar menos</span>
          </summary>
          <ul>
            {tail.map((r) => (
              <Row key={r.categoryId} r={r} />
            ))}
          </ul>
        </details>
      )}
      {none && (
        <p className="mx-4 mt-2 rounded-2xl bg-paper px-3.5 py-3 text-[14px] text-ink-2">
          <Money cents={none.total} className="font-semibold text-ink" /> em {none.count} {none.count === 1 ? "lançamento" : "lançamentos"} sem categoria (
          {formatPercent(Math.max(none.share, 0))} dos gastos).
        </p>
      )}
    </Panel>
  );
}

function Payments({ stats, lookups }: { stats: Stats; lookups: Awaited<ReturnType<typeof loadLookups>> }) {
  if (!stats.byPayment.length) return null;
  const rows = stats.byPayment.map((p) => {
    const m = p.paymentMethodId != null ? lookups.methods.get(p.paymentMethodId) : undefined;
    return { ...p, key: String(p.paymentMethodId), name: m?.name ?? "Sem forma de pagamento", color: m?.color ?? "#9aa3b5" };
  });
  return (
    <Panel className="px-4 pt-4 pb-3">
      <h2 className="mb-3 text-[15px] font-semibold">Formas de pagamento</h2>
      <StackedBar parts={rows.map((r) => ({ key: r.key, value: Math.max(r.total, 0), color: r.color }))} />
      <ul className="mt-2">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center gap-3 py-2">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: r.color }} aria-hidden />
            <span className="min-w-0 flex-1 truncate text-[15px]">{r.name}</span>
            <span className="num text-[12px] text-ink-3">{formatPercent(Math.max(r.share, 0))}</span>
            <Money cents={r.total} className="w-28 text-right text-[15px] font-semibold" />
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function Weekdays({ stats }: { stats: Stats }) {
  const total = stats.weekday.reduce((a, w) => a + w.total, 0);
  if (total <= 0) return null;
  const top = [...stats.weekday].sort((a, b) => b.total - a.total)[0];
  const low = [...stats.weekday].sort((a, b) => a.total - b.total)[0];
  return (
    <Panel className="px-4 pt-4 pb-4">
      <h2 className="text-[15px] font-semibold">Dia a dia por dia da semana</h2>
      <p className="mb-3 text-[13px] text-ink-3">
        {WEEKDAYS[top.day]} concentra {formatPercent(top.total / total)} dos gastos do dia a dia; {WEEKDAYS[low.day].toLowerCase()}, só{" "}
        {formatPercent(low.total / total)}.
      </p>
      <ColumnChart
        label="Gastos do dia a dia por dia da semana"
        height={150}
        labels={WEEKDAYS_SHORT}
        titles={WEEKDAYS}
        series={[{ key: "dia", label: "no total", color: SPEND, values: stats.weekday.map((w) => w.total) }]}
        extra={[
          { label: "", values: stats.weekday.map((w) => w.count), format: "count" },
          { label: "por compra", values: stats.weekday.map((w) => (w.count ? Math.round(w.total / w.count) : 0)) },
        ]}
      />
    </Panel>
  );
}
