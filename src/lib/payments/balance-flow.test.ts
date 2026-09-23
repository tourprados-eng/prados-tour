import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  Booking,
  DataStore,
  Payment,
  PaymentInstallment,
  Profile,
  Trip,
} from "@/types";
import {
  balancePaymentIdFor,
  computeRemainingBalance,
  ensureBalanceChargeForBooking,
  isBookingFullyPaid,
} from "@/lib/payments/balance";

vi.mock("uuid", () => {
  let n = 1;
  return {
    v4: () => `00000000-0000-4000-8000-${String(n++).padStart(12, "0")}`,
  };
});

/**
 * Testes do fluxo de SALDO (segunda parcela) — genéricos, sem dependência de
 * IDs reais.
 *
 * Cobre: idempotência (clique duplo / atualização de página / reentrada),
 * reuso de cobrança existente, criação única, cobrança paga e vencida,
 * isolamento entre reservas/clientes, valores diferentes, QR/copia-e-cola,
 * link web, webhook confirmando a 2ª parcela e liberação do voucher (saldo 0).
 *
 * Runtime, Asaas e claims são simulados em memória (sem rede e sem banco). O
 * store é um DataStore mutável compartilhado entre chamadas, como no
 * `supabase-store` usado em produção.
 */

/* ---------------------------------------------------------------------------
 * Estado compartilhado entre os mocks (vi.hoisted) e o teste.
 * ------------------------------------------------------------------------- */

const fake = vi.hoisted(() => {
  const chargesByRef = new Map<string, unknown>();
  const chargesById = new Map<string, unknown>();
  const claims = new Map<string, unknown>();
  const createCalls: Array<{ value: number; externalReference: string }> = [];
  const qrCalls: string[] = [];
  const paymentCalls: string[] = [];
  const seq = { n: 1 };
  let data: DataStore | null = null;

  function clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }

  return {
    chargesByRef,
    chargesById,
    claims,
    createCalls,
    qrCalls,
    paymentCalls,
    seq,
    clone,
    getData(): DataStore | null {
      return data;
    },
    setData(next: DataStore | null): void {
      data = next;
    },
    reset(): void {
      seq.n = 1;
      chargesByRef.clear();
      chargesById.clear();
      claims.clear();
      createCalls.length = 0;
      qrCalls.length = 0;
      paymentCalls.length = 0;
      data = null;
    },
  };
});

/* ---------------------------------------------------------------------------
 * Mocks dos módulos (runtime, asaas, claims, webhook-events).
 * ------------------------------------------------------------------------- */

function buildRuntime() {
  const data = fake.getData();
  if (!data) throw new Error("fake store não inicializada");
  return {
    backend: "supabase" as const,
    supabaseReady: true,
    repository: {} as never,
    async read(): Promise<DataStore> {
      return fake.clone(data);
    },
    async transaction<T>(mutator: (store: DataStore) => T | Promise<T>): Promise<T> {
      const next = fake.clone(data);
      const result = await mutator(next);
      for (const key of Object.keys(next) as Array<keyof DataStore>) {
        (data as unknown as Record<string, unknown>)[key] = next[key];
      }
      return result;
    },
    async findResumableBookingId(): Promise<null> {
      return null;
    },
  };
}

vi.mock("@/lib/repositories/runtime", () => ({
  getRepositoryRuntime: () => buildRuntime(),
}));

