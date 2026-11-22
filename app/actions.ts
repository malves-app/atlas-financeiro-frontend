"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as data from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { isMonth, monthPhrase, parseAmountInput, referenceMonth, currentMonth } from "@/lib/format";
import { findConflict, isGoalKind, KIND_INFO } from "@/lib/goals";
import { importFromGoogleSheet, type ImportReport } from "@/lib/import/sheet";

/** ok/again/at: usados no modo modal (o formulário fecha ou limpa sozinho em vez de mudar de página). */
export type FormState = { error?: string; ok?: boolean; again?: boolean; at?: number } | undefined;

const isModal = (f: FormData) => f.get("mode") === "modal";
function modalDone(f: FormData): FormState {
  revalidatePath("/", "layout");
  return { ok: true, again: f.get("again") === "1", at: Date.now() };
}

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const optInt = (f: FormData, k: string) => {
  const v = str(f, k);
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};
const validDate = (s: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null);

function done(path: string): never {
  revalidatePath("/", "layout");
  redirect(path);
}

/* ---------- gastos ---------- */

export async function saveEntry(_: FormState, f: FormData): Promise<FormState> {
  const id = optInt(f, "id");
  const amount = parseAmountInput(str(f, "amount"));
  const name = str(f, "name");
  const paymentMethodId = optInt(f, "paymentMethodId");
  const date = validDate(str(f, "date"));
  const categoryId = optInt(f, "categoryId");
  const back = str(f, "back") || "/";

  if (amount == null || amount === 0) return { error: "Informe o valor." };
  if (!name) return { error: "Dê um nome ao gasto (ex.: Assaí, Uber)." };
  if (!paymentMethodId) return { error: "Escolha a forma de pagamento." };

  let month = str(f, "month");
  if (!isMonth(month)) {
    const method = (await data.listPaymentMethods()).find((m) => m.id === paymentMethodId);
    month = date ? referenceMonth(date, method) : currentMonth();
  }

  if (id) {
    const existing = await data.getEntry(id);
    if (!existing) return { error: "Esse lançamento não existe mais." };
    await data.updateEntry(id, { month, name, amountCents: amount, date, paymentMethodId, categoryId });
    if (existing.kind !== "avulso") {
      // "Pago" só existe para fixos fora do cartão de crédito
      if (f.get("hasPaid") === "1") await data.setPaid(id, f.get("paid") === "on");
      if (existing.recurringId && f.get("applyFuture") === "on") {
        const rec = await data.getRecurring(existing.recurringId);
        if (rec) {
          await data.updateRecurring(
            rec.id,
            {
              name,
              amountCents: amount,
              day: date ? Number(date.slice(8, 10)) : rec.day,
              paymentMethodId,
              categoryId,
              installments: rec.installments,
            },
            existing.month,
          );
        }
      }
    }
    if (isModal(f)) return modalDone(f);
    done(back);
  }

  // No crédito, a compra pode ser parcelada ou fixa (repete todo mês): vira um fixo do cartão
  const plan = str(f, "plan");
  if (plan === "parcelado" || plan === "fixa") {
    const method = (await data.listPaymentMethods()).find((m) => m.id === paymentMethodId);
    if (method?.isCredit) {
      if (amount < 0) return { error: "Estorno não pode ser parcelado." };
      const installments = plan === "parcelado" ? optInt(f, "installments") : null;
      if (plan === "parcelado" && (!installments || installments < 2 || installments > 72))
        return { error: "Informe em quantas vezes (de 2 a 72)." };
      await data.createRecurring(
        {
          kind: "cartao",
          name,
          amountCents: installments ? Math.round(amount / installments) : amount,
          day: date ? Number(date.slice(8, 10)) : null,
          paymentMethodId,
          categoryId,
          installments,
          startMonth: month,
        },
        { backfill: true },
      );
      if (isModal(f) || f.get("again") === "1") return modalDone(f);
      done(`/fixos?m=${month}&aba=cartao&ok=${plan === "fixa" ? "fixo" : "parcelado"}`);
    }
  }

  await data.createEntry({ month, kind: "avulso", name, amountCents: amount, date, paymentMethodId, categoryId });
  // "+ Outro" e a janela: o formulário se limpa / fecha sozinho, sem trocar de página
  if (isModal(f) || f.get("again") === "1") return modalDone(f);
  done(`/?m=${month}&ok=gasto`);
}

