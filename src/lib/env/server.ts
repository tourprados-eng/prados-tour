/**
 * Variáveis exclusivas do servidor.
 * Nunca importe este módulo em componentes com "use client".
 */

export function isProductionEnvironment() {
  return process.env.NODE_ENV === "production";
}

export function getRequiredServerEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`A variável de ambiente ${name} é obrigatória.`);
  }
  return value;
}

export function getAuthSecret() {
  return getRequiredServerEnv("AUTH_SECRET");
}

/**
 * E-mail da conta designada como Super Admin do sistema. Não é um segredo
 * (é um identificador público da conta); serve apenas para identificar a
 * conta prevista pelo sistema em validações/cross-check. Ausente se não
 * configurado.
 */
export function getSuperAdminEmail(): string | null {
  return process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase() || null;
}

/**
 * Chave de API do Asaas. Exclusiva do servidor; nunca expor ao cliente.
 * Em desenvolvimento local pode haver fallback para o valor literal de
 * `.env.local` — ver `@/lib/payments/asaas-secrets`.
 */
export function getAsaasApiKeyEnvOnly() {
  return process.env.ASAAS_API_KEY?.trim();
}

/**
 * URL base da API do Asaas, derivada apenas de ASAAS_ENVIRONMENT
 * ("sandbox" ou "production"). Valores arbitrários não são aceitos.
 */
export function getAsaasBaseUrl() {
  const environment = process.env.ASAAS_ENVIRONMENT?.trim();
  if (environment === "sandbox") {
    return "https://api-sandbox.asaas.com/v3";
  }
  if (environment === "production") {
    return "https://api.asaas.com/v3";
  }
  throw new Error(
    `A variável de ambiente ASAAS_ENVIRONMENT é obrigatória e deve ser "sandbox" ou "production". Valor recebido: ${environment ?? "(ausente)"}.`,
  );
}

/**
 * Token de verificação de webhooks do Asaas. Obrigatório em produção. Em
 * desenvolvimento, sua ausência mantém o fluxo utilizável, mas nunca deve
 * ser aceita em deploy.
 */
export function getAsaasWebhookToken() {
  const value = process.env.ASAAS_WEBHOOK_TOKEN?.trim();
  if (!value && isProductionEnvironment()) {
    throw new Error("A variável de ambiente ASAAS_WEBHOOK_TOKEN é obrigatória em produção.");
  }
  return value || null;
}
