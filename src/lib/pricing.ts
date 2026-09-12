import type { Coupon, DataStore, PaymentMethod, PaymentPlan, Promotion, Trip } from "@/types";
import { calculateTripPrice, formatCurrency } from "@/lib/utils";

/**
 * Motor de preços do backend. Todo cálculo de preço, desconto e total usado no
 * checkout deve passar por aqui — nunca confiar em valores vindos do frontend.
 *
 * Ordem de aplicação (documentada):
 *   1. Preço promocional/preço de dupla promocional da viagem (promoção PRECO).
 *   2. Desconto promocional (percentual ou fixo) sobre o valor base.
 *   3. Cupom: sobre o subvalor já com promoção (quando cumulativo).
 *   4. Desconto PIX (taxa da promoção, quando definida, senão a global).
 * Quando promoção e cupom existem mas não são cumulativos, aplica-se apenas o
 * maior desconto entre os dois (evita desconto duplo).
 */

export function round2(value: number) {
  return Math.round(value * 100) / 100;
}

/** Idade completa de uma pessoa na data da viagem (YYYY-MM-DD). */
export function ageAtDate(birthDate: string, tripDate: string): number {
  const [by, bm, bd] = birthDate.slice(0, 10).split("-").map(Number);
  const [ty, tm, td] = tripDate.slice(0, 10).split("-").map(Number);
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age -= 1;
  return Math.max(0, age);
}

/**
 * Categoria de preço do passageiro a partir da data de nascimento: criança
 * apenas quando a viagem define childMaxAge E o passageiro tem idade <= limite.
 */
export function passengerCategory(
  birthDate: string | null | undefined,
  tripDate: string,
  childMaxAge: number | null,
): "ADULTO" | "CRIANCA" {
  if (!childMaxAge || childMaxAge <= 0 || !birthDate) return "ADULTO";
  return ageAtDate(birthDate, tripDate) <= childMaxAge ? "CRIANCA" : "ADULTO";
}

/** Preços efetivos (pessoa/dupla) considerando uma promoção de preço/dupla. */
export function effectiveTripPrices(trip: Trip, promotion?: Promotion | null) {
  if (promotion?.discountType === "PRECO") {
    const person = promotion.promoPricePerson ?? trip.pricePerson;
    const couple = promotion.promoPriceCouple ?? trip.priceCouple ?? person * 2;
    return { personPrice: person, couplePrice: couple };
  }
  return {
    personPrice: trip.pricePerson,
    couplePrice: trip.priceCouple ?? trip.pricePerson * 2,
  };
}

export function baseTripPrice(
  quantity: number,
  trip: Trip,
  promotion?: Promotion | null,
) {
  const { personPrice, couplePrice } = effectiveTripPrices(trip, promotion);
  return calculateTripPrice(quantity, personPrice, couplePrice);
}

/**
 * Contabiliza a base ("ticket") de uma reserva:
 * - com passageiros: adultos pagam pessoa/dupla (duplas ganham o preço de
 *   casal) e crianças pagam `trip.childPrice` (ou pessoa, se não configurado);
 * - sem passageiros: todos os lugares pagam pessoa/dupla (comportamento antigo).
 */
function tripsTicket(
  trip: Trip,
  quantity: number,
  promotion: Promotion | null | undefined,
  passengers?: Array<{ birthDate?: string | null }>,
): { adultCount: number; childCount: number; base: number } {
  const { personPrice, couplePrice } = effectiveTripPrices(trip, promotion);
  if (passengers && passengers.length > 0) {
    const childCount = passengers.filter(
      (p) => passengerCategory(p.birthDate, trip.date, trip.childMaxAge) === "CRIANCA",
    ).length;
    const adultCount = passengers.length - childCount;
    const adultBase = calculateTripPrice(adultCount, personPrice, couplePrice);
    const childPrice = trip.childPrice ?? personPrice;
    return { adultCount, childCount, base: round2(adultBase + childCount * childPrice) };
  }
  return { adultCount: quantity, childCount: 0, base: calculateTripPrice(quantity, personPrice, couplePrice) };
}

