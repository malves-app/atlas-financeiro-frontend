import Link from "next/link";
import type { BalancePart, BalanceView } from "@/lib/balance";
import { Chevron, Money } from "@/components/ui";

// Cartão do saldo do Painel: o destaque da tela. As contas estão em lib/balance.ts.
// Destaque = saldo do mês inteiro. Barras Entrou × Gastos na mesma escala (a diferença é o saldo); cada parte
// dos gastos é uma linha do extrato, com a mesma cor (azul = conta, dourado = cartão) e o mesmo listrado
// (= ainda não saiu da conta). O extrato fecha a conta, com "Na conta hoje" no meio.

export function BalanceCard({ view, className = "" }: { view: BalanceView; className?: string }) {
  const conta = view.outs.find((p) => p.key === "conta");
  const rest = view.outs.filter((p) => p.key !== "conta");
  return (
    <section
      aria-labelledby="saldo-titulo"
      className={`mx-3 mt-1 overflow-hidden rounded-[24px] bg-ink p-5 text-white lg:mx-0 lg:mt-0 lg:p-7 ${className}`}
    >
      <h2 id="saldo-titulo" className="text-[15px] text-white/70">
        {view.heroLabel}
      </h2>
      <p
        className={`display mt-1 text-[clamp(42px,12.5vw,64px)] leading-[0.95] font-[750] tracking-[-0.02em] ${
          view.saldo < 0 ? "text-[#ff9aa5]" : "text-white"
        }`}
        style={{ fontStretch: "82%" }}
      >
        <Money cents={view.saldo} />
      </p>

      <div className="mt-5">
        <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2" role="img" aria-label={view.barsLabel}>
          <span className="text-[12px] text-white/60" aria-hidden>
            {view.income.label}
          </span>
          <FlowBar parts={[view.income]} scale={view.scale} />
          <span className="text-[12px] text-white/60" aria-hidden>
            Gastos
          </span>
          <FlowBar parts={view.outs} scale={view.scale} />
        </div>
        <p className={`mt-2.5 text-[14px] ${view.over ? "font-medium text-[#ff9aa5]" : "text-white/70"}`}>
          {view.meterText}
        </p>
      </div>

      {/* Extrato: entrou − já saiu da conta = na conta hoje; − fatura − contas = saldo no fim do mês */}
      <ul className="mt-5 overflow-hidden rounded-2xl bg-white/[0.07]">
        <StatementRow part={view.income} />
        {conta && <StatementRow part={conta} out />}
        {view.mode === "andamento" && (
          <TotalRow label="Na conta hoje" hint={view.naContaHint} cents={view.naConta} />
        )}
        {rest.map((p) => (
          <StatementRow key={p.key} part={p} out />
        ))}
        <TotalRow label={view.totalLabel} cents={view.saldo} last />
      </ul>
    </section>
  );
}

const stripes = (color: string) => `repeating-linear-gradient(-45deg, ${color} 0 3px, transparent 3px 6px)`;

const fillOf = (p: Pick<BalancePart, "color" | "striped">): React.CSSProperties =>
  p.striped ? { background: stripes(p.color), boxShadow: `inset 0 0 0 1px ${p.color}` } : { background: p.color };

/** Barra fina: o trilho é a escala comum; cada parte com o tamanho do valor, separadas por 2px. */
function FlowBar({ parts, scale }: { parts: BalancePart[]; scale: number }) {
  const visible = parts.filter((p) => p.cents > 0);
  const total = visible.reduce((a, p) => a + p.cents, 0);
  return (
    <div className="h-2 overflow-hidden rounded-full bg-white/10" aria-hidden>
      {total > 0 && (
        <div className="flex h-full gap-[2px]" style={{ width: `${Math.min((total / scale) * 100, 100)}%` }}>
          {visible.map((p) => (
            <div
              key={p.key}
              className="h-full min-w-[3px] first:rounded-l-full last:rounded-r-full"
              style={{ flex: `${p.cents} 1 0`, ...fillOf(p) }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** Legenda da barra, na linha do extrato. Sem valor (nada entrou), só o contorno: não há parte na barra. */
function Marker({ part }: { part: BalancePart }) {
  return (
    <span
      className="h-2.5 w-4 shrink-0 rounded-full"
      style={part.cents > 0 ? fillOf(part) : { boxShadow: `inset 0 0 0 1px ${part.color}` }}
      aria-hidden
    />
  );
}

function StatementRow({ part, out = false }: { part: BalancePart; out?: boolean }) {
  return (
    <li className="border-t border-white/10 first:border-t-0">
      {/* valor na linha do nome; a explicação embaixo, na largura toda (cabe numa linha no celular) */}
      <Link
        href={part.href}
        className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-x-3 px-4 py-3 hover:bg-white/[0.05]"
      >
        <Marker part={part} />
        <span className="min-w-0 text-[15px] text-white/85">{part.label}</span>
        {/* saídas com "−", para o extrato fechar a conta */}
        <Money cents={out ? -part.cents : part.cents} className="text-[16px] font-semibold" />
        <Chevron className="row-span-2 size-4 shrink-0 text-white/40" />
        {part.hint && (
          <span className="col-span-2 col-start-2 mt-0.5 text-[12px] leading-snug text-white/55">{part.hint}</span>
        )}
      </Link>
    </li>
  );
}

/** Subtotal do extrato: "Na conta hoje" e o saldo do fim. */
function TotalRow({ label, hint, cents, last = false }: { label: string; hint?: string; cents: number; last?: boolean }) {
  return (
    <li
      className={`grid grid-cols-[1fr_auto_auto] items-center gap-x-3 border-t border-white/15 px-4 first:border-t-0 ${
        last ? "py-3.5" : "bg-white/[0.05] py-3"
      }`}
    >
      <span className="min-w-0 text-[15px] font-medium">{label}</span>
      <Money cents={cents} className={`text-[18px] font-semibold ${cents < 0 ? "text-[#ff9aa5]" : ""}`} />
      {/* mesmo espaço da seta das linhas, para os valores ficarem alinhados */}
      <span className="size-4" aria-hidden />
      {hint && <span className="col-span-2 mt-0.5 text-[12px] leading-snug text-white/55">{hint}</span>}
    </li>
  );
}
