import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategory, listSubcategories } from "@/lib/data";
import { suggestedSubcategories } from "@/lib/category-icons";
import { archiveCategoryAction } from "@/app/actions";
import { CategoryForm, SubcategoryManager } from "@/components/SettingsForms";
import { SettingsTopBar } from "@/components/SettingsVisuals";
import { DeleteButton } from "@/components/DeleteButton";
import { Chevron } from "@/components/ui";
import { TargetGlyph } from "@/components/PageHeaders";

export const dynamic = "force-dynamic";

/** Detalhes de uma categoria: nome e ícone, subcategorias, limite (Metas) e remover. */
export default async function Categoria({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [category, allSubs] = await Promise.all([getCategory(Number(id)), listSubcategories()]);
  if (!category) notFound();
  const subs = allSubs.filter((s) => s.categoryId === category.id);

  return (
    <div className="pb-8 lg:mx-auto lg:max-w-2xl">
      <SettingsTopBar title="Categoria" back="/configuracoes/categorias" />

      <div className="space-y-4">
        <CategoryForm category={category} subCount={subs.length} />

        <section className="mx-3 rounded-[20px] bg-surface lg:mx-0">
          <div className="flex items-baseline justify-between gap-3 px-4 pt-4 pb-2">
            <h2 className="text-[15px] font-semibold">Subcategorias</h2>
            <span className="num text-[13px] text-ink-3">{subs.length}</span>
          </div>
          <SubcategoryManager
            categoryId={category.id}
            categoryEmoji={category.emoji}
            subs={subs.map(({ id, name, emoji }) => ({ id, name, emoji }))}
            suggestions={suggestedSubcategories(category.name)}
          />
        </section>

        <Link
          href="/metas/nova?tipo=categoria"
          className="mx-3 flex items-center gap-3.5 rounded-[20px] bg-surface px-4 py-3.5 hover:bg-white lg:mx-0"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#fbf1df] text-[#b37410]">
            <TargetGlyph className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold">Limite de gastos</span>
            <span className="block text-[13px] text-ink-3">Crie uma meta mensal para {category.name}</span>
          </span>
          <Chevron className="size-5 shrink-0 text-ink-3" />
        </Link>

        <div className="mx-3 rounded-[20px] bg-surface px-4 pt-4 lg:mx-0">
          <h2 className="text-[15px] font-semibold">Remover categoria</h2>
          <p className="mt-1 mb-3 text-[14px] text-ink-2">
            Ela sai das opções do lançamento, com as subcategorias. Os gastos antigos continuam com ela nos meses e nas estatísticas.
          </p>
          <DeleteButton action={archiveCategoryAction} fields={{ id: String(category.id) }} label="Remover categoria" confirmLabel="Remover" />
        </div>
      </div>
    </div>
  );
}
