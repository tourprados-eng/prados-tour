import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { isProductionEnvironment } from "@/lib/env/server";
import { getDataBackend } from "@/lib/supabase/config";
import { clearSession, setSession } from "@/lib/auth/session";
import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import {
  payBalanceAction,
  runBalanceRemindersAction,
} from "@/lib/payments/balance-actions";
import { confirmPaymentWebhook } from "@/lib/payments/confirmation";
import { releasePixClaim } from "@/lib/payments/claims";
import { runBalanceReminders } from "@/lib/payments/reminders";
import { reconcileExistingBalances } from "@/lib/payments/reconcile";
import { balancePaymentIdFor, getBalanceInfo } from "@/lib/payments/balance";
import type { DataStore } from "@/types";

const OWNER_EMAIL = "saldo-teste-owner@pradostour.com";
const OTHER_EMAIL = "saldo-teste-other@pradostour.com";
const TRIP_NAME = "VIAGEM-TESTE-SALDO";
const BOOKING_REF = "PT-TESTE-SALDO";
const BOOKING3_REF = "PT-TESTE-SALDO-B";
const DOWN_GATEWAY = "pay_test_balance_down";
const TEST_CPF = "52998224725";
const MONEY_TOLERANCE = 0.01;

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

function balanceDue(trip: { date: string }): string {
  const d = new Date(`${trip.date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 7);
  return d.toISOString().slice(0, 10);
}

type Step = { name: string; pass: boolean; detail: string };

async function resetReminderRowsForTest(bookingIds: string[]) {
  if (getDataBackend() !== "local") return;
  try {
    const { promises: fs } = await import("fs");
    const { join } = await import("path");
    const file = join(process.cwd(), ".data", "balance-reminders.json");
    const rows = JSON.parse(await fs.readFile(file, "utf8")) as Array<{
      bookingId: string;
    }>;
    const kept = rows.filter((r) => !bookingIds.includes(r.bookingId));
    await fs.writeFile(file, JSON.stringify(kept, null, 2), "utf8");
  } catch {
    // Sem arquivo de lembretes: nada a limpar.
  }
}

async function run(ownerId: string, otherId: string) {
  const steps: Step[] = [];
  const push = (name: string, pass: boolean, detail: string) =>
    steps.push({ name, pass, detail });
  const repo = getRepositoryRuntime();

  const runSteps = async () => {
    const booking = (await repo.read()).bookings.find((b) => b.reference === BOOKING_REF)!;
    const booking3 = (await repo.read()).bookings.find((b) => b.reference === BOOKING3_REF)!;
    const trip = (await repo.read()).trips.find((t) => t.name === TRIP_NAME)!;

    const asOwner = () => setSession({ id: ownerId, email: OWNER_EMAIL, fullName: "Saldo Teste Owner", role: "CLIENTE" });
    const asOther = () => setSession({ id: otherId, email: OTHER_EMAIL, fullName: "Saldo Teste Other", role: "CLIENTE" });

    const balancePayments = (store: DataStore) =>
      store.payments.filter(
        (p) =>
          p.bookingId === booking.id &&
          (p.metadata as Record<string, unknown> | null | undefined)?.type === "BALANCE",
      );

    await asOwner();
    const gen = await payBalanceAction(booking.id);
    const afterGen = await repo.read();
    const balsGen = balancePayments(afterGen);
    const paidGen = afterGen.payments
      .filter((p) => p.bookingId === booking.id && p.status === "PAGO")
      .reduce((s, p) => s + Number(p.amount ?? 0), 0);
    const genOk = gen.ok === true;
    const genStatus = genOk ? gen.status : null;
    const genAmount = genOk ? gen.amount : 0;
    const genPix = genOk ? gen.pixCopyPaste : null;
    push(
      "1_gerar_cobranca_saldo",
      Boolean(
        genOk &&
          genStatus === "pending" &&
          Math.abs(genAmount - 100) <= MONEY_TOLERANCE &&
          typeof genPix === "string" &&
          genPix.length > 10 &&
          balsGen.length === 1 &&
          balsGen[0].status === "PENDENTE" &&
          Boolean(balsGen[0].gatewayPaymentId) &&
          Boolean(balsGen[0].asaasExternalReference) &&
          Math.abs(Number(balsGen[0].amount) - 100) <= MONEY_TOLERANCE &&
          Math.abs(paidGen - 100) <= MONEY_TOLERANCE,
      ),
      `ok=${genOk} status=${genStatus} amount=${genAmount} pixLen=${String(genPix).length} bals=${balsGen.length} gateway=${balsGen[0]?.gatewayPaymentId ?? "null"} balStatus=${balsGen[0]?.status ?? "null"}`,
    );

    const gatewayId = balsGen[0]?.gatewayPaymentId ?? null;

    await asOwner();
    const double = await payBalanceAction(booking.id);
    const afterDouble = await repo.read();
    const balsDouble = balancePayments(afterDouble);
    const doubleOk = double.ok === true;
    push(
      "2_double_click_reutiliza",
      Boolean(
        doubleOk &&
          double.reused === true &&
          balsDouble.length === 1 &&
          balsDouble[0].id === balsGen[0]?.id,
      ),
      `ok=${doubleOk} reused=${doubleOk ? double.reused : "n/a"} bals=${balsDouble.length} samePayment=${balsDouble[0]?.id === balsGen[0]?.id}`,
    );

    await asOther();
    const otherRes = await payBalanceAction(booking.id);
    const afterOther = await repo.read();
    const otherOk = otherRes.ok === true;
    const otherError = "error" in otherRes && otherRes.error ? otherRes.error : "";
    push(
      "3_outro_usuario_bloqueado",
      !otherOk && otherError.toLowerCase().includes("permiss"),
      `ok=${otherOk} error=${otherError || "n/a"} bals=${balancePayments(afterOther).length}`,
    );

    await clearSession();
    const anon = await payBalanceAction(booking.id);
    const anonOk = anon.ok === true;
    const anonError = "error" in anon && anon.error ? anon.error : "";
    push(
      "4_anon_bloqueado",
      !anonOk && anonError.toLowerCase().includes("login"),
      `ok=${anonOk} error=${anonError || "n/a"}`,
    );

    await asOwner();
    await confirmPaymentWebhook(String(gatewayId));
    const afterConfirm = await repo.read();
    const balConfirmed = balancePayments(afterConfirm)[0];
    const installment2 = afterConfirm.installments.find(
      (i) => i.bookingId === booking.id && i.number === 2,
    );
    const blocked = await payBalanceAction(booking.id);
    const afterBlocked = await repo.read();
    const balanceAfter = getBalanceInfo(
      afterBlocked,
      afterBlocked.bookings.find((b) => b.id === booking.id)!,
      trip,
    );
    const blockedOk = blocked.ok === true;
    push(
      "5_webhook_confirma_parcela2_e_bloqueia_nova",
      Boolean(
        balConfirmed?.status === "PAGO" &&
          installment2?.status === "PAGO" &&
          balanceAfter.balance <= MONEY_TOLERANCE &&
          balanceAfter.status === "COMPLETO" &&
          blockedOk &&
          blocked.status === "alreadyPaid" &&
          balancePayments(afterBlocked).length === 1,
      ),
      `bal=${balConfirmed?.status} inst2=${installment2?.status} balance=${balanceAfter.balance} blockStatus=${blockedOk ? blocked.status : "n/a"}`,
    );

    await repo.transaction((s) => {
      const t = s.trips.find((x) => x.id === trip.id)!;
      t.date = daysFromNow(-5);
      t.departureDate = daysFromNow(-5);
    });
    const pastRes = await payBalanceAction(booking.id);
    const pastOk = pastRes.ok === true;
    const pastError = "error" in pastRes && pastRes.error ? pastRes.error : "";
    const vip = getBalanceInfo(await repo.read(), booking3, {
      ...(await repo.read()).trips.find((t) => t.name === TRIP_NAME)!,
      date: daysFromNow(-5),
      departureDate: daysFromNow(-5),
    });
    push(
      "6_viagem_passada_bloqueia",
      !pastOk &&
        pastError.toLowerCase().includes("viagem j") &&
        vip.status === "VIAGEM_REALIZADA",
      `ok=${pastOk} error=${pastError || "n/a"} status=${vip.status}`,
    );

    await repo.transaction((s) => {
      const t = s.trips.find((x) => x.id === trip.id)!;
      t.date = daysFromNow(7);
      t.departureDate = null;
    });

    await resetReminderRowsForTest([booking.id, booking3.id]);

    const reminderWindow = async (tripDays: number, expectKind: string) => {
      await repo.transaction((s) => {
        const t = s.trips.find((x) => x.id === trip.id)!;
        t.date = daysFromNow(tripDays);
        t.departureDate = null;
      });
      const first = await runBalanceReminders();
      const second = await runBalanceReminders();
      const firstItems = first.items.filter((i) => i.bookingId === booking3.id);
      const secondItems = second.items.filter((i) => i.bookingId === booking3.id);
      return {
        first,
        second,
        firstItems,
        secondItems,
        pass:
          second.created === 0 &&
          first.created >= 1 &&
          firstItems.some((i) => i.kind === expectKind),
      };
    };

    const vencHoje = await reminderWindow(7, "PRAZO_VENCIDO");
    push(
      "7a_lembrete_prazo_vencido_hoje",
      vencHoje.pass,
      `first=${vencHoje.first.created} firstItems=${vencHoje.firstItems.map((i) => `${i.kind}:${i.status}`).join(",")} second=${vencHoje.second.created}`,
    );

    const vencido = await reminderWindow(3, "SALDO_VENCIDO");
    push(
      "7b_lembrete_saldo_vencido",
      vencido.pass,
      `first=${vencido.first.created} firstItems=${vencido.firstItems.map((i) => `${i.kind}:${i.status}`).join(",")} second=${vencido.second.created}`,
    );

    await repo.transaction((s) => {
      const t = s.trips.find((x) => x.id === trip.id)!;
      t.date = daysFromNow(9);
      t.departureDate = null;
    });
    const proximo = await runBalanceReminders();
    const proximoItems = proximo.items.filter((i) => i.bookingId === booking3.id);
    push(
      "7c_lembrete_prazo_proximo",
      proximo.created >= 1 && proximoItems.some((i) => i.kind === "PRAZO_PROXIMO"),
      `created=${proximo.created} items=${proximoItems.map((i) => `${i.kind}:${i.status}`).join(",")}`,
    );

    await asOther();
    const guard = await runBalanceRemindersAction();
    const guardOk = guard.ok === true;
    push(
      "7d_acao_lembretes_guard",
      !guardOk && String(guard.message ?? "").includes("Sem permiss"),
      `ok=${guardOk} message=${guard.message ?? "n/a"}`,
    );

    await asOwner();
    const dry = await reconcileExistingBalances({ apply: false });
    const afterDry = await repo.read();
    const b3Dry = afterDry.payments.filter(
      (p) =>
        p.bookingId === booking3.id &&
        (p.metadata as Record<string, unknown> | null | undefined)?.type === "BALANCE",
    );
    push(
      "8_reconciliacao_dry_run_sem_efeito",
      dry.withBalance >= 1 && dry.newlyCharged === 0 && b3Dry.length === 0,
      `withBalance=${dry.withBalance} newlyCharged=${dry.newlyCharged} bals=${b3Dry.length} status=${dry.items.map((i) => i.status).join(",")}`,
    );

    const guardOkDry = await reconcileExistingBalances({
      apply: false,
      guardAmounts: { "PT-TESTE-SALDO-B": 100 },
    });
    const guardBlock = await reconcileExistingBalances({
      apply: true,
      guardAmounts: { "PT-TESTE-SALDO-B": 99.99 },
    });
    const afterGuard = await repo.read();
    const b3Guard = afterGuard.payments.filter(
      (p) =>
        p.bookingId === booking3.id &&
        (p.metadata as Record<string, unknown> | null | undefined)?.type === "BALANCE",
    );
    push(
      "8b_guard_valores_bloqueia",
      !guardOkDry.aborted &&
        guardBlock.aborted === true &&
        b3Guard.length === 0,
      `okDryAborted=${guardOkDry.aborted} aborted=${guardBlock.aborted} reason=${guardBlock.abortReason ?? "n/a"} bals=${b3Guard.length}`,
    );

    const apply = await reconcileExistingBalances({ apply: true });
    const afterApply = await repo.read();
    const b3Apply = afterApply.payments.filter(
      (p) =>
        p.bookingId === booking3.id &&
        (p.metadata as Record<string, unknown> | null | undefined)?.type === "BALANCE",
    );
    push(
      "9_reconciliacao_aplicada_cria_cobranca",
      apply.newlyCharged >= 1 &&
        b3Apply.length === 1 &&
        Math.abs(Number(b3Apply[0]?.amount) - 100) <= MONEY_TOLERANCE &&
        Boolean(b3Apply[0]?.gatewayPaymentId),
      `newlyCharged=${apply.newlyCharged} bals=${b3Apply.length} amount=${b3Apply[0]?.amount ?? "null"} gateway=${b3Apply[0]?.gatewayPaymentId ?? "null"}`,
    );
  };

  await runSteps();

  const first = steps[0];
  return { pass: Boolean(first?.pass), steps };
}

export async function GET() {
  if (isProductionEnvironment() || getDataBackend() !== "local") {
    return NextResponse.json({ error: "disabled outside local dev" }, { status: 404 });
  }

  const repo = getRepositoryRuntime();
  const now = new Date().toISOString();

  const owner = await repo.transaction(async (s) => {
    let profile = s.profiles.find((p) => p.email === OWNER_EMAIL);
    if (!profile) {
      profile = {
        id: uuid(),
        fullName: "Saldo Teste Owner",
        cpf: TEST_CPF,
        birthDate: null,
        email: OWNER_EMAIL,
        phone: null,
        whatsapp: null,
        role: "CLIENTE",
        customerClass: "NOVO",
        referralCode: `R${Math.floor(Math.random() * 1e6)}`,
        createdAt: now,
        updatedAt: now,
      };
      s.profiles.push(profile);
    }
    return profile;
  });

  const other = await repo.transaction(async (s) => {
    let profile = s.profiles.find((p) => p.email === OTHER_EMAIL);
    if (!profile) {
      profile = {
        id: uuid(),
        fullName: "Saldo Teste Other",
        cpf: "15350946056",
        birthDate: null,
        email: OTHER_EMAIL,
        phone: null,
        whatsapp: null,
        role: "CLIENTE",
        customerClass: "NOVO",
        referralCode: `R${Math.floor(Math.random() * 1e6)}`,
        createdAt: now,
        updatedAt: now,
      };
      s.profiles.push(profile);
    }
    return profile;
  });

  const trip = await repo.transaction(async (s) => {
    let t = s.trips.find((x) => x.name === TRIP_NAME);
    if (!t) {
      t = {
        id: uuid(),
        name: TRIP_NAME,
        slug: "viagem-teste-saldo",
        destination: "Teste",
        category: "NATUREZA",
        date: daysFromNow(40),
        departureDate: null,
        departureTime: null,
        returnTime: null,
        pricePerson: 100,
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
        createdAt: now,
        updatedAt: now,
      };
      s.trips.push(t);
    }
    return t;
  });

  await repo.transaction(async (s) => {
    let b = s.bookings.find((x) => x.reference === BOOKING_REF);
    if (!b) {
      b = {
        id: uuid(),
        reference: BOOKING_REF,
        customerId: owner.id,
        tripId: trip.id,
        sellerId: null,
        quantity: 1,
        boardingPointId: null,
        boardingPoint: null,
        totalAmount: 200,
        baseAmount: 200,
        discountAmount: 0,
        couponCode: null,
        paymentPlan: "PARCIAL",
        status: "CONFIRMADA",
        notes: null,
        childCount: 0,
        insuranceCount: 0,
        insuranceAmount: 0,
        createdAt: now,
        updatedAt: now,
      };
      s.bookings.push(b);
    }
    return b;
  });

  await repo.transaction(async (s) => {
    let b = s.bookings.find((x) => x.reference === BOOKING3_REF);
    if (!b) {
      b = {
        id: uuid(),
        reference: BOOKING3_REF,
        customerId: owner.id,
        tripId: trip.id,
        sellerId: null,
        quantity: 1,
        boardingPointId: null,
        boardingPoint: null,
        totalAmount: 200,
        baseAmount: 200,
        discountAmount: 0,
        couponCode: null,
        paymentPlan: "PARCIAL",
        status: "CONFIRMADA",
        notes: null,
        childCount: 0,
        insuranceCount: 0,
        insuranceAmount: 0,
        createdAt: now,
        updatedAt: now,
      };
      s.bookings.push(b);
    }
    return b;
  });

  await repo.transaction(async (s) => {
    const tripRef = s.trips.find((x) => x.id === trip.id)!;
    const due2 = balanceDue(tripRef);

    for (const [bookingRef, gatewayRef] of [
      [BOOKING_REF, DOWN_GATEWAY],
      [BOOKING3_REF, `${DOWN_GATEWAY}3`],
    ] as const) {
      const b = s.bookings.find((x) => x.reference === bookingRef)!;

      s.payments = s.payments.filter(
        (p) =>
          p.bookingId !== b.id ||
          (p.metadata as Record<string, unknown>)?.type !== "BALANCE",
      );
      s.installments = s.installments.filter((i) => i.bookingId !== b.id);

      const down = s.payments.find((p) => p.gatewayPaymentId === gatewayRef);
      if (down) {
        down.status = "PAGO";
        down.amount = 100;
        down.paidAt = now;
      } else {
        s.payments.push({
          id: uuid(),
          bookingId: b.id,
          customerId: b.customerId,
          method: "PIX",
          plan: "PARCIAL",
          amount: 100,
          status: "PAGO",
          gateway: "asaas",
          gatewayPaymentId: gatewayRef,
          feeAmount: 0,
          netAmount: 100,
          paidAt: now,
          pixCopyPaste: null,
          asaasExternalReference: `PRADOS-TOUR:${gatewayRef}`,
          metadata: { type: "DOWN", installNumber: 1 },
          createdAt: now,
        });
      }

      s.installments.push(
        {
          id: uuid(),
          bookingId: b.id,
          number: 1,
          value: 100,
          dueDate: "2020-01-01",
          status: "PAGO",
          paidAt: now,
          method: "PIX",
        },
        {
          id: uuid(),
          bookingId: b.id,
          number: 2,
          value: 100,
          dueDate: due2,
          status: "PENDENTE",
          paidAt: null,
          method: null,
        },
      );

      await releasePixClaim(balancePaymentIdFor(b.id)).catch(() => undefined);
    }
  });

  const result = await run(owner.id, other.id);

  return NextResponse.json({
    pass: result.pass,
    steps: result.steps,
    environment: {
      backend: getDataBackend(),
      asaas: process.env.ASAAS_ENVIRONMENT ?? "n/a",
    },
  });
}