/**
 * Variáveis públicas do cliente (podem ser lidas no navegador).
 * Nunca guarde segredos aqui.
 */

/**
 * URL pública base do site (para links enviados por e-mail, ex.: recuperação
 * de senha). Não tem barra final.
 */
export function getPublicSiteUrl() {
  const value = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  if (value) return value;
  return process.env.NODE_ENV === "production"
    ? ""
    : "http://localhost:3000";
}