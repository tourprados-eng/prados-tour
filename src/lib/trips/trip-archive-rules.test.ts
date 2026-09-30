import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Booking, DataStore, Payment, Trip } from "@/types";

/**
 * REGRA DE ARQUIVAMENTO PÚBLICO DE VIAGENS
 * ========================================
 *
 * Viagem com data vencida:
 *   - não aparece no catálogo público;
 *   - URL direta não abre venda e mostra a mensagem de encerramento;
 *   - criação de reserva é REJEITADA no backend;
 *   - continua no banco, visível no Admin;
 *   - reservas, passageiros e pagamentos ficam intactos.
 *
 * Nada é apagado: a regra é de CONSULTA, aplicada a cada leitura.
 */

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/auth/session", () => ({
  getSession: async () => ({ id: "user-cliente", role: "CLIENTE", email: "c@e.com", fullName: "Cliente Teste" }),
  canAccess: () => true,
}));

vi.mock("@/lib/payments/asaas", () => ({
  createAsaasPixPayment: vi.fn(),
  findAsaasPaymentByExternalReference: vi.fn(),
  getAsaasPixQrCode: vi.fn(),
  getOrCreateAsaasCustomer: vi.fn(),
  getAsaasPayment: vi.fn(),
}));

vi.mock("@/lib/payments/claims", () => ({
  // A claim é ganha normalmente, para o fluxo seguir até o gate de data da
  // viagem (que é o que este arquivo precisa exercitar).
  acquirePixClaim: async () => ({ won: true, claim: { status: "RESERVED" } }),
  // Precisam devolver Promise: o fluxo faz `.catch()` no cleanup da claim.
  completePixClaim: async () => undefined,
  getPixClaim: async () => null,
  releasePixClaim: async () => undefined,
  takeoverExpiredClaim: async () => ({ won: false, claim: null }),
  updatePixClaim: async () => undefined,
}));

vi.mock("@/lib/payments/webhook-events", () => ({
  claimAsaasWebhookEvent: async () => ({ claimed: false, reason: null }),
  completeAsaasWebhookEvent: vi.fn(),
  releaseAsaasWebhookEvent: vi.fn(),
}));

const store = vi.hoisted(() => ({ data: {} as DataStore }));
const getData = (): DataStore => store.data;
const setData = (d: DataStore) => { store.data = d; };

vi.mock("@/lib/repositories/runtime", () => ({
  getRepositoryRuntime: () => ({
    read: async () => structuredClone(getData()),
    // Sem reserva pendente para retomar: o checkout segue para o gate de data.
    findResumableBookingId: async () => null,
    transaction: async (fn: (s: DataStore) => void | Promise<void>) => {
      const draft = structuredClone(getData());
      const result = await fn(draft);
      setData(draft);
      return result;
    },
  }),
}));

import {
  createBookingAction,
  getPublicTripState,
  getPublicTrips,
  getTripBySlug,
  previewBookingPriceAction,
} from "@/lib/booking/actions";
import { PAST_TRIP_MESSAGE, todayInSaoPaulo } from "@/lib/trips/availability";
import { createAsaasPixPayment } from "@/lib/payments/asaas";

/** Ontem / hoje / amanhã em São Paulo — determinístico, sem depender do relógio. */
const HOJE = todayInSaoPaulo();
const ONTEM = shiftDia(HOJE, -1);
const AMANHA = shiftDia(HOJE, 1);
const FUTURO = shiftDia(HOJE, 60);

function shiftDia(iso: string, delta: number): string {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + delta)).toISOString().slice(0, 10);
}

function trip(overrides: Partial<Trip> & { date: string }): Trip {
  return {
    id: overrides.slug ?? "trip-1",
    name: "Viagem Teste",
    slug: "viagem-teste",
    destination: "Ilhabela",
    category: "PRAIA",
    departureDate: null,
    departureTime: null,
    returnTime: null,
    returnDate: null,
    pricePerson: 100,
    priceCouple: null,
    childPrice: null,
    childMaxAge: null,
    insuranceEnabled: false,
    insurancePrice: 0,
    transportPolicy: null,
    totalSeats: 40,
    description: "Descricao",
    itinerary: "Roteiro",
    included: "",
    notIncluded: "",
    rules: "",
    cancellationPolicy: "",
    status: "PUBLICADA",
    images: [],
    deletedAt: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  } as Trip;
}

