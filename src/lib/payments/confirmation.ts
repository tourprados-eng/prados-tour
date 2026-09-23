import "server-only";

import { v4 as uuid } from "uuid";
import { revalidatePath } from "next/cache";
import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import { getAsaasPayment } from "@/lib/payments/asaas";
import { computeRemainingBalance } from "@/lib/payments/balance";
import {
  claimAsaasWebhookEvent,
  completeAsaasWebhookEvent,
  releaseAsaasWebhookEvent,
} from "@/lib/payments/webhook-events";

/**
 * Confirmação de pagamentos do lado do servidor.
 *
 * Module intencionalmente SEM "use server": nenhuma função aqui pode ser
 * invocada como server action pelo cliente — o único caminho de execução é o
 * webhook oficial do Asaas (validações) ou o simulate interno restrito a
 * financeiro (que importa `confirmPaymentWebhook` deste módulo).
 *
 * Regra financeira aprovada:
 *  - PAYMENT_CONFIRMED: registra o evento e valida a cobrança. NÃO marca PAGO,
 *    NÃO confirma Booking, NÃO libera voucher.
 *  - PAYMENT_RECEIVED: único gateway de confirmação. Sobrevive a todas as
 *    validações (chave única, gateway, referência externa, reserva, valor) e
 *    à verificação na API do Asaas ANTES de chamar a confirmação.
 *  - PAYMENT_REFUNDED / chargeback: ainda NÃO alteram o Payment (documentado).
 *
 * IDEMPOTÊNCIA + RETRY:
 *  - Antes de qualquer regra, o evento é CLAIMADO como PROCESSING (atômico na
 *    PK event_id). Duplicatas simultâneas não processam em paralelo.
 *  - Sucesso ou rejeição DEFINITIVA (mismatches de valor/referência, evento
 *    não suportado) → COMPLETA como PROCESSED (reentrega = no-op).
 *  - Falha TRANSITÓRIA (Payment/Booking ainda não existem, status remoto ainda
 *    não RECEIVED, erro de API/banco) → LIBERA a row e lança 5xx — o Asaas
 *    reenviará e o MESMO body.id poderá ser reprocessado legitimamente.
 */

const ASAAS_CONFIRMING_EVENTS = new Set(["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"]);
const ASAAS_RECEIVED_STATUSES = new Set(["CONFIRMED", "RECEIVED"]);
const MONEY_TOLERANCE = 0.01;

/**
 * Confirmação real do pagamento (efeitos: Payment PAGO + paidAt, parcela
 * correspondente PAGO, Booking CONFIRMADA, pontos, notificação e liberação do
 * voucher). Idempotente: se o Payment já está PAGO, não produz efeito algum.
 *
 * Para pagamentos de SALDO (metadata.type === "BALANCE") marca a PARCELA 2.
 * Fallback (reservas antigas sem parcela 2 cadastrada): marca a primeira
 * parcela PENDENTE da reserva — assim uma reserva histórica que só tinha a
 * parcela 1 paga passa a ter a parcela 2 como PAGO.
 */
