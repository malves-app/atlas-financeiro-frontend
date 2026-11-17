/**
 * Marca do AtlasFinanceiro: um globo cujos gomos sobem como barras de gráfico
 * (o último, dourado, é a meta alcançada). Os vãos entre os gomos são vazados,
 * então o símbolo funciona sobre qualquer fundo. Desenho gerado; os mesmos
 * traços estão em public/brand e nos ícones do app.
 */

// Gomos inteiros (fundo apagado) e gomos preenchidos até 28%, 50%, 71% e 90%.
const GORES = [
  "M42.89 21.88A29 29 0 0 0 42.89 78.12A17.7 30.7 0 0 1 42.89 21.88Z",
  "M48.3 22.89L48.3 77.11A14.3 27.3 0 0 1 48.3 22.89Z",
  "M51.7 22.89L51.7 77.11A14.3 27.3 0 0 0 51.7 22.89Z",
  "M57.11 21.88A29 29 0 0 1 57.11 78.12A17.7 30.7 0 0 0 57.11 21.88Z",
];
const BARS = [
  "M23.96 62.76A29 29 0 0 0 42.89 78.12A17.7 30.7 0 0 1 33.9 62.76Z",
  "M48.3 50L48.3 77.11A14.3 27.3 0 0 1 35.7 50Z",
  "M51.7 37.82L51.7 77.11A14.3 27.3 0 0 0 62.8 37.82Z",
  "M67.4 26.8A29 29 0 0 1 57.11 78.12A17.7 30.7 0 0 0 61.59 26.8Z",
];

/** Cores conforme o fundo onde o símbolo fica: "light" (fundo claro) ou "dark" (fundo escuro). */
const TONES = {
  light: { ring: "#172033", empty: "#172033", emptyOpacity: 0.07, bar: "#12a08a", goal: "#e39a2d" },
  dark: { ring: "#eef1f5", empty: "#eef1f5", emptyOpacity: 0.1, bar: "#17b39b", goal: "#e9a531" },
} as const;

type Tone = keyof typeof TONES;

export function LogoMark({ tone = "light", className }: { tone?: Tone; className?: string }) {
  const c = TONES[tone];
  return (
    <svg viewBox="12.5 12.5 75 75" className={className} aria-hidden>
      <g fill={c.empty} fillOpacity={c.emptyOpacity}>
        {GORES.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      {BARS.map((d, i) => (
        <path key={d} d={d} fill={i === BARS.length - 1 ? c.goal : c.bar} />
      ))}
      <circle cx="50" cy="50" r="34.35" fill="none" stroke={c.ring} strokeWidth="5.5" />
    </svg>
  );
}

/** Símbolo + nome. O tamanho acompanha o font-size passado em className. */
export function Logo({ tone = "light", className = "" }: { tone?: Tone; className?: string }) {
  return (
    <span className={`display inline-flex items-center gap-[0.32em] font-bold tracking-tight ${className}`}>
      <LogoMark tone={tone} className="size-[1.3em] shrink-0" />
      <span>
        Atlas<span className={tone === "dark" ? "text-[#7fd8c8]" : "text-brand"}>Financeiro</span>
      </span>
    </span>
  );
}
