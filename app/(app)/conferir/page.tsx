import Link from "next/link";
import { getImport, listImports, loadReport, type ImportKind, type StatementImport } from "@/lib/statements/data";
import type { Fix, Issue, IssueType } from "@/lib/statements/compare";
import type { Extrato, Fatura } from "@/lib/statements/types";
import { STATEMENT_BANKS, statementBank } from "@/lib/statements/banks";
import { bankById } from "@/lib/payment-icons";
import { listCategories, listPaymentMethods, listSubcategories, withSubcategories, type PaymentMethod } from "@/lib/data";
import { formatBRL, formatShortDate, monthLabel } from "@/lib/format";
import { readParams, type SearchParams } from "@/lib/page";
import { Money, Panel } from "@/components/ui";
import { ApproveAllButton, IssueActions, UnignoreButton, UploadForm, type BankOption, type IssueAction } from "@/components/StatementClient";
import { deleteImportAction } from "@/app/statement-actions";

export const dynamic = "force-dynamic";

const TYPE: Record<IssueType, { label: string; tone: string }> = {
  valor: { label: "Valor diferente", tone: "bg-[#fdf3e1] text-[#7a4b00]" },
  faltando: { label: "Falta lançar", tone: "bg-[#e8eefc] text-[#2a4fb0]" },
  forma: { label: "Outra forma de pagamento", tone: "bg-[#fdf3e1] text-[#7a4b00]" },
  mes: { label: "Mês errado", tone: "bg-[#fdf3e1] text-[#7a4b00]" },
  pagar: { label: "Marcar como paga", tone: "bg-brand-soft text-brand" },
  duplicado: { label: "Lançado duas vezes", tone: "bg-danger-soft text-danger" },
  sobrando: { label: "Não está no banco", tone: "bg-danger-soft text-danger" },
  "nao-pago": { label: "Não saiu da conta", tone: "bg-danger-soft text-danger" },
};

/** A sugestão de cada problema, para a pessoa aprovar ou recusar. */
function actionFor(issue: Issue, keys: string[], methodName: (id: number) => string): IssueAction {
  const f: Fix = issue.fix;
  switch (f.kind) {
    case "criar":
      return {
        keys,
        label: "Lançar",
        icon: "valor",
        create: {
          kind: "gasto",
          name: f.name,
          categoryId: f.categoryId,
          subcategoryId: f.subcategoryId,
          unsure: f.source === "outros" || f.source === "nenhuma",
        },
      };
    case "criar-entrada":
      return { keys, label: "Lançar", icon: "valor", create: { kind: "entrada", name: f.name, categoryId: null, subcategoryId: null, unsure: false } };
    case "valor":
    case "valor-entrada":
      return { keys, label: `Corrigir o valor para ${formatBRL(Math.abs(f.amountCents))}`, icon: "valor" };
    case "mes":
      return { keys, label: `Mover para ${monthLabel(f.month, false).toLowerCase()}`, icon: "mes" };
    case "forma":
      return { keys, label: `Mudar para ${methodName(f.paymentMethodId)}`, icon: "forma" };
    case "excluir":
      return { keys, label: "Excluir do Atlas", icon: "excluir", danger: true };
    case "pago":
      return { keys, label: f.paid ? "Marcar como paga" : "Desmarcar como paga", icon: "pago" };
  }
}

function suggestionKey(issue: Issue) {
  const f = issue.fix;
  return f.kind === "criar" ? `${issue.key}|${f.name}|${f.categoryId}|${f.subcategoryId}|${f.source}` : f.kind === "criar-entrada" ? `${issue.key}|${f.name}` : issue.key;
}

/** Linhas iguais que faltam lançar (ex.: 9 estornos iguais no mesmo dia) viram uma só, com "9×". */
function groupIssues(issues: Issue[]) {
  const groups: { issue: Issue; keys: string[] }[] = [];
  const byKey = new Map<string, { issue: Issue; keys: string[] }>();
  for (const i of issues) {
    const k = i.type === "faltando" ? `${i.title}|${i.date}|${i.amountCents}|${i.fix.kind}|${i.detail}` : null;
    const g = k ? byKey.get(k) : undefined;
    if (g) g.keys.push(i.key);
    else {
      const ng = { issue: i, keys: [i.key] };
      groups.push(ng);
      if (k) byKey.set(k, ng);
    }
  }
  return groups;
}