export async function confirmPaymentWebhook(gatewayPaymentId: string) {
  await getRepositoryRuntime().transaction((store) => {
    const payment = store.payments.find((p) => p.gatewayPaymentId === gatewayPaymentId);
    if (!payment || payment.status === "PAGO") return;
    const now = new Date().toISOString();
    payment.status = "PAGO";
    payment.paidAt = now;

    const isBalancePayment =
      (payment.metadata as Record<string, unknown> | null | undefined)?.type === "BALANCE";
    const targetNumber = isBalancePayment ? 2 : 1;

    const installment =
      store.installments.find(
        (i) => i.bookingId === payment.bookingId && i.number === targetNumber,
      ) ??
      store.installments
        .filter((i) => i.bookingId === payment.bookingId && i.status !== "PAGO")
        .sort((a, b) => a.number - b.number)[0];

    if (installment) {
      installment.status = "PAGO";
      installment.paidAt = now;
      installment.method = payment.method;
    }
    const booking = store.bookings.find((b) => b.id === payment.bookingId);
    if (booking) {
      booking.status = "CONFIRMADA";
      booking.updatedAt = now;
      store.loyaltyPoints.push({
        id: uuid(),
        customerId: booking.customerId,
        points: Math.floor(payment.amount),
        source: "PAGAMENTO",
        bookingId: booking.id,
        createdAt: now,
      });
      // Voucher só é liberado com a reserva 100% paga (saldo = 0). A
      // notificação informa o estado real; a regra de acesso do /voucher é
      // derivada do pagamento, não deste texto.
      const fullyPaidNow =
        computeRemainingBalance(store, booking.id) <= MONEY_TOLERANCE;
      store.notifications.push({
        id: uuid(),
        userId: booking.customerId,
        title: isBalancePayment ? "Saldo confirmado" : "Pagamento confirmado",
        message: isBalancePayment
          ? fullyPaidNow
            ? `Seu pagamento do saldo restante da reserva ${booking.reference} foi confirmado. Reserva totalmente quitada. Seu voucher já está disponível.`
            : `Seu pagamento do saldo restante da reserva ${booking.reference} foi confirmado.`
          : fullyPaidNow
            ? `Pagamento da reserva ${booking.reference} confirmado. Seu voucher já está disponível.`
            : `Pagamento da reserva ${booking.reference} confirmado. Falta quitar o saldo restante para liberar o voucher.`,
        type: isBalancePayment ? "SALDO" : "PAGAMENTO",
        read: false,
        createdAt: now,
      });
      store.auditLogs.push({
        id: uuid(),
        userId: null,
        action: isBalancePayment ? "BALANCE_PAYMENT_CONFIRMED" : "PAYMENT_CONFIRMED",
        entity: "booking",
        entityId: booking.id,
        oldValue: { method: payment.method, installment: targetNumber },
        newValue: { status: "PAGO", reference: booking.reference, installment: targetNumber },
        ip: null,
        createdAt: now,
      });
    }
  });
  revalidatePath("/admin");
  revalidatePath("/minhas-viagens");
}

export type AsaasWebhookEventInput = {
  id: string;
  event: string;
  payment?: {
    id?: unknown;
    value?: unknown;
    externalReference?: unknown;
    status?: unknown;
  } | null;
};

export type AsaasWebhookProcessResult =
  | { status: "duplicate" }
  | { status: "processing" }
  | { status: "ignored"; reason: string }
  | { status: "registered_only" }
  | { status: "confirmed" };

/** Rejeições DEFINITIVAS: consomem o evento (PROCESSED) — reprocessar repetiria o mesmo resultado. */
const DEFINITIVE_IGNORES = new Set([
  "event_not_supported",
  "external_reference_mismatch",
  "value_mismatch",
  "remote_value_mismatch",
  "remote_reference_mismatch",
]);

/** Falhas TRANSITÓRIAS: liberam a row para reprocessar o MESMO event_id. */
const TRANSIENT_FAILURES = new Set([
  "payment_not_found",
  "booking_not_found",
  "status_not_received",
  "remote_status_not_received",
]);

/**
 * Roteia um evento de webhook do Asaas com claim atômico + retry seguro.
 */
