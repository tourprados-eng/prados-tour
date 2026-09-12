import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getDataBackend, getSupabaseEnvironment } from "@/lib/supabase/config";

/**
 * Claim de operação PIX Asaas.
 *
 * Uma claim ocupa uma chave determinística por OPERAÇÃO de cobrança (o
 * paymentId determinístico derivado do clientRequestId ou dos dados do
 * checkout). A claim é gravada ANTES de qualquer chamada ao Asaas e é o único
 * ponto de decisão de "quem cria a cobrança" sob concorrência (insert on
 * conflict). Ela também registra os marcos de recuperação para que uma
 * operação interrompida possa ser retomada:
 *
 *   PENDING (lease) -> booking_id/charge_id preenchidos -> CHARGED
 *
 * A claim NUNCA bloqueia permanentemente: o lease expira e qualquer tentativa
 * posterior pode fazer take-over condicional (CAS). Em ambiente local (store
 * em arquivo, processo único) ou se a tabela ainda não existir na base, o
 * módulo degrada para um mapa em memória sem perda de funcionalidade.
 */

export type PixClaimStatus = "PENDING" | "CHARGED";

export type PaymentClaim = {
  idempotencyKey: string;
  bookingId: string | null;
  customerId: string | null;
  tripId: string | null;
  paymentId: string | null;
  chargeId: string | null;
  status: PixClaimStatus;
  leaseUntil: string | null;
  createdAt: string;
  updatedAt: string;
};

export const PIX_CLAIM_LEASE_MS = 90_000;

type ClaimRow = {
  idempotency_key: string;
  booking_id: string | null;
  customer_id: string | null;
  trip_id: string | null;
  payment_id: string | null;
  charge_id: string | null;
  status: PixClaimStatus;
  lease_until: string | null;
  created_at: string;
  updated_at: string;
};

let client: SupabaseClient | null | undefined = undefined;
const memoryClaims = new Map<string, ClaimRow>();

