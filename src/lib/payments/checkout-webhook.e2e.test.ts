import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DataStore, Profile, Trip } from "@/types";

/**
 * Fluxo integrado CHECKOUT -> ASAAS -> WEBHOOK.
 *
 * Trava a arquitetura exigida: a reserva nasce PENDENTE com todos os
 * passageiros completos ANTES de existir cobrança, o webhook apenas
 * CONFIRMA a reserva já existente (nunca cria reserva nem passageiro) e a
 * reentrega do mesmo evento é idempotente.
 */

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    const error = new Error(`NEXT_REDIRECT:${path}`);
    error.name = "NEXT_REDIRECT";
    throw error;
  }),
}));

const fake = vi.hoisted(() => {
  let data: DataStore = {} as DataStore;
  const asaasRemote = new Map<string, { status: string; value: number; externalReference: string | null }>();
  const events = new Map<string, { status: string }>();
  return {
    asaasRemote,
    events,
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
  createAsaasPixPayment: async (externalReference: string) => {
    const chargeId = "pay_e2e_1";
    fake.asaasRemote.set(chargeId, {
      status: "PENDING",
      value: 100,
      externalReference,
    });
    return { ok: true, id: chargeId } as never;
  },
  getAsaasPayment: async (id: string) => fake.asaasRemote.get(id) as never,
  findAsaasPaymentByExternalReference: async () => null,
  getAsaasPixQrCode: async () => ({
    encodedImage: "data:image/png;base64,AAA",
    payload: "00020126580014br.gov.bcb.pixpt0001",
    expirationDate: "2026-12-31T23:59:59.000Z",
  }),
  getOrCreateAsaasCustomer: async () => ({ ok: true, id: "cus-1" } as never),
}));

vi.mock("@/lib/payments/claims", () => ({
  acquirePixClaim: async () => ({ won: true, claim: null } as never),
  completePixClaim: async () => ({ ok: true } as never),
  getPixClaim: async () => null,
  releasePixClaim: async () => ({ ok: true } as never),
  takeoverExpiredClaim: async () => ({ ok: true } as never),
  updatePixClaim: async () => ({ ok: true } as never),
}));

/** Idempotência real por event_id, com os mesmos estados do banco. */
vi.mock("@/lib/payments/webhook-events", () => ({
  claimAsaasWebhookEvent: async ({ eventId }: { eventId: string }) => {
    const existing = fake.events.get(eventId);
    if (!existing) {
      fake.events.set(eventId, { status: "PROCESSING" });
      return { claimed: true } as never;
    }
    if (existing.status === "PROCESSED") {
      return { claimed: false, reason: "processed" } as never;
    }
    return { claimed: false, reason: "processing" } as never;
  },
  completeAsaasWebhookEvent: async (eventId: string) => {
    fake.events.set(eventId, { status: "PROCESSED" });
    return { ok: true } as never;
  },
  releaseAsaasWebhookEvent: async (eventId: string) => {
    fake.events.delete(eventId);
    return { ok: true } as never;
  },
}));

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

const PASSAGEIRO = {
  name: "Maria Silva",
  cpf: "529.982.247-25",
  birthDate: "1990-05-10",
  phone: "(11) 98888-7777",
  rg: "12.345.678-9",
  dataDeclaration: true,
};

/** Checkout real: cria reserva PENDENTE + passageiros + cobrança no Asaas. */
async function checkout() {
  const { createBookingAction } = await import("@/lib/booking/actions");
  try {
    return await createBookingAction({
      tripId: "viagem-1",
      quantity: 1,
      boardingPointId: "ponto-1",
      paymentMethod: "PIX",
      paymentPlan: "TOTAL",
      passengers: [PASSAGEIRO],
    } as never);
  } catch (error) {
    if (error instanceof Error && error.name === "NEXT_REDIRECT") return { redirected: error.message };
    throw error;
  }
}

const CHARGE_ID = "pay_e2e_1";

/** O Asaas informa que o PIX foi compensado. */
function asaasConfirma() {
  fake.asaasRemote.set(CHARGE_ID, {
    status: "RECEIVED",
    value: 100,
    externalReference: fake.getData().payments[0].asaasExternalReference ?? null,
  });
}