export async function deleteEntryAction(f: FormData) {
  const id = optInt(f, "id");
  if (id) await data.deleteEntry(id);
  if (isModal(f)) {
    revalidatePath("/", "layout"); // a janela fecha sozinha
    return;
  }
  done(str(f, "back") || "/lancamentos");
}

export async function togglePaid(id: number, paid: boolean) {
  await data.setPaid(id, paid);
  revalidatePath("/", "layout");
}

/** Preenche categorias vazias de um mês usando o histórico (mesmo nome = mesma categoria). */
export async function fillCategoriesFromHistory(f: FormData) {
  const month = str(f, "month");
  if (isMonth(month)) await data.fillCategoriesFromHistory(month);
  done(`/lancamentos?m=${month}&f=sem-categoria&ok=categorias`);
}

/* ---------- entradas ---------- */

export async function saveIncome(_: FormState, f: FormData): Promise<FormState> {
  const id = optInt(f, "id");
  const amount = parseAmountInput(str(f, "amount"));
  const name = str(f, "name");
  const date = validDate(str(f, "date"));
  let month = str(f, "month");
  if (!isMonth(month)) month = date ? date.slice(0, 7) : currentMonth();
  if (amount == null || amount === 0) return { error: "Informe o valor." };
  if (!name) return { error: "De onde veio? (ex.: Salário, Freela)" };

  if (id) {
    await data.updateIncome(id, { month, name, amountCents: amount, date });
    if (isModal(f)) return modalDone(f);
    done(str(f, "back") || `/lancamentos?m=${month}&tab=entradas`);
  }
  await data.createIncome({ month, name, amountCents: amount, date });
  if (isModal(f) || f.get("again") === "1") return modalDone(f);
  done(`/?m=${month}&ok=entrada`);
}

export async function deleteIncomeAction(f: FormData) {
  const id = optInt(f, "id");
  if (id) await data.deleteIncome(id);
  if (isModal(f)) {
    revalidatePath("/", "layout");
    return;
  }
  done(str(f, "back") || "/lancamentos?tab=entradas");
}

/* ---------- fixos ---------- */

export async function saveRecurring(_: FormState, f: FormData): Promise<FormState> {
  const id = optInt(f, "id");
  const amount = parseAmountInput(str(f, "amount"));
  const name = str(f, "name");
  const kind = str(f, "kind") === "cartao" ? "cartao" : "fixo";
  const paymentMethodId = optInt(f, "paymentMethodId");
  const day = optInt(f, "day");
  const categoryId = optInt(f, "categoryId");
  const parcelado = str(f, "mode") === "parcelado";
  const installments = parcelado ? optInt(f, "installments") : null;
  const currentNo = parcelado ? optInt(f, "currentNo") ?? 1 : 1;
  const month = isMonth(str(f, "month")) ? str(f, "month") : currentMonth();

  if (amount == null) return { error: "Informe o valor." };
  if (!name) return { error: "Dê um nome (ex.: Aluguel, Netflix)." };
  if (!paymentMethodId) return { error: "Escolha a forma de pagamento." };
  if (day != null && (day < 1 || day > 31)) return { error: "O dia precisa estar entre 1 e 31." };
  if (parcelado && (!installments || installments < 2)) return { error: "Informe em quantas parcelas." };
  if (parcelado && installments && (currentNo < 1 || currentNo > installments))
    return { error: `A parcela deste mês precisa estar entre 1 e ${installments}.` };

  if (id) {
    await data.updateRecurring(id, { name, amountCents: amount, day, paymentMethodId, categoryId, installments }, month);
  } else {
    const { shiftMonth } = await import("@/lib/format");
    await data.createRecurring({
      kind,
      name,
      amountCents: amount,
      day,
      paymentMethodId,
      categoryId,
      installments,
      startMonth: shiftMonth(month, -(currentNo - 1)),
    });
  }
  done(`/fixos?m=${month}&ok=fixo`);
}

