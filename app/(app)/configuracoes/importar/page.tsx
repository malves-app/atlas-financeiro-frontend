import { ImportForm } from "@/components/SettingsForms";
import { SettingsTopBar } from "@/components/SettingsVisuals";
import { Panel } from "@/components/ui";

export const dynamic = "force-dynamic";

/**
 * Importar da planilha do Google. Fica fora do menu e da tela de Configurações:
 * só abre pelo endereço /configuracoes/importar.
 */
export default function Importar() {
  return (
    <div className="pb-8 lg:mx-auto lg:max-w-2xl">
      <SettingsTopBar title="Importar planilha" subtitle="Planilha do Google" back="/configuracoes" />
      <Panel>
        <p className="px-4 pt-4 pb-3 text-[14px] text-ink-2">
          Lê as abas de janeiro a novembro: fixos da conta, fixos e parcelas do cartão, gastos do mês, entradas e as formas de
          pagamento da seção Saídas. Os fixos de novembro viram os fixos que o site repete nos próximos meses.
        </p>
        <ImportForm />
      </Panel>
    </div>
  );
}
