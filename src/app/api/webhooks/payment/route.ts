import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { confirmPaymentWebhook } from "@/lib/booking/actions";
import { getPaymentWebhookSecret } from "@/lib/env/server";

/**
 * Compara o segredo em tempo constante para evitar vazamento via timing.
 */
function secretsMatch(header: string, secret: string): boolean {
  const a = Buffer.from(header);
  const b = Buffer.from(secret);
  if (a.length !== b.length) {
    timingSafeEqual(a, a);
    return false;
  }
  return timingSafeEqual(a, b);
}

/**
 * Webhook do gateway de pagamento.
 * Em produção, valide assinatura HMAC do provedor antes de confirmar.
 */
export async function POST(request: Request) {
  let secret: string | null;
  try {
    secret = getPaymentWebhookSecret();
  } catch (error) {
    console.error("Configuração de webhook inválida", error);
    return NextResponse.json({ error: "Webhook não configurado." }, { status: 503 });
  }

  if (secret) {
    const header = request.headers.get("x-webhook-secret");
    if (!header || !secretsMatch(header, secret)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const body = await request.json().catch(() => null);
  const gatewayPaymentId = body?.gatewayPaymentId || body?.id;
  if (!gatewayPaymentId) {
    return NextResponse.json({ error: "gatewayPaymentId required" }, { status: 400 });
  }

  await confirmPaymentWebhook(String(gatewayPaymentId));
  return NextResponse.json({ ok: true });
}
