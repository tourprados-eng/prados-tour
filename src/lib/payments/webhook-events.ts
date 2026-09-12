import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getDataBackend, getSupabaseEnvironment } from "@/lib/supabase/config";

/**
 * Persistência de eventos de webhook do Asaas para IDEMPOTÊNCIA com RETRY.
 *
 * O Asaas entrega "at-least-once": o mesmo `body.id` pode chegar várias vezes,
 * inclusive com atrasos de minutos/horas. Este guard diferencia:
 *
 *  - PROCESSING  → evento CLAIMADO, em processamento (insert atômico). Se o
 *    processamento abandonar (crash/timeout), a claim expira após um período
 *    seguro e outra entrega pode retomá-lo (re-claim por CAS na `claimed_at`).
 *  - PROCESSED   → evento definitivamente consumido (sucesso OU rejeição por
 *    IDEMPOTÊNCIA, ver "autor das rejeições definitivas" em confirmation.ts).
 *    Qualquer reentrega responde sem repetir efeitos.
 *  - (ausente)   → nunca processado, ou falha TRANSITÓRIA que liberou a row
 *    (delete) para permitir reprocessamento legítimo.
 *
 * ATOMICIDADE: a decisão de quem processa é o INSERT na PK `event_id`
 * (constraint UNIQUE no Postgres). Uma segunda entrega simultânea não consegue
 * a claim enquanto a primeira estiver com PROCESSING recente.
 *
 * A tabela tem RLS HABILITADO e NENHUMA policy: service_role a ignora
 * (acesso exclusivo do backend); anon/authenticated não conseguem LER nem
 * GRAVAR. Em ambiente local (store em arquivo), degrada para um mapa em
 * memória com a mesma semântica de timeout.
 */

/** Período seguro após o qual um PROCESSING abandonado é retomável. */
const ABANDONMENT_TIMEOUT_MS = 10 * 60 * 1000;

type WebhookEventRow = {
  event_id: string;
  event: string;
  payment_id: string;
  booking_id: string | null;
  status: "PROCESSING" | "PROCESSED";
  claimed_at: string;
  processed_at: string | null;
  created_at: string;
};

type MemoryEvent = {
  status: "PROCESSING" | "PROCESSED";
  claimedAt: number;
};

let client: SupabaseClient | null | undefined = undefined;
const memoryEvents = new Map<string, MemoryEvent>();

function getDbClient(): SupabaseClient | null {
  if (client !== undefined) return client;
  client = null;
  const config = getSupabaseEnvironment();
  if (
    getDataBackend() === "supabase" &&
    config.hasServerCredentials &&
    config.url &&
    config.serviceRoleKey
  ) {
    client = createClient(config.url, config.serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return client;
}

function isMissingTableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("42P01") ||
    message.toLowerCase().includes("does not exist") ||
    message.includes("PGRST204")
  );
}

export type AsaasWebhookClaim =
  | { claimed: true }
  | { claimed: false; reason: "processed" | "processing" };

function claimInMemory(eventId: string): AsaasWebhookClaim {
  const existing = memoryEvents.get(eventId);
  const now = Date.now();

  if (!existing) {
    memoryEvents.set(eventId, { status: "PROCESSING", claimedAt: now });
    return { claimed: true };
  }

  if (existing.status === "PROCESSED") {
    return { claimed: false, reason: "processed" };
  }

  if (now - existing.claimedAt < ABANDONMENT_TIMEOUT_MS) {
    return { claimed: false, reason: "processing" };
  }

  existing.claimedAt = now;
  return { claimed: true };
}

function completeInMemory(eventId: string): void {
  const existing = memoryEvents.get(eventId);
  if (existing) {
    existing.status = "PROCESSED";
  }
}

function releaseInMemory(eventId: string): void {
  memoryEvents.delete(eventId);
}

