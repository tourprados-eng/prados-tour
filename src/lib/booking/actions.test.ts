import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Booking, DataStore, Profile, Trip } from "@/types";

/**
 * Teste de integração do BACKEND: `createBookingAction` é a única porta de
 * entrada de reservas e precisa recusar qualquer passageiro incompleto ANTES de
 * criar reserva, Passenger, Payment ou chamar o gateway.
 *
 * Runtime, sessão e Asaas são simulados em memória (sem rede e sem banco), mas
 * a validação exercitada é exatamente a de produção (`@/lib/booking/passengers`).
 */

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
// `redirect` precisa interromper o fluxo como no Next.js; um no-op deixaria a
// execução seguir depois do ponto de retorno.
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    const error = new Error(`NEXT_REDIRECT:${path}`);
    error.name = "NEXT_REDIRECT";
    throw error;
  }),
}));

const fake = vi.hoisted(() => {
  const calls = {
    bookingsWrites: 0,
    passengerWrites: 0,
    paymentWrites: 0,
    asaas: [] as string[],
    pixClaims: [] as string[],
  };
  let data: DataStore = {} as DataStore;
  return {
    calls,
    setData: (d: DataStore) => { data = d; },
    getData: (): DataStore => data,
  };
});

vi.mock("@/lib/auth/session", () => ({
  getSession: async () => ({ id: "cliente-1", email: "cliente@teste.com", role: "CLIENTE" }),
  canAccess: () => true,
}));

vi.mock("@/lib/repositories/runtime", () => ({
  getRepositoryRuntime: () => ({
    read: async () => structuredClone(fake.getData()),
    transaction: async (fn: (store: DataStore) => void | Promise<void>) => {
      const draft = structuredClone(fake.getData());
      const result = await fn(draft);
      fake.setData(draft);
      return result;
    },
    findResumableBookingId: async () => null,
  }),
}));

vi.mock("@/lib/payments/asaas", () => ({
  createAsaasPixPayment: async () => {
    fake.calls.asaas.push("createAsaasPixPayment");
    return { ok: true, id: "asaas-1" } as never;
  },
  findAsaasPaymentByExternalReference: async () => null,
  getAsaasPixQrCode: async () => ({
    encodedImage: "data:image/png;base64,AAA",
    payload: "00020126580014br.gov.bcb.pixpt0001",
    expirationDate: "2026-12-31T23:59:59.000Z",
  }),
  getOrCreateAsaasCustomer: async () => ({ ok: true, id: "cus-1" } as never),
}));

vi.mock("@/lib/payments/claims", () => ({
  acquirePixClaim: async () => {
    fake.calls.pixClaims.push("acquire");
    return { won: true, claim: null } as never;
  },
  completePixClaim: async () => ({ ok: true } as never),
  getPixClaim: async () => null,
  releasePixClaim: async () => ({ ok: true } as never),
  takeoverExpiredClaim: async () => ({ ok: true } as never),
  updatePixClaim: async () => ({ ok: true } as never),
}));

/** Reserva mínima válida: 1 passageiro, PIX, tudo completo. */
function baselineStore(): DataStore {
  const customer: Profile = {
    id: "cliente-1",
    email: "cliente@teste.com",
    fullName: "Cliente Teste",
    role: "CLIENTE",
    createdAt: "2026-01-01T00:00:00.000Z",
  } as Profile;
  const trip: Trip = {
    id: "viagem-1",
    title: "Prados Tour",
    status: "PUBLICADA",
    totalSeats: 40,
    date: "2026-12-01",
    pricePerson: 100,
    priceCouple: 180,
    childPrice: 60,
    deletedAt: null,
  } as unknown as Trip;

  return {
    profiles: [customer],
    trips: [trip],
    boardingPoints: [
      {
        id: "ponto-1",
        name: "Rodoviária Central",
        city: "São Paulo",
        address: "Av. Central, 1000",
        latitude: null,
        longitude: null,
        observations: "",
        active: true,
      },
    ],
    tripBoardingPoints: [
      { id: "tbp-1", tripId: "viagem-1", boardingPointId: "ponto-1", time: "07:00", sortOrder: 1 },
    ],
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
    paymentSettings: {
      pixKey: "",
      pixTotalDiscount: 0,
      cardWhatsapp: false,
      defaultCommission: 0.1,
    } as never,
    promoBanner: {} as never,
    voucher: {} as never,
  } as unknown as DataStore;
}

