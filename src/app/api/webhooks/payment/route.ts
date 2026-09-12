import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { getAsaasWebhookToken } from "@/lib/env/server";
import { processAsaasPaymentEvent } from "@/lib/payments/confirmation";

/**
 * Compara o token do Asaas em tempo constante para evitar vazamento via timing.
 * O token do webhook NUNCA é a API key; vem exclusivamente de ASAAS_WEBHOOK_TOKEN.
 */
function webhookTokenMatch(header: string, token: string): boolean {
  const a = Buffer.from(header);
  const b = Buffer.from(token);
  if (a.length !== b.length) {
    timingSafeEqual(a, a);
    return false;
  }
  return timingSafeEqual(a, b);
}

/**
 * Webhook oficial do Asaas (PIX).
 *
 * Autenticação: header `asaas-access-token` vs ASAAS_WEBHOOK_TOKEN.
 * Validação mínima: body.id, body.event e body.payment.id presentes.
 * Campos adicionais desconhecidos não rejeitam o webhook.
 *
 * A idempotência por `body.id` é resolvida ATÔMICAMENTE no banco
 * (payment_webhook_events.event_id UNIQUE) ANTES de qualquer regra de negócio.
 * Estados: PROCESSING (em processamento), PROCESSED (consumido) e ausente
 * (nunca processado ou falha transitória liberada p/ retry). PROCESSING recente
 * responde 503 para o Asaas tentar novamente mais tarde; PROCESSED responde 200
 * sem repetir efeito algum.
 *
 * Eventos:
 *  - PAYMENT_CONFIRMED → registra o evento e valida a cobrança; NÃO marca PAGO,
 *    NÃO confirma a reserva, NÃO libera voucher (efeito apenas do
 *    PAYMENT_RECEIVED após todas as validações).
 *  - PAYMENT_RECEIVED   → valida gateway/referência/valor/reserva + consulta na
 *    API do Asaas e então confirma Payment, booking, parcela, pontos e voucher.
 *  - PAYMENT_REFUNDED / chargeback → ainda NÃO alteram o Payment (documentado,
 *    sem regra financeira nesta versão).
 *
 * SEGURANÇA: nenhum token, API key, CPF ou payload é logado.
 */
export async function POST(request: Request) {
  let token: string | null;
  try {
    token = getAsaasWebhookToken();
  } catch {
    console.error("Configuração de webhook do Asaas inválida");
    return NextResponse.json({ error: "Webhook não configurado." }, { status: 503 });
  }

  const header = request.headers.get("asaas-access-token");
  if (!token || !header || !webhookTokenMatch(header, token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const eventId = typeof body?.id === "string" && body.id ? body.id : null;
  const eventName = typeof body?.event === "string" && body.event ? body.event : null;
  const chargeId =
    typeof body?.payment?.id === "string" && body.payment.id ? body.payment.id : null;
  if (!eventId || !eventName || !chargeId) {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  try {
    const result = await processAsaasPaymentEvent({
      id: eventId,
      event: eventName,
      payment: body?.payment ?? null,
    });
    if (result.status === "processing") {
      return NextResponse.json({ ok: false, retry: true }, { status: 503 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    console.error("Falha ao processar evento do Asaas");
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
