import { Modal } from "@/components/Modal";

// A janela abre já no toque (com o skeleton do formulário dentro) e continua a mesma quando os dados chegam.
export default function NovoModalLayout({ children }: { children: React.ReactNode }) {
  return <Modal label="Novo lançamento">{children}</Modal>;
}
