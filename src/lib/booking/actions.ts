"use server";

import { v4 as uuid } from "uuid";
import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession, canAccess } from "@/lib/auth/session";
import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import { onlyDigits } from "@/lib/utils";
import {
  collectPassengerIssuesForQuantity,
  formatPassengerIssuesMessage,
  normalizePassengerName,
  PASSENGER_FIELD_LABELS,
  PASSENGER_REQUIRED_DATA_MESSAGE,
  passengersSchema,
  type PassengerIssueField,
} from "@/lib/booking/passengers";
import { canAccessRole } from "@/lib/roles";
import { ageAtDate, computeBookingPrice, passengerCategory } from "@/lib/pricing";
import {
  isPastTrip,
  isVendableTrip,
  PAST_TRIP_MESSAGE,
} from "@/lib/trips/availability";
import type { DataStore, Payment, PaymentMethod, PaymentPlan, Trip } from "@/types";
import {
  asaasInvoiceUrl,
  createAsaasCardPayment,
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
import { confirmPaymentWebhook } from "@/lib/payments/confirmation";
import { computeRemainingBalance } from "@/lib/payments/balance";

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
    rg: string;
    /** Declaração de veracidade aceita para este passageiro. */
    dataDeclaration: boolean;
    seatGroup?: string;
  }>;
  sellerCode?: string;
  /** Identificador da sessão de checkout (evita reserva duplicada no retry). */
  clientRequestId?: string;
  /** E-mail do responsável pela compra (validado; contato usa o e-mail da conta). */
  responsibleEmail?: string;
  /** Seguro viagem para todos os passageiros (quando habilitado na viagem). */
  insurance?: boolean;
};

/**
 * Valida os dados de TODOS os passageiros da reserva (frontend e backend
 * usam exatamente a mesma regra). Nenhum passageiro pode ficar de fora: a
 * reserva só existe se a lista inteira for válida.
 *
 * Retorna `null` quando está tudo certo, ou a mensagem detailing exatamente
 * qual passageiro e qual campo precisam ser preenchidos.
 */
function validateCheckoutPassengers(
  passengers: CheckoutInput["passengers"] | null | undefined,
  quantity?: number | null,
): string | null {
  if (!Array.isArray(passengers) || passengers.length === 0) {
    return `${PASSENGER_REQUIRED_DATA_MESSAGE} • Informe ao menos um passageiro.`;
  }

  const issues = collectPassengerIssuesForQuantity(passengers, quantity);
  if (issues.length > 0) {
    return formatPassengerIssuesMessage(issues);
  }

  // Rede de segurança: garante também o tipo normalizado (CPF/telefone só
  // com dígitos) usado na gravação, preservando passageiro e campo no erro.
  const parsed = passengersSchema.safeParse(passengers);
  if (!parsed.success) {
    return formatPassengerIssuesMessage(
      parsed.error.issues.map((issue) => {
        const position = typeof issue.path[0] === "number" ? issue.path[0] : 0;
        const field = String(issue.path[1] ?? "name");
        return {
          index: position + 1,
          field: (field in PASSENGER_FIELD_LABELS ? field : "name") as PassengerIssueField,
          message: issue.message,
        };
      }),
    );
  }

  return null;
}

