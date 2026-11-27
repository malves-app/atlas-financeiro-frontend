"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { currentMonth, isMonth, monthDiff, monthLabel } from "@/lib/format";
import type { RouteKey } from "@/lib/routes";
import { Bone, SkeletonScreen, TextBone } from "./Skeleton";
import { FixosHeader, InvestimentosHeader, InvestimentoTopBar, LancamentosHeader, MetasHeader, PainelHeader, ShareGlyph } from "./PageHeaders";
import { usePendingNav } from "./NavState";
import { Panel } from "./ui";
import { SettingsTopBar } from "./SettingsVisuals";

/*
 * Skeleton de cada tela, no mesmo formato da tela pronta: mesmos cartões, espaçamentos e
 * alturas de linha, para o conteúdo entrar sem a página pular. Os cabeçalhos são os de
 * verdade (título, mês, abas), então só o que depende dos dados aparece como bloco.
 */

// Larguras variadas, para a lista parecer uma lista de verdade
const NAMES = ["w-28", "w-36", "w-24", "w-32", "w-40", "w-20"];
const SUBS = ["w-20", "w-28", "w-16", "w-24"];
const AMOUNTS = ["w-16", "w-20", "w-14", "w-[4.5rem]"];

/** Parâmetros do endereço de destino (navegação em andamento) ou, sem ele, do endereço atual. */
function useUrlParams(url?: URL): URLSearchParams {
  const sp = useSearchParams();
  return url ? url.searchParams : new URLSearchParams(sp.toString());
}

/** Para o skeleton de uma parte da tela: parâmetros do destino quando a troca é na mesma tela. */
function useTargetParams(): URLSearchParams {
  const nav = usePendingNav();
  const sp = useSearchParams();
  return nav.target && nav.samePath ? nav.target.searchParams : new URLSearchParams(sp.toString());
}

const monthOf = (p: URLSearchParams) => {
  const m = p.get("m");
  return isMonth(m) ? m : currentMonth();
};

function SectionTitleBone({ w = "w-28", right }: { w?: string; right?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-2">
      <TextBone w={w} />
      {right && <TextBone size={13} w={right} />}
    </div>
  );
}

function BackGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M15 6l-6 6 6 6" />
    </svg>
  );
}

function CloseGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

/** Cabeçalho das janelas de criar (igual ao SheetHeader de components/Modal.tsx). */
function SheetHeaderBone({ title }: { title: string }) {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-paper/90 px-5 pt-2 pb-2 backdrop-blur-md lg:pt-5">
      <h2 className="display text-[20px] font-bold">{title}</h2>
      <span className="grid size-10 place-items-center rounded-full bg-surface text-ink-2 ring-1 ring-line/80" aria-hidden>
        <CloseGlyph />
      </span>
    </header>
  );
}

/* ------------------------------- Painel ------------------------------- */

export function PainelSkeleton({ url }: { url?: URL }) {
  const month = monthOf(useUrlParams(url));
  return (
    <SkeletonScreen>
      <PainelHeader
        month={month}
        shareIcon={
          <span className="grid size-10 shrink-0 place-items-center rounded-full text-ink-2" aria-hidden>
            <ShareGlyph />
          </span>
        }
        sharePill={
          <span className="inline-flex items-center gap-2 rounded-full bg-surface px-4 py-2 text-[14px] font-semibold text-ink ring-1 ring-line" aria-hidden>
            <ShareGlyph />
            Compartilhar
          </span>
        }
      />
      <PainelBodySkeleton />
    </SkeletonScreen>
  );
}

