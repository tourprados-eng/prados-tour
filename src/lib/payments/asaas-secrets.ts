import "server-only";

/**
 * Chave de API do Asaas com resolução segura para desenvolvimento local.
 *
 * Ordem:
 *  1) process.env.ASAAS_API_KEY (produção / ambientes gerenciados);
 *  2) leitura literal de `.env.local` (somente fora de produção), pois o
 *     expander de variáveis do Next anula valores iniciados por "$"
 *     (formato aact_hmlg_...);
 *  3) erro de configuração.
 *
 * Este módulo é Node-only e NUNCA entra no grafo do Edge Runtime
 * (middleware), por isso pode usar `node:fs`/`node:path` com segurança.
 */
export async function getAsaasApiKey(): Promise<string> {
  const direct = process.env.ASAAS_API_KEY?.trim();
  if (direct) return direct;
  if (process.env.NODE_ENV !== "production") {
    const { readLocalDotEnvValue } = await import("@/lib/env/local-dotenv");
    const local = readLocalDotEnvValue("ASAAS_API_KEY");
    if (local) return local;
  }
  throw new Error("A variável de ambiente ASAAS_API_KEY é obrigatória.");
}