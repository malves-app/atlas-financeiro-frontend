import Link from "next/link";
import { listCategories, listPaymentMethods } from "@/lib/data";
import { readParams, type SearchParams } from "@/lib/page";
import { RecurringForm } from "@/components/RecurringForm";

export const dynamic = "force-dynamic";

export default async function NovoFixo({ searchParams }: { searchParams: SearchParams }) {
  const { month } = await readParams(searchParams);
  const [categories, methods] = await Promise.all([listCategories(), listPaymentMethods()]);
  return (
    <div className="lg:mx-auto lg:max-w-xl">
      <header className="flex items-center gap-2 px-2 pt-[max(env(safe-area-inset-top),10px)] pb-1 lg:px-0 lg:pt-2 lg:pb-4">
        <Link href={`/fixos?m=${month}`} aria-label="Voltar" className="grid size-10 place-items-center rounded-full text-ink-2 hover:bg-surface">
          <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </Link>
        <h1 className="display text-[20px] font-bold">Novo fixo</h1>
      </header>
      <RecurringForm categories={categories.map(({ id, name, emoji }) => ({ id, name, emoji }))} methods={methods} month={month} />
    </div>
  );
}