const COMPLETE_PASSENGER = {
  name: "Maria Silva",
  cpf: "529.982.247-25",
  birthDate: "1990-05-10",
  phone: "(11) 98888-7777",
  rg: "12.345.678-9",
  dataDeclaration: true,
};

async function submit(overrides: Record<string, unknown> = {}): Promise<SubmitResult> {
  const { createBookingAction } = await import("@/lib/booking/actions");
  try {
  return await createBookingAction({
    tripId: "viagem-1",
    quantity: 1,
    boardingPointId: "ponto-1",
    paymentMethod: "PIX",
    paymentPlan: "TOTAL",
    passengers: [COMPLETE_PASSENGER],
    ...overrides,
  } as never);
  } catch (error) {
    if (error instanceof Error && error.name === "NEXT_REDIRECT") {
      return { redirected: error.message.replace("NEXT_REDIRECT:", "") };
    }
    throw error;
  }
}

type SubmitResult = { error?: string; bookingId?: string; reference?: string; redirected?: string };

/** No fluxo de sucesso o booking vem na query do redirect. */
function bookingIdFromRedirect(redirected: string | undefined): string | undefined {
  return redirected?.match(/[?&]booking=([^&]+)/)?.[1];
}

/** Nada foi criado: nem reserva, nem passageiro, nem pagamento, nem gateway. */
function expectNothingCreated() {
  const store = fake.getData()!;
  expect(store.bookings).toHaveLength(0);
  expect(store.passengers).toHaveLength(0);
  expect(store.payments).toHaveLength(0);
  expect(fake.calls.asaas).toHaveLength(0);
  expect(fake.calls.pixClaims).toHaveLength(0);
}

beforeEach(() => {
  fake.setData(baselineStore());
  fake.calls.asaas.length = 0;
  fake.calls.pixClaims.length = 0;
});

describe("createBookingAction recusa passageiro incompleto (cenário 8)", () => {
  const incompleteCases: Array<[string, Record<string, unknown>, string]> = [
    ["sem RG", { rg: "" }, "Passageiro 1: RG é obrigatório."],
    ["sem nome completo", { name: "Ronaldo" }, "Passageiro 1: Nome completo deve conter nome e sobrenome."],
    ["sem CPF", { cpf: "" }, "Passageiro 1: CPF é obrigatório."],
    ["CPF inválido", { cpf: "111.111.111-11" }, "Passageiro 1: CPF inválido."],
    ["sem telefone", { phone: "" }, "Passageiro 1: Telefone/WhatsApp é obrigatório."],
    ["telefone curto", { phone: "1234" }, "Passageiro 1: Telefone/WhatsApp deve ter DDD"],
    ["sem nascimento", { birthDate: "" }, "Passageiro 1: Data de nascimento é obrigatória."],
    ["nascimento futuro", { birthDate: "2099-01-01" }, "Passageiro 1: Data de nascimento não pode ser futura."],
    ["nascimento inexistente", { birthDate: "1990-02-31" }, "Passageiro 1: Data de nascimento inválida."],
    ["declaração não marcada", { dataDeclaration: false }, "é obrigatório marcar a declaração"],
  ];

  for (const [label, patch, expected] of incompleteCases) {
    it(`recusa ${label} sem criar reserva nem pagamento`, async () => {
      const result = await submit({ passengers: [{ ...COMPLETE_PASSENGER, ...patch }] });
      expect(result).toHaveProperty("error");
      expect((result as { error: string }).error).toContain(expected);
      expectNothingCreated();
    });
  }

  it("recusa payload direto pela API sem RG e sem declaração", async () => {
    // Cliente ignorando o formulário e chamando a action com JSON cru.
    const result = await submit({
      passengers: [
        {
          name: "Maria Silva",
          cpf: "529.982.247-25",
          birthDate: "1990-05-10",
          phone: "11988887777",
        },
      ],
    });
    const error = (result as { error: string }).error;
    expect(error).toContain("Passageiro 1: RG é obrigatório.");
    expect(error).toContain("é obrigatório marcar a declaração");
    expectNothingCreated();
  });

  it("recusa lista de passageiros vazia", async () => {
    const result = await submit({ passengers: [] });
    expect((result as { error: string }).error).toContain("ao menos um passageiro");
    expectNothingCreated();
  });

  it("recusa quantidade divergente da lista de passageiros", async () => {
    const result = await submit({ quantity: 2, passengers: [COMPLETE_PASSENGER] });
    expect((result as { error: string }).error).toContain(
      "a reserva exige 2 passageiro(s) e recebeu 1",
    );
    expectNothingCreated();
  });

  it("recusa quando só o segundo passageiro está incompleto", async () => {
    const result = await submit({
      quantity: 2,
      passengers: [
        COMPLETE_PASSENGER,
        { ...COMPLETE_PASSENGER, name: "João", rg: "" },
      ],
    });
    const error = (result as { error: string }).error;
    expect(error).toContain("Passageiro 2: Nome completo deve conter nome e sobrenome.");
    expect(error).toContain("Passageiro 2: RG é obrigatório.");
    expectNothingCreated();
  });

  it("bloqueia pagamento em cartão também (não só PIX)", async () => {
    const result = await submit({
      paymentMethod: "CARTAO",
      passengers: [{ ...COMPLETE_PASSENGER, dataDeclaration: false }],
    });
    expect((result as { error: string }).error).toContain("declaração");
    expectNothingCreated();
  });
});

