import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { createServerClient } from "@supabase/ssr";
import type { AppRole } from "@/types";
import { getAuthSecret } from "@/lib/env/server";
import { getAuthDriver, getSupabaseEnvironment } from "@/lib/supabase/config";

const COOKIE = "prados_session";

async function verify(token: string) {
  try {
    const secret = new TextEncoder().encode(getAuthSecret());
    const { payload } = await jwtVerify(token, secret);
    return {
      id: String(payload.id),
      role: payload.role as AppRole,
    };
  } catch {
    return null;
  }
}

type Session = { id: string; role: AppRole };

async function resolveSession(request: NextRequest): Promise<{
  session: Session | null;
  response: NextResponse;
}> {
  if (getAuthDriver() === "supabase") {
    const env = getSupabaseEnvironment();
    let response = NextResponse.next({ request });
    const cookieStore = request.cookies;
    const supabase = createServerClient(env.url || "", env.anonKey || "", {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value);
            response = NextResponse.next({ request });
            response.cookies.set(name, value, options);
          }
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { session: null, response };

    // Role resolvido pelo próprio perfil (RLS `profiles_self` permite a leitura).
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile) return { session: null, response };
    return { session: { id: profile.id, role: profile.role as AppRole }, response };
  }

  const token = request.cookies.get(COOKIE)?.value;
  const session = token ? await verify(token) : null;
  return { session, response: NextResponse.next({ request }) };
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { session, response } = await resolveSession(request);

  if (!session) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/admin") && !["SUPER_ADMIN", "ADMIN"].includes(session.role)) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  if (
    pathname.startsWith("/financeiro") &&
    !["SUPER_ADMIN", "ADMIN", "FINANCEIRO"].includes(session.role)
  ) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  if (
    pathname.startsWith("/vendedor") &&
    !["SUPER_ADMIN", "ADMIN", "VENDEDOR"].includes(session.role)
  ) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  if (
    (pathname.startsWith("/operacional") || pathname.startsWith("/check-in")) &&
    !["SUPER_ADMIN", "ADMIN", "MONITOR"].includes(session.role)
  ) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/meu-perfil/:path*",
    "/minhas-viagens/:path*",
    "/meus-pagamentos/:path*",
    "/meus-vouchers/:path*",
    "/notificacoes/:path*",
    "/checkout",
    "/checkout/:path*",
    "/admin/:path*",
    "/financeiro/:path*",
    "/vendedor/:path*",
    "/operacional/:path*",
    "/check-in/:path*",
  ],
};