export async function endRecurringAction(f: FormData) {
  const id = optInt(f, "id");
  const lastMonth = str(f, "lastMonth");
  if (id && isMonth(lastMonth)) await data.endRecurring(id, lastMonth);
  done(`/fixos?m=${str(f, "month") || currentMonth()}&ok=encerrado`);
}

/* ---------- metas ---------- */

export async function saveGoal(_: FormState, f: FormData): Promise<FormState> {
  const id = optInt(f, "id");
  const target = parseAmountInput(str(f, "amount"));
  const month = isMonth(str(f, "month")) ? str(f, "month") : currentMonth();
  if (target == null || target <= 0) return { error: "Informe o valor da meta." };

  if (id) {
    const goal = await data.getGoal(id);
    if (!goal) return { error: "Essa meta não existe mais." };
    // Meta do mês: o valor novo vale a partir do mês na tela (os anteriores ficam com o antigo)
    await data.updateGoal(id, target, month);
    done(`/metas?m=${month}&ok=meta`);
  }

  const kind = str(f, "kind");
  if (!isGoalKind(kind)) return { error: "Escolha o tipo de meta." };
  const period = str(f, "period") === "ano" && KIND_INFO[kind].annual ? "ano" : "mes";
  const categoryId = kind === "categoria" ? optInt(f, "categoryId") : null;
  if (kind === "categoria" && !categoryId) return { error: "Escolha a categoria." };
  const year = optInt(f, "year") ?? Number(month.slice(0, 4));
  if (period === "ano" && (year < 2000 || year > 2100)) return { error: "Escolha o ano." };
  const goal = {
    kind,
    period,
    categoryId,
    targetCents: target,
    startMonth: period === "ano" ? `${year}-01` : month,
    endMonth: period === "ano" ? `${year}-12` : null,
  } as const;
  const twin = findConflict(await data.listGoals(), goal);
  if (twin)
    return {
      error:
        twin.period === "mes" && twin.startMonth > goal.startMonth
          ? `Você já tem essa meta a partir de ${monthPhrase(twin.startMonth)}. Abra ela em Metas, naquele mês, para mudar o valor ou o início.`
          : "Você já tem essa meta. Abra ela na lista de metas para mudar o valor.",
    };
  await data.createGoal(goal);
  // Meta de outro ano: abre a tela em janeiro daquele ano, onde ela aparece
  const view = period === "ano" && String(year) !== month.slice(0, 4) ? `${year}-01` : month;
  done(`/metas?m=${view}&ok=meta`);
}

export async function endGoalAction(f: FormData) {
  const id = optInt(f, "id");
  const month = isMonth(str(f, "month")) ? str(f, "month") : currentMonth();
  if (id) await data.endGoal(id, month);
  done(`/metas?m=${month}&ok=meta-encerrada`);
}

/* ---------- ajustes ---------- */

export async function saveCategory(_: FormState, f: FormData): Promise<FormState> {
  const id = optInt(f, "id") ?? undefined;
  const name = str(f, "name");
  const emoji = str(f, "emoji") || "🏷️";
  if (!name) return { error: "Dê um nome à categoria." };
  try {
    // O valor previsto por mês agora é uma meta da categoria (tela Metas)
    await data.upsertCategory({ id, name, emoji });
  } catch {
    return { error: "Já existe uma categoria com esse nome." };
  }
  revalidatePath("/", "layout");
  return {};
}

export async function archiveCategoryAction(f: FormData) {
  const id = optInt(f, "id");
  if (id) await data.archiveCategory(id);
  done("/ajustes?ok=categoria");
}

