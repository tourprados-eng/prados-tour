import "server-only";

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Leitura LITERAL de variável em `.env.local` (somente desenvolvimento local).
 *
 * Motivo: o expander de variáveis do Next (dotenv-expand) trata valores que
 * começam com "$" — como as chaves do Asaas no formato `aact_hmlg_...` — como
 * referência a outra variável e os anula silenciosamente. Este módulo lê o
 * valor cru do arquivo sem qualquer expansão.
 *
 * Este arquivo é importado APENAS dinamicamente a partir de código Node.js
 * (`server-only`); nunca é anexado ao runtime Edge do middleware.
 */
export function readLocalDotEnvValue(name: string): string | null {
  try {
    const file = join(process.cwd(), ".env.local");
    if (!existsSync(file)) return null;
    for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq <= 0 || line.slice(0, eq).trim() !== name) continue;
      let value = line.slice(eq + 1).trim();
      for (const quote of ['"', "'"] as const) {
        if (value.length >= 2 && value.startsWith(quote) && value.endsWith(quote)) {
          value = value.slice(1, -1);
        }
      }
      if (value) return value;
    }
  } catch {
    // Sem acesso ao arquivo local: mantém apenas o valor de process.env.
  }
  return null;
}