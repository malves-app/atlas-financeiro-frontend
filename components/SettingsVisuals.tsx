import Link from "next/link";
import { bankById, paymentType, type PaymentType } from "@/lib/payment-icons";
import { Chevron } from "./ui";

/*
 * Peças visuais de Configurações (servem para páginas do servidor e formulários do cliente):
 * selo da forma de pagamento, ícone do tipo, círculo da categoria, cabeçalho com voltar e
 * os cartões da visão geral.
 */

export function TypeGlyph({ type, className = "size-5", width = 1.9 }: { type: string | null | undefined; className?: string; width?: number }) {
  const t = paymentType(type);
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={t.id === "outro" ? width + 1.4 : width}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={t.icon} />
    </svg>
  );
}

const BADGE = {
  xs: { box: "size-6 rounded-[7px]", glyph: "size-3.5", text: "text-[9px]", textLong: "text-[7.5px]" },
  sm: { box: "size-8 rounded-[10px]", glyph: "size-[18px]", text: "text-[11px]", textLong: "text-[9px]", corner: "size-4 -right-1 -bottom-1", cornerGlyph: "size-2.5" },
  md: { box: "size-10 rounded-xl", glyph: "size-[22px]", text: "text-[13px]", textLong: "text-[11px]", corner: "size-5 -right-1 -bottom-1", cornerGlyph: "size-3" },
  lg: { box: "size-16 rounded-[20px]", glyph: "size-8", text: "text-[20px]", textLong: "text-[16px]", corner: "size-7 -right-1.5 -bottom-1.5", cornerGlyph: "size-4" },
} as const;

/**
 * Selo da forma de pagamento. Com banco: iniciais na cor do banco e, no canto, o tipo
 * (cartão, conta, Pix...). Sem banco: o ícone do tipo na cor da forma de pagamento.
 */
export function PaymentBadge({
  icon,
  bank,
  color,
  size = "md",
  className = "",
  corner = true,
  round = false,
}: {
  icon: PaymentType | string | null | undefined;
  bank: string | null | undefined;
  color: string;
  size?: keyof typeof BADGE;
  className?: string;
  /** Com banco: mostrar o tipo no canto. */
  corner?: boolean;
  /** Redondo (dentro de botões em pílula). */
  round?: boolean;
}) {
  const s = BADGE[size];
  const b = bankById(bank);
  const box = round ? s.box.replace(/rounded-\S+/, "rounded-full") : s.box;
  if (!b) {
    return (
      <span className={`relative grid shrink-0 place-items-center text-white ${box} ${className}`} style={{ background: color }} aria-hidden>
        <TypeGlyph type={icon} className={s.glyph} width={2} />
      </span>
    );
  }
  return (
    <span className={`relative inline-grid shrink-0 ${round ? "rounded-full" : ""} ${className}`} aria-hidden>
      <span
        className={`display grid place-items-center overflow-hidden leading-none font-bold tracking-[-0.02em] ${box} ${b.initials.length > 2 ? s.textLong : s.text}`}
        style={{ background: b.bg, color: b.fg }}
      >
        {b.logo ? <img src={b.logo} alt="" className="size-full object-cover" /> : b.initials}
      </span>
      {corner && "cornerGlyph" in s && (
        <span className={`absolute grid place-items-center rounded-full bg-surface text-ink shadow-[0_1px_3px_rgba(23,32,51,0.25)] ${s.corner}`}>
          <TypeGlyph type={icon} className={s.cornerGlyph} width={2.3} />
        </span>
      )}
    </span>
  );
}

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

/** "Cartão de crédito · Nubank · fecha dia 25" (sem repetir o que o nome já diz). */
export function methodDescription(m: { name?: string; icon: string; bank: string | null; isCredit: boolean; closingDay: number | null }) {
  const name = fold(m.name ?? "");
  const parts: string[] = [];
  const type = paymentType(m.icon).label;
  if (!name || fold(type) !== name) parts.push(type);
  const b = bankById(m.bank);
  if (b && fold(b.name) !== name) parts.push(b.name);
  if (m.isCredit) parts.push(m.closingDay ? `fecha dia ${m.closingDay}` : "sem dia de fechamento");
  return parts.join(" · ") || "Sai na hora, sem fatura";
}

