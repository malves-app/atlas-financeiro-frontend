import { useId } from "react";

/*
 * Carregando com a marca: o mesmo globo da abertura (components/SplashScreen.tsx), com os
 * gomos subindo e descendo como barras e um trecho do aro girando. Feito para caber em
 * botões ("Salvando…"), mas escala para esperas maiores.
 */

// Mesma geometria de components/Logo.tsx: gomos inteiros e gomos preenchidos.
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

/** Cores conforme o fundo: "dark" (botão escuro), "brand" (botão verde ou vermelho), "light" (fundo claro). */
const TONES = {
  dark: { ring: "#eef1f5", track: "rgba(238,241,245,0.2)", empty: "rgba(238,241,245,0.1)", bar: "#17b39b", goal: "#e9a531" },
  brand: { ring: "#ffffff", track: "rgba(255,255,255,0.28)", empty: "rgba(255,255,255,0.14)", bar: "rgba(255,255,255,0.92)", goal: "#f8c56b" },
  light: { ring: "#172033", track: "rgba(23,32,51,0.12)", empty: "rgba(23,32,51,0.07)", bar: "#12a08a", goal: "#e39a2d" },
} as const;

export type LoaderTone = keyof typeof TONES;

export function LogoLoader({
  tone = "dark",
  className = "size-5",
  label,
}: {
  tone?: LoaderTone;
  className?: string;
  /** Texto para leitores de tela quando o loader aparece sozinho (sem texto ao lado). */
  label?: string;
}) {
  const id = `al${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const c = TONES[tone];
  return (
    <svg
      viewBox="12.5 12.5 75 75"
      className={`atlas-loader shrink-0 overflow-visible ${className}`}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <defs>
        {GORES.map((d, i) => (
          <clipPath key={d} id={`${id}-${i}`}>
            <path d={d} />
          </clipPath>
        ))}
      </defs>
      <g fill={c.empty}>
        {GORES.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      {BARS.map((d, i) => (
        <g key={d} clipPath={`url(#${id}-${i})`}>
          <path className={`al-bar al-bar-${i}`} d={d} fill={i === BARS.length - 1 ? c.goal : c.bar} />
        </g>
      ))}
      <circle cx="50" cy="50" r="34.35" fill="none" stroke={c.track} strokeWidth="5.5" />
      <circle
        className="al-arc"
        cx="50"
        cy="50"
        r="34.35"
        fill="none"
        stroke={c.ring}
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeDasharray="64 216"
      />
    </svg>
  );
}
