import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Booking, BookingPassenger, DataStore, Payment } from "@/types";

/**
 * O segundo portão: mesmo que um pagamento chegue ao gateway, ele NÃO pode
 * confirmar uma reserva cujo passageiro está incompleto. Aqui a reserva já
 * existe no banco (dados foram "corrigidos" por fora do fluxo do checkout),
 * então a barreira precisa existir também na confirmação.
 */

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/payments/asaas", () => ({
  getAsaasPayment: async (id: string) => ({
    id,
    status: "RECEIVED",
    value: 100,
    externalReference: "PRADOS-TOUR:pay-1",
  }),
}));

const claims = vi.hoisted(() => ({
  claim: { claimed: true, reason: null as string | null },
  released: [] as string[],
  completed: [] as string[],
  failWrites: null as string | null,
}));

vi.mock("@/lib/payments/webhook-events", () => ({
  claimAsaasWebhookEvent: async () => claims.claim as never,
  completeAsaasWebhookEvent: async (eventId: string) => {
    claims.completed.push(eventId);
    return { ok: true } as never;
  },
  releaseAsaasWebhookEvent: async (eventId: string) => {
    claims.released.push(eventId);
    return { ok: true } as never;
  },
}));

const store = vi.hoisted(() => ({ data: {} as DataStore }));
const setData = (d: DataStore) => { store.data = d; };
const getData = (): DataStore => store.data;

vi.mock("@/lib/repositories/runtime", () => ({
  getRepositoryRuntime: () => ({
    read: async () => structuredClone(getData()),
    transaction: async (fn: (s: DataStore) => void | Promise<void>) => {
      if (claims.failWrites) {
        throw new Error(claims.failWrites);
      }
      const draft = structuredClone(getData());
      const result = await fn(draft);
      setData(draft);
      return result;
    },
  }),
}));

/** Reserva PENDENTE de `quantity` passageiros, aplicando `patch` no passageiro 1. */
function buildStore(quantity = 1, patch: Partial<BookingPassenger> = {}): DataStore {
  const NOMES = [
    "Maria Silva",
    "Joao Souza",
    "Ana Nogueira",
    "Pedro Alves",
    "Carla Dias",
    "Bruno Teixeira",
    "Larissa Prado",
    "Diego Ramos",
    "Helena Castro",
    "Miguel Santos",
  ];
  const passengers: BookingPassenger[] = Array.from({ length: quantity }, (_, i) => ({
    id: `pax-${i + 1}`,
    bookingId: "booking-1",
    name: NOMES[i % NOMES.length],
    cpf: "52998224725",
    phone: "11988887777",
    rg: "12.345.678-9",
    birthDate: "1990-05-10",
    dataDeclarationAt: "2026-01-01T12:00:00.000Z",
    price: 100,
    priceCategory: "ADULTO",
    insurance: false,
    seatAssignmentStatus: null,
    seatId: null,
    boardingPointId: null,
    seatGroup: null,
    ...(i === 0 ? patch : {}),
  })) as BookingPassenger[];

  const booking = {
    id: "booking-1",
    reference: "PT000001",
    customerId: "cliente-1",
    tripId: "viagem-1",
    quantity,
    status: "PENDENTE",
    totalAmount: 100 * quantity,
    paidAmount: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
  } as unknown as Booking;

  const payment = {
    id: "pay-1",
    bookingId: "booking-1",
    gatewayPaymentId: "gw-1",
    gateway: "asaas",
    status: "PENDENTE",
    amount: 100 * quantity,
    method: "PIX",
    createdAt: "2026-01-01T00:00:00.000Z",
  } as unknown as Payment;

  return {
    profiles: [],
    trips: [],
    boardingPoints: [],
    tripBoardingPoints: [],
    seats: [],
    sellers: [],
    bookings: [booking],
    passengers,
    payments: [payment],
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
  } as unknown as DataStore;
}

async function confirm() {
  const { confirmPaymentWebhook } = await import("@/lib/payments/confirmation");
  return confirmPaymentWebhook("gw-1");
}

beforeEach(() => {
  setData(buildStore());
  claims.claim = { claimed: true, reason: null };
  claims.released = [];
  claims.completed = [];
  claims.failWrites = null;
});

const RECEIVED_EVENT = {
  id: "evt-1",
  event: "PAYMENT_RECEIVED",
  payment: {
    id: "gw-1",
    status: "RECEIVED",
    value: 100,
    externalReference: "PRADOS-TOUR:pay-1",
  },
};

async function processEvent(overrides: Partial<typeof RECEIVED_EVENT> = {}) {
  const { processAsaasPaymentEvent } = await import("@/lib/payments/confirmation");
  return processAsaasPaymentEvent({ ...RECEIVED_EVENT, ...overrides } as never);
}