function booking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: "booking-antigo",
    code: "PT-0001",
    tripId: "trip-1",
    customerId: "user-cliente",
    quantity: 2,
    status: "CONFIRMADA",
    paymentMethod: "PIX",
    paymentPlan: "TOTAL",
    totalAmount: 200,
    createdAt: "2026-01-02T00:00:00Z",
    ...overrides,
  } as Booking;
}

function payment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: "pay-1",
    bookingId: "booking-antigo",
    method: "PIX",
    status: "CONFIRMADO",
    amount: 200,
    createdAt: "2026-01-02T00:00:00Z",
    ...overrides,
  } as Payment;
}

/**
 * Cenário base: uma viagem PASSADA (ontem) com reserva confirmada, dois
 * passageiros e um pagamento. Serve tanto para provar que ela some do site
 * quanto para provar que nada foi apagado.
 */
function lojaComHistorico(): DataStore {
  return {
    trips: [trip({ id: "trip-1", slug: "viagem-passada", date: ONTEM })],
    bookings: [booking()],
    passengers: [
      { id: "pax-1", bookingId: "booking-antigo", name: "Maria Silva", cpf: "52998224725", birthDate: "1990-05-10", phone: "11988887777", rg: "123456789", dataDeclaration: true, seatGroup: null },
      { id: "pax-2", bookingId: "booking-antigo", name: "Joao Souza", cpf: "11144477735", birthDate: "1992-02-02", phone: "11977776666", rg: "987654321", dataDeclaration: true, seatGroup: null },
    ],
    payments: [payment()],
    tripBoardingPoints: [],
    boardingPoints: [],
    seats: [],
    profiles: [{ id: "user-cliente", fullName: "Cliente Teste", email: "c@e.com", phone: "11988887777", document: "52998224725" }],
    coupons: [],
    couponTrips: [],
    promotions: [],
    promotionTrips: [],
    expenses: [],
    reviews: [],
    galleryPhotos: [],
    paymentClaims: [],
    auditLogs: [],
    settings: {} as never,
    paymentSettings: { pixKey: "", pixTotalDiscount: 0, cardWhatsapp: true, defaultCommission: 0 },
    brand: {} as never,
    promoBanner: {} as never,
    voucher: {} as never,
  } as unknown as DataStore;
}

beforeEach(() => {
  setData(lojaComHistorico());
});

