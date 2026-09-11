"use server";

import { v4 as uuid } from "uuid";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getSession, canAccess } from "@/lib/auth/session";
import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import { isValidCpf, onlyDigits } from "@/lib/utils";
import { canAccessRole } from "@/lib/roles";
import { computeBookingPrice } from "@/lib/pricing";
import type { PaymentMethod, PaymentPlan } from "@/types";

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
  try {
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

    outcome = await getRepositoryRuntime().transaction((store) => {
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
      const paymentId = uuid();
      const pixCopy =
        input.paymentMethod === "PIX"
          ? `00020126580014BR.GOV.BCB.PIX0136${store.paymentSettings.pixKey}520400005303986540${initial.toFixed(2)}5802BR5925PRADOS TOUR6009SAO PAULO62070503***6304ABCD`
          : null;

      store.payments.push({
        id: paymentId,
        bookingId,
        customerId: store.bookings.find((b) => b.id === bookingId)!.customerId,
        method: input.paymentMethod,
        plan: input.paymentPlan,
        amount: initial,
        status: "PENDENTE",
        gateway: input.paymentMethod === "PIX" ? "demo-pix" : "demo-card",
        gatewayPaymentId: `gw_${paymentId.slice(0, 8)}`,
        feeAmount: 0,
        netAmount: initial,
        paidAt: null,
        pixCopyPaste: pixCopy,
        metadata: { awaitingWebhook: true },
        createdAt: now,
      });

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

  if (!outcome) {
    return { error: "Erro ao criar reserva." };
  }

  const { bookingId, reference } = outcome;

  revalidatePath("/");
  revalidatePath("/minhas-viagens");

  if (input.paymentMethod === "CARTAO") {
    return { bookingId, reference };
  }

  redirect(`/checkout/sucesso?booking=${bookingId}`);
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

/** Confirma pagamento via webhook/gateway — nunca pelo clique "já paguei". */
export async function confirmPaymentWebhook(gatewayPaymentId: string) {
  await getRepositoryRuntime().transaction((store) => {
    const payment = store.payments.find((p) => p.gatewayPaymentId === gatewayPaymentId);
    if (!payment || payment.status === "PAGO") return;
    const now = new Date().toISOString();
    payment.status = "PAGO";
    payment.paidAt = now;
    const installment = store.installments.find(
      (i) => i.bookingId === payment.bookingId && i.number === 1,
    );
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
      store.notifications.push({
        id: uuid(),
        userId: booking.customerId,
        title: "Pagamento confirmado",
        message: `Pagamento da reserva ${booking.reference} confirmado. Seu voucher já está disponível.`,
        type: "PAGAMENTO",
        read: false,
        createdAt: now,
      });
      store.auditLogs.push({
        id: uuid(),
        userId: null,
        action: "PAYMENT_CONFIRMED",
        entity: "booking",
        entityId: booking.id,
        oldValue: { method: payment.method },
        newValue: { status: "PAGO", reference: booking.reference },
        ip: null,
        createdAt: now,
      });
    }
  });
  revalidatePath("/admin");
  revalidatePath("/minhas-viagens");
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
