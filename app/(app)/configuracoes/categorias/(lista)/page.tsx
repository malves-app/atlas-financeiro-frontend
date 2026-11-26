import Link from "next/link";
import { listCategories, listPaymentMethods, listSubcategories } from "@/lib/data";
import { Chevron, Panel } from "@/components/ui";
import { AddButton, CategoryCircle, SettingsTopBar } from "@/components/SettingsVisuals";

export const dynamic = "force-dynamic";

/** Categorias: cada uma com as subcategorias. Toque para ver detalhes e ações. */
export default async function Categorias() {
  // As formas de pagamento vêm antes das categorias (conta nova: cria as padrão primeiro)
  const methodsP = listPaymentMethods();
  const [categories, subs] = await Promise.all([methodsP.then(() => listCategories()), methodsP.then(() => listSubcategories())]);
  const subsOf = (id: number) => subs.filter((s) => s.categoryId === id);
  const SHOW = 5;

  return (
    <div className="lg:mx-auto lg:max-w-2xl">
      <SettingsTopBar title="Categorias" back="/configuracoes" right={<AddButton href="/configuracoes/categorias/nova" label="Nova categoria" />} />
      <p className="mx-5 -mt-1 mb-4 text-[14px] text-ink-2 lg:mx-1">
        Categorias amplas com subcategorias dentro (ex.: Alimentação → Supermercado, Restaurante). O limite de cada uma fica em{" "}
        <Link href="/metas/nova?tipo=categoria" className="font-semibold text-brand">
          Metas
        </Link>
        .
      </p>

      <Panel>
        <ul className="divide-y divide-line/60 py-1">
          {categories.map((c) => {
            const list = subsOf(c.id);
            return (
              <li key={c.id}>
                <Link href={`/configuracoes/categorias/${c.id}`} className="flex items-center gap-3.5 px-4 py-3 hover:bg-paper/60">
                  <CategoryCircle emoji={c.emoji} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15.5px] font-medium">{c.name}</span>
                    {list.length ? (
                      // Ícones das subcategorias em fila + os nomes numa linha só
                      <span className="mt-0.5 flex min-w-0 items-center gap-2 text-[13px] text-ink-3">
                        {list.some((s) => s.emoji) && (
                          <span aria-hidden className="shrink-0 text-[14px] tracking-[0.12em]">
                            {list
                              .filter((s) => s.emoji)
                              .slice(0, SHOW)
                              .map((s) => s.emoji)
                              .join("")}
                          </span>
                        )}
                        <span className="min-w-0 truncate">{list.map((s) => s.name).join(", ")}</span>
                      </span>
                    ) : (
                      <span className="block text-[13px] text-ink-3">Sem subcategorias</span>
                    )}
                  </span>
                  <Chevron className="size-5 shrink-0 text-ink-3" />
                </Link>
              </li>
            );
          })}
        </ul>
        {categories.length === 0 && <p className="px-4 py-6 text-center text-[15px] text-ink-3">Nenhuma categoria ainda.</p>}
      </Panel>

      <Link
        href="/configuracoes/categorias/nova"
        className="mx-3 mt-4 flex items-center justify-center gap-2 rounded-[20px] border-[1.5px] border-dashed border-line py-3.5 text-[15px] font-semibold text-brand hover:border-brand/40 hover:bg-brand-soft/50 lg:mx-0"
      >
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
          <path d="M12 5v14M5 12h14" />
        </svg>
        Nova categoria
      </Link>
    </div>
  );
}
