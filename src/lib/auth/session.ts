import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { AppRole, SessionUser } from "@/types";
import { getAuthSecret } from "@/lib/env/server";
import { getAuthDriver } from "@/lib/supabase/config";
import { getSupabaseSessionUser } from "./supabase-session";

const COOKIE = "prados_session";

function getSessionSecret() {
  return new TextEncoder().encode(getAuthSecret());
}

export async function createSessionToken(user: SessionUser) {
  return new SignJWT({
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSessionSecret());
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSessionSecret());
    return {
      id: String(payload.id),
      email: String(payload.email),
      fullName: String(payload.fullName),
      role: payload.role as AppRole,
    };
  } catch {
    return null;
  }
}

export async function setSession(user: SessionUser) {
  const token = await createSessionToken(user);
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

/**
 * Avalia a sessão corrente. O driver é decidido por AUTH_DRIVER:
 * - "local" (padrão): fluxo atual, JWT próprio no cookie `prados_session`;
 * - "supabase": sessão Supabase (apenas quando explicitamente habilitado).
 */
export async function getSession(): Promise<SessionUser | null> {
  if (getAuthDriver() === "supabase") {
    return getSupabaseSessionUser();
  }

  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export function canAccess(role: AppRole, area: "admin" | "financeiro" | "vendedor" | "operacional" | "customer") {
  const map: Record<typeof area, AppRole[]> = {
    admin: ["SUPER_ADMIN", "ADMIN"],
    financeiro: ["SUPER_ADMIN", "ADMIN", "FINANCEIRO"],
    vendedor: ["SUPER_ADMIN", "ADMIN", "VENDEDOR"],
    operacional: ["SUPER_ADMIN", "ADMIN", "MONITOR"],
    customer: ["SUPER_ADMIN", "ADMIN", "FINANCEIRO", "VENDEDOR", "MONITOR", "CLIENTE"],
  };
  return map[area].includes(role);
}