/** A forma de pagamento mais provável: a de um banco que sabemos ler (hoje, Santander). */
function defaultMethod(methods: PaymentMethod[], kind: ImportKind) {
  const pool = methods.filter((m) => (kind === "fatura" ? m.isCredit : !m.isCredit && !["dinheiro", "vale"].includes(m.icon)));
  const readable = (m: PaymentMethod) => statementBank(m.bank) != null;
  return (
    pool.find((m) => readable(m) && (kind === "fatura" || m.icon === "conta")) ??
    pool.find((m) => readable(m)) ??
    pool.find((m) => kind === "fatura" || m.icon === "conta") ??
    pool[0] ??
    null
  );
}

function title(imp: StatementImport) {
  if (imp.kind === "fatura") return `Fatura de ${monthLabel(imp.month!, false).toLowerCase()}`;
  return `Extrato de ${formatShortDate(imp.from)} a ${formatShortDate(imp.to)}`;
}

/** Conferir com o banco: a fatura do cartão e o extrato da conta (hoje, do Santander) contra o Atlas. */
export default async function Conferir({ searchParams }: { searchParams: SearchParams }) {
  const { get } = await readParams(searchParams);
  const kind: ImportKind = get("aba") === "extrato" ? "extrato" : "fatura";
  const wanted = Number(get("id"));
  const [methods, imports, categories, subs] = await Promise.all([listPaymentMethods(), listImports(kind), listCategories(), listSubcategories()]);
  const current = (Number.isFinite(wanted) && wanted > 0 ? await getImport(wanted) : null) ?? imports.find((i) => i.kind === kind) ?? null;
  const loaded = current && current.kind === kind ? await loadReport(current) : null;
  const cats = withSubcategories(categories, subs);
  const methodName = (id: number) => methods.find((m) => m.id === id)?.name ?? "outra forma";
  const pool = methods.filter((m) => (kind === "fatura" ? m.isCredit : !m.isCredit && !["dinheiro", "vale"].includes(m.icon)));
  const def = defaultMethod(methods, kind);
  const banks: BankOption[] = STATEMENT_BANKS.map((b) => {
    const look = bankById(b.id);
    const f = kind === "fatura" ? b.fatura : b.extrato;
    return { id: b.id, name: b.name, initials: look?.initials ?? b.name.slice(0, 2).toUpperCase(), bg: look?.bg ?? "#172033", fg: look?.fg ?? "#fff", format: f.format, accept: f.accept, howTo: f.howTo };
  });
  const bankNames = STATEMENT_BANKS.map((b) => b.name).join(", ");

  const tab = (k: ImportKind, label: string) => (
    <Link
      href={`/conferir?aba=${k}`}
      aria-current={k === kind ? "page" : undefined}
      className={`rounded-full py-2 text-center text-[15px] font-semibold ${k === kind ? "bg-ink text-white" : "text-ink-2"}`}
    >
      {label}
    </Link>
  );

  return (
    <div className="lg:mx-auto lg:max-w-3xl">
      <header className="px-4 pt-[max(env(safe-area-inset-top),10px)] pb-3 lg:px-0 lg:pt-2 lg:pb-5">
        <h1 className="display text-[22px] font-bold tracking-tight lg:text-[28px]">Conferir com o banco</h1>
        <p className="text-[13.5px] text-ink-3">
          Envie o arquivo do banco: o Atlas mostra o que está diferente e já sugere a correção. Por enquanto, só {bankNames}.
        </p>
      </header>

      <div className="mx-4 mb-3 grid grid-cols-2 gap-1 rounded-full bg-surface p-1 lg:mx-0 lg:max-w-sm">
        {tab("fatura", "Fatura do cartão")}
        {tab("extrato", "Conta corrente")}
      </div>

      <div className="mx-3 mb-3 lg:mx-0">
        {pool.length ? (
          <UploadForm kind={kind} banks={banks} methods={pool.map((m) => ({ id: m.id, name: m.name }))} defaultMethodId={def?.id ?? null} />
        ) : (
          <Panel className="p-4 text-[14px] text-ink-2">
            Cadastre {kind === "fatura" ? "o cartão de crédito" : "a conta"} em{" "}
            <Link href="/configuracoes/pagamentos" className="font-semibold text-brand">
              Formas de pagamento
            </Link>{" "}
            antes de conferir.
          </Panel>
        )}
      </div>

      {loaded && <Report loaded={loaded} cats={cats} methodName={methodName} />}

      {imports.length > 1 && (
        <Panel className="mt-3">
          <h2 className="px-4 pt-3.5 pb-1 text-[14px] font-semibold text-ink-2">Envios anteriores</h2>
          <ul className="pb-2">
            {imports.map((i) => (
              <li key={i.id}>
                <Link
                  href={`/conferir?aba=${kind}&id=${i.id}`}
                  className={`flex items-center justify-between px-4 py-2 text-[14.5px] hover:bg-paper/60 ${i.id === loaded?.imp.id ? "font-semibold" : ""}`}
                >
                  <span>{title(i)}</span>
                  <span className="text-[12.5px] text-ink-3">
                    {statementBank(i.bank)?.name ?? i.bank} · {methodName(i.paymentMethodId)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}

function Report({
  loaded,
  cats,
  methodName,
}: {
  loaded: Awaited<ReturnType<typeof loadReport>>;
  cats: ReturnType<typeof withSubcategories>;
  methodName: (id: number) => string;
}) {
  const { imp, report, method } = loaded;
  const fatura = imp.kind === "fatura" ? (imp.data as Fatura) : null;
  const extrato = imp.kind === "extrato" ? (imp.data as Extrato) : null;
  const groups = groupIssues(report.issues);
  const n = groups.length;
  const safe = groups.filter((g) => g.issue.safe).length;
  const diff = report.atlasCents - report.bankCents;

  return (
    <div className="flex flex-col gap-3">
      {/* Resultado */}
      <Panel className="p-4 lg:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="display text-[19px] font-bold">{title(imp)}</h2>
            <p className="text-[13px] text-ink-3">
              {[statementBank(imp.bank)?.name ?? imp.bank, method?.name]
                .filter((x, i, all): x is string => !!x && all.indexOf(x) === i)
                .join(" · ")}
              {fatura && ` · compras de ${formatShortDate(fatura.periodFrom)} a ${formatShortDate(fatura.closing)}`}
              {fatura?.due && ` · vence ${formatShortDate(fatura.due)}`}
            </p>
          </div>
          {n === 0 ? (
            <span className="shrink-0 rounded-full bg-brand-soft px-3 py-1.5 text-[13.5px] font-semibold text-brand">✓ Tudo certo</span>
          ) : (
            <span className="shrink-0 rounded-full bg-[#fdf3e1] px-3 py-1.5 text-[13.5px] font-semibold text-[#7a4b00]">
              {n} para aprovar
            </span>
          )}
        </div>

        <dl className="mt-4 grid grid-cols-3 gap-2 text-[12.5px]">
          <div className="rounded-2xl bg-paper px-3 py-2.5">
            <dt className="text-ink-3">{fatura ? "Na fatura" : "Saiu da conta"}</dt>
            <dd>
              <Money cents={report.bankCents} className="text-[15px] font-semibold" />
            </dd>
          </div>
          <div className="rounded-2xl bg-paper px-3 py-2.5">
            <dt className="text-ink-3">No Atlas</dt>
            <dd>
              <Money cents={report.atlasCents} className="text-[15px] font-semibold" />
            </dd>
          </div>
          <div className={`rounded-2xl px-3 py-2.5 ${diff === 0 ? "bg-brand-soft" : "bg-[#fdf3e1]"}`}>
            <dt className="text-ink-3">Diferença</dt>
            <dd className={diff === 0 ? "text-brand" : "text-[#7a4b00]"}>
              <Money cents={diff} signed className="text-[15px] font-semibold" />
            </dd>
          </div>
        </dl>
        {fatura && fatura.summary.total != null && fatura.summary.total !== report.bankCents && (
          <p className="mt-2 text-[12.5px] text-ink-3">
            O total a pagar ({formatBRL(fatura.summary.total)}) inclui o saldo da fatura anterior menos o pagamento; a conferência usa só as
            compras e créditos desta fatura.
          </p>
        )}
        {extrato && (
          <p className="mt-2 text-[12.5px] text-ink-3">Sem transferências suas, aplicações e o pagamento da fatura do cartão.</p>
        )}
        {fatura && !fatura.check.ok && (
          <p className="mt-3 rounded-xl bg-danger-soft px-3 py-2 text-[13px] text-danger">{fatura.check.message} Confira os itens com atenção.</p>
        )}
        {safe === 0 && n > 0 && <p className="mt-3 text-[12.5px] text-ink-3">Aprove ou recuse cada item abaixo.</p>}
        {safe > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <ApproveAllButton importId={imp.id} count={safe} />
            {safe < n && <span className="text-[12.5px] text-ink-3">Exclusões e categorias a conferir você aprova uma por uma.</span>}
          </div>
        )}
        {report.ignored > 0 && (
          <div className="mt-3">
            <UnignoreButton importId={imp.id} count={report.ignored} />
          </div>
        )}
      </Panel>

      {/* O que corrigir */}
      {n > 0 && (
        <Panel>
          <p className="px-4 pt-3 pb-1 text-[12.5px] text-ink-3">
            Cada item já vem com a correção sugerida: aprove ou recuse. Toque no nome para mudar a categoria.
          </p>
          <ul className="divide-y divide-line/60">
            {groups.map(({ issue, keys }) => (
              <li key={issue.key} className="px-4 py-3">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${TYPE[issue.type].tone}`}>
                        {TYPE[issue.type].label}
                      </span>
                      {issue.date && <span className="shrink-0 text-[12.5px] text-ink-3">{formatShortDate(issue.date)}</span>}
                    </div>
                    <div className="mt-1 truncate text-[15px] font-medium">
                      {keys.length > 1 && <span className="num mr-1 text-ink-3">{keys.length}×</span>}
                      {issue.title}
                    </div>
                    {issue.detail && <div className="text-[13px] text-ink-2">{issue.detail}</div>}
                  </div>
                  <Money cents={issue.amountCents} className="shrink-0 text-[15px] font-semibold" />
                </div>
                {/* A chave muda com a sugestão: depois de aprovar uma linha, as iguais já aparecem com a nova categoria */}
                <IssueActions key={suggestionKey(issue)} importId={imp.id} action={actionFor(issue, keys, methodName)} categories={cats} />
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {report.matched.length > 0 && (
        <Panel>
          <details>
            <summary className="flex items-center justify-between px-4 py-3.5 text-[14.5px] font-semibold">
              ✓ {report.matched.length} {report.matched.length === 1 ? "bateu" : "bateram"} com o Atlas
              <span className="text-[12.5px] font-medium text-ink-3">ver</span>
            </summary>
            <ul className="divide-y divide-line/60 border-t border-line/60">
              {report.matched.map((m, i) => (
                <li key={i} className="flex items-center gap-3 px-4 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px]">{m.title}</div>
                    <div className="truncate text-[12.5px] text-ink-3">
                      {m.date ? `${formatShortDate(m.date)} · ` : ""}
                      {m.entryName}
                    </div>
                  </div>
                  <Money cents={m.amountCents} className="text-[14px]" />
                </li>
              ))}
            </ul>
          </details>
        </Panel>
      )}

      {report.skipped.length > 0 && (
        <Panel>
          <details>
            <summary className="flex items-center justify-between px-4 py-3.5 text-[14.5px] font-semibold">
              {report.skipped.length} {report.skipped.length === 1 ? "não precisa" : "não precisam"} de lançamento
              <span className="text-[12.5px] font-medium text-ink-3">ver</span>
            </summary>
            <ul className="divide-y divide-line/60 border-t border-line/60">
              {report.skipped.map((s, i) => (
                <li key={i} className="flex items-center gap-3 px-4 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px]">{s.title}</div>
                    <div className="truncate text-[12.5px] text-ink-3">
                      {formatShortDate(s.date)} · {s.reason}
                    </div>
                  </div>
                  <Money cents={s.amountCents} className="text-[14px]" />
                </li>
              ))}
            </ul>
          </details>
        </Panel>
      )}

      <form action={deleteImportAction} className="px-4 lg:px-0">
        <input type="hidden" name="importId" value={imp.id} />
        <input type="hidden" name="kind" value={imp.kind} />
        <button type="submit" className="text-[13px] font-semibold text-ink-3 hover:text-danger">
          Apagar este envio ({imp.fileName ?? title(imp)})
        </button>
      </form>
    </div>
  );
}
