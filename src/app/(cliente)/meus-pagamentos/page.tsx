import { requireUser } from "@/lib/auth/actions";
import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import { formatCurrency, formatDateTime } from "@/lib/utils";

export default async function MyPaymentsPage() {
  const session = await requireUser();
  const store = await getRepositoryRuntime().read();
  const payments = store.payments.filter((p) => p.customerId === session.id);
  const installments = store.installments.filter((i) =>
    store.bookings.some((b) => b.id === i.bookingId && b.customerId === session.id),
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">
        Meus pagamentos
      </h1>
      <div className="mt-8 space-y-4">
        {payments.map((p) => {
          const booking = store.bookings.find((b) => b.id === p.bookingId)!;
          return (
            <div key={p.id} className="rounded-3xl bg-white/90 p-5 ring-1 ring-black/5">
              <p className="font-bold">
                {booking.reference} · {p.method} · {p.status}
              </p>
              <p className="text-sm text-black/60">
                {formatCurrency(p.amount)} · {formatDateTime(p.createdAt)}
              </p>
            </div>
          );
        })}
      </div>
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
