import "server-only";

import { v4 as uuid } from "uuid";
import { revalidatePath } from "next/cache";
import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import { getAsaasPayment } from "@/lib/payments/asaas";
import { computeRemainingBalance } from "@/lib/payments/balance";
import {
  collectPassengerIssuesForQuantity,
  formatPassengerIssuesMessage,
  type PassengerIssue,
} from "@/lib/booking/passengers";
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

export type AsaasWebhookStage =
  | "claim_event"
  | "find_internal_payment"
  | "payload_status"
  | "external_reference"
  | "value"
  | "gateway_payment_id"
  | "read_store"
  | "find_booking"
  | "passenger_validation"
  | "remote_charge"
  | "remote_value"
  | "remote_reference"
  | "confirm_payment"
  | "complete_event";

type StageTaggedError = Error & { asaasWebhookStage?: AsaasWebhookStage };

/** Anexa a etapa que falhou ao erro, sem alterar a mensagem original. */
function tagStage(error: unknown, stage: AsaasWebhookStage): StageTaggedError {
  const base =
    error instanceof Error
      ? error
      : new Error(`Falha inesperada (${typeof error}) no webhook do Asaas`);
  const tagged = base as StageTaggedError;
  tagged.asaasWebhookStage = stage;
  return tagged;
}

export function getAsaasWebhookStage(error: unknown): AsaasWebhookStage | undefined {
  return error instanceof Error
    ? (error as StageTaggedError).asaasWebhookStage
    : undefined;
}

/**
 * Log de observabilidade do webhook. Registra APENAS identificadores
 * (event id, tipo de evento, charge id e etapa) — nunca token, API key, CPF,
 * payload, nome ou valor do passageiro.
 */