describe("createBookingAction aceita passageiro completo", () => {
  it("cria a reserva e gera o pagamento quando todos os dados são válidos", async () => {
    const result = await submit();
    // No sucesso a action redireciona (como em produção) para /checkout/sucesso.
    const bookingId = result.bookingId ?? bookingIdFromRedirect(result.redirected);
    expect(result.error).toBeUndefined();
    expect(bookingId).toBeTruthy();

    const store = fake.getData()!;
    expect(store.bookings).toHaveLength(1);
    expect(store.bookings[0].status).toBe("PENDENTE");
    expect(store.payments).toHaveLength(1);
    // O gateway só é acionado DEPOIS da reserva válida.
    expect(fake.calls.asaas).toContain("createAsaasPixPayment");
  });

  it("persiste o RG, a declaração e grava CPF/telefone só com dígitos", async () => {
    const result = await submit();
    const bookingId = result.bookingId ?? bookingIdFromRedirect(result.redirected);
    const store = fake.getData()!;
    const booking = store.bookings.find((b: Booking) => b.id === bookingId)!;
    expect(booking).toBeTruthy();

    const passenger = store.passengers.find((p) => p.bookingId === booking.id)!;
    expect(passenger).toBeTruthy();
    expect(passenger.rg).toBe("12.345.678-9");
    expect(passenger.dataDeclarationAt).toBeTruthy();
    expect(passenger.cpf).toBe("52998224725");
    expect(passenger.phone).toBe("11988887777");
  });

  it("grava a reserva de 2 passageiros e vincula os dois", async () => {
    const result = await submit({
      quantity: 2,
      passengers: [
        COMPLETE_PASSENGER,
        { ...COMPLETE_PASSENGER, name: "João Souza", cpf: "390.533.447-05" },
      ],
    });
    const bookingId = result.bookingId ?? bookingIdFromRedirect(result.redirected);
    expect(result.error).toBeUndefined();

    const store = fake.getData()!;
    const booking = store.bookings.find((b: Booking) => b.id === bookingId)!;
    expect(booking).toBeTruthy();
    expect(booking.quantity).toBe(2);
    const passengers = store.passengers.filter((p) => p.bookingId === booking.id);
    expect(passengers).toHaveLength(2);
    expect(passengers.every((p) => p.rg && p.dataDeclarationAt)).toBe(true);
  });
});