vi.mock("@/lib/payments/asaas", () => ({
  asaasPaymentLink: (
    payment: { paymentUrl?: string | null; invoiceUrl?: string | null } | undefined | null,
  ) => payment?.paymentUrl?.trim() || payment?.invoiceUrl?.trim() || null,

  getOrCreateAsaasCustomer: async () => ({
    id: "cus_fake",
    name: "Cliente Teste",
    email: null,
    mobilePhone: null,
    cpfCnpj: null,
    externalReference: null,
  }),

  createAsaasPixPayment: async (input: {
    customer: string;
    billingType: string;
    value: number;
    dueDate: string;
    externalReference: string;
  }) => {
    fake.createCalls.push({ value: input.value, externalReference: input.externalReference });
    const id = `pay_fake_${fake.seq.n}`;
    fake.seq.n += 1;
    const charge = {
      id,
      customer: input.customer,
      billingType: input.billingType,
      value: input.value,
      dueDate: input.dueDate,
      externalReference: input.externalReference,
      status: "PENDING",
      paymentUrl: `https://asaas.test/i/${id}`,
    };
    fake.chargesByRef.set(input.externalReference, charge);
    fake.chargesById.set(id, charge);
    return charge;
  },

  getAsaasPayment: async (paymentId: string) => {
    fake.paymentCalls.push(paymentId);
    const charge = fake.chargesById.get(paymentId);
    if (!charge) throw new Error(`cobrança inexistente: ${paymentId}`);
    return charge;
  },

  getAsaasPixQrCode: async (paymentId: string) => {
    fake.qrCalls.push(paymentId);
    if (!fake.chargesById.has(paymentId)) {
      throw new Error(`QR de cobrança inexistente: ${paymentId}`);
    }
    return {
      encodedImage: "",
      payload: `000201010212fake${paymentId}`,
      expirationDate: "2099-01-01",
    };
  },

  findAsaasPaymentByExternalReference: async (externalReference: string) =>
    fake.chargesByRef.get(externalReference) ?? null,
}));