async function entregarEvento(eventId: string) {
  const { processAsaasPaymentEvent } = await import("@/lib/payments/confirmation");
  const payment = fake.getData().payments[0];
  return processAsaasPaymentEvent({
    id: eventId,
    event: "PAYMENT_RECEIVED",
    payment: {
      id: CHARGE_ID,
      status: "RECEIVED",
      value: 100,
      externalReference: payment.asaasExternalReference,
    },
  } as never);
}

beforeEach(() => {
  fake.setData(baselineStore());
  fake.asaasRemote.clear();
  fake.events.clear();
});

describe("cenário 1: passageiro completo -> PENDENTE -> cobrança -> webhook -> CONFIRMADA", () => {
  it("cria a reserva PENDENTE com passageiros antes da cobrança e confirma no webhook", async () => {
    await checkout();

    const aposCheckout = fake.getData();
    expect(aposCheckout.bookings).toHaveLength(1);
    expect(aposCheckout.bookings[0].status).toBe("PENDENTE");
    expect(aposCheckout.passengers).toHaveLength(1);
    expect(aposCheckout.payments).toHaveLength(1);
    expect(aposCheckout.payments[0].gatewayPaymentId).toBe(CHARGE_ID);
    expect(aposCheckout.payments[0].status).toBe("PENDENTE");
    // A cobrança só existe porque a reserva e os passageiros já estão no banco.
    expect(fake.asaasRemote.has(CHARGE_ID)).toBe(true);

    asaasConfirma();
    await expect(entregarEvento("evt_1")).resolves.toEqual({ status: "confirmed" });

    const pos = fake.getData();
    expect(pos.bookings[0].status).toBe("CONFIRMADA");
    expect(pos.payments[0].status).toBe("PAGO");
    expect(pos.bookings[0].updatedAt).not.toBe(pos.bookings[0].createdAt);
    // O webhook não recriou nada.
    expect(pos.bookings).toHaveLength(1);
    expect(pos.passengers).toHaveLength(1);
  });
});

describe("cenário 4 e 7: idempotência da reentrega", () => {
  it("não duplica nada quando o mesmo evento é entregue duas vezes", async () => {
    await checkout();
    asaasConfirma();

    await entregarEvento("evt_1");
    const depoisDoPrimeiro = fake.getData();

    await expect(entregarEvento("evt_1")).resolves.toEqual({ status: "duplicate" });

    const pos = fake.getData();
    expect(pos.bookings).toHaveLength(1);
    expect(pos.passengers).toHaveLength(1);
    expect(pos.payments).toHaveLength(1);
    expect(pos.loyaltyPoints).toHaveLength(depoisDoPrimeiro.loyaltyPoints.length);
    expect(pos.notifications).toHaveLength(depoisDoPrimeiro.notifications.length);
    expect(pos.auditLogs).toHaveLength(depoisDoPrimeiro.auditLogs.length);
    expect(pos.payments[0].paidAt).toBe(depoisDoPrimeiro.payments[0].paidAt);
  });

  it("responde de forma idempotente quando a reserva já está confirmada", async () => {
    await checkout();
    asaasConfirma();
    await entregarEvento("evt_1");
    const antes = fake.getData();

    // O Asaas reentrega com um NOVO event_id (o sufixo &timestamp é dele).
    await expect(entregarEvento("evt_1&1538161430")).resolves.toEqual({ status: "confirmed" });

    const pos = fake.getData();
    expect(pos.bookings[0].status).toBe("CONFIRMADA");
    expect(pos.payments[0].status).toBe("PAGO");
    expect(pos.payments[0].paidAt).toBe(antes.payments[0].paidAt);
    expect(pos.loyaltyPoints).toHaveLength(antes.loyaltyPoints.length);
    expect(pos.notifications).toHaveLength(antes.notifications.length);
  });
});

