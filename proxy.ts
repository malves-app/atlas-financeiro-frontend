import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseEnv } from "./lib/supabase/env";

// Renova a sessão do Supabase a cada requisição e manda para /login quem não entrou.
export async function proxy(request: NextRequest) {
  // Nos testes automáticos o banco é local e não há login.
  if ((globalThis as { __atlasTestClient?: unknown }).__atlasTestClient) return NextResponse.next();
  const { url, key } = supabaseEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [k, v] of Object.entries(headers ?? {})) response.headers.set(k, v);
      },
    },
  });

  // Não coloque código entre createServerClient e getClaims: é aqui que a sessão é validada.
  const { data } = await supabase.auth.getClaims();
  const loggedIn = !!data?.claims?.sub;
  const path = request.nextUrl.pathname;
  const isAuthPage = path.startsWith("/login") || path.startsWith("/cadastro");
  const isPublic = isAuthPage || path.startsWith("/auth/");

  if (!loggedIn && !isPublic) {
    const to = request.nextUrl.clone();
    to.pathname = "/login";
    to.search = "";
    const next = request.nextUrl.pathname + request.nextUrl.search;
    if (next !== "/") to.searchParams.set("next", next);
    const redirect = NextResponse.redirect(to);
    for (const c of response.cookies.getAll()) redirect.cookies.set(c);
    return redirect;
  }
  if (loggedIn && isAuthPage) {
    const to = request.nextUrl.clone();
    to.pathname = "/";
    to.search = "";
    return NextResponse.redirect(to);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icon|apple-icon|manifest|favicon|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};