function logWebhook(
  level: "info" | "error",
  message: string,
  context: {
    eventId: string;
    eventType: string;
    paymentId: string | null;
    stage?: AsaasWebhookStage;
    outcome?: string;
    error?: string;
  },
) {
  const payload = {
    eventId: context.eventId,
    eventType: context.eventType,
    paymentId: context.paymentId,
    ...(context.stage ? { stage: context.stage } : {}),
    ...(context.outcome ? { outcome: context.outcome } : {}),
    ...(context.error ? { error: context.error } : {}),
  };
  if (level === "error") {
    console.error(message, payload);
    return;
  }
  console.info(message, payload);
}

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
    const booking = store.bookings.find((b) => b.id === payment.bookingId);

    // REGRA CENTRAL, SEM EXCEÇÃO: nenhum pagamento confirma uma reserva cujos
    // passageiros estejam incompletos — nem em reserva já CONFIRMADA ou
    // CONCLUIDA. Uma reserva legada confirmada sem RG/declaração NÃO ganha
    // isenção: enquanto os dados não forem corrigidos, o pagamento não é
    // confirmado e o voucher não é liberado.
    if (booking) {
      const issues = collectPassengerIssuesForQuantity(
        store.passengers.filter((p) => p.bookingId === booking.id),
        booking.quantity,
      );
      if (issues.length > 0) {
        throw new Error(
          `Pagamento não confirmado: ${formatPassengerIssuesMessage(issues)}`,
        );
      }
    }

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

    if (payment.method === "CARTAO" && !isBalancePayment) {
      for (const inst of store.installments) {
        if (inst.bookingId === payment.bookingId && inst.status !== "PAGO") {
          inst.status = "PAGO";
          inst.paidAt = now;
          inst.method = payment.method;
        }
      }
    }
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
  "passenger_data_incomplete",
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
  const context = { eventId, eventType: eventName, paymentId: chargeId || null };

  let stage: AsaasWebhookStage = "claim_event";
  try {
    const claim = await claimAsaasWebhookEvent({ eventId, event: eventName, paymentId: chargeId });
    if (!claim.claimed) {
      if (claim.reason === "processed") {
        logWebhook("info", "ASAAS WEBHOOK DUPLICADO", {
          ...context,
          stage,
          outcome: "already_processed",
        });
        return { status: "duplicate" };
      }
      logWebhook("info", "ASAAS WEBHOOK EM PROCESSAMENTO", {
        ...context,
        stage,
        outcome: "in_flight",
      });
      return { status: "processing" };
    }
    logWebhook("info", "ASAAS WEBHOOK CLAIMED", { ...context, stage });

    if (!ASAAS_CONFIRMING_EVENTS.has(eventName)) {
      await completeAsaasWebhookEvent(eventId);
      logWebhook("info", "ASAAS WEBHOOK IGNORADO", {
        ...context,
        stage,
        outcome: "event_not_supported",
      });
      return { status: "ignored", reason: "event_not_supported" };
    }

    stage = "find_internal_payment";
    const internalPayment = await findAsaasInternalPayment(chargeId);
    if (!internalPayment || internalPayment.gateway !== "asaas") {
      await completeAsaasWebhookEvent(eventId);
      logWebhook("info", "ASAAS WEBHOOK IGNORADO", {
        ...context,
        stage,
        outcome: "payment_not_found",
      });
      return { status: "ignored", reason: "payment_not_found" };
    }

    if (eventName === "PAYMENT_CONFIRMED") {
      // Consulta o status remoto antes de decidir se apenas registra ou confirma.
      // Alguns ambientes do Asaas enviam PAYMENT_CONFIRMED com status já RECEIVED/CONFIRMED.
      stage = "remote_charge";
      try {
        const remoteCharge = await getAsaasPayment(internalPayment.gatewayPaymentId!);
        if (ASAAS_RECEIVED_STATUSES.has(remoteCharge.status)) {
          // Verifica consistência antes de confirmar (valor/referência)
          const expectedExternalReference =
            internalPayment.asaasExternalReference ?? `PRADOS-TOUR:${internalPayment.id}`;
          const payloadValue = typeof rawPayment.value === "number" ? rawPayment.value : null;
          const externalReference =
            typeof rawPayment.externalReference === "string" && rawPayment.externalReference.length > 0
              ? rawPayment.externalReference
              : null;

          if (
            (externalReference === null || externalReference === expectedExternalReference) &&
            (payloadValue === null || Math.abs(payloadValue - Number(internalPayment.amount)) <= MONEY_TOLERANCE) &&
            (remoteCharge.externalReference == null || remoteCharge.externalReference === expectedExternalReference) &&
            Math.abs(Number(remoteCharge.value) - Number(internalPayment.amount)) <= MONEY_TOLERANCE
          ) {
            // Valida passageiros antes de confirmar
            stage = "read_store";
            const store = await getRepositoryRuntime().read();
            const booking = store.bookings.find((b) => b.id === internalPayment.bookingId);
            if (booking) {
              stage = "passenger_validation";
              const issues = collectPassengerIssuesForQuantity(
                store.passengers.filter((p) => p.bookingId === booking.id),
                booking.quantity,
              );
              if (issues.length === 0) {
                stage = "confirm_payment";
                await confirmPaymentWebhook(internalPayment.gatewayPaymentId!);
                stage = "complete_event";
                await completeAsaasWebhookEvent(eventId);
                logWebhook("info", "ASAAS WEBHOOK CONFIRMADO", {
                  ...context,
                  stage,
                  outcome: "confirmed",
                });
                return { status: "confirmed" };
              } else {
                await notifyIncompletePassengers(booking, issues);
                await completeAsaasWebhookEvent(eventId);
                logWebhook("info", "ASAAS WEBHOOK IGNORADO", {
                  ...context,
                  stage,
                  outcome: "passenger_data_incomplete",
                });
                return { status: "ignored", reason: "passenger_data_incomplete" };
              }
            }
          }
        }
      } catch (error) {
        // Se não conseguir consultar o Asaas agora, libera para retry (não completa)
        await releaseAsaasWebhookEvent(eventId).catch(() => undefined);
        throw tagStage(error, stage);
      }

      await completeAsaasWebhookEvent(eventId);
      logWebhook("info", "ASAAS WEBHOOK REGISTRADO", {
        ...context,
        stage,
        outcome: "registered_only",
      });
      return { status: "registered_only" };
    }

    stage = "payload_status";
    if (!ASAAS_RECEIVED_STATUSES.has(String(rawPayment.status ?? ""))) {
      throw new Error(`Status do payload ainda não recebido: ${String(rawPayment.status)}`);
    }

    const externalReference =
      typeof rawPayment.externalReference === "string" && rawPayment.externalReference.length > 0
        ? rawPayment.externalReference
        : null;
    const payloadValue = typeof rawPayment.value === "number" ? rawPayment.value : null;
    const expectedExternalReference =
      internalPayment.asaasExternalReference ?? `PRADOS-TOUR:${internalPayment.id}`;

    stage = "external_reference";
    if (
      externalReference !== null &&
      externalReference !== expectedExternalReference
    ) {
      await completeAsaasWebhookEvent(eventId);
      logWebhook("info", "ASAAS WEBHOOK IGNORADO", {
        ...context,
        stage,
        outcome: "external_reference_mismatch",
      });
      return { status: "ignored", reason: "external_reference_mismatch" };
    }

    stage = "value";
    if (
      payloadValue !== null &&
      Math.abs(payloadValue - Number(internalPayment.amount)) > MONEY_TOLERANCE
    ) {
      await completeAsaasWebhookEvent(eventId);
      logWebhook("info", "ASAAS WEBHOOK IGNORADO", {
        ...context,
        stage,
        outcome: "value_mismatch",
      });
      return { status: "ignored", reason: "value_mismatch" };
    }

    stage = "gateway_payment_id";
    if (!internalPayment.gatewayPaymentId) {
      throw new Error(`Payment sem gatewayPaymentId: ${internalPayment.id}`);
    }

    stage = "read_store";
    const store = await getRepositoryRuntime().read();
    stage = "find_booking";
    const booking = store.bookings.find((b) => b.id === internalPayment.bookingId);
    if (!booking) {
      throw new Error(`Booking não encontrada para o pagamento: ${internalPayment.id}`);
    }

    // REGRA CENTRAL, SEM EXCEÇÃO: um pagamento não confirma uma reserva cujos
    // passageiros estejam incompletos, INCLUSIVE se a reserva já estiver
    // CONFIRMADA/CONCLUIDA (herança legada não concede isenção). É uma
    // rejeição DEFINITIVA — o evento é consumido em vez de reentregar para
    // sempre — e o cliente é notificado para corrigir os dados.
    stage = "passenger_validation";
    {
      const issues = collectPassengerIssuesForQuantity(
        store.passengers.filter((p) => p.bookingId === booking.id),
        booking.quantity,
      );
      if (issues.length > 0) {
        await notifyIncompletePassengers(booking, issues);
        await completeAsaasWebhookEvent(eventId);
        logWebhook("info", "ASAAS WEBHOOK IGNORADO", {
          ...context,
          stage,
          outcome: "passenger_data_incomplete",
        });
        return { status: "ignored", reason: "passenger_data_incomplete" };
      }
    }

    stage = "remote_charge";
    const remoteCharge = await getAsaasPayment(internalPayment.gatewayPaymentId!);
    if (!ASAAS_RECEIVED_STATUSES.has(remoteCharge.status)) {
      throw new Error(`Cobrança no Asaas ainda não recebida: ${remoteCharge.status}`);
    }
    stage = "remote_value";
    if (Math.abs(Number(remoteCharge.value) - Number(internalPayment.amount)) > MONEY_TOLERANCE) {
      await completeAsaasWebhookEvent(eventId);
      logWebhook("info", "ASAAS WEBHOOK IGNORADO", {
        ...context,
        stage,
        outcome: "remote_value_mismatch",
      });
      return { status: "ignored", reason: "remote_value_mismatch" };
    }
    stage = "remote_reference";
    if (
      remoteCharge.externalReference &&
      remoteCharge.externalReference !== expectedExternalReference
    ) {
      await completeAsaasWebhookEvent(eventId);
      logWebhook("info", "ASAAS WEBHOOK IGNORADO", {
        ...context,
        stage,
        outcome: "remote_reference_mismatch",
      });
      return { status: "ignored", reason: "remote_reference_mismatch" };
    }

    stage = "confirm_payment";
    await confirmPaymentWebhook(internalPayment.gatewayPaymentId!);
    stage = "complete_event";
    await completeAsaasWebhookEvent(eventId);
    logWebhook("info", "ASAAS WEBHOOK CONFIRMADO", { ...context, stage, outcome: "confirmed" });
    return { status: "confirmed" };
  } catch (error) {
    const tagged = tagStage(error, stage);
    logWebhook("error", "ASAAS WEBHOOK ERROR", {
      ...context,
      stage,
      error: tagged.message,
    });
    // Libera (e não completa) em TODA falha: é o que permite o Asaas reentregar
    // o MESMO event.id depois da próxima tentativa.
    await releaseAsaasWebhookEvent(eventId).catch(() => undefined);
    throw tagged;
  }
}

