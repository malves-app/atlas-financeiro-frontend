import { Modal } from "@/components/Modal";

// Novo investimento aberto a partir de qualquer tela: janela no computador, folha que sobe no celular.
export default function NovoInvestimentoModalLayout({ children }: { children: React.ReactNode }) {
  return <Modal label="Novo investimento">{children}</Modal>;
}
