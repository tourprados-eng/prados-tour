import "server-only";

export type DataBackend = "local" | "supabase";

export type AuthDriver = "local" | "supabase";

export type SupabaseEnvironment = {
  url: string | null;
  anonKey: string | null;
  serviceRoleKey: string | null;
  hasBrowserCredentials: boolean;
  hasServerCredentials: boolean;
};

function readOptionalEnv(name: string) {
  return process.env[name]?.trim() || null;
}

/**
 * Expõe apenas o estado da configuração; nunca registre os valores retornados.
 */
export function getSupabaseEnvironment(): SupabaseEnvironment {
  const publicUrl = readOptionalEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serverUrl = readOptionalEnv("SUPABASE_URL");
  const anonKey = readOptionalEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const serviceRoleKey = readOptionalEnv("SUPABASE_SERVICE_ROLE_KEY");
  const url = serverUrl || publicUrl;

  return {
    url,
    anonKey,
    serviceRoleKey,
    hasBrowserCredentials: Boolean(publicUrl && anonKey),
    hasServerCredentials: Boolean(url && serviceRoleKey),
  };
}

export function getDataBackend(): DataBackend {
  const value = process.env.DATA_BACKEND?.trim().toLowerCase() || "local";
  if (value === "local" || value === "supabase") return value;
  throw new Error("DATA_BACKEND deve ser 'local' ou 'supabase'.");
}

/**
 * Driver de autenticação. Enquanto não for alterado explicitamente para
 * "supabase", toda a autenticação usa a sessão local (JWT + cookie próprio),
 * sem nenhuma chamada ao Supabase.
 */
export function getAuthDriver(): AuthDriver {
  const value = process.env.AUTH_DRIVER?.trim().toLowerCase() || "local";
  if (value === "local" || value === "supabase") return value;
  throw new Error("AUTH_DRIVER deve ser 'local' ou 'supabase'.");
}

export function assertSupabaseBrowserConfiguration() {
  const config = getSupabaseEnvironment();
  if (!config.hasBrowserCredentials || !config.url || !config.anonKey) {
    throw new Error(
      "Supabase requer NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }
  return { url: config.url, anonKey: config.anonKey };
}

export function assertSupabaseServerConfiguration() {
  const config = getSupabaseEnvironment();
  if (!config.hasServerCredentials || !config.url || !config.serviceRoleKey) {
    throw new Error(
      "Supabase administrativo requer SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return { url: config.url, serviceRoleKey: config.serviceRoleKey };
}
