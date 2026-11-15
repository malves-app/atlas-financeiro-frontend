"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signUp } from "@/app/actions";
import { AuthShell } from "@/components/AuthShell";

export default function CadastroPage() {
  const [state, action, pending] = useActionState(signUp, undefined);
  const input = "w-full rounded-2xl border border-line bg-surface px-4 py-3.5 outline-none focus:border-brand";

  if (state?.sentTo) {
    return (
      <AuthShell title="Confirme seu e-mail" subtitle={`Enviamos um link para ${state.sentTo}. Abra o e-mail e toque no link para ativar a conta.`}>
        <Link href="/login" className="block w-full rounded-full bg-ink py-3.5 text-center text-[16px] font-semibold text-white">
          Ir para o login
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Criar conta" subtitle="Use seu e-mail e escolha uma senha.">
      <form action={action} className="space-y-4">
        <input type="email" name="email" autoComplete="email" aria-label="E-mail" placeholder="E-mail (ex.: voce@exemplo.com)" required className={input} />
        <input
          type="password"
          name="password"
          autoComplete="new-password"
          aria-label="Senha"
          placeholder="Senha (mínimo 6 caracteres)"
          minLength={6}
          required
          className={input}
        />
        <input
          type="password"
          name="confirm"
          autoComplete="new-password"
          aria-label="Repita a senha"
          placeholder="Repita a senha"
          minLength={6}
          required
          className={input}
        />
        {state?.error && (
          <p role="alert" className="text-[14px] font-medium text-danger">
            {state.error}
          </p>
        )}
        <button type="submit" disabled={pending} className="w-full rounded-full bg-ink py-3.5 text-[16px] font-semibold text-white disabled:opacity-60">
          {pending ? "Criando conta…" : "Criar conta"}
        </button>
      </form>
      <p className="mt-5 text-center text-[15px] text-ink-2">
        Já tem conta?{" "}
        <Link href="/login" className="font-semibold text-brand">
          Entrar
        </Link>
      </p>
    </AuthShell>
  );
}
