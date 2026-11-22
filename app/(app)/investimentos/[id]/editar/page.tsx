import { notFound } from "next/navigation";
import { formatBRL } from "@/lib/format";
import { institutionsOf, position } from "@/lib/investments";
import { getInvestment, listInvestments, listMoves } from "@/lib/investments-data";
import { closeInvestmentAction, deleteInvestmentAction, reopenInvestmentAction } from "@/app/actions";
import { InvestimentoTopBar } from "@/components/PageHeaders";
import { InvestmentForm } from "@/components/InvestmentForm";
import { DeleteButton } from "@/components/DeleteButton";
import { SubmitButton } from "@/components/SubmitButton";

export const dynamic = "force-dynamic";

export default async function EditarInvestimento({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const investment = await getInvestment(Number(id));
  if (!investment) notFound();
  const [all, moves] = await Promise.all([listInvestments(), listMoves(investment.id)]);
  const { balance } = position(moves);

  return (
    <div className="lg:mx-auto lg:max-w-xl">
      <InvestimentoTopBar title="Editar investimento" back={`/investimentos/${investment.id}`} />
      <InvestmentForm institutions={institutionsOf(all)} investment={investment} />

      <div className="mx-5 space-y-3 pb-6">
        {investment.archived ? (
          <form action={reopenInvestmentAction} className="rounded-2xl bg-surface p-4">
            <input type="hidden" name="id" value={investment.id} />
            <h2 className="text-[15px] font-semibold">Reabrir investimento</h2>
            <p className="mt-1 text-[14px] text-ink-2">Ele volta para a lista e para o total, e você pode registrar movimentações de novo.</p>
            <SubmitButton pendingLabel="Reabrindo…" className="mt-3 rounded-full bg-ink px-4 py-2.5 text-[14px] font-semibold text-white">
              Reabrir
            </SubmitButton>
          </form>
        ) : (
          <form action={closeInvestmentAction} className="rounded-2xl bg-surface p-4">
            <input type="hidden" name="id" value={investment.id} />
            <h2 className="text-[15px] font-semibold">Encerrar investimento</h2>
            <p className="mt-1 text-[14px] text-ink-2">
              {balance > 0 ? (
                <>
                  O saldo de{" "}
                  <strong className="num font-semibold">
                    {formatBRL(balance)}
                  </strong>{" "}
                  entra como resgate hoje e o investimento sai da lista. O histórico continua na evolução.
                </>
              ) : (
                "Ele sai da lista. O histórico continua na evolução."
              )}
            </p>
            <SubmitButton
              tone="light"
              pendingLabel="Encerrando…"
              loaderClassName="size-4"
              className="mt-3 rounded-full bg-paper px-4 py-2.5 text-[14px] font-semibold text-ink"
            >
              {balance > 0 ? "Resgatar tudo e encerrar" : "Encerrar"}
            </SubmitButton>
          </form>
        )}

        <div className="rounded-2xl bg-surface px-4 pt-4">
          <h2 className="text-[15px] font-semibold">Apagar investimento</h2>
          <p className="mt-1 mb-3 text-[14px] text-ink-2">
            Apaga o investimento e todas as movimentações dele, como se nunca tivesse existido. Para guardar o histórico, prefira
            encerrar.
          </p>
          <DeleteButton action={deleteInvestmentAction} fields={{ id: String(investment.id) }} label="Apagar investimento" confirmLabel="Apagar de vez" />
        </div>
      </div>
    </div>
  );
}
