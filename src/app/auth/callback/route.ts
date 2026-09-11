import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/auth/supabase-session";
import { getPublicSiteUrl } from "@/lib/env/public";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  const siteUrl = getPublicSiteUrl() || url.origin;

  if (!code) {
    return NextResponse.redirect(
      new URL("/login?erro=confirmacao_invalida", siteUrl),
    );
  }

  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("[auth/callback] falha ao confirmar sessão:", error);

    return NextResponse.redirect(
      new URL("/login?erro=confirmacao_invalida", siteUrl),
    );
  }

  return NextResponse.redirect(new URL("/minhas-viagens", siteUrl));
}