vi.mock("@/lib/payments/claims", () => ({
  acquirePixClaim: async (args: { key: string; customerId: string; tripId: string }) => {
    const existing = fake.claims.get(args.key);
    if (existing) {
      return { won: false, claim: fake.clone(existing) };
    }
    const claim = {
      idempotencyKey: args.key,
      bookingId: null,
      customerId: args.customerId,
      tripId: args.tripId,
      paymentId: null,
      chargeId: null,
      status: "PENDING",
      leaseUntil: new Date(Date.now() + 90_000).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    fake.claims.set(args.key, fake.clone(claim));
    return { won: true, claim };
  },
  getPixClaim: async (key: string) => {
    const claim = fake.claims.get(key);
    return claim ? fake.clone(claim) : null;
  },
  takeoverExpiredClaim: async (key: string) => {
    const claim = fake.claims.get(key);
    if (!claim) return { won: false, claim: null };
    const now = new Date().toISOString();
    const value = claim as { leaseUntil: string | null; updatedAt: string };
    if (!value.leaseUntil || value.leaseUntil <= now) {
      value.leaseUntil = new Date(Date.now() + 90_000).toISOString();
      value.updatedAt = now;
      return { won: true, claim: fake.clone(claim) };
    }
    return { won: false, claim: fake.clone(claim) };
  },
  updatePixClaim: async (key: string, patch: Record<string, unknown>) => {
    const claim = fake.claims.get(key);
    if (claim) Object.assign(claim, patch);
  },
  completePixClaim: async (
    key: string,
    fields: { bookingId: string; paymentId: string; chargeId: string | null },
  ) => {
    const claim = fake.claims.get(key);
    if (claim) {
      Object.assign(claim, fields, { status: "CHARGED", leaseUntil: null });
    }
  },
  releasePixClaim: async (key: string) => {
    fake.claims.delete(key);
  },
}));

vi.mock("@/lib/payments/webhook-events", () => ({
  claimAsaasWebhookEvent: async () => ({ claimed: true }),
  completeAsaasWebhookEvent: async () => undefined,
  releaseAsaasWebhookEvent: async () => undefined,
}));

/* ---------------------------------------------------------------------------
 * Fixtures.
 * ------------------------------------------------------------------------- */

const NOW = "2026-09-23T22:00:00.000Z";

function emptyStore(): DataStore {
  return {
    profiles: [],
    trips: [],
    boardingPoints: [],
    tripBoardingPoints: [],
    seats: [],
    sellers: [],
    bookings: [],
    passengers: [],
    payments: [],
    installments: [],
    coupons: [],
    couponUsages: [],
    promotions: [],
    promotionUsages: [],
    commissions: [],
    expenses: [],
    checkins: [],
    notifications: [],
    reviews: [],
    galleryPhotos: [],
    loyaltyPoints: [],
    referrals: [],
    auditLogs: [],
    brand: {} as never,
    paymentSettings: {} as never,
    promoBanner: {} as never,
    voucher: { showQr: true } as never,
  };
}

function makeProfile(id: string): Profile {
  return {
    id,
    fullName: `Cliente ${id}`,
    cpf: `000000001${id}`,
    birthDate: null,
    email: `${id}@test.com`,
    phone: null,
    whatsapp: null,
    role: "CLIENTE",
    customerClass: "NOVO",
    referralCode: `ref-${id}`,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function makeTrip(): Trip {
  return {
    id: "trip-1",
    name: "Viagem Teste",
    slug: "viagem-teste",
    destination: "Destino Teste",
    category: "CIDADE_TURISMO",
    date: "2099-06-15",
    departureDate: null,
    departureTime: null,
    returnTime: null,
    pricePerson: 500,
    priceCouple: null,
    childPrice: null,
    childMaxAge: null,
    insuranceEnabled: false,
    insurancePrice: 0,
    transportPolicy: null,
    totalSeats: 40,
    description: "",
    itinerary: "",
    included: "",
    notIncluded: "",
    rules: "",
    cancellationPolicy: "",
    status: "PUBLICADA",
    images: [],
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function makeBooking(id: string, reference: string, customerId: string, total: number): Booking {
  return {
    id,
    reference,
    customerId,
    tripId: "trip-1",
    sellerId: null,
    quantity: 1,
    boardingPointId: null,
    boardingPoint: null,
    totalAmount: total,
    baseAmount: total,
    discountAmount: 0,
    couponCode: null,
    paymentPlan: "PARCIAL",
    status: "CONFIRMADA",
    notes: null,
    childCount: 0,
    insuranceCount: 0,
    insuranceAmount: 0,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function makePaidPayment(
  bookingId: string,
  customerId: string,
  amount: number,
  chargeId: string,
): Payment {
  return {
    id: `${bookingId}-p1`,
    bookingId,
    customerId,
    method: "PIX",
    plan: "PARCIAL",
    amount,
    status: "PAGO",
    gateway: "asaas",
    gatewayPaymentId: chargeId,
    feeAmount: 0,
    netAmount: amount,
    paidAt: NOW,
    pixCopyPaste: "00020101021200014br.gov.bcb.pix.pago",
    metadata: {},
    createdAt: NOW,
  };
}

function makeInstallment1(bookingId: string, amount: number): PaymentInstallment {
  return {
    id: `${bookingId}-i1`,
    bookingId,
    number: 1,
    value: amount,
    dueDate: "2099-01-01",
    status: "PAGO",
    paidAt: NOW,
    method: "PIX",
  };
}

function makeBalancePayment(
  bookingId: string,
  customerId: string,
  amount: number,
  chargeId: string,
  overrides: Partial<Payment> = {},
): Payment {
  const id = `${bookingId}-balance`;
  return {
    id,
    bookingId,
    customerId,
    method: "PIX",
    plan: "PARCIAL",
    amount,
    status: "PENDENTE",
    gateway: "asaas",
    gatewayPaymentId: chargeId,
    feeAmount: 0,
    netAmount: amount,
    paidAt: null,
    pixCopyPaste: "00020101021200014br.gov.bcb.pix.saldo",
    asaasExternalReference: `PRADOS-TOUR:${id}`,
    metadata: {
      type: "BALANCE",
      installNumber: 2,
      awaitingWebhook: true,
      pixState: "QR_READY",
      paymentUrl: `https://www.asaas.com/i/${chargeId}`,
      asaasExternalReference: `PRADOS-TOUR:${id}`,
    },
    createdAt: NOW,
    ...overrides,
  };
}

function seedAsaasCharge(
  chargeId: string,
  opts: { status?: string; paymentUrl?: string | null; dueDate?: string } = {},
): void {
  const charge = {
    id: chargeId,
    customer: "cus_fake",
    billingType: "PIX",
    value: 0,
    dueDate: opts.dueDate ?? "2099-06-08",
    externalReference: "",
    status: opts.status ?? "PENDING",
    paymentUrl: opts.paymentUrl === undefined ? `https://asaas.test/i/${chargeId}` : opts.paymentUrl,
  };
  fake.chargesById.set(chargeId, charge);
  fake.chargesByRef.set(charge.externalReference, charge);
}

/**
 * Reserva PARCIAL com a 1ª parcela confirmada (50% pago).
 */
function seedBookingWithHalfPaid(
  store: DataStore,
  booking: Booking,
  profile: Profile,
  paidAmount: number,
): void {
  store.profiles.push(profile);
  store.trips.push(makeTrip());
  store.bookings.push(booking);
  store.payments.push(makePaidPayment(booking.id, profile.id, paidAmount, `pay_first_${booking.id}`));
  store.installments.push(makeInstallment1(booking.id, paidAmount));
}

beforeEach(() => {
  fake.reset();
  fake.setData(emptyStore());
});

afterEach(() => {
  fake.reset();
});

/* ---------------------------------------------------------------------------
 * Suíte.
 * ------------------------------------------------------------------------- */

describe("1. Saldo e voucher (regras de valor)", () => {
  it("50% pago → saldo restante e voucher bloqueado (isBookingFullyPaid=false)", async () => {
    const store = fake.getData()!;
    const profile = makeProfile("cust-a");
    const bookingA = makeBooking("aaa", "REF-A", profile.id, 500);
    seedBookingWithHalfPaid(store, bookingA, profile, 250);

    expect(computeRemainingBalance(store, bookingA.id)).toBe(250);
    expect(isBookingFullyPaid(store, bookingA.id)).toBe(false);
  });

  it("100% pago → saldo 0 e voucher liberado (isBookingFullyPaid=true)", async () => {
    const store = fake.getData()!;
    const profile = makeProfile("cust-c");
    const bookingC = makeBooking("ccc", "REF-C", profile.id, 500);
    seedBookingWithHalfPaid(store, bookingC, profile, 250);
    store.payments.push(
      makeBalancePayment(bookingC.id, profile.id, 250, "pay_balance_c", {
        status: "PAGO",
        paidAt: NOW,
      }),
    );
    store.installments.push({
      id: `${bookingC.id}-i2`,
      bookingId: bookingC.id,
      number: 2,
      value: 250,
      dueDate: "2099-06-07",
      status: "PAGO",
      paidAt: NOW,
      method: "PIX",
    });

    expect(computeRemainingBalance(store, bookingC.id)).toBe(0);
    expect(isBookingFullyPaid(store, bookingC.id)).toBe(true);
  });
});

describe("2. Criação única da cobrança de saldo", () => {
  it("reserva sem cobrança → cria UMA cobrança com valor do saldo, QR e link", async () => {
    const store = fake.getData()!;
    const profile = makeProfile("cust-a");
    const bookingA = makeBooking("aaa", "REF-A", profile.id, 500);
    seedBookingWithHalfPaid(store, bookingA, profile, 250);

    const trip = store.trips[0];
    const result = await ensureBalanceChargeForBooking(bookingA, trip, {
      responsibleEmail: profile.email,
    });

    expect(result.ok).toBe(true);
    expect(result.reused).toBe(false);
    expect(result.amount).toBe(250);
    expect(result.pixCopyPaste).toBeTruthy();
    expect(result.pixCopyPaste?.startsWith("000201010212")).toBe(true);
    expect(result.paymentUrl).toMatch(/^https:\/\/asaas\.test\/i\//);
    expect(fake.createCalls).toHaveLength(1);
    expect(fake.createCalls[0].value).toBe(250);

    const saved = fake
      .getData()!
      .payments.filter((p) => (p.metadata as { type?: string })?.type === "BALANCE");
    expect(saved).toHaveLength(1);
    expect(saved[0].amount).toBe(250);
    expect(saved[0].status).toBe("PENDENTE");
    expect(saved[0].gatewayPaymentId).toBe("pay_fake_1");
    expect(saved[0].pixCopyPaste).toBe(result.pixCopyPaste);
  });
});

describe("3. Idempotência: clique duplo, atualização de página e reentrada", () => {
  it("duas chamadas → UMA única cobrança (sem duplicar)", async () => {
    const store = fake.getData()!;
    const profile = makeProfile("cust-a");
    const bookingA = makeBooking("aaa", "REF-A", profile.id, 500);
    seedBookingWithHalfPaid(store, bookingA, profile, 250);
    const trip = store.trips[0];

    const primeiro = await ensureBalanceChargeForBooking(bookingA, trip, {
      responsibleEmail: profile.email,
    });
    const segundo = await ensureBalanceChargeForBooking(bookingA, trip, {
      responsibleEmail: profile.email,
    });

    expect(primeiro.ok).toBe(true);
    expect(segundo.ok).toBe(true);
    expect(segundo.reused).toBe(true);
    expect(segundo.amount).toBe(250);
    expect(segundo.pixCopyPaste).toBe(primeiro.pixCopyPaste);
    expect(fake.createCalls).toHaveLength(1);

    const balancePayments = fake
      .getData()!
      .payments.filter((p) => (p.metadata as { type?: string })?.type === "BALANCE");
    expect(balancePayments).toHaveLength(1);
    expect(fake.chargesByRef.size).toBe(1);
  });

  it("muitas chamadas seguidas (simula atualização/voltar) → uma única cobrança", async () => {
    const store = fake.getData()!;
    const profile = makeProfile("cust-a");
    const bookingA = makeBooking("aaa", "REF-A", profile.id, 500);
    seedBookingWithHalfPaid(store, bookingA, profile, 250);
    const trip = store.trips[0];

    for (let i = 0; i < 5; i++) {
      const r = await ensureBalanceChargeForBooking(bookingA, trip, {
        responsibleEmail: profile.email,
      });
      expect(r.ok).toBe(true);
    }
    expect(fake.createCalls).toHaveLength(1);
    expect(
      fake.getData()!.payments.filter((p) => p.id === balancePaymentIdFor(bookingA.id)),
    ).toHaveLength(1);
  });
});

describe("4. Reuso de cobrança existente (pendente com PIX salvo)", () => {
  it("cobrança existente → reutiliza, sem criação nem GET de QR", async () => {
    const store = fake.getData()!;
    const profile = makeProfile("cust-a");
    const bookingA = makeBooking("aaa", "REF-A", profile.id, 500);
    seedBookingWithHalfPaid(store, bookingA, profile, 250);
    const chargeId = "pay_ja_existente";
    const balance = makeBalancePayment(bookingA.id, profile.id, 250, chargeId);
    store.payments.push(balance);
    seedAsaasCharge(chargeId);

    const trip = store.trips[0];
    const resultado = await ensureBalanceChargeForBooking(bookingA, trip, {
      responsibleEmail: profile.email,
    });

    expect(resultado.ok).toBe(true);
    expect(resultado.reused).toBe(true);
    expect(resultado.pixCopyPaste).toBe(balance.pixCopyPaste);
    expect(resultado.paymentUrl).toMatch(/asaas\.com\/i\//);
    expect(fake.createCalls).toHaveLength(0);
    expect(fake.qrCalls).toHaveLength(0);
    const saved = fake
      .getData()!
      .payments.filter((p) => (p.metadata as { type?: string })?.type === "BALANCE");
    expect(saved).toHaveLength(1);
    expect(saved[0].gatewayPaymentId).toBe(chargeId);
    expect(saved[0].pixCopyPaste).toBe(balance.pixCopyPaste);
  });
});

describe("5. Cobrança existente porém SEM PIX salvo (vencida/pendente) → refaz QR via GET", () => {
  it("reutiliza a MESMA cobrança, obtém o QR por GET — nunca cria nova", async () => {
    const store = fake.getData()!;
    const profile = makeProfile("cust-a");
    const bookingA = makeBooking("aaa", "REF-A", profile.id, 500);
    seedBookingWithHalfPaid(store, bookingA, profile, 250);
    const chargeId = "pay_vencida";
    store.payments.push(
      makeBalancePayment(bookingA.id, profile.id, 250, chargeId, {
        pixCopyPaste: null,
        metadata: { type: "BALANCE", installNumber: 2 },
      }),
    );
    seedAsaasCharge(chargeId, { status: "OVERDUE", dueDate: "2026-01-01" });

    const trip = store.trips[0];
    const resultado = await ensureBalanceChargeForBooking(bookingA, trip, {
      responsibleEmail: profile.email,
    });

    expect(resultado.ok).toBe(true);
    expect(resultado.reused).toBe(true);
    expect(fake.createCalls).toHaveLength(0);
    expect(fake.qrCalls).toContain(chargeId);
    expect(resultado.pixCopyPaste?.startsWith("000201010212")).toBe(true);
  });
});

describe("6. Cobrança PAGA → já quitado, não gera outra", () => {
  it("saldo já pago → alreadyPaid e nenhuma criação", async () => {
    const store = fake.getData()!;
    const profile = makeProfile("cust-a");
    const bookingA = makeBooking("aaa", "REF-A", profile.id, 500);
    seedBookingWithHalfPaid(store, bookingA, profile, 250);
    const chargeId = "pay_paga";
    store.payments.push(
      makeBalancePayment(bookingA.id, profile.id, 250, chargeId, {
        status: "PAGO",
        paidAt: NOW,
      }),
    );
    seedAsaasCharge(chargeId, { status: "RECEIVED" });

    const trip = store.trips[0];
    const resultado = await ensureBalanceChargeForBooking(bookingA, trip, {
      responsibleEmail: profile.email,
    });

    expect(resultado.ok).toBe(true);
    expect(resultado.alreadyPaid).toBe(true);
    expect(fake.createCalls).toHaveLength(0);
    expect(fake.getData()!.payments.length).toBe(2);
  });

  it("saldo total já pago (sem cobrança de saldo) → alreadyPaid e nenhuma criação", async () => {
    const store = fake.getData()!;
    const profile = makeProfile("cust-c");
    const bookingC = makeBooking("ccc", "REF-C", profile.id, 500);
    store.profiles.push(profile);
    store.trips.push(makeTrip());
    store.bookings.push(bookingC);
    store.payments.push(makePaidPayment(bookingC.id, profile.id, 500, "pay_first_c"));
    store.installments.push(makeInstallment1(bookingC.id, 500));
    store.installments.push({
      id: `${bookingC.id}-i2`,
      bookingId: bookingC.id,
      number: 2,
      value: 500,
      dueDate: "2099-06-07",
      status: "PAGO",
      paidAt: NOW,
      method: "PIX",
    });

    const trip = store.trips[0];
    const resultado = await ensureBalanceChargeForBooking(bookingC, trip, {
      responsibleEmail: profile.email,
    });

    expect(resultado.ok).toBe(true);
    expect(resultado.alreadyPaid).toBe(true);
    expect(fake.createCalls).toHaveLength(0);
  });
});

describe("7. Isolamento: cada reserva usa SOMENTE a própria cobrança", () => {
  it("dois clientes com valores diferentes → cobranças diferentes e corretas", async () => {
    const store = fake.getData()!;
    const profileA = makeProfile("cust-a");
    const bookingA = makeBooking("aaa", "REF-A", profileA.id, 500);
    seedBookingWithHalfPaid(store, bookingA, profileA, 250);

    const profileB = makeProfile("cust-b");
    const bookingB = makeBooking("bbb", "REF-B", profileB.id, 800);
    seedBookingWithHalfPaid(store, bookingB, profileB, 400);

    const trip = store.trips[0];
    const ra = await ensureBalanceChargeForBooking(bookingA, trip, {
      responsibleEmail: profileA.email,
    });
    const rb = await ensureBalanceChargeForBooking(bookingB, trip, {
      responsibleEmail: profileB.email,
    });

    expect(ra.ok).toBe(true);
    expect(rb.ok).toBe(true);
    expect(ra.amount).toBe(250);
    expect(rb.amount).toBe(400);

    const idA = balancePaymentIdFor(bookingA.id);
    const idB = balancePaymentIdFor(bookingB.id);
    expect(idA).not.toBe(idB);

    const refs = [...fake.chargesByRef.keys()];
    expect(refs).toContain(`PRADOS-TOUR:${idA}`);
    expect(refs).toContain(`PRADOS-TOUR:${idB}`);
    expect(refs).toHaveLength(2);

    const payments = fake.getData()!.payments;
    const balA = payments.find((p) => p.id === idA)!;
    const balB = payments.find((p) => p.id === idB)!;
    expect(balA.bookingId).toBe(bookingA.id);
    expect(balB.bookingId).toBe(bookingB.id);
    expect(balA.gatewayPaymentId).not.toBe(balB.gatewayPaymentId);
    expect(balA.amount).toBe(250);
    expect(balB.amount).toBe(400);
    expect(fake.createCalls.map((c) => c.value).sort()).toEqual([250, 400]);
  });
});

describe("8. Webhook confirmando a 2ª parcela → saldo 0 → voucher liberado", () => {
  it("confirmPaymentWebhook marca o pagamento de saldo PAGO, parcela 2 PAGO e libera voucher", async () => {
    const store = fake.getData()!;
    const profile = makeProfile("cust-a");
    const bookingA = makeBooking("aaa", "REF-A", profile.id, 500);
    seedBookingWithHalfPaid(store, bookingA, profile, 250);

    const trip = store.trips[0];
    const criado = await ensureBalanceChargeForBooking(bookingA, trip, {
      responsibleEmail: profile.email,
    });
    expect(criado.ok).toBe(true);

    const payment = fake
      .getData()!
      .payments.find((p) => (p.metadata as { type?: string })?.type === "BALANCE")!;

    expect(isBookingFullyPaid(fake.getData()!, bookingA.id)).toBe(false);

    const { confirmPaymentWebhook } = await import("@/lib/payments/confirmation");
    await confirmPaymentWebhook(payment.gatewayPaymentId!);

    const after = fake.getData()!;
    const balanceAfter = after.payments.find((p) => p.id === payment.id)!;
    expect(balanceAfter.status).toBe("PAGO");
    expect(balanceAfter.paidAt).toBeTruthy();

    const install2 = after.installments.find(
      (i) => i.bookingId === bookingA.id && i.number === 2,
    )!;
    expect(install2.status).toBe("PAGO");
    expect(after.bookings.find((b) => b.id === bookingA.id)?.status).toBe("CONFIRMADA");
    expect(computeRemainingBalance(after, bookingA.id)).toBe(0);
    expect(isBookingFullyPaid(after, bookingA.id)).toBe(true);
    expect(install2.value).toBe(250);

    const novo = await ensureBalanceChargeForBooking(after.bookings[0], trip, {
      responsibleEmail: profile.email,
    });
    expect(novo.ok).toBe(true);
    expect(novo.alreadyPaid).toBe(true);
    expect(fake.createCalls).toHaveLength(1);
  });
});

describe("9. QR Code / copia-e-cola / link", () => {
  it("resultado contém copia-e-cola (que alimenta o QR no cliente) e link web", async () => {
    const store = fake.getData()!;
    const profile = makeProfile("cust-a");
    const bookingA = makeBooking("aaa", "REF-A", profile.id, 500);
    seedBookingWithHalfPaid(store, bookingA, profile, 250);
    const trip = store.trips[0];

    const resultado = await ensureBalanceChargeForBooking(bookingA, trip, {
      responsibleEmail: profile.email,
    });

    expect(resultado.ok).toBe(true);
    expect(typeof resultado.pixCopyPaste).toBe("string");
    expect((resultado.pixCopyPaste ?? "").length).toBeGreaterThan(20);
    expect(resultado.paymentUrl).toBeTruthy();
    expect(
      fake
        .getData()!
        .payments.find((p) => (p.metadata as { type?: string })?.type === "BALANCE")
        ?.pixCopyPaste,
    ).toBe(resultado.pixCopyPaste);
  });
});

describe("10. PaymentId determinístico", () => {
  it("é estável para a reserva e único entre reservas", () => {
    expect(balancePaymentIdFor("booking-x")).toBe(balancePaymentIdFor("booking-x"));
    expect(balancePaymentIdFor("booking-x")).not.toBe(balancePaymentIdFor("booking-y"));
    const re = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    expect(balancePaymentIdFor("booking-x")).toMatch(re);
  });
});

describe("11. Cenário que reproduz as reservas atuais, sem valores hardcoded", () => {
  it("vale para qualquer valor de saldo (ex.: 274,50 e 180,00)", async () => {
    const store = fake.getData()!;
    const profileA = makeProfile("cust-a");
    const bookingA = makeBooking("aaa", "REF-A", profileA.id, 549);
    seedBookingWithHalfPaid(store, bookingA, profileA, 274.5);

    const profileB = makeProfile("cust-b");
    const bookingB = makeBooking("bbb", "REF-B", profileB.id, 360);
    seedBookingWithHalfPaid(store, bookingB, profileB, 180);

    const trip = store.trips[0];
    const ra = await ensureBalanceChargeForBooking(bookingA, trip, {
      responsibleEmail: profileA.email,
    });
    const rb = await ensureBalanceChargeForBooking(bookingB, trip, {
      responsibleEmail: profileB.email,
    });

    expect(ra.ok).toBe(true);
    expect(rb.ok).toBe(true);
    expect(ra.amount).toBeCloseTo(274.5, 2);
    expect(rb.amount).toBeCloseTo(180, 2);
    expect(ra.pixCopyPaste).toBeTruthy();
    expect(rb.pixCopyPaste).toBeTruthy();
    expect(ra.paymentUrl).toBeTruthy();
    expect(rb.paymentUrl).toBeTruthy();
    expect(fake.createCalls.map((c) => c.value).sort()).toEqual([180, 274.5]);

    const after = fake.getData()!;
    expect(
      after.payments.filter((p) => (p.metadata as { type?: string })?.type === "BALANCE"),
    ).toHaveLength(2);
  });
});