import Link from "next/link";
import {
  getMonth,
  hasAnyData,
  listCategories,
  listPaymentMethods,
} from "@/lib/data";
import {
  currentMonth,
  formatShortDate,
  monthLabel,
  monthPhrase,
  todayISO,
} from "@/lib/format";
import { readParams, type SearchParams } from "@/lib/page";
import {
  BackToCurrentMonth,
  Chevron,
  DayBadge,
  EntryIcon,
  Money,
  MonthSwitcher,
  Panel,
  PaymentTag,
  SectionTitle,
  StackedBar,
} from "@/components/ui";
import { PayNowButton } from "@/components/PayButton";
import { CategoryBars } from "@/components/CategoryBars";
import { ShareReport, type ReportData } from "@/components/ShareReport";

export const dynamic = "force-dynamic";

// Tons de uma cor só para as partes de um todo (fixos do mês, do cartão, dia a dia)
const COMPOSITION = ["#172033", "#5b6b8c", "#a9b4c8"];
const PENDING_VISIBLE = 5;

export default async function Painel({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { month } = await readParams(searchParams);
  const [methods, categories] = await Promise.all([
    listPaymentMethods(),
    listCategories(),
  ]);
  const [summary, anyData] = await Promise.all([getMonth(month), hasAnyData()]);
  const { totals } = summary;
  const catById = new Map(categories.map((c) => [c.id, c]));
  const methodById = new Map(methods.map((m) => [m.id, m]));
  const monthName = monthLabel(month, false).toLowerCase();
  const back = encodeURIComponent(`/?m=${month}`);
  const today = todayISO();
  const isCurrent = month === currentMonth();

  const spentRatio =
    totals.entradas > 0
      ? totals.gastos / totals.entradas
      : totals.gastos > 0
        ? Infinity
        : 0;
  const over = spentRatio > 1;
  const pct = Number.isFinite(spentRatio) ? Math.round(spentRatio * 100) : 100;
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
        budget: cat?.budgetCents ?? null,
      };
    });

  // Resumo para compartilhar (texto curto com o mais importante do mês)
  const report: ReportData = {
    monthTitle: monthPhrase(month),
    partial: isCurrent,
    entradas: totals.entradas,
    gastos: totals.gastos,
    saldo: totals.saldo,
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
      <header className="px-4 pt-[max(env(safe-area-inset-top),10px)] pb-1 lg:flex lg:items-center lg:justify-between lg:px-0 lg:pt-2 lg:pb-3">
        <div className="flex items-center justify-between lg:hidden">
          <span className="display text-[19px] font-bold tracking-tight">
            Atlas<span className="text-brand">Financeiro</span>
          </span>
          <div className="-mr-1.5 flex items-center">
            <ShareReport report={report} variant="icon" />
            <Link
              href="/ajustes"
              aria-label="Ajustes"
              className="grid size-10 shrink-0 place-items-center rounded-full text-ink-2 hover:bg-white/70 lg:hidden"
            >
              <svg
                viewBox="0 0 24 24"
                className="size-[22px]"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
                <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
              </svg>
            </Link>
          </div>
        </div>
        <h1 className="display hidden text-[28px] font-bold tracking-tight lg:block">
          Painel
        </h1>
        <div className="-mx-2 mt-1 flex justify-center lg:mx-0 lg:mt-0 lg:items-center lg:gap-3">
          <span className="hidden lg:inline-flex">
            <ShareReport report={report} variant="pill" />
          </span>
          <MonthSwitcher month={month} basePath="/" />
        </div>
      </header>
      <BackToCurrentMonth month={month} basePath="/" />

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
          <section
            aria-labelledby="saldo-titulo"
            className="order-1 mx-3 mt-1 overflow-hidden rounded-[24px] bg-ink p-5 text-white lg:mx-0 lg:mt-0 lg:p-7"
          >
            <h2 id="saldo-titulo" className="text-[15px] text-white/70">
              Saldo de {monthName}
            </h2>
            <p
              className={`display mt-1 text-[clamp(42px,12.5vw,64px)] leading-[0.95] font-[750] tracking-[-0.02em] ${
                totals.saldo < 0 ? "text-[#ff9aa5]" : "text-white"
              }`}
              style={{ fontStretch: "82%" }}
            >
              <Money cents={totals.saldo} />
            </p>

            <div className="mt-5">
              <div
                className="h-2.5 overflow-hidden rounded-full bg-white/15"
                role="meter"
                aria-label="Quanto do que entrou já foi gasto"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.min(pct, 100)}
              >
                <div
                  className={`h-full rounded-full ${over ? "bg-[#ff9aa5]" : "bg-[#7fd8c8]"}`}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
              <p
                className={`mt-2 text-[14px] ${over ? "font-medium text-[#ff9aa5]" : "text-white/70"}`}
              >
                {totals.entradas === 0
                  ? "Nenhuma entrada registrada neste mês."
                  : over
                    ? `Os gastos passaram o que entrou em ${pct - 100}%.`
                    : `${pct}% do que entrou já foi gasto.`}
              </p>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <Link
                href={`/lancamentos?m=${month}&tab=entradas`}
                className="rounded-2xl bg-white/[0.08] p-3.5 hover:bg-white/[0.12]"
              >
                <div className="flex items-center gap-1.5 text-[13px] text-white/70">
                  <Arrow dir="down" /> Entrou
                </div>
                <Money
                  cents={totals.entradas}
                  className="mt-0.5 block text-[18px] font-semibold text-[#7fd8c8]"
                />
              </Link>
              <Link
                href={`/lancamentos?m=${month}&f=todos`}
                className="rounded-2xl bg-white/[0.08] p-3.5 hover:bg-white/[0.12]"
              >
                <div className="flex items-center gap-1.5 text-[13px] text-white/70">
                  <Arrow dir="up" /> Saiu
                </div>
                <Money
                  cents={totals.gastos}
                  className="mt-0.5 block text-[18px] font-semibold"
                />
              </Link>
            </div>
          </section>

          {/* Por categoria */}
          {(catRows.length > 0 || uncategorized) && (
            <Panel className="order-5 pb-3">
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

          {/* Para onde foi */}
          {totals.gastos !== 0 && (
            <Panel className="order-3 pb-2">
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
            <Panel className="order-4 pb-2">
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
            <Panel className="order-6">
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
    </>
  );
}

function Arrow({ dir }: { dir: "up" | "down" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path
        d={dir === "down" ? "M12 5v14M6 13l6 6 6-6" : "M12 19V5M6 11l6-6 6 6"}
      />
    </svg>
  );
}
