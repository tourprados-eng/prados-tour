import "server-only";

import { v4 as uuid } from "uuid";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isProductionEnvironment } from "@/lib/env/server";
import { getDataBackend, getSupabaseEnvironment } from "@/lib/supabase/config";
import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import { reconcileExistingBalances } from "@/lib/payments/reconcile";
import { sendInitialBalanceNotice } from "@/lib/payments/reminders";

const RUN_KEY = "initial";
const STUCK_EXECUTING_MS = 30 * 60 * 1000;
const ASKED_ENVIRONMENT = "production";
const ACTIVATION_ENV_VAR = "BALANCE_ACTIVATION";

/**
 * Ativação automática da cobrança de saldo ao subir para PRODUÇÃO.
 *
 * Executo de forma controlada a partir de `instrumentation.ts` (bootstrap do
 * servidor) — NUNCA no carregamento de páginas públicas. Garantias:
 *
 *  1) roda somente em produção, DATA_BACKEND=supabase,
 *     ASAAS_ENVIRONMENT=production E interruptor BALANCE_ACTIVATION=1
 *     (NUNCA em sandbox; NUNCA sem autorização explícita de ativação);
 *  2) lock run-once em `balance_reconciliation_runs` (run_key='initial');
 *     uma vez concluída com sucesso, reinícios/deploys NÃO executam de novo;
 *     se a execução anterior falhou, permite nova tentativa;
 *  3) guard de valores antes de qualquer efeito: PT000001 deve calcular
 *     exatamente R$ 274,50 e PT000002 R$ 180,00; divergência => ABORTA tudo;
 *  4) cria/localiza a cobrança via o fluxo idempotente do saldo
 *     (paymentId determinístico + reconcile-first no Asaas);
 *  5) envia o e-mail inicial UMA única vez por reserva (AVISO_INICIAL) com o
 *     link "Pagar saldo" para o fluxo do site;
 *  6) nunca expõe chaves/tokens; o resumo é gravado em jsonb (sem valores
 *     sensíveis além dos montantes já públicos das cobranças).
 */

const GUARD_AMOUNTS: Record<string, number> = {
  PT000001: 274.5,
  PT000002: 180.0,
};

type RunResult = {
  ran: boolean;
  reason?: string;
  aborted?: boolean;
  abortReason?: string | null;
  newlyCharged?: number;
  emailsSent?: number;
};

let client: SupabaseClient | null | undefined = undefined;

