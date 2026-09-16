import Link from "next/link";
import { requireUser } from "@/lib/auth/actions";
import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import { formatCurrency, formatDate } from "@/lib/utils";
import { GalleryPhotoForm } from "@/components/gallery/gallery-photo-form";

export default async function MyTripsPage() {
  const session = await requireUser();
  const store = await getRepositoryRuntime().read();
  const bookings = store.bookings.filter((b) => b.customerId === session.id);

  const eligibleTrips = store.trips
    .filter(
      (trip) =>
        trip.status === "PUBLICADA" ||
        trip.status === "ESGOTADA" ||
        trip.status === "FINALIZADA",
    )
    .map((trip) => ({
      id: trip.id,
      name: trip.name,
      date: formatDate(trip.date),
    }));

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">
        Minhas viagens
      </h1>
      {eligibleTrips.length > 0 && (
        <div className="mt-8">
          <GalleryPhotoForm trips={eligibleTrips} />
        </div>
      )}

      <div className="mt-8 space-y-4">
        {bookings.length === 0 && (
          <p className="text-black/60">
            Nenhuma reserva ainda.{" "}
            <Link href="/excursoes" className="text-[var(--brand-primary)]">
              Ver excursões
            </Link>
          </p>
        )}
        {bookings.map((b) => {
          const trip = store.trips.find((t) => t.id === b.tripId)!;
          return (
            <div
              key={b.id}
              className="flex flex-col gap-3 rounded-3xl bg-white/90 p-5 ring-1 ring-black/5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-xs font-semibold text-[var(--brand-secondary)]">
                  {b.reference} · {b.status}
                </p>
                <h2 className="text-xl font-bold">{trip.name}</h2>
                <p className="text-sm text-black/60">
                  {formatDate(trip.date)} · {b.boardingPoint} · {formatCurrency(b.totalAmount)}
                </p>
              </div>
              {b.status === "CONFIRMADA" ? (
                <Link
                  href={`/voucher/${b.id}`}
                  className="text-sm font-semibold text-[var(--brand-primary)]"
                >
                  Ver voucher
                </Link>
              ) : (
                <Link
                  href={`/checkout/sucesso?booking=${b.id}`}
                  className="text-sm font-semibold text-[var(--brand-primary)]"
                >
                  Ver pagamento
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
