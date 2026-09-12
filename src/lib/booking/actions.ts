"use server";

import { v4 as uuid } from "uuid";
import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getSession, canAccess } from "@/lib/auth/session";
import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import { isValidCpf, onlyDigits } from "@/lib/utils";
import { canAccessRole } from "@/lib/roles";
import { computeBookingPrice } from "@/lib/pricing";
import type { Payment, PaymentMethod, PaymentPlan } from "@/types";
import {
  createAsaasPixPayment,
  findAsaasPaymentByExternalReference,
  getAsaasPixQrCode,
  getOrCreateAsaasCustomer,
} from "@/lib/payments/asaas";
import {
  acquirePixClaim,
  completePixClaim,
  getPixClaim,
  takeoverExpiredClaim,
  updatePixClaim,
  type PaymentClaim,
} from "@/lib/payments/claims";
import { confirmPaymentWebhook } from "@/lib/payments/confirmation";

export type CheckoutInput = {
  tripId: string;
  quantity: number;
  boardingPointId: string;
  paymentMethod: PaymentMethod;
  paymentPlan: PaymentPlan;
  installmentCount?: number;
  couponCode?: string;
  passengers: Array<{
    name: string;
    cpf: string;
    birthDate: string;
    phone: string;
    seatGroup?: string;
  }>;
  sellerCode?: string;
  /** Identificador da sessão de checkout (evita reserva duplicada no retry). */
  clientRequestId?: string;
  /** E-mail do responsável pela compra (validado; contato usa o e-mail da conta). */
  responsibleEmail?: string;
};

const birthDateSchema = z.string().refine((value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return false;
  if (y < 1900) return false;
  const today = new Date();
  const cutoff = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  return date.getTime() <= cutoff.getTime();
}, { message: "Data de nascimento inválida." });

const passengerSchema = z.object({
  name: z.string().trim().min(3, "Informe o nome completo de cada passageiro."),
  cpf: z.string().refine((v) => isValidCpf(v), { message: "CPF inválido." }),
  birthDate: birthDateSchema,
  phone: z
    .string()
    .transform(onlyDigits)
    .refine((v) => v.length >= 10 && v.length <= 13, {
      message: "Telefone inválido para um passageiro.",
    }),
  seatGroup: z.string().max(24).optional(),
});