/**
 * CLAIM: registra o evento como PROCESSING sob a PK `event_id` (atômico).
 * - 1ª chegada: insere PROCESSING → claimed.
 * - já PROCESSED: não reclama (duplicate).
 * - PROCESSING recente: outra entrega em andamento → não reclama.
 * - PROCESSING expirado: retoma por CAS (só se ninguém reclamou no intervalo).
 */
export async function claimAsaasWebhookEvent(args: {
  eventId: string;
  event: string;
  paymentId: string;
}): Promise<AsaasWebhookClaim> {
  const db = getDbClient();
  if (!db) {
    return claimInMemory(args.eventId);
  }

  const now = new Date().toISOString();
  try {
    const { data, error } = await db
      .from("payment_webhook_events")
      .upsert(
        {
          event_id: args.eventId,
          event: args.event,
          payment_id: args.paymentId,
          booking_id: null,
          status: "PROCESSING",
          claimed_at: now,
          processed_at: null,
          created_at: now,
        },
        { onConflict: "event_id", ignoreDuplicates: true },
      );
    if (error) throw error;

    const inserted = (data ?? []) as WebhookEventRow[];
    if (inserted.length === 1) {
      return { claimed: true };
    }

    const { data: existing, error: readError } = await db
      .from("payment_webhook_events")
      .select("status, claimed_at")
      .eq("event_id", args.eventId)
      .single();
    if (readError || !existing) {
      throw readError ?? new Error("Evento de webhook não encontrado após conflito.");
    }
    const row = existing as { status: string; claimed_at: string };

    if (row.status === "PROCESSED") {
      return { claimed: false, reason: "processed" };
    }

    const claimedAt = new Date(row.claimed_at).getTime();
    if (!Number.isFinite(claimedAt)) {
      return { claimed: false, reason: "processing" };
    }
    if (Date.now() - claimedAt < ABANDONMENT_TIMEOUT_MS) {
      return { claimed: false, reason: "processing" };
    }

    const { data: renewedData, error: renewError } = await db
      .from("payment_webhook_events")
      .update({ claimed_at: now })
      .eq("event_id", args.eventId)
      .eq("status", "PROCESSING")
      .lte("claimed_at", row.claimed_at)
      .select("event_id");
    if (renewError) throw renewError;

    const renewed = (renewedData ?? []) as WebhookEventRow[];
    return renewed.length === 1
      ? { claimed: true }
      : { claimed: false, reason: "processing" };
  } catch (error) {
    if (isMissingTableError(error)) {
      return claimInMemory(args.eventId);
    }
    throw error;
  }
}

/**
 * COMPLETA o processamento com sucesso/definitivo: PROCESSING → PROCESSED.
 * Apenas o detentor da claim deve chamar.
 */
export async function completeAsaasWebhookEvent(eventId: string): Promise<void> {
  const db = getDbClient();
  if (!db) {
    completeInMemory(eventId);
    return;
  }

  const now = new Date().toISOString();
  try {
    const { error } = await db
      .from("payment_webhook_events")
      .update({ status: "PROCESSED", processed_at: now })
      .eq("event_id", eventId);
    if (error) throw error;
  } catch (error) {
    if (!isMissingTableError(error)) throw error;
    completeInMemory(eventId);
  }
}

/**
 * LIBERA o evento após falha TRANSITÓRIA ANTES de qualquer mutação permanente:
 * remove a row, permitindo que uma nova entrega do MESMO `body.id` reprocesse.
 * Nunca libera um PROCESSED (só é chamado sob PROCESSING).
 */
export async function releaseAsaasWebhookEvent(eventId: string): Promise<void> {
  const db = getDbClient();
  if (!db) {
    releaseInMemory(eventId);
    return;
  }
  try {
    const { error } = await db
      .from("payment_webhook_events")
      .delete()
      .eq("event_id", eventId);
    if (error) throw error;
  } catch (error) {
    if (!isMissingTableError(error)) throw error;
    releaseInMemory(eventId);
  }
}