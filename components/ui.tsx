import { formatBRL } from "@/lib/format";

export function Money({ cents, className = "", signed = false }: { cents: number; className?: string; signed?: boolean }) {
  const text = formatBRL(Math.abs(cents));
  const sign = cents < 0 ? "−" : signed && cents > 0 ? "+" : "";
  return (
    <span className={`num whitespace-nowrap ${className}`}>
      {sign}
      {text}
    </span>
  );
}

export function Chevron({ dir = "right", className = "size-5" }: { dir?: "left" | "right" | "down"; className?: string }) {
  const d = dir === "left" ? "M15 6l-6 6 6 6" : dir === "down" ? "M6 9l6 6 6-6" : "M9 6l6 6-6 6";
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

export function PageHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <header className="flex items-center justify-between gap-2 px-4 pt-[max(env(safe-area-inset-top),12px)] pb-2">
      <h1 className="display text-[22px] font-bold tracking-tight">{title}</h1>
      {children}
    </header>
  );
}

export function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`mx-3 rounded-[20px] bg-surface lg:mx-0 ${className}`}>{children}</section>;
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-4 pt-4 pb-2">
      <h2 className="text-[15px] font-semibold text-ink">{children}</h2>
      {right}
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-6 text-center text-[15px] text-ink-3">{children}</p>;
}

/** Forma de pagamento: ponto colorido + nome (a cor nunca aparece sozinha). */
export function PaymentTag({ method }: { method?: { name: string; color: string } | null }) {
  if (!method) return null;
  return (
    <span className="inline-flex items-center gap-1">
      <span className="size-2 rounded-full" style={{ background: method.color }} aria-hidden />
      {method.name}
    </span>
  );
}

const MONTHS_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Selo de calendário com o dia do vencimento/cobrança. */
export function DayBadge({ date, tone = "default" }: { date: string | null; tone?: "default" | "muted" | "danger" | "done" }) {
  const styles = {
    default: "bg-paper text-ink",
    muted: "bg-paper text-ink-3",
    danger: "bg-danger-soft text-danger",
    done: "bg-brand-soft text-brand",
  }[tone];
  if (!date) {
    return (
      <span className={`grid size-11 shrink-0 place-items-center rounded-xl text-[15px] ${styles}`} aria-hidden>
        —
      </span>
    );
  }
  const d = Number(date.slice(8, 10));
  const m = MONTHS_SHORT[Number(date.slice(5, 7)) - 1];
  return (
    <span className={`flex size-11 shrink-0 flex-col items-center justify-center rounded-xl leading-none ${styles}`} aria-hidden>
      <span className="num text-[17px] font-bold">{d}</span>
      <span className="mt-0.5 text-[11px] font-medium opacity-80">{m}</span>
    </span>
  );
}

/** Círculo com o emoji da categoria (ou a inicial do nome, se não tiver categoria). */
export function EntryIcon({ emoji, name }: { emoji?: string | null; name: string }) {
  return (
    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-paper text-[18px]" aria-hidden>
      {emoji ?? <span className="text-[15px] font-semibold text-ink-3">{name.trim().charAt(0).toUpperCase() || "·"}</span>}
    </span>
  );
}

/** Barra empilhada fina (partes de um todo), com 2px entre as partes. */
export function StackedBar({ parts, height = "h-3" }: { parts: { key: string; value: number; color: string }[]; height?: string }) {
  const visible = parts.filter((p) => p.value > 0);
  if (!visible.length) return <div className={`${height} rounded-full bg-paper`} aria-hidden />;
  return (
    <div className={`flex ${height} gap-[2px] overflow-hidden rounded-full`} aria-hidden>
      {visible.map((p) => (
        <div key={p.key} className="h-full first:rounded-l-full last:rounded-r-full" style={{ flexGrow: p.value, background: p.color }} />
      ))}
    </div>
  );
}
