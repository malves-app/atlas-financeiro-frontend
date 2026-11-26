import Link from "next/link";
import { listPaymentMethods, type PaymentMethod } from "@/lib/data";
import { Chevron, Panel } from "@/components/ui";
import { AddButton, methodDescription, PaymentBadge, SettingsTopBar } from "@/components/SettingsVisuals";

export const dynamic = "force-dynamic";

function MethodRow({ m }: { m: PaymentMethod }) {
  return (
    <li>
      <Link href={`/configuracoes/pagamentos/${m.id}`} className="flex items-center gap-3.5 px-4 py-3 hover:bg-paper/60">
        <PaymentBadge icon={m.icon} bank={m.bank} color={m.color} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15.5px] font-medium">{m.name}</span>
          <span className="block truncate text-[13px] text-ink-3">{methodDescription(m)}</span>
        </span>
        <Chevron className="size-5 shrink-0 text-ink-3" />
      </Link>
    </li>
  );
}

/** Formas de pagamento: contas, Pix e dinheiro de um lado; cartões de crédito do outro. */
export default async function Pagamentos() {
  const methods = await listPaymentMethods();
  const accounts = methods.filter((m) => !m.isCredit);
  const cards = methods.filter((m) => m.isCredit);

  return (
    <div className="lg:mx-auto lg:max-w-2xl">
      <SettingsTopBar
        title="Formas de pagamento"
        back="/configuracoes"
        right={<AddButton href="/configuracoes/pagamentos/nova" label="Nova forma" />}
      />
      <p className="mx-5 -mt-1 mb-4 text-[14px] text-ink-2 lg:mx-1">
        Como cada gasto é pago. Nos cartões de crédito, compras depois do dia de fechamento entram na fatura do mês seguinte.
      </p>

      <div className="space-y-4">
        <section>
          <h2 className="mx-5 mb-2 flex items-baseline justify-between text-[13px] font-semibold text-ink-2 lg:mx-1">
            Contas, Pix e outros
            <span className="num font-medium text-ink-3">{accounts.length}</span>
          </h2>
          <Panel>
            {accounts.length ? (
              <ul className="divide-y divide-line/60 py-1">
                {accounts.map((m) => (
                  <MethodRow key={m.id} m={m} />
                ))}
              </ul>
            ) : (
              <p className="px-4 py-4 text-[14px] text-ink-3">Nenhuma conta ainda.</p>
            )}
          </Panel>
        </section>

        <section>
          <h2 className="mx-5 mb-2 flex items-baseline justify-between text-[13px] font-semibold text-ink-2 lg:mx-1">
            Cartões de crédito
            <span className="num font-medium text-ink-3">{cards.length}</span>
          </h2>
          <Panel>
            {cards.length ? (
              <ul className="divide-y divide-line/60 py-1">
                {cards.map((m) => (
                  <MethodRow key={m.id} m={m} />
                ))}
              </ul>
            ) : (
              <p className="px-4 py-4 text-[14px] text-ink-3">
                Nenhum cartão de crédito.{" "}
                <Link href="/configuracoes/pagamentos/nova?tipo=credito" className="font-semibold text-brand">
                  Adicionar cartão
                </Link>
              </p>
            )}
          </Panel>
        </section>

        <Link
          href="/configuracoes/pagamentos/nova"
          className="mx-3 flex items-center justify-center gap-2 rounded-[20px] border-[1.5px] border-dashed border-line py-3.5 text-[15px] font-semibold text-brand hover:border-brand/40 hover:bg-brand-soft/50 lg:mx-0"
        >
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
            <path d="M12 5v14M5 12h14" />
          </svg>
          Adicionar forma de pagamento
        </Link>
      </div>
    </div>
  );
}
