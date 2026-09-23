import "server-only";

import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import {
  ensureBalanceChargeForBooking,
  findBalancePayment,
  getBalanceInfo,
} from "@/lib/payments/balance";
import { getAsaasPayment } from "@/lib/payments/asaas";
import { confirmPaymentWebhook } from "@/lib/payments/confirmation";

/**
 * Rotina de reconciliação / backfill dos saldos das reservas antigas.
 *
 * Idempotente e segura:
 *  - percorre apenas reservas CONFIRMADA com plano PARCIAL e saldo pendente;
 *  - consulta o status REAL no Asaas antes de considerar pago;
 *  - nunca duplica cobrança (paymentId determinístico + reconcile-first);
 *  - `apply=false` (padrão) é dry-run: apenas reporta o que seria feito;
 *  - confirmar pago SÓ via confirmPaymentWebhook (gatewayPaymentId), nunca por
 *    suposição ou retorno do frontend.
 */

const MONEY_TOLERANCE = 0.01;

export type ReconcileItemStatus =
  | "charge_created"
  | "charge_exists"
  | "already_paid"
  | "confirm_from_asaas"
  | "pending_not_confirmed"
  | "no_balance"
  | "skipped";

export type ReconcileItem = {
  bookingId: string;
  reference: string;
  customerId: string;
  tripId: string;
  balance: number;
  dueDate: string | null;
  status: ReconcileItemStatus;
  detail: string;
};

export type ReconcileReport = {
  scanned: number;
  withBalance: number;
  newlyCharged: number;
  confirmedExisting: number;
  reusePending: number;
  alreadyPaid: number;
  errors: number;
  /** true quando `guardAmounts` detectou divergência e NENHUMA ação foi aplicada. */
  aborted: boolean;
  abortReason: string | null;
  items: ReconcileItem[];
};

