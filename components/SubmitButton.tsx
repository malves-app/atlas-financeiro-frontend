"use client";

import { useFormStatus } from "react-dom";
import { LogoLoader, type LoaderTone } from "./LogoLoader";

/**
 * Botão de enviar que mostra o loader da marca enquanto o formulário salva
 * (para formulários com action do servidor, sem estado próprio).
 */
export function SubmitButton({
  children,
  pendingLabel,
  className = "",
  tone = "dark",
  loaderClassName = "size-[18px]",
}: {
  children: React.ReactNode;
  pendingLabel?: React.ReactNode;
  className?: string;
  tone?: LoaderTone;
  loaderClassName?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending || undefined} className={`inline-flex items-center justify-center gap-2 ${className}`}>
      {pending && <LogoLoader tone={tone} className={loaderClassName} />}
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
