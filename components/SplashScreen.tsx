"use client";

import { useEffect, useRef } from "react";

/*
 * Abertura animada: o globo da marca aparece, o aro se desenha, os gomos sobem
 * como barras (o dourado por último) e o nome surge embaixo. Aparece uma vez por
 * sessão (por aba), no navegador e no app instalado; ?splash na URL força a
 * abertura. Um script inline decide antes da primeira pintura, então a página
 * não pisca por baixo. Toque na tela pula a abertura.
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

const SHOW = `(function(){try{var e=document.getElementById("atlas-splash");if(!e)return;var q=/[?&]splash(=|&|$)/.test(location.search);if(q||!sessionStorage.getItem("atlas-splash")){e.setAttribute("data-show","1");sessionStorage.setItem("atlas-splash","1")}}catch(x){}})()`;

export function SplashScreen() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || el.dataset.show !== "1") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timers: number[] = [];
    const close = () => {
      if (el.dataset.show !== "1") return;
      el.dataset.show = "out";
      timers.push(window.setTimeout(() => (el.dataset.show = "0"), 400));
    };
    timers.push(window.setTimeout(close, reduce ? 700 : 2100));
    el.addEventListener("click", close);
    return () => {
      timers.forEach(clearTimeout);
      el.removeEventListener("click", close);
    };
  }, []);

  return (
    <div ref={ref} id="atlas-splash" className="atlas-splash" data-show="0" aria-hidden suppressHydrationWarning>
      <script
        type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: SHOW }}
      />
      <svg viewBox="12.5 12.5 75 75" className="sp-art">
        <defs>
          {GORES.map((d, i) => (
            <clipPath key={d} id={`sp-gomo-${i}`}>
              <path d={d} />
            </clipPath>
          ))}
        </defs>
        <g className="sp-empty" fill="#eef1f5" fillOpacity="0.1">
          {GORES.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
        {BARS.map((d, i) => (
          <g key={d} clipPath={`url(#sp-gomo-${i})`}>
            <path className={`sp-bar sp-bar-${i}`} d={d} fill={i === BARS.length - 1 ? "#e9a531" : "#17b39b"} />
          </g>
        ))}
        <circle
          className="sp-ring"
          cx="50"
          cy="50"
          r="34.35"
          transform="rotate(90 50 50)"
          fill="none"
          stroke="#eef1f5"
          strokeWidth="5.5"
          strokeDasharray="216"
        />
        <circle className="sp-echo" cx="50" cy="50" r="34.35" fill="none" stroke="#eef1f5" strokeWidth="3.3" />
      </svg>
      <p className="sp-word display text-[30px] leading-none font-bold tracking-tight">
        Atlas<span className="text-[#7fd8c8]">Financeiro</span>
      </p>
    </div>
  );
}