export function PainelBodySkeleton() {
  return (
    <SkeletonScreen className="flex flex-col gap-3 lg:gap-4">
      {/* Saldo do mês */}
      <section className="mx-3 mt-1 overflow-hidden rounded-[24px] bg-ink p-5 lg:mx-0 lg:mt-0 lg:p-7">
        <TextBone dark w="w-24" />
        <span className="mt-1 flex items-center" style={{ height: "calc(0.95 * clamp(42px, 12.5vw, 64px))" }}>
          <Bone dark className="block h-[78%] w-[62%] max-w-80 rounded-2xl" />
        </span>
        {/* barras Entrou × Gastos */}
        <div className="mt-5 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2">
          <TextBone dark size={12} w="w-10" />
          <Bone dark className="block h-2 w-[78%] rounded-full" />
          <TextBone dark size={12} w="w-10" />
          <Bone dark className="block h-2 w-full rounded-full" />
        </div>
        <TextBone dark size={14} w="w-64" className="mt-2.5" />
        {/* extrato: entrou, já saiu da conta, na conta hoje, fatura, contas, saldo */}
        <div className="mt-5 overflow-hidden rounded-2xl bg-white/[0.07]">
          {[
            ["row", "w-14", "w-24"],
            ["row", "w-28", "w-24"],
            ["total", "w-28", "w-24"],
            ["row", "w-28", "w-24"],
            ["row", "w-24", "w-20"],
            ["total", "w-36", "w-24"],
          ].map(([kind, label, value], i) => (
            <div key={i} className="flex items-center gap-3 border-t border-white/10 px-4 py-3 first:border-t-0">
              {kind === "row" && <Bone dark className="block h-2.5 w-4 shrink-0 rounded-full" />}
              <span className="min-w-0 flex-1">
                <TextBone dark w={label} />
              </span>
              <TextBone dark size={kind === "row" ? 16 : 18} w={value} />
              <span className="size-4 shrink-0" />
            </div>
          ))}
        </div>
      </section>

      {/* A pagar */}
      <Panel>
        <SectionTitleBone w="w-16" right="w-28" />
        <ul className="pb-2">
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex items-center gap-3 px-4 py-2">
              <Bone className="block size-11 shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1">
                <TextBone w={NAMES[i]} />
                <TextBone size={13} w={SUBS[i]} />
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <TextBone w={AMOUNTS[i]} />
                <Bone className="block h-[26px] w-[74px] rounded-full" />
              </div>
            </li>
          ))}
        </ul>
      </Panel>

      {/* Para onde foi */}
      <Panel className="pb-2">
        <SectionTitleBone w="w-28" />
        <div className="px-4 pb-1">
          <Bone className="block h-3 w-full rounded-full" />
        </div>
        <ul>
          {[
            ["w-24", "w-32"],
            ["w-28", "w-36"],
            ["w-20", "w-24"],
          ].map(([name, hint]) => (
            <li key={name} className="flex items-center gap-3 px-4 py-2">
              <Bone className="block size-3 shrink-0 rounded-full" />
              <span className="min-w-0 flex-1">
                <TextBone w={name} />
                <TextBone size={13} w={hint} />
              </span>
              <TextBone size={13} w="w-7" />
              <span className="flex w-[6.5rem] justify-end">
                <TextBone w="w-20" />
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      {/* Por categoria */}
      <Panel className="pb-3">
        <SectionTitleBone w="w-28" />
        <ul>
          {[92, 70, 54, 38].map((pct, i) => (
            <li key={pct} className="flex items-center gap-3 px-4 py-2.5">
              <Bone className="block size-9 shrink-0 rounded-full" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-3">
                  <TextBone w={NAMES[i + 1]} />
                  <TextBone w={AMOUNTS[i]} />
                </span>
                <span className="mt-1.5 flex items-center gap-2.5">
                  <span className="flex-1">
                    <Bone className="block h-2 rounded-full" style={{ width: `${pct}%` }} />
                  </span>
                  <TextBone size={12} w="w-8" />
                </span>
              </span>
            </li>
          ))}
        </ul>
      </Panel>
    </SkeletonScreen>
  );
}

/* ----------------------------- Lançamentos ----------------------------- */

const FILTERS = [
  ["", "Dia a dia"],
  ["todos", "Todos"],
  ["fixos", "Fixos e parcelas"],
  ["sem-categoria", "Sem categoria"],
] as const;

export function LancamentosSkeleton({ url }: { url?: URL }) {
  const p = useUrlParams(url);
  const month = monthOf(p);
  const tab = p.get("tab") === "entradas" ? "entradas" : "gastos";
  const f = p.get("f") ?? "";
  const filtered = !!p.get("pm") || !!p.get("cat");
  return (
    <SkeletonScreen>
      <LancamentosHeader month={month} tab={tab} />
      <div className="mx-4 mt-2 grid grid-cols-2 gap-1 rounded-full bg-surface p-1 lg:mx-0 lg:max-w-sm" aria-hidden>
        <span className={`rounded-full py-2 text-center text-[15px] font-semibold ${tab === "gastos" ? "bg-ink text-white" : "text-ink-2"}`}>Gastos</span>
        <span className={`rounded-full py-2 text-center text-[15px] font-semibold ${tab === "entradas" ? "bg-brand text-white" : "text-ink-2"}`}>
          Entradas
        </span>
      </div>
      {tab === "gastos" ? (
        <>
          <div className="mx-4 mt-3 lg:mx-0" aria-hidden>
            <div className="w-full truncate rounded-2xl border border-line bg-surface px-4 py-2.5 text-[16px] text-ink/45">
              {p.get("q") || "Buscar por nome"}
            </div>
          </div>
          <div className="mt-3 flex gap-2 overflow-hidden px-4 pb-1 pointer-fine:flex-wrap lg:flex-wrap lg:px-0" aria-hidden>
            {FILTERS.map(([id, label]) => (
              <span
                key={id}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-[14px] font-medium ${
                  f === id && !filtered ? "bg-ink text-white" : "border border-line bg-surface text-ink-2"
                }`}
              >
                {label}
              </span>
            ))}
            <Bone className="block h-[34px] w-24 shrink-0 rounded-full" />
            <Bone className="block h-[34px] w-[5.5rem] shrink-0 rounded-full" />
          </div>
          <LancamentosListSkeleton tab="gastos" />
        </>
      ) : (
        <>
          <LancamentosListSkeleton tab="entradas" />
          <div className="mx-4 mt-3 lg:mx-0" aria-hidden>
            <span className="block rounded-full border border-line bg-surface py-3 text-center text-[15px] font-semibold text-brand">
              Registrar entrada
            </span>
          </div>
        </>
      )}
    </SkeletonScreen>
  );
}

/** Lista de gastos (agrupada por dia) ou de entradas. */
export function LancamentosListSkeleton({ tab }: { tab: "gastos" | "entradas" }) {
  const count = (
    <div className="mx-5 mt-4 mb-2 flex justify-between lg:mx-1">
      <TextBone size={14} w="w-28" />
      <TextBone size={14} w="w-20" />
    </div>
  );
  if (tab === "entradas") {
    return (
      <SkeletonScreen>
        {count}
        <Panel>
          <ul className="py-1.5">
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className="flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <TextBone w={NAMES[i]} />
                  <TextBone size={13} w="w-12" />
                </div>
                <TextBone w={AMOUNTS[i]} />
              </li>
            ))}
          </ul>
        </Panel>
      </SkeletonScreen>
    );
  }
  return (
    <SkeletonScreen>
      {count}
      <div className="space-y-3">
        {[3, 2, 3].map((n, g) => (
          <Panel key={g}>
            <div className="flex items-center justify-between px-4 pt-3 pb-1">
              <TextBone size={13} w="w-20" />
              <TextBone size={13} w="w-14" />
            </div>
            <ul className="pb-1.5">
              {Array.from({ length: n }, (_, i) => (
                <li key={i} className="flex items-center gap-3 px-4 py-2">
                  <Bone className="block size-9 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1">
                    <TextBone w={NAMES[(g * 3 + i) % NAMES.length]} />
                    <TextBone size={13} w={SUBS[(g + i) % SUBS.length]} />
                  </div>
                  <TextBone w={AMOUNTS[(g + i) % AMOUNTS.length]} />
                </li>
              ))}
            </ul>
          </Panel>
        ))}
      </div>
    </SkeletonScreen>
  );
}

/* -------------------------------- Fixos -------------------------------- */

const abaOf = (p: URLSearchParams) => {
  const a = p.get("aba");
  return a === "cartao" || a === "assinaturas" || a === "parcelas" ? "cartao" : "contas";
};

export function FixosSkeleton({ url }: { url?: URL }) {
  const p = useUrlParams(url);
  const aba = abaOf(p);
  return (
    <SkeletonScreen>
      <FixosHeader month={monthOf(p)} aba={aba} />
      <FixosBodySkeleton aba={aba} />
    </SkeletonScreen>
  );
}

function SummaryColumnBone({ extra = false }: { extra?: boolean }) {
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <TextBone w="w-16" />
        <TextBone size={13} w="w-20" />
      </div>
      <span className="mt-0.5 flex h-[37.5px] items-center">
        <Bone className="block h-7 w-40 rounded-xl" />
      </span>
      <Bone className="mt-3 block h-2.5 w-full rounded-full" />
      <div className="mt-2 flex justify-between">
        <TextBone size={13} w="w-24" />
        <TextBone size={13} w="w-24" />
      </div>
      {extra && (
        <div className="mt-3 space-y-1 border-t border-line pt-3">
          <div className="flex justify-between">
            <TextBone size={13} w="w-32" />
            <TextBone size={13} w="w-16" />
          </div>
          <div className="flex justify-between">
            <TextBone size={13} w="w-20" />
            <TextBone size={13} w="w-16" />
          </div>
        </div>
      )}
    </>
  );
}

/** Resumo, abas e listas dos fixos. Sem `aba`, usa a do destino (troca de mês na mesma tela). */
export function FixosBodySkeleton({ aba: abaProp }: { aba?: "contas" | "cartao" }) {
  const target = useTargetParams();
  const aba = abaProp ?? abaOf(target);
  return (
    <SkeletonScreen>
      <Panel className="mt-1 mb-3 p-5 lg:mt-0 lg:mb-5 lg:grid lg:grid-cols-[1.4fr_1fr] lg:gap-8 lg:p-6">
        <div>
          <SummaryColumnBone />
        </div>
        <div className="mt-5 border-t border-line pt-4 lg:mt-0 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
          <SummaryColumnBone extra />
        </div>
      </Panel>

      <div className="mx-3 mb-3 grid grid-cols-2 gap-1 rounded-full bg-surface p-1 ring-1 ring-line lg:mx-0 lg:mb-4" aria-hidden>
        {(
          [
            ["contas", "Contas"],
            ["cartao", "Cartão de crédito"],
          ] as const
        ).map(([id, label]) => (
          <span
            key={id}
            className={`rounded-full py-2 text-center text-[14px] font-semibold ${aba === id ? "bg-ink text-white" : "text-ink-2"}`}
          >
            {label}
          </span>
        ))}
      </div>

      <Panel className="mb-3 lg:mb-4">
        <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-1">
          <TextBone w={aba === "contas" ? "w-16" : "w-36"} />
          <TextBone size={13} w="w-28" />
        </div>
        <ul className="pb-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <li key={i} className="flex items-center gap-3 px-4 py-2.5">
              <Bone className="block size-11 shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <TextBone w={NAMES[i]} />
                  <TextBone w={AMOUNTS[i % AMOUNTS.length]} />
                </div>
                <TextBone size={13} w={SUBS[i % SUBS.length]} />
              </div>
              {aba === "contas" && <Bone className="block size-7 shrink-0 rounded-full" />}
            </li>
          ))}
        </ul>
      </Panel>

      <div className="mx-4 mt-1 mb-4 lg:hidden" aria-hidden>
        <span className="block rounded-full bg-ink py-3.5 text-center text-[15px] font-semibold text-white">Adicionar fixo ou parcelamento</span>
      </div>

      <Panel>
        <div className="px-4 py-3.5">
          <TextBone w="w-56" />
          <TextBone size={13} w="w-72 max-w-full" />
        </div>
      </Panel>
    </SkeletonScreen>
  );
}

/* ----------------------------- Estatísticas ----------------------------- */

function periodOf(p: URLSearchParams) {
  const now = currentMonth();
  const clamp = (m: string) => (m > now ? now : m);
  const de = p.get("de");
  const ate = p.get("ate");
  let from = isMonth(de) ? clamp(de) : `${now.slice(0, 4)}-01`;
  let to = isMonth(ate) ? clamp(ate) : now;
  if (from > to) [from, to] = [to, from];
  return { from, to };
}

export function EstatisticasSkeleton({ url }: { url?: URL }) {
  const { from, to } = periodOf(useUrlParams(url));
  return (
    <SkeletonScreen>
      <header className="px-4 pt-[max(env(safe-area-inset-top),10px)] pb-2 lg:px-0 lg:pt-2 lg:pb-3">
        <h1 className="display text-[22px] font-bold tracking-tight lg:text-[28px]">Estatísticas</h1>
      </header>
      <section className="mx-3 mb-3 lg:mx-0" aria-hidden>
        <div className="grid grid-cols-2 divide-x divide-line overflow-hidden rounded-2xl bg-surface ring-1 ring-line lg:max-w-md">
          {(
            [
              ["De", from],
              ["Até", to],
            ] as const
          ).map(([label, m]) => (
            <div key={label} className="relative min-w-0 px-4 py-2.5">
              <span className="block text-[12px] text-ink-3">{label}</span>
              <span className="block truncate pr-6 text-[15px] font-semibold">{monthLabel(m)}</span>
              <svg
                viewBox="0 0 24 24"
                className="pointer-events-none absolute right-3.5 bottom-3.5 size-4 text-ink-3"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </div>
          ))}
        </div>
      </section>
      <EstatisticasBodySkeleton months={monthDiff(from, to) + 1} />
    </SkeletonScreen>
  );
}

// Alturas das colunas (em %), fixas para o desenho não mudar a cada carregamento
const HEIGHTS = [62, 48, 71, 55, 82, 64, 57, 76, 50, 68, 79, 44];

function ChartBone({ count, height = 200, pairs = true }: { count: number; height?: number; pairs?: boolean }) {
  const n = Math.min(Math.max(count, 1), 24);
  return (
    <div aria-hidden>
      <div
        className="relative h-[var(--h)] xl:h-[calc(var(--h)*1.3)] 2xl:h-[calc(var(--h)*1.5)]"
        style={{ "--h": `${height}px` } as React.CSSProperties}
      >
        {[0, 33, 66, 100].map((y) => (
          <div key={y} className="absolute inset-x-0" style={{ bottom: `${y}%` }}>
            <div className={`ml-12 border-t ${y === 0 ? "border-ink-3/30" : "border-line/70"}`} />
            <Bone className="absolute left-2 block h-2 w-7 translate-y-1/2 rounded-full" style={{ bottom: 0 }} />
          </div>
        ))}
        <div className="absolute inset-y-0 right-0 left-12 flex">
          {Array.from({ length: n }, (_, i) => (
            <div key={i} className="relative h-full flex-1">
              <div className={`absolute inset-y-0 left-1/2 flex -translate-x-1/2 items-end gap-[2px] ${pairs ? "w-[78%] max-w-11" : "w-[56%] max-w-7"}`}>
                <Bone className="block flex-1 rounded-t-md" style={{ height: `${HEIGHTS[i % HEIGHTS.length]}%` }} />
                {pairs && <Bone className="block flex-1 rounded-t-md" style={{ height: `${HEIGHTS[(i + 5) % HEIGHTS.length] * 0.8}%` }} />}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-1.5 ml-12 flex h-4 items-center">
        {Array.from({ length: n }, (_, i) => (
          <span key={i} className="flex min-w-0 flex-1 justify-center">
            {(n <= 12 || i % 3 === 0) && <Bone className="block h-2 w-5 rounded-full" />}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Conteúdo das estatísticas (abaixo do filtro de período). */
export function EstatisticasBodySkeleton({ months: monthsProp }: { months?: number }) {
  const target = useTargetParams();
  const period = periodOf(target);
  const months = monthsProp ?? monthDiff(period.from, period.to) + 1;
  return (
    <SkeletonScreen className="flex flex-col gap-3 lg:gap-4">
      <section className="mx-3 overflow-hidden rounded-[24px] bg-ink p-5 lg:mx-0 lg:p-7">
        <TextBone dark w="w-28" />
        <span className="mt-1 flex items-center" style={{ height: "calc(0.95 * clamp(40px, 12vw, 60px))" }}>
          <Bone dark className="block h-[78%] w-[58%] max-w-72 rounded-2xl" />
        </span>
        <TextBone dark size={14} w="w-52" className="mt-2" />
        <div className="mt-5 grid grid-cols-2 gap-2.5">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-2xl bg-white/[0.08] p-3.5">
              <TextBone dark size={13} w="w-12" />
              <TextBone dark size={18} w="w-24" className="mt-0.5" />
            </div>
          ))}
        </div>
        <TextBone dark size={14} w="w-56" className="mt-4" />
      </section>

      <Panel className="grid grid-cols-2 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="border-line p-4 odd:border-r [&:nth-child(-n+2)]:border-b sm:[&:not(:last-child)]:border-r sm:[&:nth-child(-n+2)]:border-b-0"
          >
            <TextBone size={13} w="w-24" />
            <TextBone size={19} lineHeight={23.75} w="w-20" className="mt-1" />
            <TextBone size={12} w="w-16" className="mt-0.5" />
          </div>
        ))}
      </Panel>

      <Panel className="px-4 pt-4 pb-4">
        <TextBone w="w-48" className="mb-3" />
        <div className="mb-3 flex gap-4">
          <TextBone size={13} w="w-16" />
          <TextBone size={13} w="w-14" />
        </div>
        <ChartBone count={months} />
      </Panel>

      <Panel className="px-4 pt-4 pb-4">
        <TextBone w="w-36" />
        <TextBone size={13} w="w-64 max-w-full" className="mb-3" />
        <ChartBone count={months} height={180} pairs={false} />
      </Panel>

      <Panel className="pb-3">
        <SectionTitleBone w="w-24" />
        <ul>
          {[90, 66, 48, 30].map((pct, i) => (
            <li key={pct} className="flex items-center gap-3 px-4 py-2.5">
              <Bone className="block size-9 shrink-0 rounded-full" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-3">
                  <TextBone w={NAMES[i]} />
                  <TextBone w={AMOUNTS[i]} />
                </span>
                <span className="mt-1.5 block">
                  <Bone className="block h-2 rounded-full" style={{ width: `${pct}%` }} />
                </span>
                <TextBone size={12} w="w-44" className="mt-1" />
              </span>
            </li>
          ))}
        </ul>
      </Panel>
    </SkeletonScreen>
  );
}

/* -------------------------------- Metas -------------------------------- */

export function MetasSkeleton({ url }: { url?: URL }) {
  const month = monthOf(useUrlParams(url));
  return (
    <SkeletonScreen>
      <MetasHeader month={month} />
      <MetasBodySkeleton />
    </SkeletonScreen>
  );
}

function GoalCardBone({ i }: { i: number }) {
  return (
    <div className="rounded-[20px] bg-surface p-4 lg:p-5">
      <div className="flex items-start gap-3">
        <Bone className="block size-[46px] shrink-0 rounded-full" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <TextBone size={16} w={NAMES[i % NAMES.length]} />
              <TextBone size={13} w="w-24" />
            </div>
            <Bone className="block h-[24px] w-[84px] rounded-full" />
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <TextBone size={22} w="w-40" lineHeight={33} />
        <TextBone size={13} w="w-8" />
      </div>
      <Bone className="mt-2 block h-2.5 w-full rounded-full" />
      <TextBone size={14} w="w-4/5" className="mt-2.5" lineHeight={20} />
    </div>
  );
}

export function MetasBodySkeleton() {
  return (
    <SkeletonScreen className="flex flex-col gap-3 lg:gap-4">
      <section className="mx-3 overflow-hidden rounded-[24px] bg-ink p-5 lg:mx-0 lg:p-7">
        <div className="flex items-center justify-between">
          <TextBone dark w="w-36" />
          <Bone dark className="block h-[30px] w-28 rounded-full" />
        </div>
        <TextBone dark size={14} w="w-32" className="mt-3" />
        <span className="mt-0.5 flex items-center" style={{ height: "calc(0.95 * clamp(40px, 11.5vw, 60px))" }}>
          <Bone dark className="block h-[78%] w-[58%] max-w-72 rounded-2xl" />
        </span>
        <Bone dark className="mt-5 block h-3 w-full rounded-full" />
        <div className="mt-6 flex justify-between">
          <TextBone dark size={13} w="w-32" />
          <TextBone dark size={13} w="w-32" />
        </div>
        <Bone dark className="mt-3 block h-[30px] w-72 max-w-full rounded-full" />
      </section>
      <div className="mt-2">
        <div className="px-4 pb-2 lg:px-1">
          <TextBone w="w-16" />
        </div>
        <div className="grid gap-3 px-3 lg:grid-cols-2 lg:gap-4 lg:px-0">
          {[1, 2, 3, 4].map((i) => (
            <GoalCardBone key={i} i={i} />
          ))}
        </div>
      </div>
    </SkeletonScreen>
  );
}

/** Nova meta (/metas/nova) e editar meta (/metas/[id]). */
export function MetaFormSkeleton({ url, isNew = false, mode = "page" }: { url?: URL; isNew?: boolean; mode?: FormMode }) {
  const month = monthOf(useUrlParams(url));
  return (
    <SkeletonScreen className={mode === "modal" ? "" : "lg:mx-auto lg:max-w-xl"}>
      {mode === "modal" ? (
        <SheetHeaderBone title="Nova meta" />
      ) : (
        <header className="flex items-center gap-2 px-2 pt-[max(env(safe-area-inset-top),10px)] pb-1 lg:px-0 lg:pt-2 lg:pb-4">
          <Link href={`/metas?m=${month}`} aria-label="Voltar" className="grid size-10 place-items-center rounded-full text-ink-2 hover:bg-surface">
            <BackGlyph />
          </Link>
          <h1 className="display text-[20px] font-bold">{isNew ? "Nova meta" : "Editar meta"}</h1>
        </header>
      )}
      {isNew ? (
        <div className="space-y-6 px-5 pt-2">
          <div>
            <TextBone size={14} w="w-32" className="mb-2" />
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="rounded-2xl bg-surface p-3 ring-1 ring-line last:col-span-2 lg:last:col-span-1">
                  <Bone className="block size-9 rounded-full" />
                  <TextBone w={NAMES[i]} className="mt-2" />
                  <TextBone size={12.5} w="w-full" />
                </div>
              ))}
            </div>
          </div>
          <div>
            <TextBone size={14} w="w-16" className="mb-2" />
            <Bone className="block h-[46px] w-full rounded-full" />
          </div>
        </div>
      ) : (
        <div className="px-3 pb-4 lg:px-0">
          <GoalCardBone i={0} />
        </div>
      )}
      <div className={`${isNew ? "mt-6" : "mt-1"} mx-3 rounded-[24px] bg-surface/70 px-5 pt-6 pb-5 lg:mx-5`}>
        <TextBone size={13} w="w-48" className="mx-auto" />
        <Bone className="mx-auto mt-2 block h-12 w-48 rounded-2xl" />
      </div>
      <div className="mt-5 px-5">
        <Bone className="block h-[52px] w-full rounded-full" />
      </div>
    </SkeletonScreen>
  );
}

/* ---------------------------- Investimentos ---------------------------- */

function InvCardBone({ i }: { i: number }) {
  return (
    <div className="rounded-[20px] bg-surface p-4 lg:p-5">
      <div className="flex items-center gap-3">
        <Bone className="block size-11 shrink-0 rounded-[14px]" />
        <div className="min-w-0 flex-1">
          <TextBone size={16} w={NAMES[i % NAMES.length]} />
          <TextBone size={13} w={SUBS[i % SUBS.length]} />
        </div>
        <div className="flex flex-col items-end">
          <TextBone size={19} w="w-24" lineHeight={24} />
          <TextBone size={12.5} w="w-20" />
        </div>
      </div>
      <div className="mt-3 border-t border-line/70 pt-2.5">
        <TextBone size={12.5} w="w-36" />
      </div>
    </div>
  );
}

function InvHeroBone({ wide = false }: { wide?: boolean }) {
  return (
    <section
      className={`mx-3 rounded-[24px] bg-ink p-5 lg:mx-0 lg:p-7 ${wide ? "lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] lg:items-end lg:gap-10" : ""}`}
    >
      <div>
        <TextBone dark w="w-32" />
        <span className="mt-2 flex items-center" style={{ height: "calc(0.95 * clamp(40px, 11.5vw, 60px))" }}>
          <Bone dark className="block h-[78%] w-[62%] max-w-72 rounded-2xl" />
        </span>
        <TextBone dark size={14} w="w-44" className="mt-3" />
        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/10 pt-4">
          <div>
            <TextBone dark size={12.5} w="w-16" />
            <TextBone dark size={16} w="w-24" />
          </div>
          <div>
            <TextBone dark size={12.5} w="w-24" />
            <TextBone dark size={16} w="w-20" />
          </div>
        </div>
      </div>
      <Bone dark className={`mt-6 block w-full rounded-2xl ${wide ? "h-[170px] lg:mt-0" : "h-[150px]"}`} />
    </section>
  );
}

export function InvestimentosSkeleton() {
  return (
    <SkeletonScreen>
      <InvestimentosHeader />
      <div className="flex flex-col gap-3 lg:gap-4">
        <InvHeroBone wide />
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-4">
          <div>
            <div className="px-4 pt-2 pb-2 lg:px-1 lg:pt-1">
              <TextBone w="w-36" />
            </div>
            <div className="grid gap-3 px-3 lg:px-0 2xl:grid-cols-2">
              {[0, 1, 2].map((i) => (
                <InvCardBone key={i} i={i} />
              ))}
            </div>
          </div>
          <div className="mx-3 rounded-[24px] bg-surface p-4 lg:mx-0 lg:p-5">
            <TextBone w="w-40" />
            <Bone className="mt-3 block h-3 w-full rounded-full" />
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center justify-between py-2.5">
                <TextBone size={14.5} w={NAMES[i]} />
                <TextBone size={14.5} w="w-20" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </SkeletonScreen>
  );
}

/** Detalhe de um investimento (/investimentos/[id]). */
export function InvestimentoSkeleton() {
  return (
    <SkeletonScreen>
      <InvestimentoTopBar title={<TextBone size={20} w="w-44" lineHeight={30} />} back="/investimentos" />
      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-4">
        <div className="lg:col-start-1 lg:row-start-1">
          <InvHeroBone />
        </div>
        <div className="mx-3 rounded-[24px] bg-surface p-4 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mx-0 lg:p-5">
          <TextBone w="w-48" />
          <Bone className="mt-3 block h-[42px] w-full rounded-full" />
          <TextBone size={13} w="w-56" className="mt-2" />
          <Bone className="mx-auto mt-5 block h-12 w-48 rounded-2xl" />
          <Bone className="mt-8 block h-[40px] w-64 max-w-full rounded-full" />
          <Bone className="mt-4 block h-[48px] w-full rounded-2xl" />
          <Bone className="mt-4 block h-[52px] w-full rounded-full" />
        </div>
        <div className="mx-3 rounded-[24px] bg-surface pb-2 lg:col-start-1 lg:row-start-2 lg:mx-0">
          <div className="px-4 pt-4 lg:px-5">
            <TextBone w="w-24" />
          </div>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 lg:px-5">
              <Bone className="block size-10 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1">
                <TextBone w={NAMES[i]} />
                <TextBone size={13} w={SUBS[i]} />
              </div>
              <TextBone w={AMOUNTS[i]} />
            </div>
          ))}
        </div>
      </div>
    </SkeletonScreen>
  );
}

/** Novo investimento e editar investimento. */
export function InvestimentoFormSkeleton({ isNew = false, mode = "page" }: { isNew?: boolean; mode?: FormMode }) {
  return (
    <SkeletonScreen className={mode === "modal" ? "" : "lg:mx-auto lg:max-w-xl"}>
      {mode === "modal" ? (
        <SheetHeaderBone title="Novo investimento" />
      ) : (
        <InvestimentoTopBar title={isNew ? "Novo investimento" : "Editar investimento"} back="/investimentos" />
      )}
      <div className="space-y-6 px-5 pt-2">
        <div>
          <TextBone size={14} w="w-10" className="mb-2" />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="flex items-center gap-2.5 rounded-2xl bg-surface px-3 py-2.5 ring-1 ring-line">
                <Bone className="block size-9 shrink-0 rounded-xl" />
                <TextBone size={14} w={SUBS[i % SUBS.length]} />
              </div>
            ))}
          </div>
        </div>
        {[0, 1].map((i) => (
          <div key={i}>
            <TextBone size={14} w="w-20" className="mb-2" />
            <Bone className="block h-[48px] w-full rounded-2xl" />
          </div>
        ))}
      </div>
      {isNew && (
        <div className="mx-3 mt-6 rounded-[24px] bg-surface/70 px-5 pt-6 pb-5 lg:mx-5">
          <TextBone size={13} w="w-40" className="mx-auto" />
          <Bone className="mx-auto mt-2 block h-12 w-48 rounded-2xl" />
        </div>
      )}
      <div className="mt-5 space-y-4 px-5">
        <Bone className="block h-[70px] w-full rounded-2xl" />
        <Bone className="block h-[52px] w-full rounded-full" />
      </div>
    </SkeletonScreen>
  );
}

/* ---------------------------- Configurações ---------------------------- */

function SettingsCardBone({ className = "", round = false, count = 5 }: { className?: string; round?: boolean; count?: number }) {
  return (
    <div className={`mx-3 rounded-[22px] bg-surface p-4 lg:mx-0 lg:p-5 ${className}`}>
      <div className="flex items-center gap-3">
        <Bone className="block size-11 shrink-0 rounded-2xl" />
        <span className="flex-1">
          <TextBone size={16} w="w-40" />
          <TextBone size={13.5} w="w-48 max-w-full" />
        </span>
      </div>
      <div className="mt-4 flex min-h-10 -space-x-2">
        {Array.from({ length: count }, (_, i) => (
          <Bone key={i} className={`block size-10 ring-[3px] ring-surface ${round ? "rounded-full" : "rounded-xl"}`} />
        ))}
      </div>
    </div>
  );
}

export function ConfiguracoesSkeleton() {
  return (
    <SkeletonScreen>
      <header className="px-4 pt-[max(env(safe-area-inset-top),10px)] pb-3 lg:px-0 lg:pt-2 lg:pb-5">
        <h1 className="display text-[22px] font-bold tracking-tight lg:text-[28px]">Configurações</h1>
      </header>
      <div className="grid gap-3 lg:grid-cols-2 lg:gap-4">
        <SettingsCardBone />
        <SettingsCardBone round count={6} />
        <SettingsCardBone className="lg:col-span-2" round count={1} />
      </div>
    </SkeletonScreen>
  );
}

/** Lista de formas de pagamento ou de categorias. */
export function ConfigListSkeleton({ kind }: { kind: "pagamentos" | "categorias" }) {
  const pay = kind === "pagamentos";
  const rows = (n: number) => (
    <ul className="divide-y divide-line/60 py-1">
      {Array.from({ length: n }, (_, i) => (
        <li key={i} className="flex items-center gap-3.5 px-4 py-3">
          <Bone className={`block size-10 shrink-0 ${pay ? "rounded-xl" : "size-11 rounded-full"}`} />
          <span className="flex-1">
            <TextBone size={15.5} w={NAMES[i % NAMES.length]} />
            {pay ? <TextBone size={13} w={SUBS[i % SUBS.length]} /> : <ChipsBone widths={["w-20", "w-24", "w-16"]} height="h-[20px]" />}
          </span>
        </li>
      ))}
    </ul>
  );
  return (
    <SkeletonScreen className="lg:mx-auto lg:max-w-2xl">
      <SettingsTopBar title={pay ? "Formas de pagamento" : "Categorias"} back="/configuracoes" />
      <div className="mx-5 -mt-1 mb-4 lg:mx-1">
        <TextBone size={14} w="w-full" />
        <TextBone size={14} w="w-2/3" />
      </div>
      {pay ? (
        <div className="space-y-4">
          <div>
            <TextBone size={13} w="w-36" className="mx-5 mb-2 lg:mx-1" />
            <Panel>{rows(2)}</Panel>
          </div>
          <div>
            <TextBone size={13} w="w-32" className="mx-5 mb-2 lg:mx-1" />
            <Panel>{rows(1)}</Panel>
          </div>
        </div>
      ) : (
        <Panel>{rows(7)}</Panel>
      )}
    </SkeletonScreen>
  );
}

/** Formulário de forma de pagamento ou de categoria (nova ou detalhes). */
export function ConfigFormSkeleton({ kind, isNew }: { kind: "pagamento" | "categoria"; isNew?: boolean }) {
  const pay = kind === "pagamento";
  return (
    <SkeletonScreen className="lg:mx-auto lg:max-w-2xl">
      <SettingsTopBar
        title={isNew ? (pay ? "Nova forma de pagamento" : "Nova categoria") : pay ? "Forma de pagamento" : "Categoria"}
        back={pay ? "/configuracoes/pagamentos" : "/configuracoes/categorias"}
      />
      <div className="space-y-6 px-3 lg:px-0">
        <div className="flex items-center gap-4 rounded-[22px] bg-surface p-4 lg:p-5">
          <Bone className={`block size-16 shrink-0 ${pay ? "rounded-[20px]" : "rounded-full"}`} />
          <span className="flex-1">
            <TextBone size={18} w="w-44" />
            <TextBone size={13.5} w="w-56 max-w-full" />
          </span>
        </div>
        {(pay || isNew) && (
          <>
            <InputBone label="w-16" />
            <div>
              <TextBone size={13} w="w-12" className="mb-2" />
              <div className={`grid gap-2 ${pay ? "grid-cols-3 sm:grid-cols-5" : "grid-cols-7 sm:grid-cols-10"}`}>
                {Array.from({ length: pay ? 10 : 20 }, (_, i) => (
                  <Bone key={i} className={`block rounded-2xl ${pay ? "h-[74px]" : "aspect-square"}`} />
                ))}
              </div>
            </div>
          </>
        )}
        {!pay && !isNew && (
          <div className="rounded-[20px] bg-surface pb-3">
            <SectionTitleBone w="w-28" />
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 py-2.5 pr-2 pl-4">
                <Bone className="block size-1.5 rounded-full" />
                <TextBone w={NAMES[i]} />
              </div>
            ))}
          </div>
        )}
      </div>
    </SkeletonScreen>
  );
}

export function ConfigContaSkeleton() {
  return (
    <SkeletonScreen className="lg:mx-auto lg:max-w-2xl">
      <SettingsTopBar title="Conta" back="/configuracoes" />
      <div className="mx-3 flex flex-col items-center rounded-[22px] bg-surface px-5 pt-7 pb-6 lg:mx-0">
        <Bone className="block size-20 rounded-full" />
        <TextBone size={12.5} w="w-14" className="mt-4" />
        <TextBone size={17} w="w-56" />
        <TextBone size={13.5} w="w-64 max-w-full" className="mt-1" />
      </div>
    </SkeletonScreen>
  );
}

/* ----------------------------- Formulários ----------------------------- */

function InputBone({ label }: { label: string }) {
  return (
    <div>
      <TextBone size={14} w={label} className="mb-2" />
      <span className="block h-[50px] rounded-2xl border border-line bg-surface" />
    </div>
  );
}

function ChipsBone({ widths, height = "h-[38px]" }: { widths: string[]; height?: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {widths.map((w, i) => (
        <Bone key={i} className={`block rounded-full ${height} ${w}`} />
      ))}
    </div>
  );
}

/** Novo fixo (/fixos/novo) e editar fixo (/fixos/[id]). */
export function FixoFormSkeleton({ url, isNew = false }: { url?: URL; isNew?: boolean }) {
  const month = monthOf(useUrlParams(url));
  return (
    <SkeletonScreen className="lg:mx-auto lg:max-w-xl">
      <header className="flex items-center gap-2 px-2 pt-[max(env(safe-area-inset-top),10px)] pb-1 lg:px-0 lg:pt-2 lg:pb-4">
        <Link href={`/fixos?m=${month}`} aria-label="Voltar" className="grid size-10 place-items-center rounded-full text-ink-2 hover:bg-surface">
          <BackGlyph />
        </Link>
        {isNew ? <h1 className="display text-[20px] font-bold">Novo fixo</h1> : <TextBone size={20} w="w-32" />}
      </header>
      <div className="space-y-5 px-5 pt-2">
        {isNew && (
          <div>
            <TextBone size={14} w="w-20" className="mb-2" />
            <Bone className="block h-[46px] w-full rounded-full" />
            <TextBone size={13} w="w-full" className="mt-1.5" />
            <TextBone size={13} w="w-1/2" />
          </div>
        )}
        <InputBone label="w-12" />
        <div className="grid grid-cols-[1fr_7rem] gap-3">
          <InputBone label="w-24" />
          <InputBone label="w-8" />
        </div>
        <div>
          <TextBone size={14} w="w-20" className="mb-2" />
          <Bone className="block h-[46px] w-full rounded-full" />
        </div>
        <div>
          <TextBone size={14} w="w-36" className="mb-2" />
          <ChipsBone widths={["w-[150px]", "w-[96px]", "w-[72px]"]} />
        </div>
        <div>
          <TextBone size={14} w="w-20" className="mb-2" />
          <ChipsBone widths={["w-28", "w-32", "w-28", "w-24", "w-[5.5rem]", "w-28", "w-24", "w-20"]} height="h-[37px]" />
        </div>
        <Bone className="block h-[52px] w-full rounded-full" />
      </div>
    </SkeletonScreen>
  );
}

type FormMode = "page" | "modal";

/** Valor grande no centro (lançar e editar). Num lançamento novo, já mostra o "0,00". */
function AmountBone({ isNew, estorno }: { isNew: boolean; estorno: boolean }) {
  const big = { fontStretch: "85%", fontSize: "clamp(46px, 13vw, 60px)" } as const;
  return (
    <div className="px-5 pt-2 pb-5 text-center" aria-hidden>
      <TextBone size={13} w="w-32" className="justify-center" />
      <div className="mt-0.5 flex items-baseline justify-center gap-1.5">
        <span className="display text-[26px] font-semibold text-ink-3/50">R$</span>
        {isNew ? (
          <span className="display num leading-tight font-bold text-ink-3/35" style={big}>
            0,00
          </span>
        ) : (
          <span className="flex items-center self-center" style={{ height: "calc(1.25 * clamp(46px, 13vw, 60px))" }}>
            <Bone className="block h-[62%] w-36 rounded-2xl" />
          </span>
        )}
      </div>
      <div className="mx-auto mt-1 h-[3px] w-10 rounded-full bg-line" />
      {estorno && (
        <div className="mt-3 flex justify-center">
          <Bone className="block h-[27px] w-28 rounded-full" />
        </div>
      )}
    </div>
  );
}

function NameBone() {
  return (
    <div className="flex h-[52px] items-center gap-3 rounded-[20px] bg-surface px-4 ring-1 ring-line/80" aria-hidden>
      <Bone className="block size-5 shrink-0 rounded-md" />
      <TextBone size={16} w="w-48" />
    </div>
  );
}

function CategoryGridBone() {
  return (
    <div aria-hidden>
      <TextBone size={13} w="w-16" className="mb-2 px-1" />
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {Array.from({ length: 12 }, (_, i) => (
          <span
            key={i}
            className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl bg-surface px-0.5 py-2.5 ring-1 ring-line ${i >= 8 ? "max-sm:hidden" : ""}`}
          >
            <Bone className="block size-[22px] rounded-full" />
            <TextBone size={11.5} w={["w-12", "w-10", "w-14", "w-9"][i % 4]} />
          </span>
        ))}
      </div>
    </div>
  );
}

/** Bloco branco com Pagamento / Data / Mês (gasto) ou Data / Mês (entrada). */
function GroupBone({ payment }: { payment: boolean }) {
  return (
    <div className="divide-y divide-line/80 rounded-[20px] bg-surface ring-1 ring-line/80" aria-hidden>
      {payment && (
        <div className="px-4 py-3.5">
          <TextBone size={13} w="w-20" className="mb-2.5" />
          <ChipsBone widths={["w-[136px]", "w-[92px]", "w-[72px]"]} />
        </div>
      )}
      <div className="px-4 py-3.5">
        <TextBone size={13} w="w-10" className="mb-2.5" />
        <ChipsBone widths={["w-[66px]", "w-[70px]", "w-[124px]"]} />
      </div>
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <TextBone size={14} w="w-24" />
        <Bone className="block h-[34px] w-36 rounded-full" />
      </div>
    </div>
  );
}

function SubmitBarBone({ mode, again }: { mode: FormMode; again: boolean }) {
  return (
    <div
      aria-hidden
      className={
        mode === "modal"
          ? "sticky bottom-0 z-10 mt-6 flex gap-2 border-t border-line/70 bg-paper/90 px-5 pt-3 pb-[max(env(safe-area-inset-bottom),14px)] backdrop-blur-md"
          : "sticky bottom-[calc(76px+env(safe-area-inset-bottom))] z-10 mt-6 flex gap-2 bg-paper/90 px-5 pt-3 pb-3 shadow-[0_-8px_16px_-12px_rgba(23,32,51,0.25)] backdrop-blur-md lg:bottom-0"
      }
    >
      <Bone className="block h-[52px] flex-1 rounded-full" />
      {again && <Bone className="block h-[52px] w-[92px] rounded-full sm:w-[196px]" />}
    </div>
  );
}

function ExpenseFormBone({ mode, isNew }: { mode: FormMode; isNew: boolean }) {
  return (
    <>
      <AmountBone isNew={isNew} estorno />
      <div className="space-y-5 px-5">
        <NameBone />
        <CategoryGridBone />
        <GroupBone payment />
      </div>
      <SubmitBarBone mode={mode} again={isNew} />
    </>
  );
}

function IncomeFormBone({ mode, isNew }: { mode: FormMode; isNew: boolean }) {
  return (
    <>
      <AmountBone isNew={isNew} estorno={false} />
      <div className="space-y-5 px-5">
        <NameBone />
        <GroupBone payment={false} />
      </div>
      <SubmitBarBone mode={mode} again={isNew} />
    </>
  );
}

/** Lançar (janela ou página /novo). Abre na aba certa (?tipo=entrada). */
export function QuickAddSkeleton({ mode, url }: { mode: FormMode; url?: URL }) {
  const tab = useUrlParams(url).get("tipo") === "entrada" ? "entrada" : "gasto";
  const seg = (on: boolean, tone: string) =>
    `relative rounded-full px-4 py-2 text-center text-[15px] font-semibold ${
      on ? `${tone} text-white shadow-[0_2px_8px_-2px_rgba(23,32,51,0.35)]` : "text-ink-2"
    }`;
  const body = (
    <SkeletonScreen>
      <header
        className={`flex items-center justify-between gap-3 px-4 pb-2 ${
          mode === "modal" ? "sticky top-0 z-10 bg-paper/90 pt-2 backdrop-blur-md lg:px-5 lg:pt-5" : "pt-[max(env(safe-area-inset-top),10px)] lg:px-0 lg:pt-2 lg:pb-4"
        }`}
      >
        <div className="w-[210px]" aria-hidden>
          <div className="grid grid-cols-2 rounded-full bg-surface p-1 ring-1 ring-line/80">
            <span className={seg(tab === "gasto", "bg-ink")}>Gasto</span>
            <span className={seg(tab === "entrada", "bg-brand")}>Entrada</span>
          </div>
        </div>
        <span className="grid size-10 place-items-center rounded-full bg-surface text-ink-2 ring-1 ring-line/80" aria-hidden>
          <CloseGlyph />
        </span>
      </header>
      {tab === "gasto" ? <ExpenseFormBone mode={mode} isNew /> : <IncomeFormBone mode={mode} isNew />}
    </SkeletonScreen>
  );
  return mode === "page" ? <div className="lg:mx-auto lg:max-w-xl">{body}</div> : body;
}

function EditorHeaderBone({ mode }: { mode: FormMode }) {
  if (mode === "modal") {
    return (
      <header className="sticky top-0 z-10 flex items-center justify-between bg-paper/90 px-5 pt-2 pb-2 backdrop-blur-md lg:pt-5">
        <TextBone size={20} w="w-36" />
        <span className="grid size-10 place-items-center rounded-full bg-surface text-ink-2 ring-1 ring-line/80" aria-hidden>
          <CloseGlyph />
        </span>
      </header>
    );
  }
  return (
    <header className="flex items-center gap-2 px-2 pt-[max(env(safe-area-inset-top),10px)] pb-1 lg:px-0 lg:pt-2 lg:pb-4">
      <span className="grid size-10 place-items-center rounded-full text-ink-2" aria-hidden>
        <BackGlyph />
      </span>
      <TextBone size={20} w="w-36" />
    </header>
  );
}

/** Editar um gasto (janela ou página /lancamentos/[id]). */
export function EntryEditorSkeleton({ mode }: { mode: FormMode }) {
  const body = (
    <SkeletonScreen>
      <EditorHeaderBone mode={mode} />
      <ExpenseFormBone mode={mode} isNew={false} />
      <div className="mx-5 mt-3 flex justify-center pb-6" aria-hidden>
        <TextBone w="w-44" className="py-3" lineHeight={46} />
      </div>
    </SkeletonScreen>
  );
  return mode === "page" ? <div className="lg:mx-auto lg:max-w-xl">{body}</div> : body;
}

/** Editar uma entrada (janela ou página /entradas/[id]). */
export function IncomeEditorSkeleton({ mode }: { mode: FormMode }) {
  const body = (
    <SkeletonScreen>
      <EditorHeaderBone mode={mode} />
      <IncomeFormBone mode={mode} isNew={false} />
      <div className="mx-5 mt-3 flex justify-center pb-6" aria-hidden>
        <TextBone w="w-40" lineHeight={46} />
      </div>
    </SkeletonScreen>
  );
  return mode === "page" ? <div className="lg:mx-auto lg:max-w-xl">{body}</div> : body;
}

/* ------------------------------------------------------------------------ */

/** Conferir com o banco: cabeçalho, abas, envio (banco, forma, arquivo) e o resultado. */
export function ConferirSkeleton({ url }: { url?: URL }) {
  const extrato = useUrlParams(url).get("aba") === "extrato";
  return (
    <SkeletonScreen className="lg:mx-auto lg:max-w-3xl">
      <div className="px-4 pt-[max(env(safe-area-inset-top),10px)] pb-3 lg:px-0 lg:pt-2 lg:pb-5">
        <h1 className="display text-[22px] font-bold tracking-tight lg:text-[28px]">Conferir com o banco</h1>
        <TextBone size={13} w="w-72" />
      </div>
      <div className="mx-4 mb-3 grid grid-cols-2 gap-1 rounded-full bg-surface p-1 lg:mx-0 lg:max-w-sm">
        <span className={`rounded-full py-2 text-center text-[15px] font-semibold ${extrato ? "text-ink-2" : "bg-ink text-white"}`}>Fatura do cartão</span>
        <span className={`rounded-full py-2 text-center text-[15px] font-semibold ${extrato ? "bg-ink text-white" : "text-ink-2"}`}>Conta corrente</span>
      </div>
      <div className="mx-3 mb-3 rounded-[20px] bg-surface p-4 lg:mx-0">
        <Bone className="block h-8 w-60 rounded-full" />
        <Bone className="mt-3 block h-10 w-52 rounded-full" />
        <TextBone size={13} w="w-64" className="mt-2" />
      </div>
      <div className="mx-3 rounded-[20px] bg-surface p-4 lg:mx-0">
        <TextBone size={19} w="w-44" />
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <Bone key={i} className="h-14 rounded-2xl" />
          ))}
        </div>
      </div>
    </SkeletonScreen>
  );
}

