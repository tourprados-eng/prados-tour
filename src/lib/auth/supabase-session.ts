import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseEnvironment } from "@/lib/supabase/config";
import { getSuperAdminEmail } from "@/lib/env/server";
import type { AppRole, SessionUser } from "@/types";

/**
 * Infraestrutura de sessão via Supabase Auth (Etapa 2.1).
 *
 * Nada aqui é executado enquanto AUTH_DRIVER for "local" (padrão): os helpers
 * abaixo só começam a ser chamados quando o driver for alternado para
 * "supabase" (Etapa 2.2+). Mantida dormente sem contato com o Supabase remoto.
 */

/**
 * Cliente SSR (cookies) para o runtime do servidor. Usa a chave anônima e a
 * sessão do usuário que viaja nos cookies `sb-*` emitidos pelo Supabase.
 */
export async function createServerSupabaseClient() {
  const env = getSupabaseEnvironment();
  if (!env.url || !env.anonKey) {
    throw new Error(
      "Supabase exige NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  const cookieStore = await cookies();

  return createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Chamado durante render de Server Component; a escrita é
          // re-tentada em Server Action / Route Handler.
        }
      },
    },
  });
}

/**
 * Resolve o usuário da sessão Supabase como SessionUser.
 * O profile é lido pela própria sessão (RLS `profiles_self` permite leitura
 * do próprio registro), mantendo roles/permissões no `profiles.role`.
 */
export async function getSupabaseSessionUser(): Promise<SessionUser | null> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;

  // O usuário só pode ser considerado autenticado quando o e-mail
  // realmente tiver sido confirmado pelo Supabase Auth.
  if (!user.email_confirmed_at) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, email, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) return null;

  // Cross-check de identidade: o papel efetivo vem SEMPRE de profiles.role no
  // banco. A conta designada via SUPER_ADMIN_EMAIL (server-only) é apenas
  // identificada para validação — nunca concedemos privilégio por e-mail.
  const designatedSuperAdmin = getSuperAdminEmail();
  const profileEmail = (user.email ?? profile.email ?? "").toLowerCase();
  if (designatedSuperAdmin && profileEmail === designatedSuperAdmin && profile.role !== "SUPER_ADMIN") {
    console.warn(
      "[auth] A conta designada como Super Admin (SUPER_ADMIN_EMAIL) não possui role SUPER_ADMIN no banco. Verifique profiles.role.",
    );
  }

  return {
    id: profile.id,
    email: user.email ?? profile.email ?? "",
    fullName: profile.full_name,
    role: profile.role as AppRole,
  };
}

/** Encerra a sessão Supabase (revoga access token e limpa cookies). */
export async function clearSupabaseSession() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
}