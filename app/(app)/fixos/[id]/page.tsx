import Link from "next/link";
import { notFound } from "next/navigation";
import { getRecurring, listCategories, listPaymentMethods } from "@/lib/data";
import { monthLabel, monthPhrase, shiftMonth } from "@/lib/format";
import { readParams, type SearchParams } from "@/lib/page";
import { RecurringForm } from "@/components/RecurringForm";
import { endRecurringAction } from "@/app/actions";
import { SubmitButton } from "@/components/SubmitButton";

export const dynamic = "force-dynamic";

export default async function EditarFixo({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { id } = await params;
  const { month } = await readParams(searchParams);
  const [recurring, categories, methods] = await Promise.all([getRecurring(Number(id)), listCategories(), listPaymentMethods()]);
  if (!recurring) notFound();
  const endOptions = Array.from({ length: 14 }, (_, i) => shiftMonth(month, i - 1));

  return (
    <div className="lg:mx-auto lg:max-w-xl">
      <header className="flex items-center gap-2 px-2 pt-[max(env(safe-area-inset-top),10px)] pb-1 lg:px-0 lg:pt-2 lg:pb-4">
        <Link href={`/fixos?m=${month}`} aria-label="Voltar" className="grid size-10 place-items-center rounded-full text-ink-2 hover:bg-surface">
          <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </Link>
        <h1 className="display text-[20px] font-bold">{recurring.kind === "cartao" ? "Fixo do cartão" : "Conta fixa"}</h1>
      </header>

      <RecurringForm categories={categories.map(({ id, name, emoji }) => ({ id, name, emoji }))} methods={methods} month={month} recurring={recurring} />

      <form action={endRecurringAction} className="mx-5 mt-8 mb-6 rounded-2xl bg-surface p-4">
        <input type="hidden" name="id" value={recurring.id} />
        <input type="hidden" name="month" value={month} />
        <h2 className="text-[15px] font-semibold">Encerrar este fixo</h2>
        <p className="mt-1 text-[14px] text-ink-2">
          {recurring.endMonth
            ? `Hoje ele vai até ${monthPhrase(recurring.endMonth)}.`
            : "Ele deixa de aparecer depois do mês escolhido. Meses anteriores ficam como estão."}
        </p>
        <div className="mt-3 flex gap-2">
          <select name="lastMonth" defaultValue={shiftMonth(month, -1)} aria-label="Último mês" className="flex-1 rounded-xl border border-line bg-surface px-3 py-2.5">
            {endOptions.map((m) => (
              <option key={m} value={m}>
                Último mês: {monthLabel(m)}
              </option>
            ))}
          </select>
          <SubmitButton tone="light" pendingLabel="Encerrando…" loaderClassName="size-4" className="rounded-full bg-danger-soft px-4 py-2.5 text-[14px] font-semibold text-danger">
            Encerrar
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}