describe("cenário 6: webhook sem reserva correspondente", () => {
  it("não cria reserva e loga erro controlado quando a cobrança não existe internamente", async () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    const { processAsaasPaymentEvent } = await import("@/lib/payments/confirmation");

    await expect(
      processAsaasPaymentEvent({
        id: "evt_desconhecido",
        event: "PAYMENT_RECEIVED",
        payment: { id: "pay_nao_existe", status: "RECEIVED", value: 100 },
      } as never),
    ).resolves.toEqual({ status: "ignored", reason: "payment_not_found" });

    expect(fake.getData().bookings).toHaveLength(0);
    expect(fake.getData().passengers).toHaveLength(0);
    expect(fake.getData().payments).toHaveLength(0);
    expect(spy).toHaveBeenCalledWith(
      "ASAAS WEBHOOK IGNORADO",
      expect.objectContaining({
        eventId: "evt_desconhecido",
        paymentId: "pay_nao_existe",
        outcome: "payment_not_found",
      }),
    );
    spy.mockRestore();
  });

  it("não recria a reserva quando o pagamento aponta para booking inexistente", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await checkout();
    const orfa = fake.getData();
    orfa.bookings = [];
    fake.setData(orfa);
    const antesDoWebhook = {
      bookings: orfa.bookings.length,
      passengers: orfa.passengers.length,
      payments: orfa.payments.length,
    };

    asaasConfirma();
    await expect(entregarEvento("evt_orfa")).rejects.toThrow(/Booking não encontrada/);

    const pos = fake.getData();
    // Nada foi criado para "consertar" a inconsistência.
    expect(pos.bookings).toHaveLength(antesDoWebhook.bookings);
    expect(pos.passengers).toHaveLength(antesDoWebhook.passengers);
    expect(pos.payments).toHaveLength(antesDoWebhook.payments);
    expect(pos.payments[0].status).toBe("PENDENTE");
    // Liberado para o Asaas reentregar; não consumido como se fosse sucesso.
    expect(fake.events.has("evt_orfa")).toBe(false);
    expect(spy).toHaveBeenCalledWith(
      "ASAAS WEBHOOK ERROR",
      expect.objectContaining({ eventId: "evt_orfa", stage: "find_booking" }),
    );
    spy.mockRestore();
  });
});

describe("regra de negócio: a obrigatoriedade permanece no webhook", () => {
  it("recusa confirmar uma reserva PENDENTE com passageiro incompleto", async () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    await checkout();
    const store = fake.getData();
    const passageiro = store.passengers[0] as unknown as Record<string, unknown>;
    passageiro.rg = null;
    passageiro.dataDeclarationAt = null;
    fake.setData(store);

    asaasConfirma();
    await expect(entregarEvento("evt_incompleto")).resolves.toEqual({
      status: "ignored",
      reason: "passenger_data_incomplete",
    });

    const pos = fake.getData();
    expect(pos.bookings[0].status).toBe("PENDENTE");
    expect(pos.payments[0].status).toBe("PENDENTE");
    expect(spy).toHaveBeenCalledWith(
      "ASAAS WEBHOOK IGNORADO",
      expect.objectContaining({ outcome: "passenger_data_incomplete" }),
    );
    spy.mockRestore();
  });

  it("não isenta reserva legada já CONFIRMADA: saldo não confirma com passageiro incompleto", async () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    await checkout();
    const legada = fake.getData();
    // Reserva confirmada em 25/09, antes de RG e declaração serem exigidos.
    legada.bookings[0].status = "CONFIRMADA";
    const passageiro = legada.passengers[0] as unknown as Record<string, unknown>;
    passageiro.rg = null;
    passageiro.dataDeclarationAt = null;
    fake.setData(legada);

    asaasConfirma();
    await expect(entregarEvento("evt_legada")).resolves.toEqual({
      status: "ignored",
      reason: "passenger_data_incomplete",
    });

    const pos = fake.getData();
    expect(pos.payments[0].status).toBe("PENDENTE");
    expect(pos.payments[0].paidAt).toBeFalsy();
    // O cliente é avisado para corrigir os dados.
    const avisos = pos.notifications.filter((n) => n.title.includes("incompletos"));
    expect(avisos).toHaveLength(1);
    expect(pos.auditLogs.some((a) => a.action === "PAYMENT_REJECTED_INCOMPLETE_PASSENGERS")).toBe(true);
    spy.mockRestore();
  });

  it("libera o evento para retry quando o Asaas ainda não compensou", async () => {
    await checkout();
    // Sem asaasConfirma(): a cobrança remota segue PENDING.
    await expect(entregarEvento("evt_cedo")).rejects.toThrow(/ainda não recebida/);

    expect(fake.getData().bookings[0].status).toBe("PENDENTE");
    expect(fake.events.has("evt_cedo")).toBe(false);

    // O Asaas reentrega depois da compensação: agora confirma.
    asaasConfirma();
    await expect(entregarEvento("evt_cedo")).resolves.toEqual({ status: "confirmed" });
    expect(fake.getData().bookings[0].status).toBe("CONFIRMADA");
  });
});