export async function createBookingAction(input: CheckoutInput) {
  const session = await getSession();
  if (!session) {
    return { error: "Faça login para reservar." };
  }

  let outcome: { bookingId: string; reference: string } | null = null;

  const passengersResult = z.array(passengerSchema).safeParse(input.passengers ?? []);
  if (!passengersResult.success) {
    return {
      error:
        passengersResult.error.issues[0]?.message ??
        "Dados de passageiros inválidos.",
    };
  }

  if (
    input.responsibleEmail &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.responsibleEmail)
  ) {
    return { error: "E-mail do responsável inválido." };
  }

  const isPixPayment = input.paymentMethod === "PIX";
  const paymentId = isPixPayment ? pixPaymentId(input, session.id) : uuid();

  if (isPixPayment) {
    const gate = await gatePixClaim(paymentId, session.id, input.tripId);

    if (!gate.proceed) {
      const completedId =
        gate.claim?.status === "CHARGED" && gate.claim.bookingId
          ? gate.claim.bookingId
          : null;
      if (completedId) {
        const adopted = await ensureAsaasPixPayment(completedId, paymentId, {
          responsibleEmail: input.responsibleEmail,
        });
        revalidatePath("/");
        revalidatePath("/minhas-viagens");
        if (adopted.ok) {
          redirect(`/checkout/sucesso?booking=${completedId}`);
        }
        return {
          error:
            adopted.message ??
            "Sua reserva está pronta. Tente abrir o PIX novamente em instantes.",
        };
      }
      return {
        error:
          gate.message ?? "Sua reserva está sendo processada. Tente novamente em instantes.",
      };
    }

    if (gate.resumeBookingId) {
      const store = await getRepositoryRuntime().read();
      const existing = store.bookings.find((b) => b.id === gate.resumeBookingId);
      if (existing && existing.tripId === input.tripId) {
        outcome = { bookingId: existing.id, reference: existing.reference };
      }
    }
  }

  if (!outcome) {
    try {
      outcome = await getRepositoryRuntime().transaction(async (store) => {
      const trip = store.trips.find((t) => t.id === input.tripId);
      if (!trip || trip.status !== "PUBLICADA" || trip.deletedAt) {
        throw new Error("Viagem indisponível.");
      }
      if (trip.date < new Date().toISOString().slice(0, 10)) {
        throw new Error("Data da viagem inválida.");
      }
      if (input.quantity < 1 || input.passengers.length !== input.quantity) {
        throw new Error("Quantidade de passageiros inválida.");
      }

      // Idempotência: mesma viagem + cliente + requisição (ou reserva recente
      // idêntica) retorna a reserva já criada, sem duplicar no refresh/retry.
      const recentWindow = new Date(Date.now() - 60_000).toISOString();
      const existing = store.bookings.find(
        (b) =>
          b.customerId === session.id &&
          b.tripId === trip.id &&
          ((input.clientRequestId && b.clientRequestId === input.clientRequestId) ||
            (b.status === "PENDENTE" &&
              b.createdAt >= recentWindow &&
              b.quantity === input.quantity)),
      );
      if (existing) {
        return { bookingId: existing.id, reference: existing.reference };
      }

      const occupied = store.passengers.filter((p) => {
        const b = store.bookings.find((x) => x.id === p.bookingId);
        return (
          b &&
          b.tripId === trip.id &&
          (b.status === "PENDENTE" || b.status === "CONFIRMADA")
        );
      }).length;
      if (occupied + input.quantity > trip.totalSeats) {
        throw new Error("Não há vagas suficientes.");
      }

      const boarding = store.boardingPoints.find(
        (b) => b.id === input.boardingPointId && b.active,
      );

      if (!boarding) {
        throw new Error("Ponto de embarque inválido.");
      }

      const tripBoarding = store.tripBoardingPoints.find(
        (item) =>
          item.tripId === trip.id &&
          item.boardingPointId === boarding.id,
      );

      if (!tripBoarding) {
        throw new Error(
          "Este ponto de embarque não está disponível para esta viagem.",
        );
      }

      // Preço, promoção, cupom e PIX calculados pelo motor central de preços.
      const pricing = computeBookingPrice({
        store,
        trip,
        quantity: input.quantity,
        paymentMethod: input.paymentMethod,
        paymentPlan: input.paymentPlan,
        couponCode: input.couponCode,
        userId: session.id,
      });
      if (pricing.error) throw new Error(pricing.error);
      if (!pricing.breakdown) throw new Error("Erro ao calcular o valor da reserva.");

      const price = pricing.breakdown;
      const total = price.totalAmount;

      if (
        input.paymentMethod === "CARTAO" &&
        (!Number.isInteger(input.installmentCount) ||
          input.installmentCount! < 1 ||
          input.installmentCount! > 5)
      ) {
        throw new Error("Escolha uma quantidade de parcelas entre 1x e 5x.");
      }

      const now = new Date().toISOString();
      const reference = `PT${String(store.bookings.length + 1).padStart(6, "0")}`;
      const bookingId = uuid();

      let sellerId: string | null = null;
      if (input.sellerCode) {
        const seller = store.sellers.find(
          (s) => s.code.toUpperCase() === input.sellerCode!.toUpperCase(),
        );
        if (seller) sellerId = seller.id;
      } else if (session.role === "VENDEDOR") {
        sellerId = session.id;
      }

      const cardInstallments =
        input.paymentMethod === "CARTAO"
          ? input.installmentCount ?? 1
          : 1;

      const initial =
        input.paymentMethod === "CARTAO"
          ? total
          : input.paymentPlan === "TOTAL"
            ? total
            : Math.round((total / 2) * 100) / 100;

      const balance = Math.round((total - initial) * 100) / 100;

      store.bookings.push({
        id: bookingId,
        reference,
        customerId: session.id,
        tripId: trip.id,
        sellerId,
        quantity: input.quantity,
        boardingPointId: boarding.id,
        boardingPoint: boarding.name,
        totalAmount: total,
        baseAmount: price.baseAmount,
        discountAmount: price.discountAmount,
        couponCode: price.couponCode,
        promotionId: price.promotion?.id ?? null,
        promotionName: price.promotion?.name ?? null,
        promotionDiscount: price.promoDiscount,
        couponDiscount: price.couponDiscount,
        pixDiscount: price.pixDiscount,
        paymentPlan: input.paymentPlan,
        status: "PENDENTE",
        clientRequestId: input.clientRequestId ?? null,
        notes: null,
        createdAt: now,
        updatedAt: now,
      });

      for (const p of input.passengers) {
        const seatId: string | null = null;

        store.passengers.push({
          id: uuid(),
          bookingId,
          name: p.name.trim(),
          cpf: onlyDigits(p.cpf),
          birthDate: p.birthDate,
          phone: onlyDigits(p.phone),
          seatId,
          boardingPointId: boarding.id,
          seatGroup: p.seatGroup ?? null,
          seatAssignmentStatus: "PENDENTE",
        });
      }

      if (price.coupon) {
        store.couponUsages.push({
          id: uuid(),
          couponId: price.coupon.id,
          userId: session.id,
          bookingId,
          createdAt: now,
        });
      }

      if (price.promotion) {
        store.promotionUsages.push({
          id: uuid(),
          promotionId: price.promotion.id,
          userId: session.id,
          bookingId,
          createdAt: now,
        });
      }

      if (input.paymentMethod === "CARTAO") {
        store.payments.push({
          id: paymentId,
          bookingId,
          customerId: store.bookings.find((b) => b.id === bookingId)!.customerId,
          method: input.paymentMethod,
          plan: input.paymentPlan,
          amount: initial,
          status: "PENDENTE",
          gateway: "demo-card",
          gatewayPaymentId: `gw_${paymentId.slice(0, 8)}`,
          feeAmount: 0,
          netAmount: initial,
          paidAt: null,
          pixCopyPaste: null,
          metadata: { awaitingWebhook: true },
          createdAt: now,
        });
      }

      if (input.paymentMethod === "CARTAO") {
        const baseInstallmentValue =
          Math.floor((total / cardInstallments) * 100) / 100;

        let accumulated = 0;

        for (let number = 1; number <= cardInstallments; number++) {
          const value =
            number === cardInstallments
              ? Math.round((total - accumulated) * 100) / 100
              : baseInstallmentValue;

          const due = new Date();
          due.setMonth(due.getMonth() + (number - 1));

          store.installments.push({
            id: uuid(),
            bookingId,
            number,
            value,
            dueDate: due.toISOString().slice(0, 10),
            status: "PENDENTE",
            paidAt: null,
            method: "CARTAO",
          });

          accumulated += value;
        }
      } else {
        store.installments.push({
          id: uuid(),
          bookingId,
          number: 1,
          value: initial,
          dueDate: now.slice(0, 10),
          status: "PENDENTE",
          paidAt: null,
          method: input.paymentMethod,
        });

        if (input.paymentPlan === "PARCIAL") {
          const due = new Date(trip.date);
          due.setDate(due.getDate() - 7);

          store.installments.push({
            id: uuid(),
            bookingId,
            number: 2,
            value: balance,
            dueDate: due.toISOString().slice(0, 10),
            status: "PENDENTE",
            paidAt: null,
            method: null,
          });
        }
      }

      if (sellerId) {
        const seller = store.sellers.find((s) => s.id === sellerId)!;
        store.commissions.push({
          id: uuid(),
          sellerId,
          bookingId,
          rate: seller.commissionRate,
          amount: Math.round(total * seller.commissionRate * 100) / 100,
          status: "PENDENTE",
          paidAt: null,
        });

        for (const admin of store.profiles.filter((p) =>
          canAccessRole(p.role, "admin"),
        )) {
          store.notifications.push({
            id: uuid(),
            userId: admin.id,
            title: "Venda com indicação",
            message: `Nova venda ${reference} vinculada ao vendedor ${seller.code}: comissão pendente a pagar.`,
            type: "COMISSAO",
            read: false,
            createdAt: now,
          });
        }
      }

      store.notifications.push({
        id: uuid(),
        userId: store.bookings.find((b) => b.id === bookingId)!.customerId,
        title: "Reserva criada",
        message: `Sua reserva ${reference} foi criada e aguarda confirmação de pagamento.`,
        type: "RESERVA",
        read: false,
        createdAt: now,
      });

      store.auditLogs.push({
        id: uuid(),
        userId: session.id,
        action: "CREATE_BOOKING",
        entity: "bookings",
        entityId: bookingId,
        oldValue: null,
        newValue: { reference, total },
        ip: null,
        createdAt: now,
      });

      if (occupied + input.quantity >= trip.totalSeats) {
        trip.status = "ESGOTADA";
      }

      return { bookingId, reference };
      });
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Erro ao criar reserva." };
    }
  }

  if (!outcome) {
    return { error: "Erro ao criar reserva." };
  }

  const { bookingId, reference } = outcome;

  revalidatePath("/");
  revalidatePath("/minhas-viagens");

  if (input.paymentMethod === "CARTAO") {
    return { bookingId, reference };
  }

  const pix = await ensureAsaasPixPayment(bookingId, paymentId, {
    responsibleEmail: input.responsibleEmail,
  });
  revalidatePath("/minhas-viagens");

  if (pix.ok) {
    redirect(`/checkout/sucesso?booking=${bookingId}`);
  }

  return {
    error:
      pix.message ??
      "Não foi possível gerar o PIX agora. Sua reserva foi criada e você pode tentar novamente.",
  };
}