/** Monetiza o desconto da promoção sobre um valor base. */
export function promotionDiscountAmount(
  store: DataStore,
  promotion: Promotion | null,
  trip: Trip,
  quantity: number,
  passengers?: Array<{ birthDate?: string | null }>,
): number {
  if (!promotion) return 0;
  const base = tripsTicket(trip, quantity, null, passengers).base;
  if (promotion.discountType === "PRECO") {
    const promoBase = tripsTicket(trip, quantity, promotion, passengers).base;
    return Math.max(0, round2(base - promoBase));
  }
  if (promotion.discountType === "PERCENTUAL") {
    return round2((base * promotion.discountValue) / 100);
  }
  return Math.min(base, promotion.discountValue);
}

/** Promoções ativas e elegíveis para uma viagem neste momento. */
export function eligiblePromotions(
  store: DataStore,
  tripId: string,
  now = new Date().toISOString(),
): Promotion[] {
  return store.promotions.filter((p) => {
    if (!p.active || p.deletedAt) return false;
    if (p.startDate && p.startDate > now) return false;
    if (p.endDate && p.endDate < now) return false;
    if (!p.allTrips && !p.tripIds.includes(tripId)) return false;
    if (p.usageLimit != null) {
      const used = store.promotionUsages.filter((u) => u.promotionId === p.id).length;
      if (used >= p.usageLimit) return false;
    }
    return true;
  });
}

/** Melhor promoção elegível (maior desconto monetário para esta quantidade). */
export function bestPromotionForTrip(
  store: DataStore,
  trip: Trip,
  promotions: Promotion[],
  quantity: number,
  passengers?: Array<{ birthDate?: string | null }>,
): Promotion | null {
  let best: Promotion | null = null;
  let bestDiscount = -1;
  for (const promotion of promotions) {
    const discount = promotionDiscountAmount(store, promotion, trip, quantity, passengers);
    if (discount > bestDiscount) {
      best = promotion;
      bestDiscount = discount;
    } else if (discount === bestDiscount && discount > 0) {
      if (!best || promotion.createdAt > best.createdAt) best = promotion;
    }
  }
  return best;
}

/** Valida um cupom. Retorna mensagem de erro ou null (válido). */
export function validateCoupon(
  store: DataStore,
  coupon: Coupon | undefined,
  opts: {
    tripId: string;
    baseAmount: number;
    userId: string;
    now?: string;
  },
): string | null {
  const now = opts.now ?? new Date().toISOString();
  if (!coupon || !coupon.active) return "Cupom inválido.";
  if (coupon.validFrom && coupon.validFrom > now) return "Cupom ainda não está válido.";
  if (coupon.validUntil && coupon.validUntil < now) return "Cupom expirado.";
  if (coupon.tripIds.length > 0 && !coupon.tripIds.includes(opts.tripId)) {
    return "Cupom não é válido para esta viagem.";
  }
  if (coupon.minAmount != null && opts.baseAmount < coupon.minAmount) {
    return `Valor mínimo de ${formatCurrency(coupon.minAmount)} para usar este cupom.`;
  }
  if (coupon.usageLimit != null) {
    const used = store.couponUsages.filter((u) => u.couponId === coupon.id).length;
    if (used >= coupon.usageLimit) return "Limite do cupom atingido.";
  }
  if (coupon.perUserLimit != null) {
    const usedByUser = store.couponUsages.filter(
      (u) => u.couponId === coupon.id && u.userId === opts.userId,
    ).length;
    if (usedByUser >= coupon.perUserLimit) return "Limite de uso deste cupom por cliente atingido.";
  }
  return null;
}

export function couponDiscountAmount(base: number, coupon: Coupon) {
  if (coupon.type === "PERCENTUAL") return round2((base * coupon.value) / 100);
  return Math.min(base, coupon.value);
}

export type PriceBreakdown = {
  baseAmount: number;
  promoDiscount: number;
  couponDiscount: number;
  pixDiscount: number;
  totalAmount: number;
  discountAmount: number;
  adultCount: number;
  childCount: number;
  insuranceAmount: number;
  insuranceCount: number;
  promotion: Promotion | null;
  coupon: Coupon | null;
  couponCode: string | null;
};

