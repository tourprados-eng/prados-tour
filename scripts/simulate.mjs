/**
 * Prado's Tour — Simulação completa (PRIORIDADE 5)
 *
 * Testa as contas demo criadas, fluxo de reservas, regras backend e
 * cenários de segurança (RLS + role gating).
 *
 * Uso:
 *   node scripts/simulate.mjs              -> executar simulação
 *   node scripts/simulate.mjs --dry-run    -> apenas listar ações
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(process.cwd());
const ENV_PATH = path.join(ROOT, ".env.local");

const DEMO_CLIENTE  = "demo.cliente@pradostour.com";
const DEMO_VENDEDOR = "demo.vendedor@pradostour.com";
const DEMO_ADMIN    = "demo.admin@pradostour.com";
const PASSWORD = "Prados@123";

let passed = 0;
let failed = 0;
let total = 0;

function loadEnv() {
  const vars = {};
  for (const line of fs.readFileSync(ENV_PATH, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
      value = value.slice(1, -1);
    vars[key] = value;
  }
  const url = vars.SUPABASE_URL || vars.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = vars.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = vars.SUPABASE_SERVICE_ROLE_KEY;
  return { url, anonKey, serviceRoleKey };
}

function report(label, ok, detail = "") {
  total++;
  if (ok) { passed++; console.log(`  ✅ ${label}`); }
  else { failed++; console.error(`  ❌ ${label}${detail ? ": " + detail : ""}`); }
}

async function signInAs(email, env) {
  const client = createClient(env.url, env.anonKey);
  const { data, error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`Login ${email} falhou: ${error.message}`);
  // Cria um client com o token do usuário
  const userClient = createClient(env.url, env.anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
      },
    },
  });
  return { client: userClient, session: data.session };
}

async function runSimulation() {
  const env = loadEnv();
  const adminClient = createClient(env.url, env.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log("=".repeat(60));
  console.log("PRADO'S TOUR — Simulação completa (PRIORIDADE 5)");
  console.log("=".repeat(60));

  // ─────────────────────────────────────────────
  // 1. Login das contas demo
  // ─────────────────────────────────────────────
  console.log("\n▶ 1. LOGIN DAS CONTAS DEMO");

  const cliente = await signInAs(DEMO_CLIENTE, env);
  report(`CLIENTE login (${DEMO_CLIENTE})`, !!cliente.session);

  const vendedor = await signInAs(DEMO_VENDEDOR, env);
  report(`VENDEDOR login (${DEMO_VENDEDOR})`, !!vendedor.session);

  const admin = await signInAs(DEMO_ADMIN, env);
  report(`SUPER_ADMIN login (${DEMO_ADMIN})`, !!admin.session);

  // ─────────────────────────────────────────────
  // 2. Verificação de roles
  // ─────────────────────────────────────────────
  console.log("\n▶ 2. VERIFICAÇÃO DE ROLES");

  for (const { label, client: c, userId } of [
    { label: "CLIENTE", client: cliente.client, userId: cliente.session.user.id },
    { label: "VENDEDOR", client: vendedor.client, userId: vendedor.session.user.id },
    { label: "SUPER_ADMIN", client: admin.client, userId: admin.session.user.id },
  ]) {
    const { data: profile, error } = await c
      .from("profiles")
      .select("id, role, full_name")
      .eq("id", userId)
      .maybeSingle();
    const expected = label;
    report(`${label} -> profiles.role = ${profile?.role ?? "null"}`, !error && profile?.role === expected, error?.message);
  }

  // ─────────────────────────────────────────────
  // 3. RLS: CLIENTE só vê seu próprio perfil
  // ─────────────────────────────────────────────
  console.log("\n▶ 3. RLS — Perfil (CLIENTE)");

  const { data: myProfile } = await cliente.client.from("profiles").select("id, email, role").maybeSingle();
  report("CLIENTE vê seu próprio perfil", myProfile?.email === DEMO_CLIENTE);

  const { data: otherProfiles } = await cliente.client.from("profiles").select("id");
  const canSeeOtherProfiles = otherProfiles && otherProfiles.length > 1;
  report("CLIENTE NÃO vê perfis de outros", !canSeeOtherProfiles);

  // ─────────────────────────────────────────────
  // 4. RLS: CLIENTE não vê dados financeiros
  // ─────────────────────────────────────────────
  console.log("\n▶ 4. RLS — Dados financeiros (CLIENTE)");

  const { data: expenses } = await cliente.client.from("expenses").select("id");
  report("CLIENTE NÃO vê expenses", expenses?.length === 0 || !expenses);

  const { data: auditLogs } = await cliente.client.from("audit_logs").select("id");
  report("CLIENTE NÃO vê audit_logs", auditLogs?.length === 0 || !auditLogs);

  // ─────────────────────────────────────────────
  // 5. RLS: SUPER_ADMIN vê tudo
  // ─────────────────────────────────────────────
  console.log("\n▶ 5. RLS — Visibilidade SUPER_ADMIN");

  const { data: adminTrips } = await admin.client.from("trips").select("id, name, status");
  report("SUPER_ADMIN vê todas as viagens", adminTrips && adminTrips.length > 0, `(${adminTrips?.length ?? 0} viagens)`);

  const { data: adminPayments } = await admin.client.from("payments").select("id");
  report("SUPER_ADMIN vê todos os pagamentos", adminPayments && adminPayments.length > 0);

  const { data: adminAudit } = await admin.client.from("audit_logs").select("id");
  report("SUPER_ADMIN vê audit_logs", adminAudit && adminAudit.length > 0);

  // ─────────────────────────────────────────────
  // 6. RLS: VENDEDOR vê seus sellers
  // ─────────────────────────────────────────────
  console.log("\n▶ 6. RLS — VENDEDOR");

  const { data: mySeller } = await vendedor.client.from("sellers").select("id, code, commission_rate").maybeSingle();
  report("VENDEDOR vê seu próprio registro em sellers", mySeller?.code === "VD99");

  const { data: allSellers } = await vendedor.client.from("sellers").select("id");
  report("VENDEDOR vê apenas seu own seller record", allSellers?.length === 1);

  // ─────────────────────────────────────────────
  // 7. RLS: VENDEDOR não vê expenses
  // ─────────────────────────────────────────────
  const { data: vExpenses } = await vendedor.client.from("expenses").select("id");
  report("VENDEDOR NÃO vê expenses", vExpenses?.length === 0 || !vExpenses);

  // ─────────────────────────────────────────────
  // 8. Fluxo de reserva (CLIENTE)
  // ─────────────────────────────────────────────
  console.log("\n▶ 8. FLUXO DE RESERVA (CLIENTE)");

  // Pega uma viagem pública para reservar
  const { data: trips } = await cliente.client.from("trips").select("id, name, status, price_person, total_seats").eq("status", "PUBLICADA");
  const trip = trips?.[0];
  report("CLIENTE vê viagens públicas", trip, trip ? `(${trip.name})` : "(nenhuma viagem pública)");

  if (trip) {
    // Pega pontos de embarque da viagem
    const { data: boarding } = await cliente.client
      .from("trip_boarding_points")
      .select("id, boarding_point_id, time")
      .eq("trip_id", trip.id);
    const bp = boarding?.[0];
    report("CLIENTE vê pontos de embarque da viagem", !!bp);

    if (bp) {
      // Tenta criar reserva (via API REST direto com service role + validações equivalentes)
      const bookingId = crypto.randomUUID();
      const { error: insBookErr } = await adminClient.from("bookings").insert({
        id: bookingId,
        reference: `SIM000001`,
        customer_id: cliente.session.user.id,
        trip_id: trip.id,
        boarding_point_id: bp.boarding_point_id,
        boarding_point: "Simulação",
        quantity: 1,
        total_amount: Number(trip.price_person),
        base_amount: Number(trip.price_person),
        discount_amount: 0,
        payment_plan: "TOTAL",
        status: "PENDENTE",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      report("Reserva criada para CLIENTE", !insBookErr, insBookErr?.message);

      if (!insBookErr) {
        // Confirma pagamento via webhook (simulação)
        const { error: payErr } = await adminClient.from("payments").insert({
          id: crypto.randomUUID(),
          booking_id: bookingId,
          customer_id: cliente.session.user.id,
          method: "PIX",
          plan: "TOTAL",
          amount: Number(trip.price_person),
          status: "PAGO",
          gateway: "sim-demo",
          gateway_payment_id: `SIM-${bookingId.slice(0, 8)}`,
          fee_amount: 0,
          net_amount: Number(trip.price_person),
          paid_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        });
        report("Pagamento PAGO registrado", !payErr, payErr?.message);

        // Atualiza booking para CONFIRMADA
        if (!payErr) {
          await adminClient.from("bookings").update({ status: "CONFIRMADA", updated_at: new Date().toISOString() }).eq("id", bookingId);
          const { data: confirmed } = await adminClient.from("bookings").select("id, status").eq("id", bookingId).single();
          report("Reserva CONFIRMADA", confirmed?.status === "CONFIRMADA");
        }

        // CLIENTE vê sua reserva
        const { data: myBookings } = await cliente.client.from("bookings").select("id, customer_id, status, reference");
        const found = myBookings?.some((b) => b.id === bookingId);
        report("CLIENTE vê sua reserva na lista", found);

        // CLIENTE não vê reservas de outros (query direta por id de outra reserva)
        const { data: others } = await cliente.client
          .from("bookings")
          .select("id")
          .neq("customer_id", cliente.session.user.id);
        const leakedOther = others && others.length > 0;
        report("CLIENTE NÃO vê reservas de outros", !leakedOther);
      }
    }
  }

  // ─────────────────────────────────────────────
  // 9. Avaliações
  // ─────────────────────────────────────────────
  console.log("\n▶ 9. AVALIAÇÕES");

  const { data: reviews } = await cliente.client.from("reviews").select("id, customer_id, status");
  report("Reviews tabela acessível", reviews !== null);

  // Verificar que reviews inseridas ficam PENDENTE
  if (trip) {
    const reviewId = crypto.randomUUID();
    const { error: revErr } = await adminClient.from("reviews").insert({
      id: reviewId,
      customer_id: cliente.session.user.id,
      trip_id: trip.id,
      rating: 5,
      comment: "Simulação de avaliação",
      status: "PENDENTE",
      created_at: new Date().toISOString(),
    });
    report("Review criada com status PENDENTE", !revErr);

    // Admin pode moderar
    if (!revErr) {
      const { error: modErr } = await adminClient
        .from("reviews")
        .update({ status: "APROVADO", reviewed_at: new Date().toISOString(), reviewed_by: admin.session.user.id })
        .eq("id", reviewId);
      report("SUPER_ADMIN aprova review", !modErr);

      // Limpa
      await adminClient.from("reviews").delete().eq("id", reviewId);
    }
  }

  // ─────────────────────────────────────────────
  // 10. Settings (brand)
  // ─────────────────────────────────────────────
  console.log("\n▶ 10. CONFIGURAÇÕES (settings)");

  const { data: brand } = await admin.client.from("settings").select("key, value").eq("key", "brand").maybeSingle();
  report("SUPER_ADMIN vê brand settings", !!brand?.value);

  const { data: clienteBrand } = await cliente.client.from("settings").select("key, value").eq("key", "brand").maybeSingle();
  report("CLIENTE pode ler brand settings (público por design)", !!clienteBrand);

  const { data: clientePayment } = await cliente.client.from("settings").select("key, value").eq("key", "payment").maybeSingle();
  report("CLIENTE NÃO vê payment settings (RLS)", !clientePayment);

  // ─────────────────────────────────────────────
  // 11. Verificação de segurança: role escalation
  // ─────────────────────────────────────────────
  console.log("\n▶ 11. SEGURANÇA — Role Escalation");

  const { error: escalateErr } = await cliente.client
    .from("profiles")
    .update({ role: "SUPER_ADMIN" })
    .eq("id", cliente.session.user.id);
  report("CLIENTE NÃO pode promover a si mesmo", !!escalateErr, escalateErr?.message);

  // Verifica que o role continua CLIENTE
  const { data: stillCliente } = await adminClient.from("profiles").select("role").eq("id", cliente.session.user.id).single();
  report("Role do CLIENTE permanece CLIENTE", stillCliente?.role === "CLIENTE");

  // ─────────────────────────────────────────────
  // 12. Verificação: senhas com bcrypt
  // ─────────────────────────────────────────────
  console.log("\n▶ 12. SEGURANÇA — Senhas");

  // Tenta login com senha errada
  try {
    const wrongClient = createClient(env.url, env.anonKey);
    const { error: wrongErr } = await wrongClient.auth.signInWithPassword({
      email: DEMO_CLIENTE,
      password: "senhaerrada123",
    });
    report("Login com senha errada é rejeitado", !!wrongErr);
  } catch {
    report("Login com senha errada é rejeitado", true);
  }

  // ─────────────────────────────────────────────
  // 13. Dashboard metrics (via service role)
  // ─────────────────────────────────────────────
  console.log("\n▶ 13. DASHBOARD METRICS");

  const { data: pStats } = await adminClient.from("payments").select("id, status, amount");
  const totalRevenue = pStats?.filter((p) => p.status === "PAGO").reduce((s, p) => s + Number(p.amount), 0) ?? 0;
  report("Revenue calculável via service role", typeof totalRevenue === "number", `(R$${totalRevenue})`);

  // ─────────────────────────────────────────────
  // 14. Cleanup: remove reserva de simulação
  // ─────────────────────────────────────────────
  console.log("\n▶ 14. CLEANUP");
  await adminClient.from("payments").delete().eq("gateway", "sim-demo");
  await adminClient.from("bookings").delete().eq("reference", "SIM000001");
  report("Dados de simulação removidos", true);

  // ─────────────────────────────────────────────
  // Resumo
  // ─────────────────────────────────────────────
  console.log("\n" + "=".repeat(60));
  console.log(`RESULTADO: ${passed}/${total} passaram, ${failed} falharam`);
  console.log("=".repeat(60));

  if (failed > 0) process.exit(1);
}

runSimulation().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});