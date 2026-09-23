import "server-only";

import { createHash } from "node:crypto";
import { v4 as uuid } from "uuid";
import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import { onlyDigits } from "@/lib/utils";
import {
  asaasPaymentLink,
  createAsaasPixPayment,
  findAsaasPaymentByExternalReference,
  getAsaasPayment,
  getAsaasPixQrCode,
  getOrCreateAsaasCustomer,
} from "@/lib/payments/asaas";
import {
  acquirePixClaim,
  completePixClaim,
  getPixClaim,
  releasePixClaim,
  takeoverExpiredClaim,
  updatePixClaim,
  type PaymentClaim,
} from "@/lib/payments/claims";
import type { Booking, DataStore, Payment, Trip } from "@/types";

/**
 * Cobrança do SALDO restante de reservas com pagamento parcial (PARCELADA).
 *
 * A fonte de verdade do saldo é SEMPRE o servidor: totalAmount - soma(payments
 * PAGO) da reserva. O frontend nunca informa valores. A cobrança é uma
 * segunda `Payment` (PIX/Asaas) marcada com metadata.type = "BALANCE" e um id
 * DETERMINÍSTICO derivado da reserva — a chave que garante idempotência local
 * e no Asaas (externalReference = "PRADOS-TOUR:<paymentId>").
 *
 * Regras financeiras:
 *  - nunca cobra o total novamente: valor = saldo exato;
 *  - antes de criar, verifica cobrança de saldo existente (reutiliza);
 *  - cobrança já paga => não cria outra (balance <= 0);
 *  - confirmação real só via webhook/consulta ao Asaas, nunca por retorno.
 */

const MONEY_TOLERANCE = 0.01;

