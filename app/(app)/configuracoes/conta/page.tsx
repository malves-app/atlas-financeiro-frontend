import { getUserEmail } from "@/lib/data";
import { logout } from "@/app/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { Avatar, SettingsTopBar } from "@/components/SettingsVisuals";

export const dynamic = "force-dynamic";

/** Conta: por enquanto só o e-mail do cadastro (e sair). Senha e dados pessoais virão aqui. */
export default async function Conta() {
  const email = await getUserEmail();
  return (
    <div className="pb-8 lg:mx-auto lg:max-w-2xl">
      <SettingsTopBar title="Conta" back="/configuracoes" />

      <div className="space-y-4">
        <section className="mx-3 flex flex-col items-center rounded-[22px] bg-surface px-5 pt-7 pb-6 text-center lg:mx-0">
          <Avatar email={email} className="size-20 text-[32px]" />
          <p className="mt-4 text-[12.5px] font-semibold tracking-[0.04em] text-ink-3 uppercase">E-mail</p>
          <p className="mt-0.5 max-w-full text-[17px] font-semibold break-all">{email ?? "—"}</p>
          <p className="mt-1 text-[13.5px] text-ink-3">É com ele que você entra no AtlasFinanceiro.</p>
        </section>

        <form action={logout} className="mx-3 lg:mx-0">
          <SubmitButton
            tone="light"
            pendingLabel="Saindo…"
            className="w-full rounded-full border border-line bg-surface py-3 text-[15px] font-semibold text-danger hover:bg-danger-soft"
          >
            Sair da conta
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}
