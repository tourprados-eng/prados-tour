import "server-only";

import { createClient } from "@supabase/supabase-js";
import { assertSupabaseServerConfiguration } from "./config";

/**
 * Cliente que ignora RLS. Use somente em ações de servidor cuidadosamente
 * autorizadas; ele nunca deve ser importado por componentes de cliente.
 */
export function createSupabaseAdminClient() {
  const { url, serviceRoleKey } = assertSupabaseServerConfiguration();
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
