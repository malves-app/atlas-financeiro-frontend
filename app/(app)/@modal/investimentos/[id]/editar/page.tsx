// Ao navegar para esta página, a janela de lançar/editar fecha.
// (Rotas explícitas em vez de um [...catchAll], que no modo dev capturava /login e /cadastro.)
export default function Closed() {
  return null;
}