export async function createBookingAction(input: CheckoutInput) {
  const session = await getSession();
  if (!session) {
    return { error: "Faça login para reservar." };
  }

  let outcome: { bookingId: string; reference: string } | null = null;

  // REGRA CENTRAL: nenhum passageiro pode estar incompleto. A validação roda
  // ANTES de qualquer regra de preço, claim de PIX ou escrita — ou seja, uma
  // reserva incompleta não é criada e não gera pagamento.
  const passengersError = validateCheckoutPassengers(input.passengers, input.quantity);
  if (passengersError) {
    return { error: passengersError };
  }

  if (
    input.responsibleEmail &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.responsibleEmail)
  ) {
    return { error: "E-mail do responsável inválido." };
  }

  const isPixPayment = input.paymentMethod === "PIX";
  const isCardPayment = input.paymentMethod === "CARTAO";
  let paymentId = isPixPayment
    ? pixPaymentId(input, session.id)
    : cardPaymentId(input, session.id);
  let claimWon = false;

  if (isPixPayment || isCardPayment) {
    // Retoma uma reserva PENDENTE já existente para esta viagem com o MESMO
    // conjunto de passageiros (CPFs) e plano, caso uma tentativa anterior
    // tenha criado a reserva mas falhado na cobrança. Isso evita reservas
    // duplicadas no retry E deriva o MESMO paymentId da operação original,
    // permitindo reconcile-first exato no Asaas (sem cobrança duplicada).
    // A transação revalida o resume com um read fresco (regra de idempotência).
    const cpfMultiset = passengerCpfMultiset(input.passengers);
    const resumable = await getRepositoryRuntime().findResumableBookingId({
      customerId: session.id,
      tripId: input.tripId,
      paymentPlan: input.paymentPlan,
      quantity: input.quantity,
      cpfMultiset,
    });

    if (resumable) {
      paymentId = resumable.clientRequestId
        ? isPixPayment
          ? pixPaymentIdFromClientRequestId(resumable.clientRequestId)
          : cardPaymentIdFromClientRequestId(resumable.clientRequestId)
        : isPixPayment
          ? pixPaymentIdFromBookingId(resumable.id)
          : cardPaymentIdFromBookingId(resumable.id);
    }

    const gate = await gatePixClaim(paymentId, session.id, input.tripId);
    claimWon = gate.proceed;

    if (!gate.proceed) {
      const completedId =
        gate.claim?.status === "CHARGED" && gate.claim.bookingId
          ? gate.claim.bookingId
          : null;
      if (completedId) {
        const adopted =
          isPixPayment
            ? await ensureAsaasPixPayment(completedId, paymentId, {
                responsibleEmail: input.responsibleEmail,
              })
            : await ensureAsaasCardPayment(completedId, paymentId, {
                installmentCount: input.installmentCount ?? 1,
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
            "Sua reserva está pronta. Tente abrir o link de pagamento novamente em instantes.",
        };
      }
      return {
        error:
          gate.message ?? "Sua reserva está sendo processada. Tente novamente em instantes.",
      };
    }

    if (gate.resumeBookingId && !outcome) {
      const store = await getRepositoryRuntime().read();
      const existing = store.bookings.find(
        (b) => b.id === gate.resumeBookingId && b.tripId === input.tripId,
      );
      if (existing && existing.customerId === session.id) {
        outcome = { bookingId: existing.id, reference: existing.reference };
      }
    }
  }

  if (!outcome) {
    try {
      outcome = await getRepositoryRuntime().transaction(async (store) => {
      // Segunda barreira (defesa em profundidade), dentro da transação e
      // antes de qualquer escrita: mesmo já validado acima, nada é persistido
      // se algum passageiro estiver incompleto.
      const transactionPassengersError = validateCheckoutPassengers(
        input.passengers,
        input.quantity,
      );
      if (transactionPassengersError) {
        throw new Error(transactionPassengersError);
      }

      const trip = store.trips.find((t) => t.id === input.tripId);
      if (!trip || trip.status !== "PUBLICADA" || trip.deletedAt) {
        throw new Error("Viagem indisponível.");
      }
      // Barreira de segurança: mesmo que o cliente tenha aberto o checkout
      // antes da data virar, nenhuma reserva nova é criada para viagem vencida.
      if (isPastTrip(trip)) {
        throw new Error(PAST_TRIP_MESSAGE);
      }

      if (input.quantity < 1 || input.passengers.length !== input.quantity) {
        throw new Error("Quantidade de passageiros inválida.");
      }

      // Idempotência/retomada: (1) mesmo clientRequestId, ou (2) reserva
      // PENDENTE da mesma viagem/plano/quantidade para o MESMO conjunto de
      // passageiros (CPFs). Impede duplicação em refresh/retry mesmo após
      // falha parcial (reserva criada sem cobrança): o retry retoma a reserva
      // original em vez de criar outra.
      const cpfMultiset = passengerCpfMultiset(input.passengers);
      const existing = store.bookings.find(
        (b) =>
          b.customerId === session.id &&
          b.tripId === trip.id &&
          ((input.clientRequestId && b.clientRequestId === input.clientRequestId) ||
            (b.status === "PENDENTE" &&
              b.paymentPlan === input.paymentPlan &&
              b.quantity === input.quantity &&
              bookingPassengerCpfMultiset(store, b.id) === cpfMultiset)),
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
        passengers: input.passengers,
        insurance: input.insurance,
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
      const reference = nextBookingReference(store.bookings);
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
        childCount: price.childCount,
        insuranceCount: price.insuranceCount,
        insuranceAmount: price.insuranceAmount,
        paymentPlan: input.paymentPlan,
        status: "PENDENTE",
        clientRequestId: input.clientRequestId ?? null,
        notes: null,
        createdAt: now,
        updatedAt: now,
      });

      const orderPrices = passengerPricesForBooking(trip, input.passengers);
      const withInsurance = Boolean(input.insurance && trip.insuranceEnabled);

      for (const p of input.passengers) {
        const seatId: string | null = null;
        const pricingForPassenger = orderPrices.shift() ?? {
          price: trip.pricePerson,
          category: "ADULTO" as const,
        };

        store.passengers.push({
          id: uuid(),
          bookingId,
          name: normalizePassengerName(p.name),
          cpf: onlyDigits(p.cpf),
          birthDate: p.birthDate,
          phone: onlyDigits(p.phone),
          rg: p.rg.replace(/\s+/g, " ").trim(),
          dataDeclarationAt: now,
          seatId,
          boardingPointId: boarding.id,
          seatGroup: p.seatGroup ?? null,
          price: pricingForPassenger.price,
          priceCategory: pricingForPassenger.category,
          insurance: withInsurance,
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
      // Falhou antes de completar a reserva: libera a claim imediatamente
      // para que o retry possa reprocessar sem esperar o lease expirar.
      if ((isPixPayment || isCardPayment) && claimWon) {
        await releasePixClaim(paymentId).catch(() => undefined);
      }
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
    const card = await ensureAsaasCardPayment(bookingId, paymentId, {
      installmentCount: input.installmentCount ?? 1,
      responsibleEmail: input.responsibleEmail,
    });

    revalidatePath("/minhas-viagens");

    if (card.ok) {
      redirect(`/checkout/sucesso?booking=${bookingId}`);
    }

    return {
      error:
        card.message ??
        "Não foi possível gerar o link de pagamento agora. Sua reserva foi criada e você pode tentar novamente.",
      bookingId,
      reference,
    };
  }

  const pix = await ensureAsaasPixPayment(bookingId, paymentId, {
    responsibleEmail: input.responsibleEmail,
  });

  revalidatePath("/minhas-viagens");

  if (pix.ok) {
    redirect(`/checkout/sucesso?booking=${bookingId}`);
  }

  // A reserva EXISTE, mas o PIX não pôde ser gerado agora. A liberação da
  // claim já foi garantida dentro de ensureAsaasPixPayment (finally) em
  // qualquer caminho de falha, para que o retry reprocesse sem esperar lease.

  return {
    error:
      pix.message ??
      "Não foi possível gerar o PIX agora. Sua reserva foi criada e você pode tentar novamente.",
    bookingId,
    reference,
  };
}

/**
 * Preview autoritativo de preço para o checkout. O frontend exibe os descontos
 * calculados aqui; o valor final é recalculado novamente no createBookingAction.
 */
export async function confirmBookingFormAction(bookingId: string) {
  const session = await getSession();
  if (!session) {
    return { error: "Faça login para continuar." };
  }

  try {
    await getRepositoryRuntime().transaction((store) => {
      const booking = store.bookings.find((b) => b.id === bookingId);
      if (!booking) throw new Error("Reserva não encontrada.");

      if (
        booking.customerId !== session.id &&
        !["SUPER_ADMIN", "ADMIN", "FINANCEIRO", "VENDEDOR"].includes(session.role)
      ) {
        throw new Error("Sem permissão para confirmar este formulário.");
      }

      if (booking.status !== "CONFIRMADA") {
        throw new Error("O pagamento da reserva ainda não foi confirmado.");
      }

      const trip = store.trips.find((t) => t.id === booking.tripId);
      if (!trip) throw new Error("Viagem não encontrada.");

      if (!trip.formRequired) {
        return;
      }

      if (!trip.formUrl) {
        throw new Error(
          "O formulário obrigatório desta viagem não foi configurado.",
        );
      }

      if (!booking.formConfirmedAt) {
        const now = new Date().toISOString();
        booking.formConfirmedAt = now;
        booking.updatedAt = now;

        store.notifications.push({
          id: uuid(),
          userId: booking.customerId,
          title: "Formulário confirmado",
          message: `O preenchimento do formulário da reserva ${booking.reference} foi confirmado. ${
            computeRemainingBalance(store, booking.id) <= 0.01
              ? "Seu voucher está disponível."
              : "Seu voucher será liberado quando o saldo estiver quitado."
          }`,
          type: "RESERVA",
          read: false,
          createdAt: now,
        });

        store.auditLogs.push({
          id: uuid(),
          userId: session.id,
          action: "CONFIRM_BOOKING_FORM",
          entity: "booking",
          entityId: booking.id,
          oldValue: { formConfirmedAt: null },
          newValue: { formConfirmedAt: now },
          ip: null,
          createdAt: now,
        });
      }
    });
  } catch (e) {
    return {
      error:
        e instanceof Error
          ? e.message
          : "Não foi possível confirmar o formulário.",
    };
  }

  revalidatePath(`/voucher/${bookingId}`);
  revalidatePath(`/checkout/sucesso?booking=${bookingId}`);
  revalidatePath("/minhas-viagens");

  return { ok: true };
}

export async function previewBookingPriceAction(input: {
  tripId: string;
  quantity: number;
  paymentMethod: PaymentMethod;
  paymentPlan: PaymentPlan;
  couponCode?: string;
  birthDates?: Array<string | null>;
  insurance?: boolean;
}): Promise<
  | {
      baseAmount: number;
      promoDiscount: number;
      couponDiscount: number;
      pixDiscount: number;
      totalAmount: number;
      adultCount: number;
      childCount: number;
      insuranceCount: number;
      insuranceAmount: number;
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
  if (isPastTrip(trip)) {
    return { error: PAST_TRIP_MESSAGE };
  }

  const pricing = computeBookingPrice({
    store,
    trip,
    quantity: input.quantity,
    paymentMethod: input.paymentMethod,
    paymentPlan: input.paymentPlan,
    couponCode: input.couponCode,
    userId: session.id,
    passengers: (input.birthDates ?? []).map((birthDate) => ({ birthDate })),
    insurance: input.insurance,
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
    adultCount: b.adultCount,
    childCount: b.childCount,
    insuranceCount: b.insuranceCount,
    insuranceAmount: b.insuranceAmount,
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
  if (payment.method === "CARTAO" && payment.gateway === "asaas") {
    return { error: "Confirmação manual não permitida para pagamentos de cartão via Asaas." };
  }
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

/**
 * Uma viagem é vendável apenas se publicada, não excluída e com data ainda não
 * vencida. Viagens com data passada não são oferecidas no catálogo público nem
 * permitem iniciar novas reservas (preview e criação).
 *
 * A regra mora em `@/lib/trips/availability`, que compara o dia civil de São
 * Paulo (não UTC) e usa `departureDate ?? date` como data efetiva. Não
 * duplique a lógica aqui — apenas reutilize.
 */

export async function getPublicTrips() {
  const store = await getRepositoryRuntime().read();
  return store.trips
    .filter((t) => isVendableTrip(t))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Estado de uma viagem para exibição pública, distinguindo "já realizada" de
 * "inexistente". Sem essa distinção, o 404 do detail page esconderia o motivo
 * real e o cliente que chegou por URL antiga não receberia a orientação
 * correta.
 */
export type PublicTripState =
  | { status: "VENDAVEL"; data: NonNullable<Awaited<ReturnType<typeof getTripBySlug>>> }
  | { status: "REALIZADA"; trip: Trip }
  | { status: "INDISPONIVEL" };

/**
 * Statuses que já ficaram públicos em algum momento. Só para eles faz
 * sentido responder "viagem já realizada" numa URL direta. RASCUNHO nunca foi
 * público e não pode ser revelado; CANCELADA e ARQUIVADA não são "realizadas".
 */
const PUBLICLY_KNOWN_TRIP_STATUSES = ["PUBLICADA", "ESGOTADA", "FINALIZADA"];

/**
 * Consulta a viagem pelo slug e classifica a disponibilidade.
 *
 * Não remove nada do banco: uma viagem realizada continua existindo e
 * consultável, apenas não é devolvida como comprável.
 */
export async function getPublicTripState(slug: string): Promise<PublicTripState> {
  const store = await getRepositoryRuntime().read();
  const trip = store.trips.find((t) => t.slug === slug);

  if (!trip || trip.deletedAt) return { status: "INDISPONIVEL" };

  const data = await getTripBySlug(slug);

  if (data) return { status: "VENDAVEL", data };

  const foiPublica = PUBLICLY_KNOWN_TRIP_STATUSES.includes(trip.status);

  if (foiPublica && isPastTrip(trip)) return { status: "REALIZADA", trip };

  return { status: "INDISPONIVEL" };
}

export async function getTripBySlug(slug: string) {
  const store = await getRepositoryRuntime().read();
  const trip = store.trips.find((t) => t.slug === slug);
  if (!trip || !isVendableTrip(trip)) return null;
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

function pixPaymentIdFromKey(key: string): string {
  const hex = createHash("md5").update(key).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function pixPaymentId(input: CheckoutInput, customerId: string): string {
  const key = input.clientRequestId
    ? `payment-pix|${input.clientRequestId}`
    : `payment-pix|${customerId}|${input.tripId}|${input.quantity}|${input.boardingPointId}|${input.passengers
        .map((p) => onlyDigits(p.cpf))
        .sort()
        .join(",")}`;
  return pixPaymentIdFromKey(key);
}

function pixPaymentIdFromClientRequestId(clientRequestId: string): string {
  return pixPaymentIdFromKey(`payment-pix|${clientRequestId}`);
}

function cardPaymentIdFromKey(key: string): string {
  const hex = createHash("md5").update(key).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function cardPaymentId(input: CheckoutInput, customerId: string): string {
  const key = input.clientRequestId
    ? `payment-card|${input.clientRequestId}`
    : `payment-card|${customerId}|${input.tripId}|${input.quantity}|${input.boardingPointId}|${input.passengers
        .map((p) => onlyDigits(p.cpf))
        .sort()
        .join(",")}`;
  return cardPaymentIdFromKey(key);
}

function cardPaymentIdFromClientRequestId(clientRequestId: string): string {
  return cardPaymentIdFromKey(`payment-card|${clientRequestId}`);
}

function cardPaymentIdFromBookingId(bookingId: string): string {
  return cardPaymentIdFromKey(`payment-card|booking:${bookingId}`);
}

function pixPaymentIdFromBookingId(bookingId: string): string {
  return pixPaymentIdFromKey(`payment-pix|booking:${bookingId}`);
}

function passengerCpfMultiset(passengers: Array<{ cpf: string }>): string {
  return passengers
    .map((p) => onlyDigits(p.cpf))
    .sort()
    .join(",");
}

function bookingPassengerCpfMultiset(
  store: DataStore,
  bookingId: string,
): string {
  return store.passengers
    .filter((p) => p.bookingId === bookingId)
    .map((p) => onlyDigits(p.cpf ?? ""))
    .sort()
    .join(",");
}

/**
 * Preços base por passageiro, na ordem de entrada: adultos pagam pessoa/dupla
 * (pares ganham o preço de casal, dividido igualmente) e crianças pagam
 * `trip.childPrice` (ou pessoa, se não configurado). Reflete exatamente o
 * `baseAmount` calculado pelo motor de preços.
 */
function passengerPricesForBooking(
  trip: Trip,
  passengers: Array<{ birthDate?: string | null }>,
): Array<{ price: number; category: "ADULTO" | "CRIANCA" }> {
  const personPrice = trip.pricePerson;
  const couplePrice = trip.priceCouple ?? personPrice * 2;
  const childPrice = trip.childPrice ?? personPrice;

  const adults = passengers.filter(
    (p) =>
      passengerCategory(p.birthDate, trip.date) === "ADULTO",
  ).length;

  let adultIndex = 0;
  return passengers.map((p) => {
    const isChild =
      passengerCategory(p.birthDate, trip.date) === "CRIANCA";
    if (isChild) {
      const age = p.birthDate ? ageAtDate(p.birthDate, trip.date) : 12;
      if (
        age < 5 &&
        trip.childUnder5FreeWithTwoAdults &&
        adults >= 2
      ) {
        return { price: 0, category: "CRIANCA" as const };
      }

      if (
        age < 5 &&
        trip.childUnder5FreeWithTwoAdults &&
        adults === 1
      ) {
        return {
          price: Math.round((childPrice / 2) * 100) / 100,
          category: "CRIANCA" as const,
        };
      }

      return { price: childPrice, category: "CRIANCA" as const };
    }
    const isOddSingle = adults % 2 === 1 && adultIndex === adults - 1;
    const price = isOddSingle
      ? personPrice
      : Math.round((couplePrice / 2) * 100) / 100;
    adultIndex += 1;
    return { price, category: "ADULTO" as const };
  });
}

/**
 * Próxima referência de reserva na forma PT######. Derivada do MAIOR valor
 * numérico já usado (e não apenas da contagem) para ser monotônica mesmo com
 * exclusões administrativas, reservas demo (E2EWB001) ou concorrência — e
 * para reduzir colisões com a UNIQUE de bookings.reference.
 */
function nextBookingReference(bookings: Array<{ reference: string }>): string {
  const maxNumeric = bookings.reduce((max, b) => {
    const match = /^PT(\d+)$/.exec(b.reference ?? "");
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  const next = Math.max(maxNumeric + 1, bookings.length + 1);
  return `PT${String(next).padStart(6, "0")}`;
}

const PIX_CLAIM_WAIT_MS = 300;
const PIX_CLAIM_WAIT_ATTEMPTS = 30;

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
 *   se a claim SUMIR (vencedor falhou e liberou), re-adquire e prossegue.
 * - claim já CHARGED: não recria a cobrança; devolve a reserva para adoção.
 */
async function gatePixClaim(
  paymentId: string,
  customerId: string,
  tripId: string,
): Promise<PixClaimGate> {
  let acquired: { won: boolean; claim: PaymentClaim | undefined } =
    await acquirePixClaim({ key: paymentId, customerId, tripId });
  let attempt = 0;

  while (!acquired.won) {
    const claim = acquired.claim;
    if (!claim) {
      // A claim foi liberada pelo vencedor que falhou: adquire de novo e
      // prossegue (a transação é idempotente por CPFs — sem duplicação).
      const retried = await acquirePixClaim({ key: paymentId, customerId, tripId });
      if (retried.won) {
        return {
          proceed: true,
          claim: retried.claim,
          resumeBookingId: retried.claim?.bookingId ?? undefined,
        };
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
    acquired = { won: false, claim: latest ?? undefined };
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

async function persistCardPayment(
  bookingId: string,
  paymentId: string,
  data: {
    chargeId: string;
    invoiceUrl: string | null;
    installmentCount: number;
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
      invoiceUrl: data.invoiceUrl,
      cardInstallments: data.installmentCount,
      asaasExternalReference: externalReference,
      responsibleEmail: data.responsibleEmail?.trim() || null,
    };

    const next: Payment = {
      id: paymentId,
      bookingId,
      customerId: existing?.customerId ?? booking.customerId,
      method: "CARTAO",
      plan: existing?.plan ?? booking.paymentPlan,
      amount,
      status: "PENDENTE",
      gateway: "asaas",
      gatewayPaymentId: data.chargeId,
      feeAmount: 0,
      netAmount: amount,
      paidAt: null,
      pixCopyPaste: null,
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
): Promise<{ ok: boolean; message?: string; error?: string }> {
  let completed = false;
  try {
    let store;
    try {
      store = await getRepositoryRuntime().read();
    } catch (error) {
      console.error("[ASAAS] read() falhou em ensureAsaasPixPayment:", error);
      return { ok: false, error: "read_failed" };
    }
    const payment = store.payments.find((p) => p.bookingId === bookingId);
    if (payment?.status === "PAGO") {
      completed = true;
      return { ok: true };
    }

    const booking = store.bookings.find((b) => b.id === bookingId);
    const trip = store.trips.find((t) => t.id === booking?.tripId);
    const profile = store.profiles.find((p) => p.id === booking?.customerId);
    const installment1 = store.installments.find(
      (i) => i.bookingId === bookingId && i.number === 1,
    );
    if (!booking || !trip || !profile) {
      return {
        ok: false,
        message: "Dados da reserva incompletos para gerar o PIX.",
      };
    }

    const externalReference = `PRADOS-TOUR:${paymentId}`;
    const amount = payment?.amount ?? installment1?.value ?? booking.totalAmount;

    let chargeId: string | null = payment?.gatewayPaymentId ?? null;

    if (!chargeId) {
      try {
        chargeId =
          (await findAsaasPaymentByExternalReference(externalReference))?.id ?? null;
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
          dueDate: installment1?.dueDate ?? new Date().toISOString().slice(0, 10),
          description: `Reserva ${booking.reference} - ${trip.name}`.slice(0, 120),
          externalReference,
        }).catch(async (error) => {
          console.error(
            "[ASAAS] Erro ao criar cobrança PIX:",
            error instanceof Error ? error.message : error,
          );

          try {
            return (
              (await findAsaasPaymentByExternalReference(externalReference)) ?? null
            );
          } catch (reconcileError) {
            console.error(
              "[ASAAS] Erro ao reconciliar cobrança PIX:",
              reconcileError instanceof Error
                ? reconcileError.message
                : reconcileError,
            );

            return null;
          }
        });
        if (created) {
          chargeId = created.id;
          await updatePixClaim(paymentId, { chargeId, bookingId }).catch(
            () => undefined,
          );
        }
      } catch (error) {
        // Falha de conexão/criação no Asaas: a reserva e a claim são preservadas
        // para retry seguro (clientRequestId/claim). Não estoura para a action.
        console.error("[ASAAS] Falha ao criar/reconciliar cobrança PIX:", {
          bookingId,
          paymentId,
          externalReference,
          error: error instanceof Error ? error.message : error,
        });
        return {
          ok: false,
          message:
            "Não foi possível gerar o PIX neste momento. Sua reserva foi criada e você poderá tentar novamente em instantes.",
        };
      }
    }

    if (!chargeId) {
      return {
        ok: false,
        message:
          "Não foi possível gerar o PIX neste momento. Sua reserva foi criada e você poderá tentar novamente em instantes.",
      };
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
      } catch (error) {
        console.error(
          "[ASAAS] Erro ao obter QR Code PIX:",
          error instanceof Error ? error.message : error,
        );

        payload = null;
      }
    }

    try {
      await persistPixPayment(bookingId, paymentId, {
        chargeId,
        payload,
        expirationDate,
        responsibleEmail: opts.responsibleEmail,
      });
    } catch (error) {
      console.error("[ASAAS] persistPixPayment() falhou em ensureAsaasPixPayment:", {
        bookingId,
        paymentId,
        error: error instanceof Error ? error.message : error,
      });
      return { ok: false, error: "persist_failed" };
    }

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

    completed = true;
    return { ok: true };
  } finally {
    if (!completed) {
      await releasePixClaim(paymentId).catch(() => undefined);
    }
  }
}

async function ensureAsaasCardPayment(
  bookingId: string,
  paymentId: string,
  opts: { installmentCount: number; responsibleEmail?: string },
): Promise<{ ok: boolean; message?: string; error?: string }> {
  let completed = false;
  try {
    let store;
    try {
      store = await getRepositoryRuntime().read();
    } catch (error) {
      console.error("[ASAAS] read() falhou em ensureAsaasCardPayment:", error);
      return { ok: false, error: "read_failed" };
    }

    const payment = store.payments.find((p) => p.bookingId === bookingId);
    if (payment?.status === "PAGO") {
      completed = true;
      return { ok: true };
    }

    const booking = store.bookings.find((b) => b.id === bookingId);
    const trip = store.trips.find((t) => t.id === booking?.tripId);
    const profile = store.profiles.find((p) => p.id === booking?.customerId);
    const installment1 = store.installments.find(
      (i) => i.bookingId === bookingId && i.number === 1,
    );
    if (!booking || !trip || !profile) {
      return {
        ok: false,
        message: "Dados da reserva incompletos para gerar o pagamento.",
      };
    }

    const externalReference = `PRADOS-TOUR:${paymentId}`;
    const amount = payment?.amount ?? installment1?.value ?? booking.totalAmount;

    let chargeId: string | null = payment?.gatewayPaymentId ?? null;
    let invoiceUrl: string | null =
      (typeof payment?.metadata?.invoiceUrl === "string" && payment.metadata.invoiceUrl.trim()
        ? payment.metadata.invoiceUrl.trim()
        : null);

    if (!chargeId) {
      try {
        chargeId =
          (await findAsaasPaymentByExternalReference(externalReference))?.id ?? null;
      } catch {
        chargeId = null;
      }
    }

    if (chargeId && !invoiceUrl) {
      try {
        const found = await findAsaasPaymentByExternalReference(externalReference);
        if (found) {
          invoiceUrl = asaasInvoiceUrl(found);
        }
      } catch {
        // ignore reconcile failure
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

        const created = await createAsaasCardPayment({
          customer: asaasCustomer.id,
          billingType: "CREDIT_CARD",
          value: amount,
          dueDate: installment1?.dueDate ?? new Date().toISOString().slice(0, 10),
          description: `Reserva ${booking.reference} - ${trip.name}`.slice(0, 120),
          externalReference,
          installmentCount: opts.installmentCount,
        }).catch(async (error) => {
          console.error(
            "[ASAAS] Erro ao criar cobrança de cartão:",
            error instanceof Error ? error.message : error,
          );

          try {
            return (
              (await findAsaasPaymentByExternalReference(externalReference)) ?? null
            );
          } catch (reconcileError) {
            console.error(
              "[ASAAS] Erro ao reconciliar cobrança de cartão:",
              reconcileError instanceof Error
                ? reconcileError.message
                : reconcileError,
            );

            return null;
          }
        });

        if (created) {
          chargeId = created.id;
          invoiceUrl = asaasInvoiceUrl(created);
          await updatePixClaim(paymentId, { chargeId, bookingId }).catch(
            () => undefined,
          );
        }
      } catch (error) {
        console.error("[ASAAS] Falha ao criar/reconciliar cobrança de cartão:", {
          bookingId,
          paymentId,
          externalReference,
          error: error instanceof Error ? error.message : error,
        });
        return {
          ok: false,
          message:
            "Não foi possível gerar o link de pagamento neste momento. Sua reserva foi criada e você poderá tentar novamente em instantes.",
        };
      }
    }

    if (!chargeId) {
      return {
        ok: false,
        message:
          "Não foi possível gerar o link de pagamento neste momento. Sua reserva foi criada e você poderá tentar novamente em instantes.",
      };
    }

    if (chargeId && !invoiceUrl) {
      try {
        const found = await getAsaasPayment(chargeId);
        invoiceUrl = asaasInvoiceUrl(found);
      } catch (error) {
        console.error(
          "[ASAAS] Erro ao obter cobrança de cartão:",
          error instanceof Error ? error.message : error,
        );
      }
    }

    try {
      await persistCardPayment(bookingId, paymentId, {
        chargeId,
        invoiceUrl,
        installmentCount: opts.installmentCount,
        responsibleEmail: opts.responsibleEmail,
      });
    } catch (error) {
      console.error("[ASAAS] persistCardPayment() falhou em ensureAsaasCardPayment:", {
        bookingId,
        paymentId,
        error: error instanceof Error ? error.message : error,
      });
      return { ok: false, error: "persist_failed" };
    }

    await completePixClaim(paymentId, { bookingId, paymentId, chargeId }).catch(
      () => undefined,
    );

    completed = true;
    return { ok: true };
  } finally {
    if (!completed) {
      await releasePixClaim(paymentId).catch(() => undefined);
    }
  }
}

/**
 * Correção dos dados dos passageiros de uma reserva JÁ CRIADA.
 *
 * Caminho de suporte para a regra de passageiro obrigatório: quando o webhook
 * recusa um pagamento porque faltam dados, o cliente precisa de um lugar para
 * corrigir — sem isso, a notificação não tem efeito. Só corrige DADOS; não
 * cria nem remove passageiro (a quantidade é a da reserva), não altera o
 * status da reserva e não toca em pagamento.
 *
 * Se a reserva já estiver CONFIRMADA, a correção só é aceita quando TODOS os
 * passageiros ficam completos — o trigger do banco é a última linha e
 * rejeitaria de qualquer forma uma gravação parcial.
 */
export async function updateBookingPassengersAction(
  bookingId: string,
  input: { passengers: Array<Record<string, unknown>> },
) {
  const session = await getSession();
  if (!session) {
    return { error: "Faça login para corrigir os dados." };
  }

  const parsed = passengersSchema.safeParse(input.passengers ?? []);
  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ?? "Dados de passageiros inválidos.",
    };
  }
  const incoming = parsed.data;

  try {
    const outcome = await getRepositoryRuntime().transaction((store) => {
      const booking = store.bookings.find((b) => b.id === bookingId);
      if (!booking) throw new Error("Reserva não encontrada.");

      if (
        booking.customerId !== session.id &&
        !["SUPER_ADMIN", "ADMIN", "FINANCEIRO", "VENDEDOR"].includes(session.role)
      ) {
        throw new Error("Sem permissão para corrigir esta reserva.");
      }

      if (booking.status === "CONCLUIDA") {
        throw new Error(
          "Esta viagem já foi concluída e os dados não podem mais ser alterados.",
        );
      }

      const trip = store.trips.find((t) => t.id === booking.tripId);
      if (!trip) throw new Error("Viagem não encontrada.");
      if (isPastTrip(trip)) {
        throw new Error(PAST_TRIP_MESSAGE);
      }

      // A quantidade é a da reserva: corrige-se o MESMO conjunto de passageiro.
      if (incoming.length !== booking.quantity) {
        throw new Error(
          `A reserva exige ${booking.quantity} passageiro(s) e recebeu ${incoming.length}.`,
        );
      }

      const existing = store.passengers.filter((p) => p.bookingId === booking.id);
      if (existing.length !== incoming.length) {
        throw new Error(
          "A lista de passageiros não bate com a reserva. Fale com o atendimento.",
        );
      }

      // A validação usa a DECLARAÇÃO QUE ESTÁ SENDO ENVIADA agora, não a antiga:
      // uma reserva legada sem declaração é corrigida justamente marcando a caixa.
      const now = new Date().toISOString();
      const issues = collectPassengerIssuesForQuantity(
        incoming.map((p, i) => ({
          ...existing[i],
          name: p.name,
          cpf: p.cpf,
          phone: p.phone,
          rg: p.rg,
          birthDate: p.birthDate,
          dataDeclarationAt: p.dataDeclaration
            ? (existing[i].dataDeclarationAt ?? now)
            : null,
        })),
        booking.quantity,
      );
      if (issues.length > 0) {
        throw new Error(formatPassengerIssuesMessage(issues));
      }

      const before = existing.map((p) => ({
        name: p.name,
        cpf: p.cpf,
        phone: p.phone,
        rg: p.rg,
        birthDate: p.birthDate,
      }));

      incoming.forEach((next, i) => {
        const target = existing[i];
        target.name = normalizePassengerName(next.name);
        // Mesma normalização do checkout: CPF e telefone só com dígitos, senão a
        // busca por CPF (reconcile, lembretes, check-in) não encontra a linha.
        target.cpf = onlyDigits(next.cpf);
        target.phone = onlyDigits(next.phone);
        target.rg = next.rg;
        target.birthDate = next.birthDate;
        target.dataDeclarationAt = now;
      });

      booking.updatedAt = now;

      store.auditLogs.push({
        id: uuid(),
        userId: session.id,
        action: "UPDATE_BOOKING_PASSENGERS",
        entity: "booking",
        entityId: booking.id,
        oldValue: { reference: booking.reference, passengers: before },
        newValue: {
          reference: booking.reference,
          passengers: incoming.length,
          completo: true,
        },
        ip: null,
        createdAt: now,
      });

      return { reference: booking.reference };
    });

    revalidatePath("/minhas-viagens");
    revalidatePath("/notificacoes");
    revalidatePath(`/minhas-viagens/${bookingId}/passageiros`);
    revalidatePath(`/voucher/${bookingId}`);

    return { ok: true, reference: outcome.reference };
  } catch (e) {
    return {
      error:
        e instanceof Error ? e.message : "Não foi possível salvar os dados.",
    };
  }
}
