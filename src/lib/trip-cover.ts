import "server-only";

import { existsSync } from "fs";
import path from "path";

/**
 * Resolve a primeira imagem de capa realmente disponível para uma viagem.
 *
 * - URLs absolutas (https) são assumidas como storage/CDN confiável.
 * - URLs relativas (`/uploads/...`, `/images/...`) são verificadas no
 *   filesystem de `public/` antes de serem consideradas válidas — evita
 *   imagem quebrada quando o arquivo não existe mais.
 *
 * Retorna `null` quando nenhuma imagem é utilizável.
 */
export function resolveTripCoverUrl(images: string[] | undefined): string | null {
  const candidates = images ?? [];

  for (const url of candidates) {
    if (!url) continue;

    if (/^https?:\/\//i.test(url)) {
      return url;
    }

    const relative = url.startsWith("/") ? url.slice(1) : url;
    const filepath = path.join(process.cwd(), "public", relative);
    if (existsSync(filepath)) {
      return url;
    }
  }

  return null;
}