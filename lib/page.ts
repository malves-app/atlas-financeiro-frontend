import { currentMonth, isMonth } from "./format";

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function readParams(searchParams: SearchParams) {
  const sp = await searchParams;
  const get = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const m = get("m");
  return { month: isMonth(m) ? m : currentMonth(), get };
}