export async function processAsaasPaymentEvent(
  payload: AsaasWebhookEventInput,
): Promise<AsaasWebhookProcessResult> {
  const eventId = payload.id;
  const eventName = payload.event;
  const rawPayment = payload.payment ?? {};
  const chargeId = typeof rawPayment.id === "string" ? rawPayment.id : "";

  const claim = await claimAsaasWebhookEvent({ eventId, event: eventName, paymentId: chargeId });
  if (!claim.claimed) {
    if (claim.reason === "processed") {
      return { status: "duplicate" };
    }
    return { status: "processing" };
  }

  if (!ASAAS_CONFIRMING_EVENTS.has(eventName)) {
    await completeAsaasWebhookEvent(eventId);
    return { status: "ignored", reason: "event_not_supported" };
  }

  try {
    const internalPayment = await findAsaasInternalPayment(chargeId);
    if (!internalPayment || internalPayment.gateway !== "asaas") {
      // Cobranças antigas que já não existem no banco não podem ser
      // confirmadas. Consome o evento para não bloquear a fila do Asaas.
      await completeAsaasWebhookEvent(eventId);
      return { status: "ignored", reason: "payment_not_found" };
    }

    if (eventName === "PAYMENT_CONFIRMED") {
      await completeAsaasWebhookEvent(eventId);
      return { status: "registered_only" };
    }

    if (!ASAAS_RECEIVED_STATUSES.has(String(rawPayment.status ?? ""))) {
      await releaseAsaasWebhookEvent(eventId);
      throw new Error(`Status do payload ainda não recebido: ${String(rawPayment.status)}`);
    }

    const externalReference =
      typeof rawPayment.externalReference === "string" && rawPayment.externalReference.length > 0
        ? rawPayment.externalReference
        : null;
    const payloadValue = typeof rawPayment.value === "number" ? rawPayment.value : null;
    const expectedExternalReference =
      internalPayment.asaasExternalReference ?? `PRADOS-TOUR:${internalPayment.id}`;

    if (
      externalReference !== null &&
      externalReference !== expectedExternalReference
    ) {
      await completeAsaasWebhookEvent(eventId);
      return { status: "ignored", reason: "external_reference_mismatch" };
    }

    if (
      payloadValue !== null &&
      Math.abs(payloadValue - Number(internalPayment.amount)) > MONEY_TOLERANCE
    ) {
      await completeAsaasWebhookEvent(eventId);
      return { status: "ignored", reason: "value_mismatch" };
    }

    if (!internalPayment.gatewayPaymentId) {
      await releaseAsaasWebhookEvent(eventId);
      throw new Error(`Payment sem gatewayPaymentId: ${internalPayment.id}`);
    }

    const store = await getRepositoryRuntime().read();
    const booking = store.bookings.find((b) => b.id === internalPayment.bookingId);
    if (!booking) {
      await releaseAsaasWebhookEvent(eventId);
      throw new Error(`Booking não encontrada para o pagamento: ${internalPayment.id}`);
    }

    const remoteCharge = await getAsaasPayment(internalPayment.gatewayPaymentId);
    if (!ASAAS_RECEIVED_STATUSES.has(remoteCharge.status)) {
      await releaseAsaasWebhookEvent(eventId);
      throw new Error(`Cobrança no Asaas ainda não recebida: ${remoteCharge.status}`);
    }
    if (Math.abs(Number(remoteCharge.value) - Number(internalPayment.amount)) > MONEY_TOLERANCE) {
      await completeAsaasWebhookEvent(eventId);
      return { status: "ignored", reason: "remote_value_mismatch" };
    }
    if (
      remoteCharge.externalReference &&
      remoteCharge.externalReference !== expectedExternalReference
    ) {
      await completeAsaasWebhookEvent(eventId);
      return { status: "ignored", reason: "remote_reference_mismatch" };
    }

    await confirmPaymentWebhook(internalPayment.gatewayPaymentId);
    await completeAsaasWebhookEvent(eventId);
    return { status: "confirmed" };
  } catch (error) {
    await releaseAsaasWebhookEvent(eventId).catch(() => undefined);
    throw error;
  }
}

/** Conjuntos exportados para auditoria/observabilidade (sem tokens/payload). */
export const ASAAS_WEBHOOK_DEFINITIVE_IGNORES = DEFINITIVE_IGNORES;
export const ASAAS_WEBHOOK_TRANSIENT_FAILURES = TRANSIENT_FAILURES;

async function findAsaasInternalPayment(chargeId: string) {
  if (!chargeId) return null;
  const store = await getRepositoryRuntime().read();
  return store.payments.find((p) => p.gatewayPaymentId === chargeId) ?? null;
}