import Link from "next/link";
import { requireUser } from "@/lib/auth/actions";
import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import { isBookingFullyPaid } from "@/lib/payments/balance";

export default async function MyVouchersPage() {
  const session = await requireUser();
  const store = await getRepositoryRuntime().read();
  const bookings = store.bookings.filter(
    (b) =>
      b.customerId === session.id &&
      b.status === "CONFIRMADA" &&
      isBookingFullyPaid(store, b.id),
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">
        Meus vouchers
      </h1>
      <div className="mt-8 space-y-3">
        {bookings.length === 0 && (
          <p className="text-black/60">Nenhum voucher confirmado ainda.</p>
        )}
        {bookings.map((b) => {
          const trip = store.trips.find((t) => t.id === b.tripId)!;
          return (
            <Link
              key={b.id}
              href={`/voucher/${b.id}`}
              className="block rounded-3xl bg-white/90 p-5 ring-1 ring-black/5"
            >
              <p className="font-bold">
                {b.reference} · {trip.name}
              </p>
              <p className="text-sm text-black/60">Status: CONFIRMADO</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