/** UUID determinístico — mesmo esquema md5/versão do fluxo PIX de entrada. */
function uuidFromKey(key: string): string {
  const hex = createHash("md5").update(key).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/** Id do Payment de saldo: determinístico por reserva (idempotência local+Asaas). */
export function balancePaymentIdFor(bookingId: string): string {
  return uuidFromKey(`payment-pix|balance:${bookingId}`);
}

export function externalReferenceForBalancePayment(paymentId: string): string {
  return `PRADOS-TOUR:${paymentId}`;
}

/** Prazo de pagamento do saldo: 7 dias antes da viagem (mesma regra da parcela 2). */
export function balanceDueDateFor(trip: Pick<Trip, "date">): string {
  const date = new Date(`${trip.date}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 7);
  return date.toISOString().slice(0, 10);
}

/** Data de vencimento para a cobrança Asaas: nunca no passado. */
export function chargeDueDateFor(balanceDueDate: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return balanceDueDate >= today ? balanceDueDate : today;
}

/** Saldo restante calculado no servidor (total - soma de pagamentos PAGO). */
export function computeRemainingBalance(
  store: DataStore,
  bookingId: string,
): number {
  const booking = store.bookings.find((b) => b.id === bookingId);
  if (!booking) return 0;
  const paid = store.payments
    .filter((p) => p.bookingId === bookingId && p.status === "PAGO")
    .reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
  return Math.round((Number(booking.totalAmount) - paid) * 100) / 100;
}

/**
 * Reserva integralmente paga (saldo = 0). Autorização REAL de voucher: baseada
 * no estado do pagamento (soma de Payments PAGO == total), NÃO no status
 * CONFIRMADA nem na primeira parcela.
 */
export function isBookingFullyPaid(
  store: DataStore,
  bookingId: string,
): boolean {
  return computeRemainingBalance(store, bookingId) <= MONEY_TOLERANCE;
}

export type BalanceStatus =
  | "PENDENTE"
  | "VENCIDO"
  | "COMPLETO"
  | "VIAGEM_REALIZADA";

export type BalanceInfo = {
  total: number;
  paid: number;
  balance: number;
  dueDate: string | null;
  chargeDueDate: string | null;
  today: string;
  isDueDatePassed: boolean;
  isTripPassed: boolean;
  status: BalanceStatus;
  /** Parcela 2 (saldo), se existir no store. */
  installment2?: { value: number; dueDate: string; status: string } | null;
  /** Payment de saldo existente (metadata.type === "BALANCE"), se houver. */
  balancePayment?: Payment | null;
};

/** Localiza o Payment de saldo de uma reserva (idempotência de cobrança). */
export function findBalancePayment(
  store: DataStore,
  bookingId: string,
): Payment | undefined {
  return store.payments.find(
    (p) =>
      p.bookingId === bookingId &&
      (p.metadata as Record<string, unknown> | null | undefined)?.type ===
        "BALANCE",
  );
}

export function isBalancePayment(payment: Payment | undefined | null): boolean {
  return (
    Boolean(payment) &&
    (payment?.metadata as Record<string, unknown> | null | undefined)?.type ===
      "BALANCE"
  );
}

/** Resumo de saldo para UI (cliente e admin). Sempre derivado do servidor. */
export function getBalanceInfo(
  store: DataStore,
  booking: Booking,
  trip: Trip | undefined,
): BalanceInfo {
  const total = Number(booking.totalAmount ?? 0);
  const paid = store.payments
    .filter((p) => p.bookingId === booking.id && p.status === "PAGO")
    .reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
  const balance = Math.round((total - paid) * 100) / 100;
  const today = new Date().toISOString().slice(0, 10);
  const dueDate = trip ? balanceDueDateFor(trip) : null;
  const tripDate = trip ? trip.departureDate ?? trip.date : null;
  const isDueDatePassed = dueDate ? dueDate < today : false;
  const isTripPassed = tripDate ? tripDate < today : false;

  let status: BalanceStatus;
  if (balance <= MONEY_TOLERANCE) {
    status = "COMPLETO";
  } else if (isTripPassed) {
    status = "VIAGEM_REALIZADA";
  } else if (isDueDatePassed) {
    status = "VENCIDO";
  } else {
    status = "PENDENTE";
  }

  const installment2 = store.installments.find(
    (i) => i.bookingId === booking.id && i.number === 2,
  );
  const balancePayment = findBalancePayment(store, booking.id);

  return {
    total,
    paid,
    balance,
    dueDate,
    chargeDueDate: dueDate ? chargeDueDateFor(dueDate) : null,
    today,
    isDueDatePassed,
    isTripPassed,
    status,
    installment2: installment2
      ? {
          value: installment2.value,
          dueDate: installment2.dueDate,
          status: installment2.status,
        }
      : null,
    balancePayment,
  };
}

/* ---------------------------------------------------------------------------
 * Concorrência / claim da cobrança de saldo.
 * A chave é o paymentId determinístico da reserva: dois cliques no botão, ou
 * o retry após falha, convergem para a MESMA operação.
 * ------------------------------------------------------------------------- */

const BALANCE_CLAIM_WAIT_MS = 300;
const BALANCE_CLAIM_WAIT_ATTEMPTS = 30;

export type BalanceChargeGate = {
  proceed: boolean;
  claim?: PaymentClaim;
  message?: string;
};

async function gateBalanceCharge(
  key: string,
  customerId: string,
  tripId: string,
): Promise<BalanceChargeGate> {
  let acquired: { won: boolean; claim: PaymentClaim | undefined } =
    await acquirePixClaim({ key, customerId, tripId });
  let attempt = 0;

  while (!acquired.won) {
    const claim = acquired.claim;
    if (!claim) {
      const retried = await acquirePixClaim({ key, customerId, tripId });
      if (retried.won) {
        return { proceed: true, claim: retried.claim };
      }
      acquired = { won: false, claim: retried.claim };
      continue;
    }

    if (claim.status === "CHARGED") {
      return { proceed: false, claim };
    }

    const now = new Date().toISOString();
    const expired = !claim.leaseUntil || claim.leaseUntil <= now;
    if (expired) {
      const renewal = await takeoverExpiredClaim(key);
      if (renewal.won) {
        return { proceed: true, claim: renewal.claim ?? claim };
      }
    }

    if (attempt >= BALANCE_CLAIM_WAIT_ATTEMPTS) {
      return {
        proceed: false,
        claim,
        message:
          "A cobrança do saldo está sendo processada. Tente novamente em instantes.",
      };
    }

    attempt += 1;
    await new Promise((resolve) => setTimeout(resolve, BALANCE_CLAIM_WAIT_MS));
    const latest = await getPixClaim(key);
    acquired = { won: false, claim: latest ?? undefined };
  }

  return { proceed: true, claim: acquired.claim };
}

/* ---------------------------------------------------------------------------
 * Persistência do Payment de saldo (segunda linha da reserva).
 * ------------------------------------------------------------------------- */

async function persistBalancePayment(
  bookingId: string,
  paymentId: string,
  data: {
    chargeId: string;
    payload: string | null;
    expirationDate: string | null;
    paymentUrl?: string | null;
    amount: number;
    dueDate: string;
    responsibleEmail?: string;
  },
): Promise<void> {
  await getRepositoryRuntime().transaction((store) => {
    const booking = store.bookings.find((b) => b.id === bookingId);
    if (!booking) {
      throw new Error("Reserva não encontrada ao registrar o saldo.");
    }

    const existing = store.payments.find((p) => p.id === paymentId);
    const now = new Date().toISOString();
    const externalReference = externalReferenceForBalancePayment(paymentId);

    const metadata: Record<string, unknown> = {
      ...(existing?.metadata ?? {}),
      type: "BALANCE",
      installNumber: 2,
      awaitingWebhook: true,
      pixState: data.payload ? "QR_READY" : "CHARGE_PENDING_QR",
      pixExpirationDate: data.expirationDate ?? null,
      paymentUrl: data.paymentUrl ?? null,
      asaasExternalReference: externalReference,
      responsibleEmail: data.responsibleEmail?.trim() || null,
    };

    const next: Payment = {
      id: paymentId,
      bookingId,
      customerId: existing?.customerId ?? booking.customerId,
      method: "PIX",
      plan: existing?.plan ?? booking.paymentPlan,
      amount: data.amount,
      status: "PENDENTE",
      gateway: "asaas",
      gatewayPaymentId: data.chargeId,
      feeAmount: 0,
      netAmount: data.amount,
      paidAt: null,
      pixCopyPaste: data.payload,
      asaasExternalReference: externalReference,
      metadata,
      createdAt: existing?.createdAt ?? now,
    };

    if (existing) {
      Object.assign(existing, next);
    } else {
      store.payments.push(next);
    }

    // Garante a parcela 2 (saldo) alinhada com o valor cobrado. Idempotente:
    // se já existe (como nas reservas antigas), mantém os dados originais.
    const missingInstallment2 = !store.installments.some(
      (i) => i.bookingId === bookingId && i.number === 2,
    );
    if (missingInstallment2) {
      store.installments.push({
        id: uuid(),
        bookingId,
        number: 2,
        value: data.amount,
        dueDate: data.dueDate,
        status: "PENDENTE",
        paidAt: null,
        method: null,
      });
    }
  });
}

/* ---------------------------------------------------------------------------
 * Criação/idempotência da cobrança Asaas do saldo.
 * Ordia: claim atômica (feita pela action) -> reconcile-first -> criar só se
 * não existir -> salvar gatewayPaymentId -> QR -> persistir Payment PENDENTE.
 * Nunca marca PAGO e nunca chama confirmPaymentWebhook aqui.
 * ------------------------------------------------------------------------- */

export async function ensureAsaasBalancePayment(
  bookingId: string,
  paymentId: string,
  opts: {
    amount: number;
    dueDate: string;
    responsibleEmail?: string;
  },
): Promise<{
  ok: boolean;
  alreadyPaid?: boolean;
  message?: string;
  error?: string;
  pixCopyPaste?: string | null;
  paymentUrl?: string | null;
}> {
  let completed = false;
  try {
    let store;
    try {
      store = await getRepositoryRuntime().read();
    } catch (error) {
      console.error("[ASAAS] read() falhou em ensureAsaasBalancePayment:", error);
      return { ok: false, error: "read_failed" };
    }

    const existing = store.payments.find((p) => p.id === paymentId);
    if (existing?.status === "PAGO") {
      completed = true;
      return { ok: true, alreadyPaid: true };
    }

    const booking = store.bookings.find((b) => b.id === bookingId);
    const trip = store.trips.find((t) => t.id === booking?.tripId);
    const profile = store.profiles.find((p) => p.id === booking?.customerId);
    if (!booking || !trip || !profile) {
      return {
        ok: false,
        message: "Dados da reserva incompletos para gerar o PIX do saldo.",
      };
    }

    const externalReference = externalReferenceForBalancePayment(paymentId);
    const amount = existing?.amount ?? opts.amount;

    let chargeId: string | null = existing?.gatewayPaymentId ?? null;

    let paymentUrl: string | null =
      typeof existing?.metadata?.paymentUrl === "string" &&
      existing.metadata.paymentUrl.trim()
        ? existing.metadata.paymentUrl.trim()
        : null;

    if (!chargeId) {
      try {
        chargeId =
          (await findAsaasPaymentByExternalReference(externalReference))?.id ??
          null;
      } catch {
        chargeId = null;
      }
    }

    if (!chargeId) {
      try {
        const asaasCustomer = await getOrCreateAsaasCustomer({
          name: profile.fullName,
          cpfCnpj: profile.cpf,
          email: opts.responsibleEmail?.trim() || profile.email,
          mobilePhone: onlyDigits(profile.phone ?? profile.whatsapp ?? ""),
          externalReference: `pt-customer-${booking.customerId}`,
        });

        const created = await createAsaasPixPayment({
          customer: asaasCustomer.id,
          billingType: "PIX",
          value: amount,
          dueDate: opts.dueDate,
          description: `Saldo restante ${booking.reference} - ${trip.name}`.slice(
            0,
            120,
          ),
          externalReference,
        }).catch(async (error) => {
          console.error(
            "[ASAAS] Erro ao criar cobrança do saldo:",
            error instanceof Error ? error.message : error,
          );
          try {
            return (
              (await findAsaasPaymentByExternalReference(externalReference)) ??
              null
            );
          } catch {
            return null;
          }
        });

        if (created) {
          chargeId = created.id;
          paymentUrl = asaasPaymentLink(created) ?? paymentUrl;
          await updatePixClaim(paymentId, { chargeId, bookingId }).catch(
            () => undefined,
          );
        }
      } catch (error) {
        console.error("[ASAAS] Falha ao criar/reconciliar cobrança do saldo:", {
          bookingId,
          paymentId,
          externalReference,
          error: error instanceof Error ? error.message : error,
        });
        return {
          ok: false,
          message:
            "Não foi possível gerar o PIX do saldo neste momento. Tente novamente em instantes.",
        };
      }
    }

    if (!chargeId) {
      return {
        ok: false,
        message:
          "Não foi possível gerar o PIX do saldo neste momento. Tente novamente em instantes.",
      };
    }

    if (!paymentUrl) {
      // Leitura ÚNICA (GET) da cobrança já existente: obtém o link web sem
      // criar nenhuma cobrança nova. Falhou/inexistente -> mantém QR normal.
      try {
        paymentUrl = asaasPaymentLink(await getAsaasPayment(chargeId));
      } catch (error) {
        console.error(
          "[ASAAS] Falha ao obter link de pagamento da cobrança do saldo:",
          error instanceof Error ? error.message : error,
        );
        paymentUrl = null;
      }
    }

    let payload = existing?.pixCopyPaste ?? null;
    let expirationDate: string | null =
      typeof existing?.metadata?.pixExpirationDate === "string"
        ? existing.metadata.pixExpirationDate
        : null;

    if (!payload && chargeId) {
      try {
        const qrCode = await getAsaasPixQrCode(chargeId);
        payload = qrCode.payload;
        expirationDate = qrCode.expirationDate;
      } catch (error) {
        console.error(
          "[ASAAS] Erro ao obter QR Code do saldo:",
          error instanceof Error ? error.message : error,
        );
        payload = null;
      }
    }

    try {
      await persistBalancePayment(bookingId, paymentId, {
        chargeId,
        payload,
        expirationDate,
        paymentUrl,
        amount,
        dueDate: opts.dueDate,
        responsibleEmail: opts.responsibleEmail,
      });
    } catch (error) {
      console.error(
        "[ASAAS] persistBalancePayment() falhou em ensureAsaasBalancePayment:",
        { bookingId, paymentId, error: error instanceof Error ? error.message : error },
      );
      return { ok: false, error: "persist_failed" };
    }

    await completePixClaim(paymentId, {
      bookingId,
      paymentId,
      chargeId,
    }).catch(() => undefined);

    completed = true;

    if (!payload) {
      return {
        ok: false,
        message:
          "O PIX do saldo foi gerado, mas o QR Code ainda está pendente. Tente abrir a reserva novamente em instantes.",
        pixCopyPaste: payload,
        paymentUrl,
      };
    }

    return { ok: true, pixCopyPaste: payload, paymentUrl };
  } finally {
    if (!completed) {
      await releasePixClaim(paymentId).catch(() => undefined);
    }
  }
}

/** Link web de pagamento da cobrança de saldo salvo no metadata (se houver). */
function balancePaymentUrl(payment: Payment | undefined): string | null {
  if (!payment) return null;
  const link = payment.metadata?.paymentUrl;
  return typeof link === "string" && link.trim() ? link.trim() : null;
}

/** Ponto de entrada único da cobrança de saldo usado pela action (com claim). */
export async function ensureBalanceChargeForBooking(
  booking: Booking,
  trip: Trip | undefined,
  opts: { responsibleEmail?: string },
): Promise<{
  ok: boolean;
  reused?: boolean;
  alreadyPaid?: boolean;
  message?: string;
  error?: string;
  amount?: number;
  pixCopyPaste?: string | null;
  paymentUrl?: string | null;
}> {
  if (!trip) {
    return { ok: false, message: "Viagem não encontrada." };
  }

  const store = await getRepositoryRuntime().read();
  const balance = computeRemainingBalance(store, booking.id);
  if (balance <= MONEY_TOLERANCE) {
    return { ok: true, alreadyPaid: true, amount: balance };
  }

  const dueDate = balanceDueDateFor(trip);
  const chargeDueDate = chargeDueDateFor(dueDate);
  const balancePaymentId = balancePaymentIdFor(booking.id);

  const existing = findBalancePayment(store, booking.id);
  if (existing?.status === "PAGO") {
    return { ok: true, alreadyPaid: true, amount: balance };
  }

  // Cobrança pendente JÁ criada: reutiliza (reconciliar/refrescar QR) e nunca
  // cria outra. Esta é a proteção principal contra duplicidade no retry.
  if (existing?.gatewayPaymentId) {
    const ensured = await ensureAsaasBalancePayment(booking.id, existing.id, {
      amount: balance,
      dueDate: chargeDueDate,
      responsibleEmail: opts.responsibleEmail,
    });
    if (!ensured.ok) {
      return {
        ok: false,
        message: ensured.message,
        error: ensured.error,
        amount: balance,
        pixCopyPaste: existing.pixCopyPaste,
        paymentUrl: ensured.paymentUrl,
      };
    }
    return {
      ok: true,
      reused: true,
      amount: balance,
      pixCopyPaste: existing.pixCopyPaste ?? ensured.pixCopyPaste,
      paymentUrl: ensured.paymentUrl ?? balancePaymentUrl(existing),
    };
  }

  const gate = await gateBalanceCharge(
    balancePaymentId,
    booking.customerId,
    booking.tripId,
  );

  if (!gate.proceed) {
    if (gate.claim?.status === "CHARGED") {
      // Adoção: outro processo concluiu a cobrança (mesma chave). Reconcilia.
      const ensured = await ensureAsaasBalancePayment(
        booking.id,
        balancePaymentId,
        {
          amount: balance,
          dueDate: chargeDueDate,
          responsibleEmail: opts.responsibleEmail,
        },
      );
      if (!ensured.ok) {
        return {
          ok: false,
          message: ensured.message,
          error: ensured.error,
          amount: balance,
          pixCopyPaste: ensured.pixCopyPaste,
          paymentUrl: ensured.paymentUrl,
        };
      }
      const after = await getRepositoryRuntime().read();
      const row = after.payments.find((p) => p.id === balancePaymentId);
      return {
        ok: true,
        reused: true,
        amount: balance,
        pixCopyPaste: row?.pixCopyPaste ?? ensured.pixCopyPaste,
        paymentUrl: ensured.paymentUrl ?? balancePaymentUrl(row),
      };
    }
    return {
      ok: false,
      message:
        gate.message ??
        "A cobrança do saldo está sendo processada. Tente novamente em instantes.",
      amount: balance,
    };
  }

  const ensured = await ensureAsaasBalancePayment(booking.id, balancePaymentId, {
    amount: balance,
    dueDate: chargeDueDate,
    responsibleEmail: opts.responsibleEmail,
  });

  if (ensured.alreadyPaid) {
    return { ok: true, alreadyPaid: true, amount: balance };
  }
  if (!ensured.ok) {
    return {
      ok: false,
      message: ensured.message,
      error: ensured.error,
      amount: balance,
      pixCopyPaste: ensured.pixCopyPaste,
      paymentUrl: ensured.paymentUrl,
    };
  }

  return {
    ok: true,
    reused: false,
    amount: balance,
    pixCopyPaste: ensured.pixCopyPaste,
    paymentUrl: ensured.paymentUrl,
  };
}