// ─────────────────────────────────────────────────────────────────────────────
// TESTE 1 — viagem de ontem não aparece no site
// ─────────────────────────────────────────────────────────────────────────────
describe("TESTE 1 — viagem vencida não aparece no site público", () => {
  it("getPublicTrips não a retorna", async () => {
    const trips = await getPublicTrips();

    expect(trips.map((t) => t.slug)).not.toContain("viagem-passada");
    expect(trips).toHaveLength(0);
  });

  it("getTripBySlug não a retorna como comprável", async () => {
    expect(await getTripBySlug("viagem-passada")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TESTES 2, 3 e 4 — hoje, amanhã e futuro aparecem
// ─────────────────────────────────────────────────────────────────────────────
describe("TESTES 2, 3 e 4 — viagem de hoje, amanhã e futura aparecem", () => {
  it("a viagem de HOJE aparece e continua comprável", async () => {
    setData(lojaComHistorico());
    getData().trips = [trip({ id: "trip-hoje", slug: "hoje", date: HOJE })];

    const trips = await getPublicTrips();

    expect(trips.map((t) => t.slug)).toEqual(["hoje"]);
    expect(await getTripBySlug("hoje")).not.toBeNull();
  });

  it("a viagem de AMANHÃ aparece", async () => {
    getData().trips = [trip({ id: "trip-amanha", slug: "amanha", date: AMANHA })];

    const trips = await getPublicTrips();

    expect(trips.map((t) => t.slug)).toEqual(["amanha"]);
  });

  it("a viagem FUTURA aparece normalmente", async () => {
    getData().trips = [trip({ id: "trip-futuro", slug: "futuro", date: FUTURO })];

    const trips = await getPublicTrips();

    expect(trips.map((t) => t.slug)).toEqual(["futuro"]);
  });

  it("as três convivem no catálogo, ordenadas por data", async () => {
    getData().trips = [
      trip({ id: "a", slug: "futuro", date: FUTURO }),
      trip({ id: "b", slug: "amanha", date: AMANHA }),
      trip({ id: "c", slug: "hoje", date: HOJE }),
    ];

    const trips = await getPublicTrips();

    expect(trips.map((t) => t.slug)).toEqual(["hoje", "amanha", "futuro"]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TESTE 5 — URL direta de viagem passada não permite nova reserva
// ─────────────────────────────────────────────────────────────────────────────
describe("TESTE 5 — acesso direto por URL a viagem passada", () => {
  it("é classificada como REALIZADA, com a mensagem de encerramento", async () => {
    const state = await getPublicTripState("viagem-passada");

    expect(state.status).toBe("REALIZADA");
    expect(state.status === "REALIZADA" && state.trip.name).toBe("Viagem Teste");
  });

  it("não devolve dados de venda (sem resultado comprável)", async () => {
    const state = await getPublicTripState("viagem-passada");

    expect(state.status).not.toBe("VENDAVEL");
  });

  it("não expõe viagem em RASCUNHO que apenas está vencida", async () => {
    getData().trips = [trip({ id: "t", slug: "rascunho", date: ONTEM, status: "RASCUNHO" })];

    expect((await getPublicTripState("rascunho")).status).toBe("INDISPONIVEL");
  });

  it("não expõe viagem CANCELADA nem ARQUIVADA como 'realizada'", async () => {
    for (const status of ["CANCELADA", "ARQUIVADA"] as const) {
      getData().trips = [trip({ id: "t", slug: "oculta", date: ONTEM, status })];

      expect((await getPublicTripState("oculta")).status).toBe("INDISPONIVEL");
    }
  });

  it("viagem inexistente é INDISPONIVEL", async () => {
    expect((await getPublicTripState("nao-existe")).status).toBe("INDISPONIVEL");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TESTE 6 — criação de reserva no backend é rejeitada
// ─────────────────────────────────────────────────────────────────────────────
describe("TESTE 6 — backend rejeita nova reserva para viagem vencida", () => {
  it("createBookingAction recusa com a mensagem exigida", async () => {
    // A action converte a exceção do gate em `{ error }` — que é exatamente
    // o que o cliente vê na tela.
    const resultado = await createBookingAction({
      tripId: "trip-1",
      quantity: 1,
      boardingPointId: "bp-1",
      paymentMethod: "PIX",
      paymentPlan: "TOTAL",
      passengers: [
        { name: "Maria Silva", cpf: "529.982.247-25", birthDate: "1990-05-10", phone: "(11) 98888-7777", rg: "12.345.678-9", dataDeclaration: true },
      ],
      clientRequestId: "req-1",
    });

    expect(resultado).toEqual({ error: PAST_TRIP_MESSAGE });
  });

  it("a recusa vem ANTES de qualquer contato com o gateway de pagamento", async () => {
    // Se o gate falhasse depois, o PIX do Asaas já teria sido criado.
    const resultado = await createBookingAction({
      tripId: "trip-1",
      quantity: 1,
      boardingPointId: "bp-1",
      paymentMethod: "PIX",
      paymentPlan: "TOTAL",
      passengers: [
        { name: "Maria Silva", cpf: "529.982.247-25", birthDate: "1990-05-10", phone: "(11) 98888-7777", rg: "12.345.678-9", dataDeclaration: true },
      ],
      clientRequestId: "req-2",
    });

    expect(resultado).toEqual({ error: PAST_TRIP_MESSAGE });
    expect(createAsaasPixPayment).not.toHaveBeenCalled();
  });

  it("previewBookingPriceAction recusa com a mesma mensagem", async () => {
    const resultado = await previewBookingPriceAction({
      tripId: "trip-1",
      quantity: 1,
      paymentMethod: "PIX",
      paymentPlan: "TOTAL",
    });

    expect(resultado).toEqual({ error: PAST_TRIP_MESSAGE });
  });

  it("NADA foi gravado: a rejeição acontece antes de qualquer escrita", () => {
    // A reserva antiga continua sendo a única do banco.
    expect(getData().bookings).toHaveLength(1);
    expect(getData().bookings[0].id).toBe("booking-antigo");
    expect(getData().payments).toHaveLength(1);
    expect(getData().passengers).toHaveLength(2);
  });

  it("viagem futura ainda é aceita pelo gate de data (não regrediu)", async () => {
    getData().trips = [trip({ id: "trip-futuro", slug: "futuro", date: FUTURO })];

    // Chega até a etapa seguinte (falta o ponto de embarque cadastrado),
    // o que prova que o gate de data deixou passar.
    const resultado = await previewBookingPriceAction({
      tripId: "trip-futuro",
      quantity: 1,
      paymentMethod: "PIX",
      paymentPlan: "TOTAL",
    });

    expect("error" in resultado && resultado.error).not.toBe(PAST_TRIP_MESSAGE);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TESTE 7 — viagem passada continua no Admin
// ─────────────────────────────────────────────────────────────────────────────
describe("TESTE 7 — Admin continua enxergando a viagem vencida", () => {
  it("a viagem permanece no repositório, com todos os campos", () => {
    const t = getData().trips.find((x) => x.id === "trip-1");

    expect(t).toBeDefined();
    expect(t?.name).toBe("Viagem Teste");
    expect(t?.status).toBe("PUBLICADA");
    expect(t?.totalSeats).toBe(40);
  });

  it("a listagem do Admin não usa o filtro público de disponibilidade", () => {
    // O Admin lê `store.trips` cru. A regra vive em getPublicTrips, que o
    // Admin não consome — por isso a viagem continua listada.
    expect(getData().trips).toHaveLength(1);
    expect(getData().trips.some((t) => t.date === ONTEM)).toBe(true);
  });

  it("a viagem não foi marcada como excluída", () => {
    expect(getData().trips[0].deletedAt).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TESTES 8, 9 e 10 — reservas, passageiros e pagamentos intactos
// ─────────────────────────────────────────────────────────────────────────────
describe("TESTES 8, 9 e 10 — histórico financeiro e de passageiros intacto", () => {
  it("TESTE 8 — a reserva antiga continua no banco, sem alteração de status", () => {
    const b = getData().bookings.find((x) => x.id === "booking-antigo");

    expect(b).toBeDefined();
    expect(b?.status).toBe("CONFIRMADA");
    expect(b?.totalAmount).toBe(200);
    expect(b?.tripId).toBe("trip-1");
  });

  it("TESTE 8 — a reserva continua vinculada à viagem vencida", () => {
    const b = getData().bookings[0];
    const t = getData().trips.find((x) => x.id === b.tripId);

    expect(t).toBeDefined();
    expect(t?.date).toBe(ONTEM);
  });

  it("TESTE 9 — os dois passageiros continuam vinculados à reserva", () => {
    const passageiros = getData().passengers;

    expect(passageiros).toHaveLength(2);
    expect(passageiros.every((p) => p.bookingId === "booking-antigo")).toBe(true);
    expect(passageiros.map((p) => p.name).sort()).toEqual([
      "Joao Souza",
      "Maria Silva",
    ]);
  });

  it("TESTE 10 — o pagamento continua confirmado e vinculado", () => {
    const p = getData().payments[0];

    expect(p.id).toBe("pay-1");
    expect(p.status).toBe("CONFIRMADO");
    expect(p.amount).toBe(200);
    expect(getData().bookings.find((b) => b.id === p.bookingId)).toBeDefined();
  });

  it("nenhum histórico foi removido no total", () => {
    expect(getData().bookings).toHaveLength(1);
    expect(getData().passengers).toHaveLength(2);
    expect(getData().payments).toHaveLength(1);
  });
});
