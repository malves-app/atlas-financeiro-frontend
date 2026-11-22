import { getSupabase } from "./supabase/server";
import { must } from "./must";
import type { Investment, InvestmentKind, Move, MoveKind } from "./investments";

// Leitura e escrita dos investimentos (tabelas investments e investment_moves, com RLS: só o dono).
// Fica à parte de lib/data.ts: os investimentos não mexem no resto do site.

type R = Record<string, unknown>;

const toInvestment = (r: R): Investment => ({
  id: Number(r.id),
  name: String(r.name),
  kind: r.kind as InvestmentKind,
  institution: (r.institution as string | null) ?? null,
  targetCents: r.target_cents == null ? null : Number(r.target_cents),
  archived: Boolean(r.archived),
});

const toMove = (r: R): Move => ({
  id: Number(r.id),
  investmentId: Number(r.investment_id),
  kind: r.kind as MoveKind,
  amountCents: Number(r.amount_cents),
  date: String(r.date),
  note: (r.note as string | null) ?? null,
});

export async function listInvestments(): Promise<Investment[]> {
  const sb = await getSupabase();
  const rows = must(await sb.from("investments").select("*").order("id"), "ler os investimentos") as R[];
  return rows.map(toInvestment);
}

export async function getInvestment(id: number): Promise<Investment | null> {
  if (!Number.isSafeInteger(id)) return null;
  const sb = await getSupabase();
  const row = must(await sb.from("investments").select("*").eq("id", id).maybeSingle(), "ler o investimento") as R | null;
  return row ? toInvestment(row) : null;
}

/** Movimentações (de um investimento ou de todos), lidas de 1000 em 1000. */
export async function listMoves(investmentId?: number): Promise<Move[]> {
  const sb = await getSupabase();
  const out: Move[] = [];
  for (let from = 0; ; from += 1000) {
    let q = sb.from("investment_moves").select("id, investment_id, kind, amount_cents, date, note");
    if (investmentId != null) q = q.eq("investment_id", investmentId);
    const rows = must(await q.order("date").order("id").range(from, from + 999), "ler as movimentações") as R[];
    out.push(...rows.map(toMove));
    if (rows.length < 1000) break;
  }
  return out;
}

export interface InvestmentInput {
  name: string;
  kind: InvestmentKind;
  institution: string | null;
  targetCents: number | null;
}

export async function createInvestment(i: InvestmentInput): Promise<number> {
  const sb = await getSupabase();
  const row = must(
    await sb
      .from("investments")
      .insert({ name: i.name, kind: i.kind, institution: i.institution, target_cents: i.targetCents })
      .select("id")
      .single(),
    "criar o investimento",
  ) as R;
  return Number(row.id);
}

export async function updateInvestment(id: number, i: InvestmentInput) {
  const sb = await getSupabase();
  must(
    await sb
      .from("investments")
      .update({ name: i.name, kind: i.kind, institution: i.institution, target_cents: i.targetCents })
      .eq("id", id),
    "salvar o investimento",
  );
}

export async function setInvestmentArchived(id: number, archived: boolean) {
  const sb = await getSupabase();
  must(await sb.from("investments").update({ archived }).eq("id", id), archived ? "encerrar o investimento" : "reabrir o investimento");
}

/** Apaga o investimento e todas as movimentações dele. */
export async function deleteInvestment(id: number) {
  const sb = await getSupabase();
  must(await sb.from("investments").delete().eq("id", id), "apagar o investimento");
}

export async function createMove(m: Omit<Move, "id">) {
  const sb = await getSupabase();
  must(
    await sb.from("investment_moves").insert({
      investment_id: m.investmentId,
      kind: m.kind,
      amount_cents: m.amountCents,
      date: m.date,
      note: m.note,
    }),
    "registrar a movimentação",
  );
}

export async function deleteMove(id: number) {
  const sb = await getSupabase();
  must(await sb.from("investment_moves").delete().eq("id", id), "excluir a movimentação");
}