function getDbClient(): SupabaseClient | null {
  if (client !== undefined) return client;
  client = null;
  const config = getSupabaseEnvironment();
  if (config.url && config.serviceRoleKey) {
    client = createClient(config.url, config.serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return client;
}

export async function runInitialBalanceReconciliation(): Promise<RunResult> {
  if (!isProductionEnvironment()) {
    return { ran: false, reason: "Apenas em produção." };
  }
  if (getDataBackend() !== "supabase") {
    return { ran: false, reason: "DATA_BACKEND não é supabase." };
  }

  const environment = process.env.ASAAS_ENVIRONMENT?.trim();
  if (environment !== ASKED_ENVIRONMENT) {
    console.error(
      "[BALANCE BOOTSTRAP] ABORTADO: ASAAS_ENVIRONMENT deve ser 'production' (recebida: " +
        (environment ?? "(ausente)") +
        "). Nenhuma cobrança foi criada.",
    );
    return { ran: false, reason: "Ambiente Asaas não é produção." };
  }

  const activation = process.env[ACTIVATION_ENV_VAR]?.trim();
  if (activation !== "1") {
    console.log(
      `[BALANCE BOOTSTRAP] Interruptor ${ACTIVATION_ENV_VAR}=1 ausente; ` +
        "ativação financeira adiada. Nenhuma cobrança/e-mail foi criado.",
    );
    return { ran: false, reason: "Interruptor de ativação desligado." };
  }

  const db = getDbClient();
  if (!db) {
    console.error("[BALANCE BOOTSTRAP] ABORTADO: sem credenciais de servidor do Supabase.");
    return { ran: false, reason: "Sem credenciais de servidor." };
  }

  const now = new Date();
  const existing = await db
    .from("balance_reconciliation_runs")
    .select("run_key, status, started_at")
    .eq("run_key", RUN_KEY)
    .maybeSingle();

  if (existing.data) {
    if (existing.data.status === "success") {
      return { ran: false, reason: "Reconciliação inicial já concluída com sucesso." };
    }
    if (existing.data.status === "executing") {
      const started = existing.data.started_at
        ? new Date(existing.data.started_at).getTime()
        : 0;
      if (Date.now() - started < STUCK_EXECUTING_MS) {
        return { ran: false, reason: "Já existe execução em andamento (run_key=initial)." };
      }
      console.warn("[BALANCE BOOTSTRAP] Execução anterior ficou presa; nova tentativa.");
    }
  }

  const instanceId = uuid();
  await db
    .from("balance_reconciliation_runs")
    .upsert(
      {
        run_key: RUN_KEY,
        status: "executing",
        started_at: now.toISOString(),
        summary: { instance_id: instanceId, started_at: now.toISOString() },
      },
      { onConflict: "run_key", ignoreDuplicates: true },
    )
    .select("run_key");

  const mine = await db
    .from("balance_reconciliation_runs")
    .select("summary")
    .eq("run_key", RUN_KEY)
    .maybeSingle();

  const summary = (mine.data?.summary ?? {}) as { instance_id?: string };
  if (summary.instance_id !== instanceId) {
    return { ran: false, reason: "Corrida de inicialização perdida; outro processo liderou." };
  }

  const finish = async (status: "success" | "failed", payload: Record<string, unknown>) => {
    await db
      .from("balance_reconciliation_runs")
      .update({ status, summary: payload, finished_at: new Date().toISOString() })
      .eq("run_key", RUN_KEY);
  };

  try {
    const report = await reconcileExistingBalances({
      apply: true,
      guardAmounts: GUARD_AMOUNTS,
    });

    if (report.aborted || report.abortReason) {
      await finish("failed", {
        aborted: true,
        abort_reason: report.abortReason,
        scanned: report.scanned,
      });
      console.error(`[BALANCE BOOTSTRAP] ${report.abortReason ?? "Guard reprovado"}`);
      return {
        ran: true,
        aborted: true,
        abortReason: report.abortReason,
        newlyCharged: 0,
      };
    }

    const store = await getRepositoryRuntime().read();
    let emailsSent = 0;
    let emailsRegistered = 0;
    let emailsSkippedAlready = 0;
    const emailErrors: string[] = [];

    for (const item of report.items) {
      const chargeStatuses = new Set([
        "charge_created",
        "charge_exists",
        "pending_not_confirmed",
        "confirm_from_asaas",
      ]);
      if (!chargeStatuses.has(item.status)) continue;
      const booking = store.bookings.find((b) => b.id === item.bookingId);
      const trip = store.trips.find((t) => t.id === item.tripId);
      if (!booking || !trip) continue;
      const result = await sendInitialBalanceNotice({ store, booking, trip, now });
      if (result.status === "SENT") emailsSent += 1;
      else if (result.status === "REGISTERED_ONLY") emailsRegistered += 1;
      else if (result.status === "SKIPPED_ALREADY") emailsSkippedAlready += 1;
      else if (result.status === "ERROR") emailErrors.push(item.reference);
    }

    const payload: Record<string, unknown> = {
      scanned: report.scanned,
      with_balance: report.withBalance,
      newly_charged: report.newlyCharged,
      confirmed_existing: report.confirmedExisting,
      reuse_pending: report.reusePending,
      already_paid: report.alreadyPaid,
      errors: report.errors,
      items_count: report.items.length,
      emails: {
        sent: emailsSent,
        registered_only: emailsRegistered,
        skipped_already: emailsSkippedAlready,
        errors: emailErrors,
      },
    };
    await finish("success", payload);

    console.log(
      `[BALANCE BOOTSTRAP] Concluído. ${report.newlyCharged} cobrança(s) criada(s), ` +
        `${emailsSent} e-mail(s) enviado(s), ${emailsRegistered} registrado(s) sem remetente.`,
    );
    return {
      ran: true,
      newlyCharged: report.newlyCharged,
      emailsSent,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finish("failed", { error: message });
    console.error("[BALANCE BOOTSTRAP] Falha na reconciliação inicial:", message);
    return { ran: true, reason: "Falha na execução; status registrado como failed." };
  }
}