describe("confirmPaymentWebhook só confirma com passageiro completo", () => {
  it("confirma quando o RG e a declaração estão preenchidos", async () => {
    await expect(confirm()).resolves.toBeUndefined();
    const data = getData();
    expect(data.bookings[0].status).toBe("CONFIRMADA");
    expect(data.payments[0].status).toBe("PAGO");
  });

  it("recusa confirmar quando falta o RG", async () => {
    setData(buildStore(1, { rg: null }));
    await expect(confirm()).rejects.toThrow(/RG é obrigatório/);
    expect(getData().bookings[0].status).toBe("PENDENTE");
    expect(getData().payments[0].status).not.toBe("PAGO");
  });

  it("recusa confirmar quando falta a declaração de veracidade", async () => {
    setData(buildStore(1, { dataDeclarationAt: null }));
    await expect(confirm()).rejects.toThrow(/declaração/);
    expect(getData().bookings[0].status).toBe("PENDENTE");
  });

  it("recusa quando o passageiro 2 de 2 está incompleto", async () => {
    setData(buildStore(2, {}));
    // Torna o passageiro 2 incompleto mantendo o 1 completo.
    const data = getData();
    (data.passengers[1] as BookingPassenger).rg = null;
    setData(data);

    await expect(confirm()).rejects.toThrow(/Passageiro 2: RG é obrigatório/);
    expect(getData().bookings[0].status).toBe("PENDENTE");
  });

  it("recusa reserva sem nenhum passageiro (zero passageiro)", async () => {
    const data = getData();
    data.passengers = [];
    setData(data);
    await expect(confirm()).rejects.toThrow(/ao menos um passageiro|Passageiro 1/);
    expect(getData().bookings[0].status).toBe("PENDENTE");
  });

  it("recusa quando a quantidade da reserva não bate com os passageiros", async () => {
    const data = getData();
    (data.bookings[0] as Booking).quantity = 3;
    setData(data);
    await expect(confirm()).rejects.toThrow(/Passageiro 1: a reserva exige 3/);
    expect(getData().bookings[0].status).toBe("PENDENTE");
  });

  it("recusa reserva legada já CONFIRMADA com passageiro incompleto (sem isenção)", async () => {
    const data = getData();
    (data.bookings[0] as Booking).status = "CONFIRMADA";
    // Legada: confirmada antes de o RG e a declaração passarem a ser exigidos.
    (data.passengers[0] as BookingPassenger).rg = null;
    (data.passengers[0] as BookingPassenger).dataDeclarationAt = null;
    setData(data);

    await expect(confirm()).rejects.toThrow(/RG é obrigatório/);
    expect(getData().payments[0].status).toBe("PENDENTE");
    expect(getData().payments[0].paidAt).toBeFalsy();
  });

  it("aceita reserva legada CONFIRMADA quando os passageiros foram corrigidos", async () => {
    const data = getData();
    (data.bookings[0] as Booking).status = "CONFIRMADA";
    setData(data);

    await expect(confirm()).resolves.toBeUndefined();
    expect(getData().payments[0].status).toBe("PAGO");
    expect(getData().bookings[0].status).toBe("CONFIRMADA");
  });
});

describe("processAsaasPaymentEvent: claim atômico e retry", () => {
  it("confirma e consome o evento", async () => {
    await expect(processEvent()).resolves.toEqual({ status: "confirmed" });
    expect(getData().bookings[0].status).toBe("CONFIRMADA");
    expect(claims.completed).toEqual(["evt-1"]);
    expect(claims.released).toEqual([]);
  });

  it("é no-op quando o mesmo event.id já foi processado", async () => {
    claims.claim = { claimed: false, reason: "processed" };

    await expect(processEvent()).resolves.toEqual({ status: "duplicate" });
    expect(getData().bookings[0].status).toBe("PENDENTE");
    expect(claims.completed).toEqual([]);
  });

  it("libera o evento para retry quando a gravação falha no meio da confirmação", async () => {
    claims.failWrites = "Falha ao gravar bookings: BOOKING_PASSENGERS_INCOMPLETE";

    await expect(processEvent()).rejects.toThrow(/Falha ao gravar bookings/);
    // Liberar (e não completar) é o que permite o Asaas reentregar o MESMO id.
    expect(claims.completed).toEqual([]);
    expect(claims.released).toEqual(["evt-1"]);
  });

  it("marca a etapa que falhou para o log estruturado da rota", async () => {
    const { getAsaasWebhookStage } = await import("@/lib/payments/confirmation");
    claims.failWrites = "Falha ao gravar bookings";

    const error = await processEvent().catch((e: unknown) => e);

    expect(getAsaasWebhookStage(error)).toBe("confirm_payment");
  });

  it("libera o evento exatamente uma vez por falha", async () => {
    claims.failWrites = "Falha ao gravar bookings";

    await expect(processEvent()).rejects.toThrow();
    await expect(processEvent()).rejects.toThrow();

    expect(claims.released).toEqual(["evt-1", "evt-1"]);
  });

  it("consome o evento quando a reserva tem passageiro incompleto", async () => {
    setData(buildStore(1, { rg: null }));

    await expect(processEvent()).resolves.toEqual({
      status: "ignored",
      reason: "passenger_data_incomplete",
    });
    expect(getData().bookings[0].status).toBe("PENDENTE");
    expect(claims.completed).toEqual(["evt-1"]);
  });

  it("libera o evento quando o status do payload ainda não é recebido", async () => {
    await expect(
      processEvent({ payment: { ...RECEIVED_EVENT.payment, status: "PENDING" } }),
    ).rejects.toThrow(/ainda não recebido/);
    expect(claims.completed).toEqual([]);
    expect(claims.released).toEqual(["evt-1"]);
  });
});