/**
 * Preview autoritativo de preço para o checkout. O frontend exibe os descontos
 * calculados aqui; o valor final é recalculado novamente no createBookingAction.
 */
export async function previewBookingPriceAction(input: {
  tripId: string;
  quantity: number;
  paymentMethod: PaymentMethod;
  paymentPlan: PaymentPlan;
  couponCode?: string;
}): Promise<
  | {
      baseAmount: number;
      promoDiscount: number;
      couponDiscount: number;
      pixDiscount: number;
      totalAmount: number;
      promotionName: string | null;
      couponCode: string | null;
    }
  | { error: string }
> {
  const session = await getSession();
  if (!session) return { error: "Faça login para reservar." };

  const store = await getRepositoryRuntime().read();
  const trip = store.trips.find((t) => t.id === input.tripId);
  if (!trip || trip.status !== "PUBLICADA" || trip.deletedAt) {
    return { error: "Viagem indisponível." };
  }

  const pricing = computeBookingPrice({
    store,
    trip,
    quantity: input.quantity,
    paymentMethod: input.paymentMethod,
    paymentPlan: input.paymentPlan,
    couponCode: input.couponCode,
    userId: session.id,
  });
  if (pricing.error || !pricing.breakdown) {
    return { error: pricing.error ?? "Erro ao calcular o valor." };
  }

  const b = pricing.breakdown;
  return {
    baseAmount: b.baseAmount,
    promoDiscount: b.promoDiscount,
    couponDiscount: b.couponDiscount,
    pixDiscount: b.pixDiscount,
    totalAmount: b.totalAmount,
    promotionName: b.promotion?.name ?? null,
    couponCode: b.couponCode,
  };
}

