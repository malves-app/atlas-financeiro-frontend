import Link from "next/link";
import {
  categoryNames,
  getMonth,
  getMonthTotals,
  hasAnyData,
  listCategories,
  listGoals,
  listPaymentMethods,
  monthTotalsOf,
} from "@/lib/data";
import { goalBoard, goalsFor, type MonthTotals } from "@/lib/goals";
import { GoalsPanel } from "@/components/GoalsPanel";
import {
  currentMonth,
  formatShortDate,
  monthLabel,
  monthPhrase,
  todayISO,
} from "@/lib/format";
import { readParams, type SearchParams } from "@/lib/page";
import {
  Chevron,
  DayBadge,
  EntryIcon,
  Money,
  Panel,
  PaymentTag,
  SectionTitle,
  StackedBar,
} from "@/components/ui";
import { PainelHeader } from "@/components/PageHeaders";
import { PendingSwap } from "@/components/NavState";
import { PainelBodySkeleton } from "@/components/PageSkeletons";
import { PayNowButton } from "@/components/PayButton";
import { CategoryBars } from "@/components/CategoryBars";
import { ShareReport, type ReportData } from "@/components/ShareReport";
import { BalanceCard } from "@/components/BalanceCard";
import { balanceView } from "@/lib/balance";

export const dynamic = "force-dynamic";

// Tons de uma cor só para as partes de um todo (fixos do mês, do cartão, dia a dia)
const COMPOSITION = ["#172033", "#5b6b8c", "#a9b4c8"];
const PENDING_VISIBLE = 5;
const SHARE_EMOJI = { in: "⬇️", conta: "⬆️", cartao: "💳", pagar: "🧾" };

