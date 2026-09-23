/**
 * Bootstrap do servidor (Next.js). Executa apenas no runtime Node.js, em
 * PRODUÇÃO, a ativação automática da cobrança de saldo: UMA reconciliação
 * inicial das reservas antigas (idempotente, com guard de valores). NUNCA roda
 * em desenvolvimento nem no carregamento de páginas públicas.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { runInitialBalanceReconciliation } = await import(
    "@/lib/payments/bootstrap-reconciliation"
  );

  void runInitialBalanceReconciliation()
    .then((result) => {
      if (!result.ran) {
        console.log(`[BALANCE BOOTSTRAP] Não executou: ${result.reason ?? "sem motivo"}`);
      } else if (result.aborted) {
        console.error(
          `[BALANCE BOOTSTRAP] ABORTADO: ${result.abortReason ?? "guarda reprovada"}`,
        );
      }
    })
    .catch((error: unknown) => {
      console.error(
        "[BALANCE BOOTSTRAP] Falha não tratada:",
        error instanceof Error ? error.message : error,
      );
    });
}