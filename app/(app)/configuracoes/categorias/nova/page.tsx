import { CategoryForm } from "@/components/SettingsForms";
import { SettingsTopBar } from "@/components/SettingsVisuals";

export default function NovaCategoria() {
  return (
    <div className="pb-8 lg:mx-auto lg:max-w-2xl">
      <SettingsTopBar title="Nova categoria" back="/configuracoes/categorias" />
      <CategoryForm />
    </div>
  );
}