/** Círculo com o emoji da categoria. */
export function CategoryCircle({ emoji, size = "md", className = "" }: { emoji: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const s = { sm: "size-8 text-[16px]", md: "size-11 text-[21px]", lg: "size-16 text-[32px]" }[size];
  return (
    <span className={`grid shrink-0 place-items-center rounded-full bg-paper leading-none ${s} ${className}`} aria-hidden>
      {emoji}
    </span>
  );
}

/** Subpáginas de Configurações: voltar + título (+ subtítulo) + ação à direita. */
export function SettingsTopBar({
  title,
  back,
  right,
  subtitle,
}: {
  title: React.ReactNode;
  back: string;
  right?: React.ReactNode;
  subtitle?: React.ReactNode;
}) {
  return (
    <header className="flex items-center gap-2 px-2 pt-[max(env(safe-area-inset-top),10px)] pb-2 lg:px-0 lg:pt-2 lg:pb-5">
      <Link href={back} aria-label="Voltar" className="grid size-10 shrink-0 place-items-center rounded-full text-ink-2 hover:bg-surface">
        <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M15 6l-6 6 6 6" />
        </svg>
      </Link>
      <div className="min-w-0 flex-1">
        <h1 className="display truncate text-[20px] leading-tight font-bold lg:text-[24px]">{title}</h1>
        {subtitle && <p className="truncate text-[13px] text-ink-3">{subtitle}</p>}
      </div>
      {right}
    </header>
  );
}

/** Botão "+ Nova…" do cabeçalho: com texto no computador, só o + no celular. */
export function AddButton({ href, label }: { href: string; label: string }) {
  const plus = (
    <svg viewBox="0 0 24 24" className="size-4 lg:size-4" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
  return (
    <>
      <Link
        href={href}
        className="hidden items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-[14px] font-semibold text-white lg:inline-flex"
      >
        {plus}
        {label}
      </Link>
      <Link href={href} aria-label={label} className="mr-2 grid size-10 shrink-0 place-items-center rounded-full bg-ink text-white lg:hidden">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
          <path d="M12 5v14M5 12h14" />
        </svg>
      </Link>
    </>
  );
}

/** Cartão da visão geral: ícone, título, resumo, prévia e seta. Leva para a subpágina. */
export function SettingsCard({
  href,
  glyph,
  title,
  summary,
  preview,
  className = "",
}: {
  href: string;
  glyph: React.ReactNode;
  title: string;
  summary: React.ReactNode;
  preview?: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`group mx-3 flex flex-col rounded-[22px] bg-surface p-4 ring-1 ring-transparent transition-[box-shadow,transform] duration-200 hover:-translate-y-px hover:shadow-[0_10px_30px_-18px_rgba(23,32,51,0.45)] hover:ring-line focus-visible:ring-brand lg:mx-0 lg:p-5 ${className}`}
    >
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-paper text-ink">{glyph}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-semibold">{title}</span>
          <span className="block truncate text-[13.5px] text-ink-3">{summary}</span>
        </span>
        <Chevron className="size-5 shrink-0 text-ink-3 transition-transform duration-200 group-hover:translate-x-0.5" />
      </div>
      {preview && <div className="mt-4 flex min-h-10 items-center">{preview}</div>}
    </Link>
  );
}

/** Prévia em fila (selos ou emojis sobrepostos) com "+N" no fim. */
export function PreviewStack({ items, more, round = false }: { items: React.ReactNode[]; more: number; round?: boolean }) {
  return (
    <span className="flex items-center">
      <span className="flex -space-x-2">
        {items.map((it, i) => (
          <span key={i} className={`flex ring-[3px] ring-surface ${round ? "rounded-full" : "rounded-[14px]"}`} style={{ zIndex: items.length - i }}>
            {it}
          </span>
        ))}
      </span>
      {more > 0 && <span className="num ml-2.5 rounded-full bg-paper px-2.5 py-1 text-[12.5px] font-semibold text-ink-2">+{more}</span>}
    </span>
  );
}

export const CARD_GLYPH = "M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM2 10h20M6 15h4";
export const TAG_GLYPH = "M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9zM7.5 7.5h.01";
export const USER_GLYPH = "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20c.8-3.5 4-6 8-6s7.2 2.5 8 6";

export function Glyph({ d, className = "size-[22px]", width = 1.9 }: { d: string; className?: string; width?: number }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

/** Inicial do e-mail num círculo (a conta ainda só tem e-mail). */
export function Avatar({ email, className = "size-11 text-[18px]" }: { email: string | null; className?: string }) {
  const letter = (email ?? "?").trim().charAt(0).toUpperCase() || "?";
  return (
    <span className={`display grid shrink-0 place-items-center rounded-full bg-ink font-bold text-white ${className}`} aria-hidden>
      {letter}
    </span>
  );
}
