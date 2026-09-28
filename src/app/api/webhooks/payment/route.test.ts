import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regressão do HTTP 500 do webhook do Asaas.
 *
 * O 500 real vinha de uma exceção na transação de confirmação (gravação de
 * `bookings` rejeitada com 23514 pelo trigger de passageiros). Este arquivo
 * trava o contrato do endpoint: erro de processamento precisa virar 5xx com log
 * estruturado — nunca 200 silencioso — e reentrega de evento já processado
 * precisa ser no-op com 200.
 */

const state = vi.hoisted(() => ({
  token: "token-de-teste" as string | null,
  result: { status: "confirmed" } as { status: string },
  failure: null as Error | null,
}));

vi.mock("@/lib/env/server", () => ({
  getAsaasWebhookToken: () => {
    if (state.token === null) throw new Error("ASAAS_WEBHOOK_TOKEN ausente");
    return state.token;
  },
}));

vi.mock("@/lib/payments/confirmation", () => ({
  getAsaasWebhookStage: (error: unknown) =>
    error instanceof Error
      ? ((error as Error & { asaasWebhookStage?: string }).asaasWebhookStage ?? null)
      : null,
  processAsaasPaymentEvent: vi.fn(async () => {
    if (state.failure) throw state.failure;
    return state.result as never;
  }),
}));

const processEvent = (await import("@/lib/payments/confirmation")).processAsaasPaymentEvent;

const PAYLOAD_RECEIVED = {
  id: "evt_123",
  event: "PAYMENT_RECEIVED",
  payment: { id: "pay_123", status: "RECEIVED", value: 100 },
};

function request(body: unknown, token: string | null = "token-de-teste") {
  return new Request("https://app.example.com/api/webhooks/payment", {
    method: "POST",
    headers: token ? { "asaas-access-token": token, "content-type": "application/json" } : {},
    body: JSON.stringify(body),
  });
}

async function post(body: unknown, token: string | null = "token-de-teste") {
  const { POST } = await import("./route");
  return POST(request(body, token));
}

describe("POST /api/webhooks/payment", () => {
  beforeEach(() => {
    state.token = "token-de-teste";
    state.result = { status: "confirmed" };
    state.failure = null;
    vi.mocked(processEvent).mockClear();
  });

  it("processa e responde 200 com o desfecho do evento", async () => {
    const response = await post(PAYLOAD_RECEIVED);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, outcome: "confirmed" });
    expect(processEvent).toHaveBeenCalledWith({
      id: "evt_123",
      event: "PAYMENT_RECEIVED",
      payment: PAYLOAD_RECEIVED.payment,
    });
  });

  it("rejeita token ausente ou divergente com 401 sem processar", async () => {
    const semHeader = await post(PAYLOAD_RECEIVED, null);
    const divergente = await post(PAYLOAD_RECEIVED, "outro-token");

    expect(semHeader.status).toBe(401);
    expect(divergente.status).toBe(401);
    expect(processEvent).not.toHaveBeenCalled();
  });

  it("responde 503 quando o token do webhook não está configurado", async () => {
    state.token = null;

    const response = await post(PAYLOAD_RECEIVED);

    expect(response.status).toBe(503);
    expect(processEvent).not.toHaveBeenCalled();
  });

  it("exige event id, tipo de evento e payment id", async () => {
    for (const body of [
      { ...PAYLOAD_RECEIVED, id: null },
      { ...PAYLOAD_RECEIVED, event: null },
      { ...PAYLOAD_RECEIVED, payment: { status: "RECEIVED" } },
    ]) {
      const response = await post(body);
      expect(response.status).toBe(400);
    }
    expect(processEvent).not.toHaveBeenCalled();
  });

  it("aceita payload com campos adicionais do Asaas sem rejeitar", async () => {
    const response = await post({
      ...PAYLOAD_RECEIVED,
      payment: { ...PAYLOAD_RECEIVED.payment, dateCreated: "2026-09-28T17:46:18Z", bank: null },
    });

    expect(response.status).toBe(200);
  });

  it("devolve 500 com log estruturado quando o processamento falha", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    state.failure = Object.assign(new Error("Falha ao gravar bookings: BOOKING_PASSENGERS_INCOMPLETE"), {
      asaasWebhookStage: "confirm_payment",
    });

    const response = await post(PAYLOAD_RECEIVED);

    expect(response.status).toBe(500);
    expect(spy).toHaveBeenCalledWith("ASAAS WEBHOOK ERROR", {
      error: "Falha ao gravar bookings: BOOKING_PASSENGERS_INCOMPLETE",
      eventId: "evt_123",
      eventType: "PAYMENT_RECEIVED",
      paymentId: "pay_123",
      stage: "confirm_payment",
    });
    spy.mockRestore();
  });

  it("responde 503 para o Asaas reentregar quando o evento está em voo", async () => {
    state.result = { status: "processing" };

    const response = await post(PAYLOAD_RECEIVED);

    expect(response.status).toBe(503);
  });

  it("trata reentrega de evento já processado como no-op com 200", async () => {
    state.result = { status: "duplicate" };

    const response = await post(PAYLOAD_RECEIVED);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, outcome: "duplicate" });
  });
});
