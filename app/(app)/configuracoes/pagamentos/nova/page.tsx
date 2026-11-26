import { listPaymentMethods } from "@/lib/data";
import { readParams, type SearchParams } from "@/lib/page";
import { isPaymentType } from "@/lib/payment-icons";
import { PaymentMethodForm } from "@/components/SettingsForms";
import { SettingsTopBar } from "@/components/SettingsVisuals";

export const dynamic = "force-dynamic";

export default async function NovaFormaDePagamento({ searchParams }: { searchParams: SearchParams }) {
  const [methods, { get }] = await Promise.all([listPaymentMethods(), readParams(searchParams)]);
  const t = get("tipo");
  const tipo = isPaymentType(t) ? t : undefined;
  return (
    <div className="lg:mx-auto lg:max-w-2xl">
      <SettingsTopBar title="Nova forma de pagamento" back="/configuracoes/pagamentos" />
      <PaymentMethodForm usedColors={methods.map((m) => m.color)} initialType={tipo} />
    </div>
  );
}