export async function reconcileExistingBalances(opts: {
  apply: boolean;
  /** Guarda de produção: valores exatos esperados por referência (ex.: PT000001 -> 274.50).
   *  Se qualquer valor calculado divergir, a rotina ABORTA sem criar nenhuma cobrança. */
  guardAmounts?: Record<string, number>;
}): Promise<ReconcileReport> {
  const report: ReconcileReport = {
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
  };

  const store = await getRepositoryRuntime().read();

  if (opts.guardAmounts) {
    const mismatches: Array<{ reference: string; expected: number; actual: number }> = [];
    const found = new Set<string>();
    for (const booking of store.bookings) {
      if (booking.status !== "CONFIRMADA" || booking.paymentPlan !== "PARCIAL") {
        continue;
      }
      if (!(booking.reference in opts.guardAmounts)) continue;
      found.add(booking.reference);
      const expected = opts.guardAmounts[booking.reference];
      const trip = store.trips.find((t) => t.id === booking.tripId);
      const info = getBalanceInfo(store, booking, trip);
      if (Math.abs(info.balance - expected) > MONEY_TOLERANCE) {
        mismatches.push({ reference: booking.reference, expected, actual: info.balance });
      }
    }
    for (const reference of Object.keys(opts.guardAmounts)) {
      if (!found.has(reference)) {
        mismatches.push({ reference, expected: opts.guardAmounts[reference], actual: -1 });
      }
    }
    if (mismatches.length > 0) {
      report.aborted = true;
      report.abortReason = `Guard de valores reprovado: ${mismatches
        .map((m) => `${m.reference} esperado ${m.expected.toFixed(2)} calculado ${m.actual < 0 ? "reserva não encontrada" : m.actual.toFixed(2)}`)
        .join("; ")}. Nenhuma cobrança foi criada.`;
      return report;
    }
  }

  for (const booking of store.bookings) {
    if (
      booking.status !== "CONFIRMADA" ||
      booking.paymentPlan !== "PARCIAL"
    ) {
      continue;
    }

    report.scanned += 1;

    const trip = store.trips.find((t) => t.id === booking.tripId);
    const info = getBalanceInfo(store, booking, trip);
    if (info.balance <= MONEY_TOLERANCE || !trip) {
      continue;
    }

    const today = new Date().toISOString().slice(0, 10);
    const tripDate = trip.departureDate ?? trip.date;
    if (tripDate < today) {
      report.items.push({
        bookingId: booking.id,
        reference: booking.reference,
        customerId: booking.customerId,
        tripId: booking.tripId,
        balance: info.balance,
        dueDate: info.dueDate,
        status: "skipped",
        detail: "Viagem já realizada; sem nova cobrança.",
      });
      continue;
    }

    report.withBalance += 1;

    const existing = findBalancePayment(store, booking.id);

    if (existing?.status === "PAGO") {
      report.alreadyPaid += 1;
      report.items.push({
        bookingId: booking.id,
        reference: booking.reference,
        customerId: booking.customerId,
        tripId: booking.tripId,
        balance: info.balance,
        dueDate: info.dueDate,
        status: "already_paid",
        detail: "Cobrança de saldo já paga.",
      });
      continue;
    }

    if (existing?.gatewayPaymentId) {
      try {
        const remote = await getAsaasPayment(existing.gatewayPaymentId);
        const confirmedStatuses = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"];
        if (remote && confirmedStatuses.includes(String(remote.status))) {
          if (opts.apply) {
            await confirmPaymentWebhook(existing.gatewayPaymentId).catch(
              (error: unknown) => {
                console.error(
                  "[RECONCILE] confirmPaymentWebhook falhou:",
                  error instanceof Error ? error.message : error,
                );
              },
            );
            report.items.push({
              bookingId: booking.id,
              reference: booking.reference,
              customerId: booking.customerId,
              tripId: booking.tripId,
              balance: info.balance,
              dueDate: info.dueDate,
              status: "confirm_from_asaas",
              detail: "Confirmado como pago via Asaas e webhook aplicado.",
            });
            report.confirmedExisting += 1;
          } else {
            report.items.push({
              bookingId: booking.id,
              reference: booking.reference,
              customerId: booking.customerId,
              tripId: booking.tripId,
              balance: info.balance,
              dueDate: info.dueDate,
              status: "confirm_from_asaas",
              detail: "Asaas reporta pago; webhook seria confirmado (dry-run).",
            });
          }
        } else {
          report.reusePending += 1;
          report.items.push({
            bookingId: booking.id,
            reference: booking.reference,
            customerId: booking.customerId,
            tripId: booking.tripId,
            balance: info.balance,
            dueDate: info.dueDate,
            status: "pending_not_confirmed",
            detail: `Cobrança existe (${remote?.status ?? "desconhecido"}); cliente pode pagar o PIX.`,
          });
        }
      } catch (error) {
        report.errors += 1;
        report.items.push({
          bookingId: booking.id,
          reference: booking.reference,
          customerId: booking.customerId,
          tripId: booking.tripId,
          balance: info.balance,
          dueDate: info.dueDate,
          status: "pending_not_confirmed",
          detail: `Não foi possível consultar o Asaas: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
      continue;
    }

    if (opts.apply) {
      try {
        const result = await ensureBalanceChargeForBooking(booking, trip, {
          responsibleEmail:
            store.profiles.find((p) => p.id === booking.customerId)?.email,
        });
        if (result.ok && !result.alreadyPaid) {
          report.items.push({
            bookingId: booking.id,
            reference: booking.reference,
            customerId: booking.customerId,
            tripId: booking.tripId,
            balance: info.balance,
            dueDate: info.dueDate,
            status: "charge_created",
            detail: `Cobrança do saldo criada (${(result.amount ?? info.balance).toFixed(2)}).`,
          });
          report.newlyCharged += 1;
        } else {
          report.items.push({
            bookingId: booking.id,
            reference: booking.reference,
            customerId: booking.customerId,
            tripId: booking.tripId,
            balance: info.balance,
            dueDate: info.dueDate,
            status: "already_paid",
            detail: "Sem saldo restante / não foi necessário cobrar.",
          });
          report.alreadyPaid += 1;
        }
      } catch (error) {
        report.errors += 1;
        report.items.push({
          bookingId: booking.id,
          reference: booking.reference,
          customerId: booking.customerId,
          tripId: booking.tripId,
          balance: info.balance,
          dueDate: info.dueDate,
          status: "skipped",
          detail: `Erro ao criar cobrança: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    } else {
      report.items.push({
        bookingId: booking.id,
        reference: booking.reference,
        customerId: booking.customerId,
        tripId: booking.tripId,
        balance: info.balance,
        dueDate: info.dueDate,
        status: "charge_exists",
        detail: "Nenhuma cobrança de saldo encontrada; seria criada (dry-run).",
      });
    }
  }

  return report;
}