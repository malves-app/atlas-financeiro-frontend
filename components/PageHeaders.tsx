import Link from "next/link";
import { Logo } from "./Logo";
import { BackToCurrentMonth, MonthSwitcher } from "./MonthNav";

/*
 * Cabeçalhos das telas com mês. Os mesmos componentes aparecem na página e no skeleton dela,
 * então o topo da tela não "pula" quando os dados chegam.
 */

const GEAR = [
  "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  "M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
];

/** Painel: no celular, marca + compartilhar + ajustes; no computador, título + compartilhar + mês. */
export function PainelHeader({
  month,
  shareIcon,
  sharePill,
}: {
  month: string;
  /** Botão de compartilhar (ícone, celular) */
  shareIcon: React.ReactNode;
  /** Botão de compartilhar (com texto, computador) */
  sharePill: React.ReactNode;
}) {
  return (
    <>
      <header className="px-4 pt-[max(env(safe-area-inset-top),10px)] pb-1 lg:flex lg:items-center lg:justify-between lg:px-0 lg:pt-2 lg:pb-3">
        <div className="flex items-center justify-between lg:hidden">
          <Logo className="text-[19px]" />
          <div className="-mr-1.5 flex items-center">
            {shareIcon}
            <Link
              href={`/metas?m=${month}`}
              aria-label="Metas"
              className="grid size-10 shrink-0 place-items-center rounded-full text-ink-2 hover:bg-white/70 lg:hidden"
            >
              <TargetGlyph className="size-[22px]" />
            </Link>
            <Link
              href="/investimentos"
              aria-label="Investimentos"
              className="grid size-10 shrink-0 place-items-center rounded-full text-ink-2 hover:bg-white/70 lg:hidden"
            >
              <InvestGlyph className="size-[22px]" />
            </Link>
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
                {GEAR.map((d) => (
                  <path key={d} d={d} />
                ))}
              </svg>
            </Link>
          </div>
        </div>
        <h1 className="display hidden text-[28px] font-bold tracking-tight lg:block">Painel</h1>
        <div className="-mx-2 mt-1 flex justify-center lg:mx-0 lg:mt-0 lg:items-center lg:gap-3">
          <span className="hidden lg:inline-flex">{sharePill}</span>
          <MonthSwitcher month={month} basePath="/" />
        </div>
      </header>
      <BackToCurrentMonth month={month} basePath="/" />
    </>
  );
}

export function LancamentosHeader({ month, tab }: { month: string; tab: "gastos" | "entradas" }) {
  const params = { tab: tab === "entradas" ? "entradas" : undefined };
  return (
    <>
      <header className="flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),10px)] lg:px-0 lg:pt-2">
        <h1 className="display text-[22px] font-bold tracking-tight lg:text-[28px]">Lançamentos</h1>
        <MonthSwitcher month={month} basePath="/lancamentos" params={params} />
      </header>
      <BackToCurrentMonth month={month} basePath="/lancamentos" params={params} />
    </>
  );
}

export function FixosHeader({ month, aba }: { month: string; aba: "contas" | "cartao" }) {
  const params = { aba: aba !== "contas" ? aba : undefined };
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
          <MonthSwitcher month={month} basePath="/fixos" params={params} />
        </div>
      </header>
      <BackToCurrentMonth month={month} basePath="/fixos" params={params} />
    </>
  );
}

/** Ícone de compartilhar (o mesmo do botão de compartilhar resumo). */
export function ShareGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-[20px]" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3v12M7.5 7.5L12 3l4.5 4.5" />
      <path d="M5 12v6.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V12" />
    </svg>
  );
}

/** Alvo (Metas): o mesmo ícone do menu. */
export const TARGET_ICON = "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM12 12.01V12M12 12l7-7M16.5 5H19v2.5";

export function TargetGlyph({ className = "size-5", width = 1.8 }: { className?: string; width?: number }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={TARGET_ICON} />
    </svg>
  );
}

export function MetasHeader({ month }: { month: string }) {
  return (
    <>
      <header className="flex items-center justify-between gap-2 px-4 pt-[max(env(safe-area-inset-top),10px)] pb-1 lg:px-0 lg:pt-2 lg:pb-3">
        <h1 className="display text-[22px] font-bold tracking-tight lg:text-[28px]">Metas</h1>
        <div className="flex items-center gap-1 lg:gap-3">
          <Link
            href={`/metas/nova?m=${month}`}
            className="hidden items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-[14px] font-semibold text-white lg:inline-flex"
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
              <path d="M12 5v14M5 12h14" />
            </svg>
            Nova meta
          </Link>
          <MonthSwitcher month={month} basePath="/metas" />
          <Link
            href={`/metas/nova?m=${month}`}
            aria-label="Nova meta"
            className="grid size-10 shrink-0 place-items-center rounded-full bg-ink text-white lg:hidden"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
              <path d="M12 5v14M5 12h14" />
            </svg>
          </Link>
        </div>
      </header>
      <BackToCurrentMonth month={month} basePath="/metas" />
    </>
  );
}

/** Investimentos (linha subindo): o mesmo ícone do menu. */
export const INVEST_ICON = "M3 17l6-6 4 4 7.5-7.5M14 7.5h6.5V14";

export function InvestGlyph({ className = "size-5", width = 1.8 }: { className?: string; width?: number }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={INVEST_ICON} />
    </svg>
  );
}

/** Investimentos: não dependem do mês (sem seletor de mês). */
export function InvestimentosHeader({ eye }: { eye?: React.ReactNode }) {
  return (
    <header className="flex items-center justify-between gap-2 px-4 pt-[max(env(safe-area-inset-top),10px)] pb-1 lg:px-0 lg:pt-2 lg:pb-3">
      <h1 className="display text-[22px] font-bold tracking-tight lg:text-[28px]">Investimentos</h1>
      <div className="flex items-center gap-1 lg:gap-3">
        {eye}
        <Link
          href="/investimentos/novo"
          className="hidden items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-[14px] font-semibold text-white lg:inline-flex"
        >
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
            <path d="M12 5v14M5 12h14" />
          </svg>
          Novo investimento
        </Link>
        <Link
          href="/investimentos/novo"
          aria-label="Novo investimento"
          className="grid size-10 shrink-0 place-items-center rounded-full bg-ink text-white lg:hidden"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
            <path d="M12 5v14M5 12h14" />
          </svg>
        </Link>
      </div>
    </header>
  );
}

/** Telas de um investimento (detalhe, novo, editar): voltar + título + ação à direita. */
export function InvestimentoTopBar({ title, back, right }: { title: React.ReactNode; back: string; right?: React.ReactNode }) {
  return (
    <header className="flex items-center gap-2 px-2 pt-[max(env(safe-area-inset-top),10px)] pb-1 lg:px-0 lg:pt-2 lg:pb-4">
      <Link href={back} aria-label="Voltar" className="grid size-10 shrink-0 place-items-center rounded-full text-ink-2 hover:bg-surface">
        <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M15 6l-6 6 6 6" />
        </svg>
      </Link>
      <h1 className="display min-w-0 flex-1 truncate text-[20px] font-bold">{title}</h1>
      {right}
    </header>
  );
}
