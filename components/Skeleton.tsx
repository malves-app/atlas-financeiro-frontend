import type { CSSProperties, ReactNode } from "react";

/* Peças dos skeletons (as telas ficam em components/PageSkeletons.tsx). O brilho vem da
   classe .sk em app/globals.css. */

/** Bloco cinza com brilho. `dark`: sobre o cartão escuro do saldo. */
export function Bone({ className = "", dark = false, style }: { className?: string; dark?: boolean; style?: CSSProperties }) {
  return <span aria-hidden className={`sk ${dark ? "sk-dark " : ""}${className}`} style={style} />;
}

/** Uma linha de texto: ocupa a altura da linha real (fonte × 1,5) com a barra no meio. */
export function TextBone({
  size = 15,
  w = "w-24",
  dark = false,
  className = "",
  lineHeight,
}: {
  size?: number;
  w?: string;
  dark?: boolean;
  className?: string;
  lineHeight?: number;
}) {
  return (
    <span aria-hidden className={`flex items-center ${className}`} style={{ height: lineHeight ?? size * 1.5 }}>
      <Bone dark={dark} className={`block rounded-full ${w}`} style={{ height: Math.max(8, Math.round(size * 0.7)) }} />
    </span>
  );
}

/** Moldura de uma tela carregando: avisa leitores de tela e marca a região como ocupada. */
export function SkeletonScreen({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div aria-busy="true" className={className}>
      <span role="status" className="sr-only">
        Carregando…
      </span>
      {children}
    </div>
  );
}
