import Link from "next/link";
import { GENERATE_MONTHS_AHEAD, getMonth, listCategories, listPaymentMethods, listRecurring, type Entry } from "@/lib/data";
import { currentMonth, monthLabel, monthPhrase, shiftMonth, todayISO } from "@/lib/format";
import { readParams, type SearchParams } from "@/lib/page";
import { BackToCurrentMonth, DayBadge, EmptyState, Money, MonthSwitcher, Panel, PaymentTag } from "@/components/ui";
import { PaidCheck } from "@/components/PayButton";

export const dynamic = "force-dynamic";

// Duas abas: Contas (formas de pagamento que não são crédito) e Cartão de crédito
type Aba = "contas" | "cartao";

export default async function Fixos({ searchParams }: { searchParams: SearchParams }) {
  const { month, get } = await readParams(searchParams);
  const abaParam = get("aba");
  // links antigos (?aba=assinaturas / ?aba=parcelas) caem na aba do cartão
  const aba: Aba = abaParam === "cartao" || abaParam === "assinaturas" || abaParam === "parcelas" ? "cartao" : "contas";
  const methods = await listPaymentMethods();
  const [summary, categories, recurring] = await Promise.all([getMonth(month), listCategories(), listRecurring()]);
  const catById = new Map(categories.map((c) => [c.id, c]));
  const methodById = new Map(methods.map((m) => [m.id, m]));
  const back = encodeURIComponent(`/fixos?m=${month}${aba !== "contas" ? `&aba=${aba}` : ""}`);
  const today = todayISO();
  const canBeLate = month <= currentMonth();

  const byDay = (a: Entry, b: Entry) => (a.date ?? "99").localeCompare(b.date ?? "99") || a.name.localeCompare(b.name);
  const sum = (xs: Entry[]) => xs.reduce((a, e) => a + e.amountCents, 0);
  // Quem decide a aba é a forma de pagamento (Ajustes): crédito vai para o cartão, o resto é conta.
  // Se a forma foi removida, vale o tipo do lançamento.
  const isCard = (e: Entry) => {
    const m = e.paymentMethodId != null ? methodById.get(e.paymentMethodId) : undefined;
    return m ? m.isCredit : e.kind === "cartao";
  };
  const recurringEntries = summary.entries.filter((e) => e.kind !== "avulso");
  const fixos = recurringEntries.filter((e) => !isCard(e)).sort(byDay);
  const unpaid = fixos.filter((e) => e.paid !== true);
  const paid = fixos.filter((e) => e.paid === true);
  const cartao = recurringEntries.filter(isCard);
  const assinaturas = cartao.filter((e) => e.installmentTotal == null).sort(byDay);
  const parcelas = cartao
    .filter((e) => e.installmentTotal != null)
    .sort((a, b) => a.installmentTotal! - a.installmentNo! - (b.installmentTotal! - b.installmentNo!) || byDay(a, b));
  const remainingAfter = parcelas.reduce((a, e) => a + (e.installmentTotal! - e.installmentNo!) * e.amountCents, 0);
  const tooFar = month > shiftMonth(currentMonth(), GENERATE_MONTHS_AHEAD);
  const paidRatio = sum(fixos) > 0 ? sum(paid) / sum(fixos) : 0;

  // A forma de pagamento só aparece quando foge do comum daquela lista
  const usual = (xs: Entry[]) => {
    const count = new Map<number | null, number>();
    for (const e of xs) count.set(e.paymentMethodId, (count.get(e.paymentMethodId) ?? 0) + 1);
    return [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  };

  const Row = ({ e, usualMethod, children }: { e: Entry; usualMethod: number | null; children?: React.ReactNode }) => {
    const c = e.categoryId != null ? catById.get(e.categoryId) : undefined;
    const late = canBeLate && e.paid !== true && !isCard(e) && !!e.date && e.date < today;
    const card = isCard(e);
    // No cartão não há "pago": a fatura é paga de uma vez
    const tone = !card && e.paid === true ? "done" : late ? "danger" : "default";
    return (
      <li className="flex items-center gap-3 px-4 py-2.5">
        <Link href={`/lancamentos/${e.id}?back=${back}`} className="flex min-w-0 flex-1 items-center gap-3">
          <DayBadge date={e.date} tone={tone} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <span className={`truncate text-[15px] font-medium ${!card && e.paid === true ? "text-ink-2" : ""}`}>{e.name}</span>
              <Money cents={e.amountCents} className={`text-[15px] font-semibold ${!card && e.paid === true ? "text-ink-3" : ""}`} />
            </div>
            <div className="flex gap-2.5 truncate text-[13px] text-ink-3">
              {late && <span className="font-medium text-danger">Venceu</span>}
              {e.installmentTotal != null && !isCard(e) && (
                <span className="num shrink-0">
                  Parcela {e.installmentNo}/{e.installmentTotal}
                </span>
              )}
              {c && (
                <span className="truncate">
                  <span aria-hidden>{c.emoji}</span> {c.name}
                </span>
              )}
              {e.paymentMethodId !== usualMethod && <PaymentTag method={e.paymentMethodId != null ? methodById.get(e.paymentMethodId) : null} />}
            </div>
            {children}
          </div>
        </Link>
        {!card && <PaidCheck id={e.id} paid={e.paid === true} label={e.name} />}
      </li>
    );
  };

  const tabs: { id: Aba; label: string; count: number }[] = [
    { id: "contas", label: "Contas", count: fixos.length },
    { id: "cartao", label: "Cartão de crédito", count: cartao.length },
  ];
  const show = (id: Aba) => (aba === id ? "" : "hidden");
  const fixosUsual = usual(fixos);
  const cartaoUsual = usual(cartao);

  return (
    <>
      <header className="flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),10px)] pb-1 lg:px-0 lg:pt-2 lg:pb-3">
        <h1 className="display text-[22px] font-bold tracking-tight lg:text-[28px]">Fixos</h1>
        <div className="flex items-center gap-3">
          <Link
            href={`/fixos/novo?m=${month}`}
            className="hidden rounded-full bg-ink px-4 py-2 text-[14px] font-semibold text-white lg:inline-block"
          >
            Adicionar fixo
          </Link>
          <MonthSwitcher month={month} basePath="/fixos" params={{ aba: aba !== "contas" ? aba : undefined }} />
        </div>
      </header>
      <BackToCurrentMonth month={month} basePath="/fixos" params={{ aba: aba !== "contas" ? aba : undefined }} />

      {/* Resumo do mês */}
      <Panel className="mt-1 mb-3 p-5 lg:mt-0 lg:mb-5 lg:grid lg:grid-cols-[1.4fr_1fr] lg:gap-8 lg:p-6">
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-[15px] text-ink-2">Contas</h2>
            <span className="text-[13px] font-medium text-ink-2">
              {fixos.length > 0 ? `${paid.length} de ${fixos.length} pagas` : "Nenhuma"}
            </span>
          </div>
          <Money cents={sum(fixos)} className="display mt-0.5 block text-[30px] leading-tight font-bold" />
          <div
            className="mt-3 h-2.5 overflow-hidden rounded-full bg-paper"
            role="meter"
            aria-label="Quanto das contas do mês já foi pago"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(paidRatio * 100)}
          >
            <div className="h-full rounded-full bg-brand" style={{ width: `${paidRatio * 100}%` }} />
          </div>
          <div className="mt-2 flex justify-between text-[13px]">
            <span className="text-ink-2">
              Pago <Money cents={sum(paid)} className="font-semibold text-brand" />
            </span>
            <span className="text-ink-2">
              Falta <Money cents={sum(unpaid)} className={`font-semibold ${unpaid.length ? "text-ink" : "text-ink-3"}`} />
            </span>
          </div>
        </div>
        <div className="mt-5 border-t border-line pt-4 lg:mt-0 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
          <h2 className="text-[15px] text-ink-2">Cartão de crédito</h2>
          <Money cents={sum(cartao)} className="display mt-0.5 block text-[30px] leading-tight font-bold" />
          <dl className="mt-2 space-y-1 text-[13px]">
            <div className="flex justify-between">
              <dt className="text-ink-2">{assinaturas.length} {assinaturas.length === 1 ? "fixo ou assinatura" : "fixos e assinaturas"}</dt>
              <dd>
                <Money cents={sum(assinaturas)} className="font-semibold" />
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-2">{parcelas.length} {parcelas.length === 1 ? "parcela" : "parcelas"}</dt>
              <dd>
                <Money cents={sum(parcelas)} className="font-semibold" />
              </dd>
            </div>
            {remainingAfter > 0 && (
              <div className="flex justify-between">
                <dt className="text-ink-3">Parcelas depois deste mês</dt>
                <dd>
                  <Money cents={remainingAfter} className="text-ink-3" />
                </dd>
              </div>
            )}
          </dl>
        </div>
      </Panel>

      {tooFar && summary.entries.filter((e) => e.kind !== "avulso").length === 0 && (
        <Panel className="mb-3">
          <EmptyState>
            Os fixos são montados até {GENERATE_MONTHS_AHEAD / 12} anos à frente; {monthPhrase(month)} ainda está longe.
          </EmptyState>
        </Panel>
      )}

      {/* Abas: uma lista por vez, no celular e no computador */}
      <nav aria-label="Tipo de fixo" className="mx-3 mb-3 grid grid-cols-2 gap-1 rounded-full bg-surface p-1 ring-1 ring-line lg:mx-0 lg:mb-4">
        {tabs.map((t) => (
          <Link
            key={t.id}
            href={`/fixos?m=${month}${t.id !== "contas" ? `&aba=${t.id}` : ""}`}
            replace
            scroll={false}
            aria-current={aba === t.id ? "page" : undefined}
            className={`rounded-full py-2 text-center text-[14px] font-semibold ${aba === t.id ? "bg-ink text-white" : "text-ink-2"}`}
          >
            {t.label} <span className={`num ${aba === t.id ? "text-white/60" : "text-ink-3"}`}>{t.count}</span>
          </Link>
        ))}
      </nav>

      <div>
        {/* Contas do mês */}
        <Panel className={`mb-3 lg:mb-4 ${show("contas")}`}>
          <div className="flex items-baseline justify-between gap-3 px-4 pt-4 pb-1">
            <h2 className="text-[15px] font-semibold">Contas</h2>
            {unpaid.length > 0 && (
              <span className="text-[13px] text-ink-3">
                {unpaid.length} a pagar, <Money cents={sum(unpaid)} className="font-semibold text-ink" />
              </span>
            )}
          </div>
          {fixos.length === 0 ? (
            <EmptyState>Nenhuma conta fixa neste mês. Fixos pagos no crédito ficam na aba Cartão de crédito.</EmptyState>
          ) : (
            <>
              {unpaid.length > 0 && (
                <ul className="pb-1">
                  {unpaid.map((e) => (
                    <Row key={e.id} e={e} usualMethod={fixosUsual} />
                  ))}
                </ul>
              )}
              {paid.length > 0 && (
                <>
                  <div className="flex items-center gap-3 px-4 pt-2 pb-1 text-[13px] font-medium text-ink-3">
                    Pagas ({paid.length})
                    <span className="h-px flex-1 bg-line" aria-hidden />
                  </div>
                  <ul className="pb-2">
                    {paid.map((e) => (
                      <Row key={e.id} e={e} usualMethod={fixosUsual} />
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </Panel>

        {/* Cartão de crédito: fixos/assinaturas e, abaixo, as parcelas */}
        <Panel className={`mb-3 lg:mb-4 ${show("cartao")}`}>
          <div className="flex items-baseline justify-between gap-3 px-4 pt-4 pb-1">
            <h2 id="cartao" className="scroll-mt-4 text-[15px] font-semibold">
              Fixos e assinaturas
            </h2>
            {assinaturas.length > 0 && <Money cents={sum(assinaturas)} className="text-[13px] font-semibold text-ink-2" />}
          </div>
          {assinaturas.length === 0 ? (
            <EmptyState>Nenhum fixo no cartão neste mês.</EmptyState>
          ) : (
            <ul className="pb-2">
              {assinaturas.map((e) => (
                <Row key={e.id} e={e} usualMethod={cartaoUsual} />
              ))}
            </ul>
          )}
        </Panel>

        <Panel className={`mb-3 lg:mb-4 ${show("cartao")}`}>
          <div className="flex items-baseline justify-between gap-3 px-4 pt-4 pb-1">
            <h2 className="text-[15px] font-semibold">Parcelas de compras</h2>
            {parcelas.length > 0 && <Money cents={sum(parcelas)} className="text-[13px] font-semibold text-ink-2" />}
          </div>
          {parcelas.length === 0 ? (
            <EmptyState>Nenhuma compra parcelada neste mês.</EmptyState>
          ) : (
            <ul className="pb-2">
              {parcelas.map((e) => {
                const left = e.installmentTotal! - e.installmentNo!;
                const color = methodById.get(e.paymentMethodId ?? -1)?.color ?? "#eb6834";
                return (
                  <Row key={e.id} e={e} usualMethod={cartaoUsual}>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="flex h-1.5 flex-1 gap-[2px]" aria-hidden>
                        {Array.from({ length: e.installmentTotal! }, (_, i) => (
                          <span
                            key={i}
                            className="h-full flex-1 rounded-full"
                            style={{ background: i < e.installmentNo! ? color : "var(--color-line)" }}
                          />
                        ))}
                      </div>
                      <span className="num shrink-0 text-[12px] font-semibold text-ink-2">
                        {e.installmentNo}/{e.installmentTotal}
                      </span>
                    </div>
                    <div className="mt-0.5 flex justify-between gap-2 text-[12px] text-ink-3">
                      <span>{left === 0 ? "Última parcela" : `Até ${monthLabel(shiftMonth(month, left)).toLowerCase()}`}</span>
                      {left > 0 && (
                        <span>
                          faltam <Money cents={left * e.amountCents} />
                        </span>
                      )}
                    </div>
                  </Row>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <div className="mx-4 mt-1 mb-4 lg:hidden">
        <Link href={`/fixos/novo?m=${month}`} className="block rounded-full bg-ink py-3.5 text-center text-[15px] font-semibold text-white">
          Adicionar fixo ou parcelamento
        </Link>
      </div>

      <Panel>
        <details>
          <summary className="cursor-pointer list-none px-4 py-3.5 text-[15px] font-semibold marker:hidden">
            Todos os fixos cadastrados ({recurring.length})
            <span className="block text-[13px] font-normal text-ink-3">Para mudar valores de todos os meses ou encerrar um fixo</span>
          </summary>
          <ul className="pb-2">
            {recurring.map((r) => {
              const lastInstallment = r.installments != null ? shiftMonth(r.startMonth, r.installments - 1) : null;
              const end = [r.endMonth, lastInstallment].filter(Boolean).sort()[0] ?? null;
              const ended = end != null && end < month;
              return (
                <li key={r.id}>
                  <Link href={`/fixos/${r.id}?m=${month}`} className="flex items-center gap-3 px-4 py-2 hover:bg-paper/60">
                    <div className="min-w-0 flex-1">
                      <div className={`truncate text-[15px] ${ended ? "text-ink-3 line-through" : "font-medium"}`}>{r.name}</div>
                      <div className="text-[13px] text-ink-3">
                        {(r.paymentMethodId != null ? methodById.get(r.paymentMethodId)?.isCredit : r.kind === "cartao") ? "Cartão" : "Conta"}
                        {r.installments != null ? `, ${r.installments}x` : ", todo mês"}
                        {end ? `, até ${monthPhrase(end)}` : ""}
                      </div>
                    </div>
                    <Money cents={r.amountCents} className="text-[14px]" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </details>
      </Panel>
    </>
  );
}
