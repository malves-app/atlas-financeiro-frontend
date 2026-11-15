import { cache } from "react";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseEnv } from "./env";

/** Cliente do Supabase com a sessão de quem está usando o site (RLS aplica sozinho). */
export async function createClient() {
  const { url, key } = supabaseEnv();
  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Em páginas (Server Components) não dá para gravar cookies; o proxy.ts renova a sessão.
        }
      },
    },
  });
}

export type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Um cliente por requisição nas páginas. (Os testes trocam por um banco local.) */
export const getSupabase = cache(async (): Promise<Supabase> => {
  const testClient = (globalThis as { __atlasTestClient?: unknown }).__atlasTestClient;
  return testClient ? (testClient as Supabase) : createClient();
});
