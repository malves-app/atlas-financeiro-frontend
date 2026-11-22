import { Modal } from "@/components/Modal";

// Nova meta aberta a partir de qualquer tela: janela no computador, folha que sobe no celular.
export default function NovaMetaModalLayout({ children }: { children: React.ReactNode }) {
  return <Modal label="Nova meta">{children}</Modal>;
}
