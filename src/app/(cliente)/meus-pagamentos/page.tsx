import { requireUser } from "@/lib/auth/actions";
import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import { getBalanceInfo } from "@/lib/payments/balance";
import { formatCurrency, formatDateTime } from "@/lib/utils";

export default async function MyPaymentsPage() {
  const session = await requireUser();
  const store = await getRepositoryRuntime().read();
  const payments = store.payments.filter((p) => p.customerId === session.id);
  const installments = store.installments.filter((i) =>
    store.bookings.some((b) => b.id === i.bookingId && b.customerId === session.id),
  );

  const bookings = store.bookings.filter((b) => b.customerId === session.id);
  const balances = bookings.map((booking) => ({
    booking,
    trip: store.trips.find((t) => t.id === booking.tripId),
    info: getBalanceInfo(store, booking, store.trips.find((t) => t.id === booking.tripId)),
  }));

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">
        Meus pagamentos
      </h1>
      <div className="mt-8 space-y-4">
        {payments.map((p) => {
          const booking = store.bookings.find((b) => b.id === p.bookingId)!;
          const isBalance =
            (p.metadata as Record<string, unknown> | null | undefined)?.type === "BALANCE";
          return (
            <div key={p.id} className="rounded-3xl bg-white/90 p-5 ring-1 ring-black/5">
              <p className="font-bold">
                {booking.reference} · {p.method} · {p.status}
                {isBalance && (
                  <span className="ml-2 rounded-full bg-[var(--brand-primary)]/10 px-2 py-0.5 text-xs font-bold text-[var(--brand-primary)]">
                    Saldo restante
                  </span>
                )}
              </p>
              <p className="text-sm text-black/60">
                {formatCurrency(p.amount)} · {formatDateTime(p.createdAt)}
              </p>
            </div>
          );
        })}
      </div>

      {balances.filter(({ info }) => info.balance > 0.01).length > 0 && (
        <>
          <h2 className="mt-10 text-xl font-bold">Saldo restante por reserva</h2>
          <div className="mt-4 space-y-3">
            {balances
              .filter(({ info }) => info.balance > 0.01)
              .map(({ booking, trip, info }) => (
                <div
                  key={booking.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/80 px-4 py-3 text-sm ring-1 ring-black/5"
                >
                  <span className="font-semibold">
                    {booking.reference} · {trip?.name ?? "Viagem"}
                  </span>
                  <span className="text-black/60">
                    Total {formatCurrency(info.total)} · Já pago {formatCurrency(info.paid)}
                  </span>
                  <span className={`font-bold ${info.isDueDatePassed && info.status !== "COMPLETO" ? "text-red-600" : "text-emerald-600"}`}>
                    Saldo {formatCurrency(info.balance)}
                    {info.dueDate && (
                      <span className="ml-1 font-normal text-black/45">
                        · {info.isDueDatePassed ? "prazo vencido" : `até ${info.dueDate}`}
                      </span>
                    )}
                  </span>
                </div>
              ))}
          </div>
        </>
      )}

      <h2 className="mt-10 text-xl font-bold">Parcelas / saldo</h2>
      <div className="mt-4 space-y-3">
        {installments.map((i) => (
          <div
            key={i.id}
            className="flex justify-between rounded-2xl bg-white/80 px-4 py-3 text-sm ring-1 ring-black/5"
          >
            <span>
              Parcela {i.number} · venc. {i.dueDate}
            </span>
            <span className="font-semibold">
              {formatCurrency(i.value)} · {i.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
