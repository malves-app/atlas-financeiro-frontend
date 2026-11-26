import { getUserEmail, listCategories, listPaymentMethods, listSubcategories } from "@/lib/data";
import { Avatar, CARD_GLYPH, CategoryCircle, Glyph, PaymentBadge, PreviewStack, SettingsCard, TAG_GLYPH, USER_GLYPH } from "@/components/SettingsVisuals";

export const dynamic = "force-dynamic";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Configurações: visão geral. Cada cartão leva à subpágina com os detalhes e as ações. */
export default async function Configuracoes() {
  // As formas de pagamento vêm antes das categorias (conta nova: cria as padrão primeiro)
  const methodsP = listPaymentMethods();
  const [methods, categories, subs, email] = await Promise.all([
    methodsP,
    methodsP.then(() => listCategories()),
    methodsP.then(() => listSubcategories()),
    getUserEmail(),
  ]);
  const activeCats = new Set(categories.map((c) => c.id));
  const subCount = subs.filter((s) => activeCats.has(s.categoryId)).length;
  const cards = methods.filter((m) => m.isCredit).length;
  const SHOW = 5;

  return (
    <>
      <header className="px-4 pt-[max(env(safe-area-inset-top),10px)] pb-3 lg:px-0 lg:pt-2 lg:pb-5">
        <h1 className="display text-[22px] font-bold tracking-tight lg:text-[28px]">Configurações</h1>
      </header>

      <div className="grid gap-3 lg:grid-cols-2 lg:gap-4">
        <SettingsCard
          href="/configuracoes/pagamentos"
          glyph={<Glyph d={CARD_GLYPH} />}
          title="Formas de pagamento"
          summary={`${plural(methods.length, "forma", "formas")}${cards ? ` · ${plural(cards, "cartão de crédito", "cartões de crédito")}` : ""}`}
          preview={
            <PreviewStack
              items={methods.slice(0, SHOW).map((m) => (
                <PaymentBadge key={m.id} icon={m.icon} bank={m.bank} color={m.color} corner={false} />
              ))}
              more={methods.length - SHOW}
            />
          }
        />
        <SettingsCard
          href="/configuracoes/categorias"
          glyph={<Glyph d={TAG_GLYPH} />}
          title="Categorias"
          summary={`${plural(categories.length, "categoria", "categorias")}${subCount ? ` · ${plural(subCount, "subcategoria", "subcategorias")}` : ""}`}
          preview={
            <PreviewStack
              items={categories.slice(0, SHOW + 1).map((c) => (
                <CategoryCircle key={c.id} emoji={c.emoji} size="md" className="size-10 text-[19px]" />
              ))}
              more={categories.length - (SHOW + 1)}
              round
            />
          }
        />
        <SettingsCard
          href="/configuracoes/conta"
          glyph={<Glyph d={USER_GLYPH} />}
          title="Conta"
          summary="E-mail e acesso"
          className="lg:col-span-2"
          preview={
            <span className="flex min-w-0 items-center gap-3">
              <Avatar email={email} className="size-10 text-[16px]" />
              <span className="min-w-0">
                <span className="block text-[12.5px] text-ink-3">Conectado como</span>
                <span className="block truncate text-[14.5px] font-medium">{email ?? "—"}</span>
              </span>
            </span>
          }
        />
      </div>
    </>
  );
}
