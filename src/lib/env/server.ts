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
 * O segredo é obrigatório em produção. Em desenvolvimento, sua ausência mantém
 * o webhook de demonstração utilizável, mas nunca deve ser aceita em deploy.
 */
export function getPaymentWebhookSecret() {
  const value = process.env.PAYMENT_WEBHOOK_SECRET?.trim();
  if (!value && isProductionEnvironment()) {
    throw new Error("A variável de ambiente PAYMENT_WEBHOOK_SECRET é obrigatória em produção.");
  }
  return value || null;
}