export async function savePaymentMethod(_: FormState, f: FormData): Promise<FormState> {
  const id = optInt(f, "id") ?? undefined;
  const name = str(f, "name");
  const isCredit = f.get("isCredit") === "on";
  const closingDay = optInt(f, "closingDay");
  const color = str(f, "color") || undefined;
  if (!name) return { error: "Dê um nome (ex.: Pix, Nubank, Dinheiro)." };
  if (isCredit && closingDay != null && (closingDay < 1 || closingDay > 31))
    return { error: "O dia de fechamento precisa estar entre 1 e 31." };
  try {
    await data.upsertPaymentMethod({ id, name, isCredit, closingDay, color });
  } catch (e) {
    return { error: /duplicate|unique/i.test(String(e)) ? "Já existe uma forma de pagamento com esse nome." : String(e) };
  }
  revalidatePath("/", "layout");
  return {};
}

export async function archivePaymentMethodAction(f: FormData) {
  const id = optInt(f, "id");
  if (id) {
    try {
      await data.archivePaymentMethod(id);
    } catch {
      done("/ajustes?ok=pagamento-minimo");
    }
  }
  done("/ajustes?ok=pagamento");
}

export type ImportState = { error?: string; report?: ImportReport } | undefined;

export async function importSheetAction(_: ImportState, f: FormData): Promise<ImportState> {
  if (str(f, "confirm") !== "on") return { error: "Marque a confirmação para substituir os dados." };
  const raw = str(f, "sheet");
  const id = raw.match(/\/d\/([a-zA-Z0-9_-]{20,})/)?.[1] ?? (/^[a-zA-Z0-9_-]{20,}$/.test(raw) ? raw : null);
  if (!id) return { error: "Cole o link da planilha do Google (docs.google.com/spreadsheets/…)." };
  try {
    const report = await importFromGoogleSheet(await createClient(), id);
    revalidatePath("/", "layout");
    return { report };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Falha ao importar." };
  }
}

/* ---------- acesso ---------- */

export async function login(_: FormState, f: FormData): Promise<FormState> {
  const email = str(f, "email");
  const password = String(f.get("password") ?? "");
  if (!email || !password) return { error: "Informe e-mail e senha." };
  const sb = await createClient();
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    if (/invalid login credentials/i.test(error.message)) return { error: "E-mail ou senha incorretos." };
    if (/email not confirmed/i.test(error.message)) return { error: "Confirme o e-mail antes de entrar (veja sua caixa de entrada)." };
    if (/fetch failed|network/i.test(error.message)) return { error: "Não consegui falar com o Supabase. Verifique a internet e o .env.local." };
    return { error: `Não foi possível entrar: ${error.message}` };
  }
  const next = str(f, "next");
  revalidatePath("/", "layout");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export type SignUpState = { error?: string; sentTo?: string } | undefined;

export async function signUp(_: SignUpState, f: FormData): Promise<SignUpState> {
  const email = str(f, "email");
  const password = String(f.get("password") ?? "");
  const confirm = String(f.get("confirm") ?? "");
  if (!email) return { error: "Informe o e-mail." };
  if (password.length < 6) return { error: "A senha precisa ter pelo menos 6 caracteres." };
  if (password !== confirm) return { error: "As senhas não são iguais." };

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  const sb = await createClient();
  const { data: result, error } = await sb.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${proto}://${host}/auth/callback` },
  });
  if (error) {
    if (/already registered|already exists/i.test(error.message)) return { error: "Já existe uma conta com esse e-mail. Entre pela tela de login." };
    if (/signups? not allowed|disabled/i.test(error.message)) return { error: "Novos cadastros estão desativados neste site." };
    if (/password/i.test(error.message)) return { error: `Senha não aceita: ${error.message}` };
    if (/fetch failed|network/i.test(error.message)) return { error: "Não consegui falar com o Supabase. Verifique a internet e o .env.local." };
    return { error: `Não foi possível criar a conta: ${error.message}` };
  }
  if (result.session) {
    revalidatePath("/", "layout");
    redirect("/");
  }
  // Com confirmação de e-mail ligada, a conta só fica ativa depois do link
  return { sentTo: email };
}

export async function logout() {
  const sb = await createClient();
  await sb.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
