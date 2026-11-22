import { Modal } from "@/components/Modal";

export default function EditarEntradaModalLayout({ children }: { children: React.ReactNode }) {
  return <Modal label="Editar entrada">{children}</Modal>;
}