export async function simulateGatewayConfirm(paymentId: string) {
  const session = await getSession();
  if (!session || !canAccessRole(session.role, "financeiro")) {
    return { error: "Sem permissão." };
  }
  const store = await getRepositoryRuntime().read();
  const payment = store.payments.find((p) => p.id === paymentId);
  if (!payment?.gatewayPaymentId) return { error: "Pagamento não encontrado." };
  await confirmPaymentWebhook(payment.gatewayPaymentId);
  return { ok: true };
}

export async function deleteBookingAction(bookingId: string) {
  const session = await getSession();
  if (!session || !canAccess(session.role, "admin")) {
    return { error: "Sem permissão para excluir reservas." };
  }

  try {
    await getRepositoryRuntime().transaction((store) => {
      const booking = store.bookings.find((b) => b.id === bookingId);
      if (!booking) throw new Error("Reserva não encontrada.");

      const now = new Date().toISOString();

      // Remove registros dependentes antes do pai, respeitando FKs do banco:
      // passengers, payments, installments têm ON DELETE CASCADE; os demais
      // (couponUsages, commissions, checkins, loyaltyPoints) não têm cascade e
      // precisam ser removidos explicitamente para evitar constraint violation.
      store.passengers = store.passengers.filter((p) => p.bookingId !== bookingId);
      store.payments = store.payments.filter((p) => p.bookingId !== bookingId);
      store.installments = store.installments.filter((p) => p.bookingId !== bookingId);
      store.couponUsages = store.couponUsages.filter((p) => p.bookingId !== bookingId);
      store.commissions = store.commissions.filter((p) => p.bookingId !== bookingId);
      store.checkins = store.checkins.filter((p) => p.bookingId !== bookingId);
      store.loyaltyPoints = store.loyaltyPoints.filter((p) => p.bookingId !== bookingId);

      // Libera os assentos vinculados à reserva (ON DELETE SET NULL no banco).
      for (const seat of store.seats) {
        if (seat.bookingId === bookingId) {
          seat.bookingId = null;
          seat.state = "DISPONIVEL";
        }
      }

      store.bookings = store.bookings.filter((b) => b.id !== bookingId);

      // Registra a exclusão em audit log para rastreabilidade.
      store.auditLogs.push({
        id: uuid(),
        userId: session.id,
        action: "DELETE_BOOKING",
        entity: "bookings",
        entityId: bookingId,
        oldValue: { reference: booking.reference, status: booking.status },
        newValue: null,
        ip: null,
        createdAt: now,
      });
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao excluir reserva." };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/reservas");
  revalidatePath("/minhas-viagens");
  return { ok: true };
}

export async function getPublicTrips() {
  const store = await getRepositoryRuntime().read();
  return store.trips
    .filter((t) => t.status === "PUBLICADA" && !t.deletedAt)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function getTripBySlug(slug: string) {
  const store = await getRepositoryRuntime().read();
  const trip = store.trips.find((t) => t.slug === slug);
  if (!trip || trip.status !== "PUBLICADA" || trip.deletedAt) return null;
  const boarding = store.tripBoardingPoints
    .filter((t) => t.tripId === trip.id)
    .map((t) => ({
      ...t,
      point: store.boardingPoints.find((b) => b.id === t.boardingPointId)!,
    }));
  const occupied = store.passengers.filter((p) => {
    const b = store.bookings.find((x) => x.id === p.bookingId);
    return b && b.tripId === trip.id && (b.status === "PENDENTE" || b.status === "CONFIRMADA");
  }).length;
  const seats = store.seats.filter((s) => s.tripId === trip.id);
  return {
    trip,
    boarding,
    availableSeats: Math.max(0, trip.totalSeats - occupied),
    seats,
  };
}

function pixPaymentId(input: CheckoutInput, customerId: string): string {
  const key = input.clientRequestId
    ? `payment-pix|${input.clientRequestId}`
    : `payment-pix|${customerId}|${input.tripId}|${input.quantity}|${input.boardingPointId}|${input.passengers
        .map((p) => onlyDigits(p.cpf))
        .sort()
        .join(",")}`;
  const hex = createHash("md5").update(key).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

const PIX_CLAIM_WAIT_MS = 300;
const PIX_CLAIM_WAIT_ATTEMPTS = 15;

type PixClaimGate = {
  proceed: boolean;
  claim?: PaymentClaim;
  message?: string;
  resumeBookingId?: string;
};

/**
 * Porta de entrada do fluxo PIX. A claim (insert on conflict na PK
 * determinística) decide, sob concorrência, quem prossegue com a cobrança.
 * - quem ganha: prossegue para o transaction da reserva;
 * - perdedor: espera a operação original (lease curta); se a lease expirou,
 *   faz take-over condicional (CAS) e retoma do checkpoint existente;
 * - claim já CHARGED: não recria a cobrança; devolve a reserva para adoção.
 */
async function gatePixClaim(
  paymentId: string,
  customerId: string,
  tripId: string,
): Promise<PixClaimGate> {
  let acquired = await acquirePixClaim({ key: paymentId, customerId, tripId });
  let attempt = 0;

  while (!acquired.won) {
    const claim = acquired.claim;
    if (!claim) {
      return { proceed: false, message: "Não foi possível iniciar o PIX. Tente novamente." };
    }
    if (claim.status === "CHARGED") {
      return { proceed: false, claim };
    }

    const now = new Date().toISOString();
    const expired = !claim.leaseUntil || claim.leaseUntil <= now;

    if (expired) {
      const renewal = await takeoverExpiredClaim(paymentId);
      if (renewal.won) {
        return {
          proceed: true,
          claim: renewal.claim ?? claim,
          resumeBookingId: renewal.claim?.bookingId ?? undefined,
        };
      }
    }

    if (attempt >= PIX_CLAIM_WAIT_ATTEMPTS) {
      return {
        proceed: false,
        claim,
        message: "Sua reserva está sendo processada. Tente novamente em instantes.",
      };
    }

    attempt += 1;
    await new Promise((resolve) => setTimeout(resolve, PIX_CLAIM_WAIT_MS));
    const latest = await getPixClaim(paymentId);
    acquired = { won: false, claim: latest ?? claim };
  }

  return {
    proceed: true,
    claim: acquired.claim,
    resumeBookingId: acquired.claim?.bookingId ?? undefined,
  };
}

async function persistPixPayment(
  bookingId: string,
  paymentId: string,
  data: {
    chargeId: string;
    payload: string | null;
    expirationDate: string | null;
    responsibleEmail?: string;
  },
): Promise<void> {
  await getRepositoryRuntime().transaction((store) => {
    const booking = store.bookings.find((b) => b.id === bookingId);
    if (!booking) {
      throw new Error("Reserva não encontrada ao registrar o pagamento.");
    }

    const existing = store.payments.find((p) => p.bookingId === bookingId);
    const installment1 = store.installments.find(
      (i) => i.bookingId === bookingId && i.number === 1,
    );
    const amount = existing?.amount ?? installment1?.value ?? booking.totalAmount;
    const now = new Date().toISOString();
    const externalReference = `PRADOS-TOUR:${paymentId}`;

    const metadata: Record<string, unknown> = {
      ...(existing?.metadata ?? {}),
      awaitingWebhook: true,
      pixState: data.payload ? "QR_READY" : "CHARGE_PENDING_QR",
      pixExpirationDate: data.expirationDate ?? null,
      asaasExternalReference: externalReference,
      responsibleEmail: data.responsibleEmail?.trim() || null,
    };

    const next: Payment = {
      id: paymentId,
      bookingId,
      customerId: existing?.customerId ?? booking.customerId,
      method: "PIX",
      plan: existing?.plan ?? booking.paymentPlan,
      amount,
      status: "PENDENTE",
      gateway: "asaas",
      gatewayPaymentId: data.chargeId,
      feeAmount: 0,
      netAmount: amount,
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
  });
}

/**
 * Reconciliação + criação garantida de UMA cobrança Asaas por operação.
 * Ordem: claim atômica -> reconcile-first -> criar (só se não existir) ->
 * salvar gatewayPaymentId -> obter QR -> persistir Payment PENDENTE.
 * Nunca marca o pagamento como PAGO e nunca chama confirmPaymentWebhook.
 */
async function ensureAsaasPixPayment(
  bookingId: string,
  paymentId: string,
  opts: { responsibleEmail?: string },
): Promise<{ ok: boolean; message?: string }> {
  const store = await getRepositoryRuntime().read();
  const payment = store.payments.find((p) => p.bookingId === bookingId);
  if (payment?.status === "PAGO") {
    return { ok: true };
  }

  const booking = store.bookings.find((b) => b.id === bookingId);
  const trip = store.trips.find((t) => t.id === booking?.tripId);
  const profile = store.profiles.find((p) => p.id === booking?.customerId);
  const installment1 = store.installments.find(
    (i) => i.bookingId === bookingId && i.number === 1,
  );
  if (!booking || !trip || !profile) {
    return { ok: false, message: "Dados da reserva incompletos para gerar o PIX." };
  }

  const externalReference = `PRADOS-TOUR:${paymentId}`;
  const amount = payment?.amount ?? installment1?.value ?? booking.totalAmount;

  let chargeId: string | null = payment?.gatewayPaymentId ?? null;

  if (!chargeId) {
    try {
      chargeId = (await findAsaasPaymentByExternalReference(externalReference))?.id ?? null;
    } catch {
      chargeId = null;
    }
  }

  if (!chargeId) {
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
      dueDate: installment1?.dueDate ?? new Date().toISOString().slice(0, 10),
      description: `Reserva ${booking.reference} - ${trip.name}`.slice(0, 120),
      externalReference,
    }).catch(async () => {
      try {
        return (await findAsaasPaymentByExternalReference(externalReference)) ?? null;
      } catch {
        return null;
      }
    });

    if (!created) {
      return {
        ok: false,
        message:
          "Não foi possível gerar o PIX neste momento. Sua reserva foi criada e você poderá tentar novamente em instantes.",
      };
    }
    chargeId = created.id;
    await updatePixClaim(paymentId, { chargeId, bookingId }).catch(() => undefined);
  }

  let payload = payment?.pixCopyPaste ?? null;
  let expirationDate: string | null =
    typeof payment?.metadata?.pixExpirationDate === "string"
      ? payment.metadata.pixExpirationDate
      : null;

  if (!payload && chargeId) {
    try {
      const qrCode = await getAsaasPixQrCode(chargeId);
      payload = qrCode.payload;
      expirationDate = qrCode.expirationDate;
    } catch {
      payload = null;
    }
  }

  await persistPixPayment(bookingId, paymentId, {
    chargeId,
    payload,
    expirationDate,
    responsibleEmail: opts.responsibleEmail,
  });

  await completePixClaim(paymentId, { bookingId, paymentId, chargeId }).catch(
    () => undefined,
  );

  if (!payload) {
    return {
      ok: false,
      message:
        "O PIX foi gerado, mas o QR Code ainda está pendente. Tente abrir a reserva novamente em instantes.",
    };
  }

  return { ok: true };
}
