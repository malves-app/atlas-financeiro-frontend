import { Modal } from "@/components/Modal";

export default function EditarLancamentoModalLayout({ children }: { children: React.ReactNode }) {
  return <Modal label="Editar lançamento">{children}</Modal>;
}