export default async function Painel({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { month } = await readParams(searchParams);
  // Tudo de uma vez: as consultas não dependem umas das outras
  const [methods, categories, summary, anyData, goals, names] = await Promise.all([
    listPaymentMethods(),
    listCategories(),
    getMonth(month),
    hasAnyData(),
    listGoals(),
    categoryNames(),
  ]);
  const { totals } = summary;
  const catById = new Map(categories.map((c) => [c.id, c]));
  const methodById = new Map(methods.map((m) => [m.id, m]));
  const monthName = monthLabel(month, false).toLowerCase();
  const back = encodeURIComponent(`/?m=${month}`);
  const today = todayISO();
  const isCurrent = month === currentMonth();

  // Cartão do saldo: saldo do mês inteiro em destaque, barras Entrou × Gastos e o extrato (lib/balance.ts)
  const view = balanceView({
    month,
    today,
    totals,
    upcoming: summary.upcoming,
    byPayment: summary.byPayment,
    methods,
  });

  // Metas do mês (e do ano, que somam os meses de janeiro até hoje)
  const year = month.slice(0, 4);
  const nowMonth = currentMonth();
  const goalTotals: Map<string, MonthTotals> = goalsFor(goals, month).annual.length
    ? await getMonthTotals(`${year}-01`, `${year}-12` < nowMonth ? `${year}-12` : nowMonth)
    : new Map();
  goalTotals.set(month, monthTotalsOf(summary));
  const board = goalBoard(goals, { month, today, totals: goalTotals, categories: names });
  const categoryGoal = new Map(
    board.monthly.filter((p) => p.goal.kind === "categoria").map((p) => [p.goal.categoryId, p.target]),
  );

  const recent = summary.entries
    .filter((e) => e.kind === "avulso")
    .sort((a, b) => b.id - a.id)
    .slice(0, 6);

  const pendingTotal = summary.pending.reduce((a, e) => a + e.amountCents, 0);
  const overdue = summary.pending.filter((e) => e.date && e.date < today);

  // Para onde foi: fixos do mês, fixos do cartão e dia a dia
  const composition = [
    {
      key: "fixo",
      label: "Fixos do mês",
      hint: "Aluguel, saúde, contas",
      value: totals.fixo,
      href: `/fixos?m=${month}`,
      color: COMPOSITION[0],
    },
    {
      key: "cartao",
      label: "Fixos do cartão",
      hint: "Assinaturas e parcelas",
      value: totals.cartao,
      href: `/fixos?m=${month}&aba=cartao`,
      color: COMPOSITION[1],
    },
    {
      key: "avulso",
      label: "Dia a dia",
      hint: "Gastos do mês",
      value: totals.avulso,
      href: `/lancamentos?m=${month}`,
      color: COMPOSITION[2],
    },
  ];
  const compTotal =
    composition.reduce((a, c) => a + Math.max(c.value, 0), 0) || 1;

  // Forma de pagamento, na ordem cadastrada
  const payRows = summary.byPayment
    .filter((p) => p.total !== 0)
    .map((p) => {
      const m =
        p.paymentMethodId != null
          ? methodById.get(p.paymentMethodId)
          : undefined;
      return {
        key: String(p.paymentMethodId),
        id: p.paymentMethodId,
        name: m?.name ?? "Sem forma de pagamento",
        color: m?.color ?? "#9aa3b5",
        sort: m?.sort ?? 999,
        total: p.total,
      };
    })
    .sort((a, b) => a.sort - b.sort);
  const payTotal = payRows.reduce((a, r) => a + Math.max(r.total, 0), 0) || 1;

  // Categorias: "sem categoria" vira um aviso à parte para não achatar as barras
  const uncategorized = summary.byCategory.find((c) => c.categoryId == null);
  const catRows = summary.byCategory
    .filter((c) => c.categoryId != null)
    .map((c) => {
      const cat = catById.get(c.categoryId!);
      return {
        id: c.categoryId,
        name: cat?.name ?? "Categoria removida",
        emoji: cat?.emoji ?? "🏷️",
        total: c.total,
        count: c.count,
        budget: categoryGoal.get(c.categoryId) ?? null,
      };
    });

  // Resumo para compartilhar (texto curto com o mais importante do mês): o mesmo extrato do cartão do saldo
  const shareRows: ReportData["rows"] = [
    { emoji: "⬇️", label: view.income.label, cents: view.income.cents },
    ...view.outs.map((p) => ({ emoji: SHARE_EMOJI[p.key], label: p.label, cents: -p.cents })),
  ];
  if (view.mode === "andamento")
    shareRows.splice(view.outs.some((p) => p.key === "conta") ? 2 : 1, 0, {
      emoji: "🏦",
      label: "Na conta hoje",
      cents: view.naConta,
      bold: true,
    });
  const report: ReportData = {
    monthTitle: monthPhrase(month),
    partial: isCurrent,
    mode: view.mode,
    heroLabel: view.heroLabel,
    entradas: totals.entradas,
    gastos: totals.gastos,
    saldo: totals.saldo,
    naConta: view.naConta,
    rows: shareRows,
    pending: summary.pending.map((e) => ({
      date: e.date,
      name: e.name,
      amount: e.amountCents,
      late: !!e.date && e.date < today,
    })),
    payments: payRows.map((r) => ({ name: r.name, total: r.total })),
    categories: catRows
      .slice(0, 5)
      .map((c) => ({ emoji: c.emoji, name: c.name, total: c.total })),
  };

  return (
    <>
      <PainelHeader
        month={month}
        shareIcon={<ShareReport report={report} variant="icon" />}
        sharePill={<ShareReport report={report} variant="pill" />}
      />

      {/* Troca de mês: o skeleton aparece no toque, até os dados do mês novo chegarem */}
      <PendingSwap fallback={<PainelBodySkeleton />}>
        {!anyData && (
          <Panel className="mt-2 mb-3 p-5 lg:mb-5">
            <h2 className="display text-[20px] font-bold">
              Traga sua planilha para cá
            </h2>
            <p className="mt-1.5 text-[15px] text-ink-2">
              Importe os meses de 2026 da planilha do Google e continue lançando
              por aqui.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/ajustes#importar"
                className="rounded-full bg-ink px-4 py-2.5 text-[14px] font-semibold text-white"
              >
                Importar planilha
              </Link>
              <Link
                href="/novo"
                className="rounded-full bg-paper px-4 py-2.5 text-[14px] font-semibold"
              >
                Lançar um gasto
              </Link>
            </div>
          </Panel>
        )}

        <div className="flex flex-col gap-3 lg:gap-4">
          {/* cards em uma coluna; a ordem vem de "order-N" */}
          <div className="contents">
            {/* Saldo do mês: o destaque da tela */}
            <BalanceCard view={view} className="order-1" />

            {/* Por categoria */}
            {(catRows.length > 0 || uncategorized) && (
              <Panel className="order-6 pb-3">
                <SectionTitle>Por categoria</SectionTitle>
                {catRows.length > 0 && (
                  <CategoryBars month={month} rows={catRows} />
                )}
                {uncategorized && (
                  <Link
                    href={`/lancamentos?m=${month}&f=sem-categoria`}
                    className="mx-4 mt-2 flex items-center gap-3 rounded-2xl bg-paper px-3.5 py-3 hover:bg-line/50"
                  >
                    <span
                      className="grid size-8 shrink-0 place-items-center rounded-full bg-surface text-[15px] font-semibold text-ink-3"
                      aria-hidden
                    >
                      ?
                    </span>
                    <span className="min-w-0 flex-1 text-[14px]">
                      <span className="font-medium">
                        {uncategorized.count}{" "}
                        {uncategorized.count === 1 ? "lançamento" : "lançamentos"}{" "}
                        sem categoria
                      </span>
                      <span className="block text-ink-3">
                        Categorizar deixa este gráfico completo
                      </span>
                    </span>
                    <Money
                      cents={uncategorized.total}
                      className="text-[14px] font-semibold"
                    />
                    <Chevron className="size-4 text-ink-3" />
                  </Link>
                )}
              </Panel>
            )}
          </div>

          <div className="contents">
            {/* A pagar */}
            {summary.pending.length > 0 ? (
              <Panel className="order-2">
                <SectionTitle
                  right={
                    <span className="text-[13px] text-ink-3">
                      {summary.pending.length}{" "}
                      {summary.pending.length === 1 ? "conta" : "contas"},{" "}
                      <Money
                        cents={pendingTotal}
                        className="font-semibold text-ink"
                      />
                    </span>
                  }
                >
                  A pagar
                </SectionTitle>
                {overdue.length > 0 && (
                  <p className="mx-4 mb-1 rounded-xl bg-danger-soft px-3 py-2 text-[13px] font-medium text-danger">
                    {overdue.length === 1
                      ? "1 conta já venceu"
                      : `${overdue.length} contas já venceram`}
                  </p>
                )}
                <ul className="pb-2">
                  {summary.pending.slice(0, PENDING_VISIBLE).map((e) => {
                    const late = !!e.date && e.date < today;
                    return (
                      <li
                        key={e.id}
                        className="flex items-center gap-3 px-4 py-2"
                      >
                        <Link
                          href={`/lancamentos/${e.id}?back=${back}`}
                          className="flex min-w-0 flex-1 items-center gap-3"
                        >
                          <DayBadge
                            date={e.date}
                            tone={late ? "danger" : "default"}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[15px] font-medium">
                              {e.name}
                            </div>
                            <div className="flex gap-2 truncate text-[13px] text-ink-3">
                              {late ? (
                                <span className="font-medium text-danger">
                                  Venceu
                                </span>
                              ) : (
                                <span>
                                  {e.kind === "cartao" ? "Cobrança" : "Vence"}
                                </span>
                              )}
                              <PaymentTag
                                method={
                                  e.paymentMethodId != null
                                    ? methodById.get(e.paymentMethodId)
                                    : null
                                }
                              />
                            </div>
                          </div>
                        </Link>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <Money
                            cents={e.amountCents}
                            className="text-[15px] font-semibold"
                          />
                          <PayNowButton id={e.id} name={e.name} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
                {summary.pending.length > PENDING_VISIBLE && (
                  <Link
                    href={`/fixos?m=${month}`}
                    className="block border-t border-line px-4 py-3 text-[14px] font-medium text-brand"
                  >
                    {summary.pending.length - PENDING_VISIBLE === 1
                      ? "Ver a outra conta em Fixos"
                      : `Ver as outras ${summary.pending.length - PENDING_VISIBLE} contas em Fixos`}
                  </Link>
                )}
              </Panel>
            ) : (
              isCurrent &&
              summary.entries.some((e) => e.kind === "fixo") && (
                <Panel className="order-2 flex items-center gap-3 px-4 py-4">
                  <span
                    className="grid size-10 place-items-center rounded-full bg-brand-soft text-brand"
                    aria-hidden
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="size-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.6"
                    >
                      <path
                        d="M5 12.5l4.5 4.5L19 7.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <div>
                    <div className="text-[15px] font-semibold">
                      Contas do mês em dia
                    </div>
                    <div className="text-[13px] text-ink-3">
                      Nenhum fixo pendente em {monthName}.
                    </div>
                  </div>
                </Panel>
              )
            )}

            {/* Metas: as mais urgentes primeiro; sem metas, no mês atual, um convite */}
            <GoalsPanel
              month={month}
              items={[...board.monthly, ...board.annual]}
              invite={isCurrent && anyData}
              className="order-3"
            />

            {/* Para onde foi */}
            {totals.gastos !== 0 && (
              <Panel className="order-4 pb-2">
                <SectionTitle>Para onde foi</SectionTitle>
                <div className="px-4 pb-1">
                  <StackedBar
                    parts={composition.map((c) => ({
                      key: c.key,
                      value: c.value,
                      color: c.color,
                    }))}
                  />
                </div>
                <ul>
                  {composition.map((c) => (
                    <li key={c.key}>
                      <Link
                        href={c.href}
                        className="flex items-center gap-3 px-4 py-2 hover:bg-paper/60"
                      >
                        <span
                          className="size-3 shrink-0 rounded-full"
                          style={{ background: c.color }}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[15px] font-medium">
                            {c.label}
                          </span>
                          <span className="block text-[13px] text-ink-3">
                            {c.hint}
                          </span>
                        </span>
                        <span className="num text-[13px] text-ink-3">
                          {Math.round((Math.max(c.value, 0) / compTotal) * 100)}%
                        </span>
                        <Money
                          cents={c.value}
                          className="w-[6.5rem] text-right text-[15px] font-semibold"
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}

            {/* Por forma de pagamento */}
            {payRows.length > 0 && (
              <Panel className="order-5 pb-2">
                <SectionTitle>Por forma de pagamento</SectionTitle>
                <div className="px-4 pb-1">
                  <StackedBar
                    parts={payRows.map((r) => ({
                      key: r.key,
                      value: r.total,
                      color: r.color,
                    }))}
                  />
                </div>
                <ul>
                  {payRows.map((r) => (
                    <li key={r.key}>
                      <Link
                        href={
                          r.id != null
                            ? `/lancamentos?m=${month}&f=todos&pm=${r.id}`
                            : `/lancamentos?m=${month}&f=todos`
                        }
                        className="flex items-center gap-3 px-4 py-2 hover:bg-paper/60"
                      >
                        <span
                          className="size-3 shrink-0 rounded-full"
                          style={{ background: r.color }}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1 truncate text-[15px] font-medium">
                          {r.name}
                        </span>
                        <span className="num text-[13px] text-ink-3">
                          {Math.round((Math.max(r.total, 0) / payTotal) * 100)}%
                        </span>
                        <Money
                          cents={r.total}
                          className="w-[6.5rem] text-right text-[15px] font-semibold"
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}

            {/* Últimos gastos */}
            {recent.length > 0 && (
              <Panel className="order-7">
                <SectionTitle
                  right={
                    <Link
                      href={`/lancamentos?m=${month}`}
                      className="text-[14px] font-medium text-brand"
                    >
                      Ver todos
                    </Link>
                  }
                >
                  Últimos gastos
                </SectionTitle>
                <ul className="pb-2">
                  {recent.map((e) => {
                    const cat =
                      e.categoryId != null
                        ? catById.get(e.categoryId)
                        : undefined;
                    return (
                      <li key={e.id}>
                        <Link
                          href={`/lancamentos/${e.id}?back=${back}`}
                          className="flex items-center gap-3 px-4 py-2 hover:bg-paper/60"
                        >
                          <EntryIcon emoji={cat?.emoji} name={e.name} />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[15px] font-medium">
                              {e.name}
                            </div>
                            <div className="flex gap-2 truncate text-[13px] text-ink-3">
                              <span>{formatShortDate(e.date)}</span>
                              <PaymentTag
                                method={
                                  e.paymentMethodId != null
                                    ? methodById.get(e.paymentMethodId)
                                    : null
                                }
                              />
                            </div>
                          </div>
                          <Money
                            cents={e.amountCents}
                            className={`text-[15px] font-semibold ${e.amountCents < 0 ? "text-brand" : ""}`}
                          />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </Panel>
            )}
          </div>
        </div>
      </PendingSwap>
    </>
  );
}
