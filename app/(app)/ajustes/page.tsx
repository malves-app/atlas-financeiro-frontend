import { getUserEmail, listCategories, listPaymentMethods } from "@/lib/data";
import { logout } from "@/app/actions";
import { Panel, SectionTitle } from "@/components/ui";
import { CategoryRow, ImportForm, PaymentMethodRow } from "@/components/SettingsForms";

export const dynamic = "force-dynamic";

export default async function Ajustes() {
  const methods = await listPaymentMethods();
  const [categories, email] = await Promise.all([listCategories(), getUserEmail()]);
  const usedColors = methods.map((m) => m.color);
  return (
    <>
      <header className="px-4 pt-[max(env(safe-area-inset-top),10px)] pb-2 lg:px-0 lg:pt-2 lg:pb-4">
        <h1 className="display text-[22px] font-bold tracking-tight lg:text-[28px]">Ajustes</h1>
      </header>

      <div className="flex flex-col gap-3 lg:gap-4">
        <div className="contents">
          <Panel>
            <SectionTitle>Formas de pagamento</SectionTitle>
            <p className="-mt-1 px-4 pb-2 text-[14px] text-ink-2">
              O “Tipo” de cada gasto, como na seção Saídas da planilha. Cartões de crédito têm dia de fechamento: compras
              depois dele contam no mês seguinte.
            </p>
            <ul className="pb-1">
              {methods.map((m) => (
                <li key={m.id}>
                  <PaymentMethodRow m={m} usedColors={usedColors} />
                </li>
              ))}
              <li className="border-t border-line">
                <PaymentMethodRow usedColors={usedColors} />
              </li>
            </ul>
          </Panel>

          <Panel>
            <div id="importar" className="scroll-mt-4">
              <SectionTitle>Importar da planilha do Google</SectionTitle>
            </div>
            <p className="-mt-1 px-4 pb-3 text-[14px] text-ink-2">
              Lê as abas de janeiro a novembro: fixos da conta, fixos e parcelas do cartão, gastos do mês, entradas e as formas
              de pagamento da seção Saídas. Os fixos de novembro viram os fixos que o site repete nos próximos meses.
            </p>
            <ImportForm />
          </Panel>
        </div>

        <div className="contents">
          <Panel>
            <SectionTitle>Categorias</SectionTitle>
            <p className="-mt-1 px-4 pb-2 text-[14px] text-ink-2">
              Toque para mudar nome, emoji ou o valor previsto por mês. O previsto aparece no painel.
            </p>
            <ul className="pb-1">
              {categories.map((c) => (
                <li key={c.id}>
                  <CategoryRow c={c} />
                </li>
              ))}
              <li className="border-t border-line">
                <CategoryRow />
              </li>
            </ul>
          </Panel>

          <form action={logout} className="mx-4 lg:mx-0">
            {email && <p className="mb-2 text-center text-[13px] text-ink-3">Conectado como {email}</p>}
            <button type="submit" className="w-full rounded-full border border-line bg-surface py-3 text-[15px] font-semibold text-ink-2">
              Sair
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