/** Conjuntos exportados para auditoria/observabilidade (sem tokens/payload). */
export const ASAAS_WEBHOOK_DEFINITIVE_IGNORES = DEFINITIVE_IGNORES;
export const ASAAS_WEBHOOK_TRANSIENT_FAILURES = TRANSIENT_FAILURES;

/**
 * Avisa o cliente (e a equipe) que a reserva não foi confirmada por falta de
 * dados completos dos passageiros. Falha de notificação não pode derrubar a
 * rejeição do webhook — por isso o `.catch`.
 */
async function notifyIncompletePassengers(
  booking: { id: string; reference: string; customerId: string },
  issues: PassengerIssue[],
) {
  const message = formatPassengerIssuesMessage(issues);
  try {
    await getRepositoryRuntime().transaction((store) => {
      const createdAt = new Date().toISOString();
      store.notifications.push({
        id: uuid(),
        userId: booking.customerId,
        title: "Dados dos passageiros incompletos",
        message: `Sua reserva ${booking.reference} não pôde ser confirmada. ${message} Corrija os dados em /minhas-viagens/${booking.id}/passageiros.`,
        type: "RESERVA",
        read: false,
        createdAt,
      });
      store.auditLogs.push({
        id: uuid(),
        userId: null,
        action: "PAYMENT_REJECTED_INCOMPLETE_PASSENGERS",
        entity: "booking",
        entityId: booking.id,
        oldValue: null,
        newValue: { reference: booking.reference, issues: issues.length },
        ip: null,
        createdAt,
      });
    });
  } catch (error) {
    console.error("[ASAAS] falha ao notificar dados incompletos:", error);
  }
}

async function findAsaasInternalPayment(chargeId: string) {
  if (!chargeId) return null;
  const store = await getRepositoryRuntime().read();
  return store.payments.find((p) => p.gatewayPaymentId === chargeId) ?? null;
}