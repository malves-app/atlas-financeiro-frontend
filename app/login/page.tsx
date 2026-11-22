"use client";

import Link from "next/link";
import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { login } from "@/app/actions";
import { AuthShell } from "@/components/AuthShell";
import { LogoLoader } from "@/components/LogoLoader";

function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);
  const sp = useSearchParams();
  const next = sp.get("next") ?? "/";
  const linkError = sp.get("erro") === "link";
  const input = "w-full rounded-2xl border border-line bg-surface px-4 py-3.5 outline-none focus:border-brand";
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      {linkError && (
        <p role="alert" className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-[14px] font-medium text-danger">
          O link de confirmação expirou ou já foi usado. Entre com e-mail e senha ou crie a conta de novo.
        </p>
      )}
      <input type="email" name="email" autoComplete="email" aria-label="E-mail" placeholder="E-mail (ex.: voce@exemplo.com)" required className={input} />
      <input
        type="password"
        name="password"
        autoComplete="current-password"
        aria-label="Senha"
        placeholder="Senha"
        required
        className={input}
      />
      {state?.error && (
        <p role="alert" className="text-[14px] font-medium text-danger">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending || undefined}
        className="flex w-full items-center justify-center gap-2.5 rounded-full bg-ink py-3.5 text-[16px] font-semibold text-white disabled:opacity-90"
      >
        {pending && <LogoLoader className="size-5" />}
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <AuthShell title="Entrar" subtitle="Use o e-mail e a senha da sua conta.">
      <Suspense>
        <LoginForm />
      </Suspense>
      <p className="mt-5 text-center text-[15px] text-ink-2">
        Ainda não tem conta?{" "}
        <Link href="/cadastro" className="font-semibold text-brand">
          Criar conta
        </Link>
      </p>
    </AuthShell>
  );
}