function toClaim(row: ClaimRow): PaymentClaim {
  return {
    idempotencyKey: row.idempotency_key,
    bookingId: row.booking_id,
    customerId: row.customer_id,
    tripId: row.trip_id,
    paymentId: row.payment_id,
    chargeId: row.charge_id,
    status: row.status,
    leaseUntil: row.lease_until,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toSnakeCaseKey(key: string): string {
  return key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function toClaimRow(claim: PaymentClaim): ClaimRow {
  return {
    idempotency_key: claim.idempotencyKey,
    booking_id: claim.bookingId,
    customer_id: claim.customerId,
    trip_id: claim.tripId,
    payment_id: claim.paymentId,
    charge_id: claim.chargeId,
    status: claim.status,
    lease_until: claim.leaseUntil,
    created_at: claim.createdAt,
    updated_at: claim.updatedAt,
  };
}

function newLeaseIso(): string {
  return new Date(Date.now() + PIX_CLAIM_LEASE_MS).toISOString();
}

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

function memoryAcquire(
  key: string,
  customerId: string,
  tripId: string,
): { won: boolean; claim: PaymentClaim } {
  const existing = memoryClaims.get(key);
  if (existing) {
    return { won: false, claim: toClaim(existing) };
  }
  const now = new Date().toISOString();
  const row: ClaimRow = {
    idempotency_key: key,
    booking_id: null,
    customer_id: customerId,
    trip_id: tripId,
    payment_id: null,
    charge_id: null,
    status: "PENDING",
    lease_until: newLeaseIso(),
    created_at: now,
    updated_at: now,
  };
  memoryClaims.set(key, row);
  return { won: true, claim: toClaim(row) };
}

async function dbSelectClaim(key: string): Promise<PaymentClaim | null> {
  const db = getDbClient();
  if (!db) return null;
  const { data, error } = await db
    .from("payment_claims")
    .select("*")
    .eq("idempotency_key", key)
    .maybeSingle();
  if (error) throw error;
  return data ? toClaim(data as unknown as ClaimRow) : null;
}

function isMissingTableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("42P01") ||
    message.toLowerCase().includes("does not exist") ||
    message.includes("PGRST204")
  );
}

/**
 * Tenta adquirir a claim para a operação. Retorna won=true apenas para o
 * primeiro ocupante; os demais recebem a claim existente para conciliar.
 */
export async function acquirePixClaim(args: {
  key: string;
  customerId: string;
  tripId: string;
}): Promise<{ won: boolean; claim: PaymentClaim }> {
  const db = getDbClient();
  if (!db) {
    return memoryAcquire(args.key, args.customerId, args.tripId);
  }

  const now = new Date().toISOString();
  try {
    const { data, error } = await db
      .from("payment_claims")
      .upsert(
        {
          idempotency_key: args.key,
          customer_id: args.customerId,
          trip_id: args.tripId,
          status: "PENDING",
          lease_until: newLeaseIso(),
          created_at: now,
          updated_at: now,
        },
        { onConflict: "idempotency_key", ignoreDuplicates: true },
      );
    if (error) throw error;

    const inserted = (data ?? []) as ClaimRow[];
    if (inserted.length > 0) {
      return { won: true, claim: toClaim(inserted[0]) };
    }
    const existing = await dbSelectClaim(args.key);
    if (existing) {
      return { won: false, claim: existing };
    }
    return memoryAcquire(args.key, args.customerId, args.tripId);
  } catch (error) {
    if (isMissingTableError(error)) {
      return memoryAcquire(args.key, args.customerId, args.tripId);
    }
    throw error;
  }
}

/** Lê a claim atual (sem blocar). */
export async function getPixClaim(key: string): Promise<PaymentClaim | null> {
  const db = getDbClient();
  if (!db) {
    const row = memoryClaims.get(key);
    return row ? toClaim(row) : null;
  }
  try {
    return await dbSelectClaim(key);
  } catch (error) {
    if (isMissingTableError(error)) {
      const row = memoryClaims.get(key);
      return row ? toClaim(row) : null;
    }
    throw error;
  }
}

/**
 * Take-over condicional de claim com lease expirado (CAS). Quem ganha o
 * update renovou o lease; os demais continuam esperando a operação original.
 */
export async function takeoverExpiredClaim(
  key: string,
): Promise<{ won: boolean; claim: PaymentClaim | null }> {
  const db = getDbClient();
  const now = new Date().toISOString();

  if (!db) {
    const existing = memoryClaims.get(key);
    if (!existing) return { won: false, claim: null };
    if (!existing.lease_until || existing.lease_until <= now) {
      existing.lease_until = newLeaseIso();
      existing.updated_at = now;
      return { won: true, claim: toClaim(existing) };
    }
    return { won: false, claim: toClaim(existing) };
  }

  try {
    const { data, error } = await db
      .from("payment_claims")
      .update({ lease_until: newLeaseIso(), updated_at: now })
      .eq("idempotency_key", key)
      .lt("lease_until", now)
      .select("*");
    if (error) throw error;

    const rows = (data ?? []) as ClaimRow[];
    if (rows.length > 0) {
      return { won: true, claim: toClaim(rows[0]) };
    }
    return { won: false, claim: await dbSelectClaim(key) };
  } catch (error) {
    if (isMissingTableError(error)) {
      const existing = memoryClaims.get(key);
      if (!existing) return { won: false, claim: null };
      existing.lease_until = newLeaseIso();
      existing.updated_at = now;
      return { won: true, claim: toClaim(existing) };
    }
    throw error;
  }
}

/** Atualiza campos de recuperação da claim. */
export async function updatePixClaim(
  key: string,
  patch: Partial<
    Pick<
      PaymentClaim,
      "bookingId" | "customerId" | "tripId" | "paymentId" | "chargeId"
    >
  >,
): Promise<void> {
  const db = getDbClient();
  if (db) {
    const row: Partial<ClaimRow> = {};
    for (const [camel, value] of Object.entries(patch)) {
      row[toSnakeCaseKey(camel) as keyof ClaimRow] = value as never;
    }
    row.updated_at = new Date().toISOString();
    try {
      const { error } = await db
        .from("payment_claims")
        .update(row)
        .eq("idempotency_key", key);
      if (error) throw error;
      return;
    } catch (error) {
      if (!isMissingTableError(error)) throw error;
    }
  }
  const existing = memoryClaims.get(key);
  if (existing) {
    const claim = toClaim(existing);
    Object.assign(claim, patch);
    memoryClaims.set(key, toClaimRow({ ...claim, updatedAt: new Date().toISOString() }));
  }
}

/** Fecha a claim com sucesso: charge vinculada e payment persistido. */
export async function completePixClaim(
  key: string,
  fields: { bookingId: string; paymentId: string; chargeId: string | null },
): Promise<void> {
  const db = getDbClient();
  const now = new Date().toISOString();
  if (db) {
    try {
      const { error } = await db
        .from("payment_claims")
        .update({
          booking_id: fields.bookingId,
          payment_id: fields.paymentId,
          charge_id: fields.chargeId,
          status: "CHARGED",
          lease_until: null,
          updated_at: now,
        })
        .eq("idempotency_key", key);
      if (error) throw error;
      return;
    } catch (error) {
      if (!isMissingTableError(error)) throw error;
    }
  }
  const existing = memoryClaims.get(key);
  if (existing) {
    existing.booking_id = fields.bookingId;
    existing.payment_id = fields.paymentId;
    existing.charge_id = fields.chargeId;
    existing.status = "CHARGED";
    existing.lease_until = null;
    existing.updated_at = now;
  }
}

/**
 * Libera a claim (remove a linha). Usado quando a OPERAÇÃO falha de forma
 * definitiva no lado da aplicação (transação ou criação da cobrança): libera
 * a chave imediatamente, sem esperar o lease expirar, para que o retry
 * adquira uma claim nova e reprocesse com segurança. Seguro porque a
 * transação da reserva é idempotente (dedupe por conjunto de CPFs) e o Asaas
 * é reconciliado primeiro (reconcile-first por externalReference).
 */
export async function releasePixClaim(key: string): Promise<void> {
  const db = getDbClient();
  if (db) {
    try {
      const { error } = await db
        .from("payment_claims")
        .delete()
        .eq("idempotency_key", key);
      if (error) throw error;
      return;
    } catch (error) {
      if (!isMissingTableError(error)) throw error;
    }
  }
  memoryClaims.delete(key);
}