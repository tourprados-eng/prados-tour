"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import { canAccessRole } from "@/lib/roles";
import { ensureBalanceChargeForBooking, getBalanceInfo } from "@/lib/payments/balance";
import { runBalanceReminders } from "@/lib/payments/reminders";
import {
  reconcileExistingBalances,
  type ReconcileReport,
} from "@/lib/payments/reconcile";

export type BalançoActionResult =
  | {
      ok: true;
      status: "pending" | "alreadyPaid";
      reused?: boolean;
      amount: number;
      pixCopyPaste?: string | null;
      bookingId: string;
    }
  | { ok: false; error: string };

/**
 * Gera (ou reutiliza) a cobrança Asaas SOMENTE do saldo restante da reserva.
 *
 * Segurança:
 *  - somente o dono da reserva ou equipe (admin/financeiro) pode chamar;
 *  - o valor é recalculado no servidor (ignora qualquer input do cliente);
 *  - nunca cobra o total de novo; se o saldo é R$ 0, não cria nada;
 *  - idempotência por paymentId determinístico + claim + reconcile-first;
 *  - nunca considera pago por retorno: pagamento só é confirmado via webhook.
 */
export async function payBalanceAction(
  bookingId: string,
): Promise<BalançoActionResult> {
  const session = await getSession();
  if (!session) {
    return { ok: false, error: "Faça login para acessar sua reserva." };
  }

  const store = await getRepositoryRuntime().read();
  const booking = store.bookings.find((b) => b.id === bookingId);
  if (!booking) {
    return { ok: false, error: "Reserva não encontrada." };
  }

  const isStaff = canAccessRole(session.role, "financeiro");
  if (booking.customerId !== session.id && !isStaff) {
    return { ok: false, error: "Você não tem permissão nesta reserva." };
  }

  if (booking.status === "CANCELADA") {
    return { ok: false, error: "A reserva está cancelada." };
  }
  if (booking.status !== "CONFIRMADA") {
    return {
      ok: false,
      error: "O saldo só está disponível após a confirmação do pagamento inicial.",
    };
  }

  const trip = store.trips.find((t) => t.id === booking.tripId);
  if (!trip) {
    return { ok: false, error: "Viagem não encontrada." };
  }

  const info = getBalanceInfo(store, booking, trip);
  const today = new Date().toISOString().slice(0, 10);
  const tripDate = trip.departureDate ?? trip.date;
  if (tripDate < today) {
    return { ok: false, error: "A viagem já aconteceu." };
  }
  if (info.balance <= 0.005) {
    return { ok: true, status: "alreadyPaid", amount: 0, bookingId };
  }

  const result = await ensureBalanceChargeForBooking(booking, trip, {
    responsibleEmail: session.email,
  });

  if (result.alreadyPaid) {
    return { ok: true, status: "alreadyPaid", amount: result.amount ?? 0, bookingId };
  }
  if (!result.ok) {
    return { ok: false, error: result.message ?? "Não foi possível gerar o PIX do saldo." };
  }

  revalidatePath("/minhas-viagens");
  revalidatePath("/meus-pagamentos");
  revalidatePath("/admin/reservas");
  revalidatePath(`/admin/reservas/${bookingId}`);

  return {
    ok: true,
    status: "pending",
    reused: result.reused,
    amount: result.amount ?? info.balance,
    pixCopyPaste: result.pixCopyPaste ?? null,
    bookingId,
  };
}

export type ReminderRunResult = {
  ok: boolean;
  created: number;
  sent: number;
  registeredOnly: number;
  items: Array<{
    bookingId: string;
    reference: string;
    kind: string;
    email: string;
    status: string;
  }>;
  message?: string;
};

/**
 * Rotina de lembretes de saldo (idempotente). Acessível a equipe financeira.
 * Não altera o e-mail de confirmação de cadastro. Registra cada envio em
 * `balance_reminders` para impedir duplicidade entre execuções.
 */
export async function runBalanceRemindersAction(): Promise<ReminderRunResult> {
  const session = await getSession();
  if (!session || !canAccessRole(session.role, "financeiro")) {
    return { ok: false, created: 0, sent: 0, registeredOnly: 0, items: [], message: "Sem permissão." };
  }
  const report = await runBalanceReminders();
  return {
    ok: true,
    created: report.created,
    sent: report.sent,
    registeredOnly: report.registeredOnly,
    items: report.items,
  };
}

/**
 * Rotina de reconciliação/backfill das reservas antigas com saldo (idempotente).
 * Consulta o status real no Asaas antes de qualquer efeito e nunca duplica
 * cobrança. `apply=false` (padrão) apenas reporta o que seria feito.
 */
export async function runBalanceReconciliationAction(args?: {
  apply?: boolean;
}): Promise<ReconcileReport & { ok: boolean; message?: string }> {
  const session = await getSession();
  if (!session || !canAccessRole(session.role, "financeiro")) {
    return {
      ok: false,
      scanned: 0,
      withBalance: 0,
      newlyCharged: 0,
      confirmedExisting: 0,
      reusePending: 0,
      alreadyPaid: 0,
      errors: 0,
      aborted: false,
      abortReason: null,
      items: [],
      message: "Sem permissão.",
    };
  }
  const report = await reconcileExistingBalances({ apply: Boolean(args?.apply) });
  return { ok: true, ...report };
}