/** Lança um erro legível se o Supabase responder com erro. */
export function must<T>(res: { data: T | null; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`Erro ao ${what}: ${res.error.message}`);
  return res.data as T;
}