/** Skeleton de uma tela inteira, pelo endereço (página) ou pelo destino de uma navegação. */
export function RouteSkeleton({ route, url }: { route: RouteKey; url?: URL }) {
  switch (route) {
    case "painel":
      return <PainelSkeleton url={url} />;
    case "lancamentos":
      return <LancamentosSkeleton url={url} />;
    case "fixos":
      return <FixosSkeleton url={url} />;
    case "fixo-novo":
      return <FixoFormSkeleton url={url} isNew />;
    case "fixo":
      return <FixoFormSkeleton url={url} />;
    case "estatisticas":
      return <EstatisticasSkeleton url={url} />;
    case "metas":
      return <MetasSkeleton url={url} />;
    case "meta-nova":
      return <MetaFormSkeleton url={url} isNew />;
    case "meta":
      return <MetaFormSkeleton url={url} />;
    case "investimentos":
      return <InvestimentosSkeleton />;
    case "investimento-novo":
      return <InvestimentoFormSkeleton isNew />;
    case "investimento":
      return <InvestimentoSkeleton />;
    case "investimento-editar":
      return <InvestimentoFormSkeleton />;
    case "configuracoes":
      return <ConfiguracoesSkeleton />;
    case "config-pagamentos":
      return <ConfigListSkeleton kind="pagamentos" />;
    case "config-pagamento-nova":
      return <ConfigFormSkeleton kind="pagamento" isNew />;
    case "config-pagamento":
      return <ConfigFormSkeleton kind="pagamento" />;
    case "config-categorias":
      return <ConfigListSkeleton kind="categorias" />;
    case "config-categoria-nova":
      return <ConfigFormSkeleton kind="categoria" isNew />;
    case "config-categoria":
      return <ConfigFormSkeleton kind="categoria" />;
    case "config-conta":
      return <ConfigContaSkeleton />;
    case "conferir":
      return <ConferirSkeleton url={url} />;
    case "novo":
      return <QuickAddSkeleton mode="page" url={url} />;
    case "lancamento":
      return <EntryEditorSkeleton mode="page" />;
    case "entrada":
      return <IncomeEditorSkeleton mode="page" />;
  }
}

/** Conteúdo da janela enquanto ela carrega (lançar, editar gasto, editar entrada). */
export function ModalSkeleton({ route, url }: { route: RouteKey; url?: URL }) {
  if (route === "lancamento") return <EntryEditorSkeleton mode="modal" />;
  if (route === "entrada") return <IncomeEditorSkeleton mode="modal" />;
  if (route === "meta-nova") return <MetaFormSkeleton url={url} isNew mode="modal" />;
  if (route === "investimento-novo") return <InvestimentoFormSkeleton isNew mode="modal" />;
  return <QuickAddSkeleton mode="modal" url={url} />;
}
