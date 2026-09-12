import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { canAccessRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session || !canAccessRole(session.role, "admin")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const env = process.env.ASAAS_ENVIRONMENT?.trim() ?? null;
  const asaasEnvironment: "production" | "outro" | "ausente" =
    env === "production" ? "production" : env ? "outro" : "ausente";

  const apiKeyPresent = Boolean(process.env.ASAAS_API_KEY?.trim());
  const webhookTokenPresent = Boolean(process.env.ASAAS_WEBHOOK_TOKEN?.trim());

  let baseUrl: string | null = null;
  if (env === "production") baseUrl = "https://api.asaas.com/v3";
  else if (env === "sandbox") baseUrl = "https://api-sandbox.asaas.com/v3";

  let myAccountHttpStatus: number | null = null;
  let authentication: "accepted" | "rejected" | "network-error" = "rejected";

  if (apiKeyPresent && baseUrl) {
    try {
      const url = `${baseUrl}/myAccount`;
      const res = await fetch(url, {
        method: "GET",
        headers: {
          access_token: process.env.ASAAS_API_KEY!.trim(),
          "Content-Type": "application/json",
          "User-Agent": "PradosTour-Diag/1.0",
        },
        signal: AbortSignal.timeout(15_000),
      });
      myAccountHttpStatus = res.status;
      authentication = res.ok ? "accepted" : "rejected";
      await res.body?.cancel().catch(() => {});
    } catch {
      myAccountHttpStatus = null;
      authentication = "network-error";
    }
  }

  return NextResponse.json({
    asaasEnvironment,
    apiKeyPresent,
    webhookTokenPresent,
    baseUrl,
    myAccountHttpStatus,
    authentication,
  });
}
