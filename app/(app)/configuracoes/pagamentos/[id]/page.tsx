import { notFound } from "next/navigation";
import { getPaymentMethod, listPaymentMethods } from "@/lib/data";
import { archivePaymentMethodAction } from "@/app/actions";
import { PaymentMethodForm } from "@/components/SettingsForms";
import { SettingsTopBar } from "@/components/SettingsVisuals";
import { DeleteButton } from "@/components/DeleteButton";

export const dynamic = "force-dynamic";

/** Detalhes de uma forma de pagamento: editar tudo e remover. */
export default async function FormaDePagamento({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [method, methods] = await Promise.all([getPaymentMethod(Number(id)), listPaymentMethods()]);
  if (!method) notFound();
  const others = methods.filter((m) => m.id !== method.id);

  return (
    <div className="lg:mx-auto lg:max-w-2xl">
      <SettingsTopBar title="Forma de pagamento" back="/configuracoes/pagamentos" />
      <PaymentMethodForm method={method} usedColors={others.map((m) => m.color)} />

      <div className="mx-3 mb-6 rounded-[20px] bg-surface px-4 pt-4 lg:mx-0">
        <h2 className="text-[15px] font-semibold">Remover forma de pagamento</h2>
        <p className="mt-1 mb-3 text-[14px] text-ink-2">
          {others.length
            ? "Ela sai das opções do lançamento. Os gastos antigos continuam com ela nos meses e nas estatísticas."
            : "É a única forma de pagamento: crie outra antes de remover esta."}
        </p>
        {others.length > 0 && (
          <DeleteButton action={archivePaymentMethodAction} fields={{ id: String(method.id) }} label="Remover forma de pagamento" confirmLabel="Remover" />
        )}
      </div>
    </div>
  );
}
