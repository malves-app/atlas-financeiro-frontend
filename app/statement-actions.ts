"use server";

// Conferir com o banco: enviar a fatura ou o extrato (hoje, do Santander) e aprovar as correções no Atlas.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as st from "@/lib/statements/data";
import { readStatement, statementBank, STATEMENT_BANKS } from "@/lib/statements/banks";
import { listPaymentMethods } from "@/lib/data";

export type StatementState = { error?: string; ok?: boolean; message?: string; at?: number } | undefined;

const MAX_BYTES = 5 * 1024 * 1024;
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const int = (f: FormData, k: string) => {
  const n = Number(str(f, k));
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
};
const fail = (e: unknown): StatementState => ({ error: e instanceof Error ? e.message : String(e), at: Date.now() });
const done = (message: string): StatementState => {
  revalidatePath("/", "layout");
  return { ok: true, message, at: Date.now() };
};

/** Lê o arquivo enviado, guarda o que foi lido e abre a conferência. */
export async function uploadStatement(_: StatementState, f: FormData): Promise<StatementState> {
  const kind = str(f, "kind") === "extrato" ? "extrato" : "fatura";
  const file = f.get("file");
  const methodId = int(f, "paymentMethodId");
  if (!(file instanceof File) || file.size === 0) return { error: "Escolha o arquivo.", at: Date.now() };
  if (file.size > MAX_BYTES) return { error: "Arquivo grande demais (máximo 5 MB).", at: Date.now() };
  const method = (await listPaymentMethods()).find((m) => m.id === methodId);
  if (!method) return { error: "Escolha a forma de pagamento.", at: Date.now() };
  if (kind === "fatura" && !method.isCredit) return { error: "A fatura é de um cartão de crédito: escolha o cartão.", at: Date.now() };
  const bank = statementBank(str(f, "bank")) ?? statementBank(method.bank) ?? STATEMENT_BANKS[0];

  let id: number;
  try {
    const data = await readStatement(bank.id, kind, new Uint8Array(await file.arrayBuffer()));
    id = await st.saveImport({ kind, bank: bank.id, paymentMethodId: method.id, fileName: file.name, data });
    // O que já bateu com o Atlas ensina como lançar o resto (e as próximas faturas)
    await st.learnFromImport(id);
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/", "layout");
  redirect(`/conferir?aba=${kind}&id=${id}`);
}

/** Aplica a correção sugerida de um problema (com nome e categoria, se a pessoa mudou). */
const keys = (f: FormData) => f.getAll("key").map((k) => String(k).trim()).filter(Boolean).slice(0, 200);

export async function fixAction(_: StatementState, f: FormData): Promise<StatementState> {
  const importId = int(f, "importId");
  const key = keys(f);
  if (!importId || !key.length) return fail(new Error("Problema inválido."));
  const has = (k: string) => f.has(k);
  try {
    await st.fixIssue(importId, key, {
      name: has("name") ? str(f, "name") : undefined,
      categoryId: has("categoryId") ? int(f, "categoryId") : undefined,
      subcategoryId: has("subcategoryId") ? int(f, "subcategoryId") : undefined,
    });
    return done(key.length > 1 ? `${key.length} aprovados` : "Aprovado");
  } catch (e) {
    return fail(e);
  }
}

export async function fixAllAction(_: StatementState, f: FormData): Promise<StatementState> {
  const importId = int(f, "importId");
  if (!importId) return fail(new Error("Arquivo inválido."));
  try {
    const r = await st.fixAll(importId);
    if (r.failed.length && !r.done) return fail(new Error(r.failed[0]));
    return done(`${r.done} ${r.done === 1 ? "sugestão aprovada" : "sugestões aprovadas"}${r.failed.length ? ` · ${r.failed.length} não deram certo` : ""}`);
  } catch (e) {
    return fail(e);
  }
}

export async function ignoreAction(_: StatementState, f: FormData): Promise<StatementState> {
  const importId = int(f, "importId");
  const key = keys(f);
  if (!importId || !key.length) return fail(new Error("Problema inválido."));
  try {
    await st.ignoreIssue(importId, key);
    return done(key.length > 1 ? `${key.length} recusados` : "Recusado");
  } catch (e) {
    return fail(e);
  }
}

export async function unignoreAction(_: StatementState, f: FormData): Promise<StatementState> {
  const importId = int(f, "importId");
  if (!importId) return fail(new Error("Arquivo inválido."));
  try {
    await st.unignoreAll(importId);
    return done("Recusados voltaram para a lista");
  } catch (e) {
    return fail(e);
  }
}

export async function deleteImportAction(f: FormData) {
  const importId = int(f, "importId");
  const kind = str(f, "kind") === "extrato" ? "extrato" : "fatura";
  if (importId) await st.deleteImport(importId);
  revalidatePath("/", "layout");
  redirect(`/conferir?aba=${kind}`);
}