export function computeBookingPrice(params: {
  store: DataStore;
  trip: Trip;
  quantity: number;
  paymentMethod: PaymentMethod;
  paymentPlan: PaymentPlan;
  couponCode?: string;
  userId: string;
  now?: string;
  passengers?: Array<{ birthDate?: string | null }>;
  insurance?: boolean;
}): { breakdown: PriceBreakdown | null; error: string | null } {
  const now = params.now ?? new Date().toISOString();

  if (params.quantity < 1) {
    return { breakdown: null, error: "Quantidade inválida." };
  }

  const ticket = tripsTicket(params.trip, params.quantity, null, params.passengers);
  const base = ticket.base;
  const childCount = ticket.childCount;
  const adultCount = ticket.adultCount;

  // 1-2. Promoção elegível de maior benefício (respeitando limite por cliente).
  let promotion: Promotion | null = bestPromotionForTrip(
    params.store,
    params.trip,
    eligiblePromotions(params.store, params.trip.id, now),
    params.quantity,
    params.passengers,
  );
  if (promotion?.perUserLimit != null) {
    const usedByUser = params.store.promotionUsages.filter(
      (u) => u.promotionId === promotion!.id && u.userId === params.userId,
    ).length;
    if (usedByUser >= promotion.perUserLimit) promotion = null;
  }

  let promoDiscount = promotionDiscountAmount(
    params.store,
    promotion,
    params.trip,
    params.quantity,
    params.passengers,
  );

  // 3. Cupom.
  let coupon: Coupon | null = null;
  let couponDiscount = 0;
  if (params.couponCode?.trim()) {
    const found = params.store.coupons.find(
      (c) => c.code.toUpperCase() === params.couponCode!.trim().toUpperCase(),
    );
    const error = validateCoupon(params.store, found, {
      tripId: params.trip.id,
      baseAmount: Math.max(0, round2(base - promoDiscount)),
      userId: params.userId,
      now,
    });
    if (error) {
      return { breakdown: null, error };
    }
    coupon = found!;
    couponDiscount = couponDiscountAmount(
      Math.max(0, round2(base - promoDiscount)),
      coupon,
    );

    // Cumulatividade: promoção + cupom apenas se ambos forem cumulativos.
    // Senão aplica-se o maior desconto entre os dois (evita desconto duplo).
    if (promotion && coupon) {
      const stackable = Boolean(promotion.stackable && coupon.stackable);
      if (!stackable && promoDiscount >= couponDiscount) {
        couponDiscount = 0;
      } else if (!stackable) {
        promoDiscount = 0;
        promotion = null;
      }
    }
  }

  // 4. Desconto PIX.
  let pixDiscount = 0;
  if (params.paymentMethod === "PIX" && params.paymentPlan === "TOTAL") {
    const pixRate = promotion?.pixDiscountPercent ?? params.store.paymentSettings.pixTotalDiscount;
    if (pixRate > 0) {
      pixDiscount = round2(Math.max(0, round2(base - promoDiscount - couponDiscount)) * pixRate);
    }
  }

  // 5. Seguro viagem: taxa fixa por passageiro, somada APÓS os descontos.
  const insuranceEnabled = Boolean(params.insurance && params.trip.insuranceEnabled);
  const insuranceAmount = insuranceEnabled
    ? round2(params.quantity * params.trip.insurancePrice)
    : 0;
  const insuranceCount = insuranceEnabled ? params.quantity : 0;

  const discount = round2(promoDiscount + couponDiscount + pixDiscount);
  const total = Math.max(0, round2(base - discount)) + insuranceAmount;

  return {
    breakdown: {
      baseAmount: base,
      promoDiscount,
      couponDiscount,
      pixDiscount,
      discountAmount: discount,
      totalAmount: total,
      adultCount,
      childCount,
      insuranceAmount,
      insuranceCount,
      promotion,
      coupon,
      couponCode: coupon?.code ?? null,
    },
    error: null,
  };
}

/** Raio-X de uma promoção para exibição (o que o cliente vê). */
export function promotionSummary(
  store: DataStore,
  promotion: Promotion,
  trip: Trip,
) {
  const coupon = promotion.couponId
    ? store.coupons.find((c) => c.id === promotion.couponId) ?? null
    : null;
  const { personPrice, couplePrice } = effectiveTripPrices(trip, promotion);
  const pixRate = promotion.pixDiscountPercent ?? store.paymentSettings.pixTotalDiscount;
  return {
    promotion,
    coupon,
    personPrice,
    couplePrice,
    hasPriceOverride: promotion.discountType === "PRECO",
    isPercent: promotion.discountType === "PERCENTUAL",
    isFixed: promotion.discountType === "FIXO",
    pixRate,
  };
}