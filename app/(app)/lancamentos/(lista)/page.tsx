import Link from "next/link";
import Form from "next/form";
import { getMonth, listCategories, listPaymentMethods, type Entry } from "@/lib/data";
import { formatDay, formatShortDate, monthPhrase } from "@/lib/format";
import { readParams, type SearchParams } from "@/lib/page";
import { EmptyState, Money, Panel, PaymentTag } from "@/components/ui";
import { LancamentosHeader } from "@/components/PageHeaders";
import { OptimisticLink, ParamShow, PendingSwap } from "@/components/NavState";
import { LancamentosListSkeleton } from "@/components/PageSkeletons";
import { SubmitButton } from "@/components/SubmitButton";
import { fillCategoriesFromHistory } from "@/app/actions";

export const dynamic = "force-dynamic";

const FILTERS = [
  { id: "", label: "Dia a dia" },
  { id: "todos", label: "Todos" },
  { id: "fixos", label: "Fixos e parcelas" },
  { id: "sem-categoria", label: "Sem categoria" },
];

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

export default async function Lancamentos({ searchParams }: { searchParams: SearchParams }) {
  const { month, get } = await readParams(searchParams);
  const tab = get("tab") === "entradas" ? "entradas" : "gastos";
  const f = get("f") ?? "";
  const q = (get("q") ?? "").trim();
  const cat = get("cat");
  const pm = get("pm");
  const [methods, categories, summary] = await Promise.all([listPaymentMethods(), listCategories(), getMonth(month)]);
  const catById = new Map(categories.map((c) => [c.id, c]));
  const methodById = new Map(methods.map((m) => [m.id, m]));

  const params = (over: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    const merged = { m: month, tab: tab === "entradas" ? "entradas" : undefined, f: f || undefined, q: q || undefined, cat, pm, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) sp.set(k, v);
    return `/lancamentos?${sp.toString()}`;
  };

  let entries: Entry[] = summary.entries;
  if (!f && !cat && !pm) entries = entries.filter((e) => e.kind === "avulso");
  if (f === "fixos") entries = entries.filter((e) => e.kind !== "avulso");
  if (pm) entries = entries.filter((e) => String(e.paymentMethodId) === pm);
  if (f === "sem-categoria") entries = entries.filter((e) => e.categoryId == null);
  if (cat) entries = entries.filter((e) => (cat === "sem" ? e.categoryId == null : String(e.categoryId) === cat));
  if (q) entries = entries.filter((e) => norm(e.name).includes(norm(q)));

  const groups = new Map<string, Entry[]>();
  for (const e of [...entries].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || b.id - a.id)) {
    const k = e.date ?? "";
    groups.set(k, [...(groups.get(k) ?? []), e]);
  }
  const total = entries.reduce((a, e) => a + e.amountCents, 0);
  const selectedCat = cat ? (cat === "sem" ? { name: "Sem categoria", emoji: "·" } : catById.get(Number(cat))) : null;
  const uncategorized = summary.entries.filter((e) => e.categoryId == null).length;

  // As duas abas já vêm prontas: trocar de aba é instantâneo (o endereço acompanha depois).
  // Mudar mês, filtro ou busca mostra o skeleton da lista no toque, até a página responder.
  return (
    <div>
      <LancamentosHeader month={month} tab={tab} />

      <div className="mx-4 mt-2 grid grid-cols-2 gap-1 rounded-full bg-surface p-1 lg:mx-0 lg:max-w-sm">
        <OptimisticLink
          href={params({ tab: undefined, f: undefined, cat: undefined })}
          active={tab === "gastos"}
          match={["tab"]}
          current
          scroll={false}
          className="rounded-full py-2 text-center text-[15px] font-semibold text-ink-2 transition-colors data-active:bg-ink data-active:text-white"
        >
          Gastos
        </OptimisticLink>
        <OptimisticLink
          href={params({ tab: "entradas", f: undefined, cat: undefined, q: undefined })}
          active={tab === "entradas"}
          match={["tab"]}
          current
          scroll={false}
          className="rounded-full py-2 text-center text-[15px] font-semibold text-ink-2 transition-colors data-active:bg-brand data-active:text-white"
        >
          Entradas
        </OptimisticLink>
      </div>

      <ParamShow name="tab" value="gastos" current={tab} fallback="gastos">
        <Form action="/lancamentos" className="mx-4 mt-3 lg:mx-0">
          <input type="hidden" name="m" value={month} />
          {f && <input type="hidden" name="f" value={f} />}
          {cat && <input type="hidden" name="cat" value={cat} />}
          {pm && <input type="hidden" name="pm" value={pm} />}
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Buscar por nome"
            aria-label="Buscar lançamentos por nome"
            className="w-full rounded-2xl border border-line bg-surface px-4 py-2.5 outline-none focus:border-brand"
          />
        </Form>

        <div className="mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] pointer-fine:flex-wrap lg:flex-wrap lg:px-0">
          {FILTERS.map((fl) => (
            <OptimisticLink
              key={fl.id}
              href={params({ f: fl.id || undefined, cat: undefined, pm: undefined })}
              active={f === fl.id && !cat && !pm}
              match={["f", "pm", "cat"]}
              replace
              scroll={false}
              className="shrink-0 rounded-full border border-line bg-surface px-3.5 py-1.5 text-[14px] font-medium text-ink-2 data-active:border-transparent data-active:bg-ink data-active:text-white"
            >
              {fl.label}
              {fl.id === "sem-categoria" && uncategorized > 0 && <span className="ml-1 num">({uncategorized})</span>}
            </OptimisticLink>
          ))}
          {methods.map((m) => (
            <OptimisticLink
              key={m.id}
              href={params({ f: "todos", cat: undefined, pm: String(m.id) })}
              active={pm === String(m.id)}
              match={["f", "pm", "cat"]}
              replace
              scroll={false}
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-1.5 text-[14px] font-medium text-ink-2 data-active:border-transparent data-active:bg-ink data-active:text-white"
            >
              <span className="size-2 rounded-full" style={{ background: m.color }} aria-hidden />
              {m.name}
            </OptimisticLink>
          ))}
        </div>

        <PendingSwap keys={["m", "f", "pm", "cat", "q"]} fallback={<LancamentosListSkeleton tab="gastos" />}>
          {selectedCat && (
            <div className="mx-4 mt-3 flex items-center justify-between rounded-2xl lg:mx-0 bg-surface px-4 py-2.5 text-[15px]">
              <span>
                <span aria-hidden>{selectedCat.emoji}</span> {selectedCat.name}
              </span>
              <Link href={params({ cat: undefined })} scroll={false} className="text-[14px] font-medium text-brand">
                Limpar filtro
              </Link>
            </div>
          )}

          {f === "sem-categoria" && uncategorized > 0 && (
            <form action={fillCategoriesFromHistory} className="mx-4 mt-3 rounded-2xl bg-brand-soft px-4 py-3 lg:mx-0">
              <input type="hidden" name="month" value={month} />
              <p className="text-[14px] text-ink">
                Dá para preencher usando o histórico: se “Uber” já foi categorizado antes, os novos “Uber” recebem a mesma categoria.
              </p>
              <SubmitButton tone="brand" pendingLabel="Preenchendo…" className="mt-2 rounded-full bg-brand px-4 py-2 text-[14px] font-semibold text-white disabled:opacity-80">
                Preencher pelo histórico
              </SubmitButton>
            </form>
          )}

          <p className="mx-5 mt-4 mb-2 flex justify-between text-[14px] text-ink-2 lg:mx-1">
            <span>
              {entries.length} {entries.length === 1 ? "lançamento" : "lançamentos"}
            </span>
            <Money cents={total} className="font-semibold text-ink" />
          </p>

          {entries.length === 0 ? (
            <Panel>
              <EmptyState>
                {q ? `Nada encontrado para “${q}” em ${monthPhrase(month)}.` : `Nenhum gasto em ${monthPhrase(month)} com esse filtro.`}
              </EmptyState>
            </Panel>
          ) : (
            <div className="space-y-3">
              {[...groups.entries()].map(([date, list]) => (
                <Panel key={date}>
                  <div className="flex items-baseline justify-between px-4 pt-3 pb-1 text-[13px] font-medium text-ink-3">
                    <span>{formatDay(date || null)}</span>
                    <Money cents={list.reduce((a, e) => a + e.amountCents, 0)} />
                  </div>
                  <ul className="pb-1.5">
                    {list.map((e) => {
                      const c = e.categoryId != null ? catById.get(e.categoryId) : undefined;
                      return (
                        <li key={e.id}>
                          <Link
                            href={`/lancamentos/${e.id}?back=${encodeURIComponent(params({}))}`}
                            className="flex items-center gap-3 px-4 py-2 hover:bg-paper/60"
                          >
                            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-paper text-[17px]" aria-hidden>
                              {c?.emoji ?? "·"}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-[15px] font-medium">{e.name}</div>
                              <div className="flex flex-wrap gap-x-2.5 text-[13px] text-ink-3">
                                <span className={c ? "" : "italic"}>{c?.name ?? "Sem categoria"}</span>
                                <PaymentTag method={e.paymentMethodId != null ? methodById.get(e.paymentMethodId) : null} />
                                {e.kind !== "avulso" && (
                                  <span className="text-ink-2">
                                    {e.installmentTotal ? `Parcela ${e.installmentNo}/${e.installmentTotal}` : "Fixo"}
                                  </span>
                                )}
                              </div>
                            </div>
                            <Money cents={e.amountCents} className={`text-[15px] ${e.amountCents < 0 ? "text-brand" : ""}`} />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </Panel>
              ))}
            </div>
          )}
        </PendingSwap>
      </ParamShow>

      <ParamShow name="tab" value="entradas" current={tab} fallback="gastos">
        <PendingSwap keys={["m"]} fallback={<LancamentosListSkeleton tab="entradas" />}>
          <p className="mx-5 mt-4 mb-2 flex justify-between text-[14px] text-ink-2 lg:mx-1">
            <span>
              {summary.incomes.length} {summary.incomes.length === 1 ? "entrada" : "entradas"}
            </span>
            <Money cents={summary.totals.entradas} className="font-semibold text-brand" />
          </p>
          <Panel>
            {summary.incomes.length === 0 ? (
              <EmptyState>Nenhuma entrada em {monthPhrase(month)} ainda.</EmptyState>
            ) : (
              <ul className="py-1.5">
                {[...summary.incomes]
                  .sort((a, b) => b.amountCents - a.amountCents)
                  .map((i) => (
                    <li key={i.id}>
                      <Link href={`/entradas/${i.id}?m=${month}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-paper/60">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[15px] font-medium">{i.name}</div>
                          {i.date && <div className="text-[13px] text-ink-3">{formatShortDate(i.date)}</div>}
                        </div>
                        <Money cents={i.amountCents} signed className="text-[15px] font-semibold text-brand" />
                      </Link>
                    </li>
                  ))}
              </ul>
            )}
          </Panel>
        </PendingSwap>
        <div className="mx-4 mt-3 lg:mx-0">
          <Link
            href={`/novo?tipo=entrada&m=${month}`}
            className="block rounded-full border border-line bg-surface py-3 text-center text-[15px] font-semibold text-brand"
          >
            Registrar entrada
          </Link>
        </div>
      </ParamShow>
    </div>
  );
}
