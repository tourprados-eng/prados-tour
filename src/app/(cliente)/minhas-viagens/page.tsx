import Link from "next/link";
import { BusFront, Luggage, MapPin, Shell, ShieldCheck, Sparkles, Users } from "lucide-react";
import { requireUser } from "@/lib/auth/actions";
import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import { formatCurrency, formatTripDepartureDate } from "@/lib/utils";
import { PhotoShareCard } from "@/components/gallery/photo-share-card";
import { HomeHero } from "@/components/home/hero";
import { Button } from "@/components/ui/button";
import type { Booking, Trip } from "@/types";

const emptyBenefits = [
  { icon: MapPin, label: "Destinos incríveis" },
  { icon: ShieldCheck, label: "Viagem segura e organizada" },
  { icon: Users, label: "Diversão em boa companhia" },
  { icon: Sparkles, label: "Colecione boas histórias" },
];

function BookingCard({ booking, trip }: { booking: Booking; trip: Trip | undefined }) {
  const tripName = trip?.name ?? "Destino indisponível";
  const tripDate = trip ? formatTripDepartureDate(trip) : "—";
  const passengers =
    booking.quantity === 1 ? "1 passageiro" : `${booking.quantity} passageiros`;

  return (
    <div className="flex flex-col gap-3 rounded-3xl bg-white/90 p-5 shadow-card ring-1 ring-black/5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-xs font-semibold text-brand-secondary">
          {booking.reference} · {booking.status}
        </p>
        <h3 className="mt-1 font-[family-name:var(--font-display)] text-xl font-bold text-brand-ink">
          {tripName}
        </h3>
        <p className="mt-1 text-sm text-brand-muted">
          {tripDate}
          {booking.boardingPoint ? ` · ${booking.boardingPoint}` : ""} ·{" "}
          {formatCurrency(booking.totalAmount)} · {passengers}
        </p>
      </div>
      {booking.status === "CONFIRMADA" ? (
        <Link
          href={`/voucher/${booking.id}`}
          className="text-sm font-semibold text-brand-primary hover:underline"
        >
          Ver voucher
        </Link>
      ) : (
        <Link
          href={`/checkout/sucesso?booking=${booking.id}`}
          className="text-sm font-semibold text-brand-primary hover:underline"
        >
          Ver pagamento
        </Link>
      )}
    </div>
  );
}

export default async function MyTripsPage() {
  const session = await requireUser();
  const store = await getRepositoryRuntime().read();
  const today = new Date().toISOString().slice(0, 10);
  const bookings = store.bookings.filter((b) => b.customerId === session.id);

  const entries = bookings.map((booking) => ({
    booking,
    trip: store.trips.find((t) => t.id === booking.tripId),
  }));

  const upcoming = entries
    .filter(({ trip }) => trip && (trip.departureDate ?? trip.date) >= today)
    .sort((a, b) => (a.trip!.departureDate ?? a.trip!.date).localeCompare(b.trip!.departureDate ?? b.trip!.date));

  const history = entries
    .filter(({ trip }) => !trip || (trip.departureDate ?? trip.date) < today)
    .sort((a, b) => (b.trip?.departureDate ?? b.trip?.date ?? "").localeCompare(a.trip?.departureDate ?? a.trip?.date ?? ""));

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
      date: trip.date,
      departureDate: trip.departureDate,
    }));

  return (
    <div>
      {/* Fundo visual compartilhado com a Home — conteúdo próprio da página */}
      <HomeHero brand={store.brand} signedIn>
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <Shell className="absolute bottom-8 left-[12%] hidden h-12 w-12 rotate-12 text-white/30 sm:block lg:left-[16%] lg:h-16 lg:w-16" />
          <BusFront className="absolute right-[10%] bottom-6 h-14 w-14 text-white/25 sm:h-16 sm:w-16 lg:right-[14%]" />
        </div>

        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[#FFD9E8] sm:text-sm">
          <span aria-hidden className="h-0.5 w-6 rounded-full bg-gradient-to-r from-brand-secondary to-[#FFD9E8]" />
          Sua área do cliente
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl font-bold leading-[1.05] tracking-tight text-white drop-shadow-[0_4px_12px_rgba(70,10,45,0.35)] sm:text-5xl md:text-[3.4rem]">
          Minhas viagens
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-white/90 sm:text-lg">
          Confira suas reservas e acompanhe suas viagens com a Prado&apos;s Tour.
        </p>
      </HomeHero>

      <div className="relative z-10 mx-auto -mt-28 max-w-4xl px-4 sm:-mt-32 sm:px-6">
        {bookings.length === 0 ? (
          <div className="overflow-hidden rounded-[2rem] border border-white/60 bg-white shadow-[0_24px_60px_-24px_rgb(47_35_40_/_0.25)]">
            <div className="px-6 py-10 text-center sm:px-10 sm:py-14">
              <span className="relative mx-auto grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-brand-primary to-brand-secondary text-white shadow-md shadow-brand-primary/30">
                <Luggage className="h-10 w-10" strokeWidth={1.5} aria-hidden />
              </span>
              <h2 className="relative mt-6 font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight text-brand-ink sm:text-3xl">
                Nenhuma reserva ainda
              </h2>
              <p className="relative mx-auto mt-3 max-w-md text-sm leading-relaxed text-brand-muted sm:text-base">
                Suas reservas aparecerão aqui. Explore as próximas excursões e garanta o
                seu lugar.
              </p>
              <Button
                href="/excursoes"
                size="lg"
                className="relative mt-7 shadow-[0_14px_34px_-10px_rgb(232_76_145_/_0.55)]"
              >
                Ver excursões
              </Button>
            </div>

            <div className="relative border-t border-brand-line/70 bg-brand-tint/40">
              <span
                aria-hidden
                className="pointer-events-none absolute -left-6 top-0 h-full w-24 bg-gradient-to-r from-[#FFD9E8]/50 to-transparent"
              />
              <ul className="grid grid-cols-1 gap-y-5 px-6 py-7 sm:grid-cols-2 sm:gap-x-10 lg:grid-cols-4 lg:gap-x-0 lg:divide-x lg:divide-brand-line/80">
                {emptyBenefits.map(({ icon: Icon, label }) => (
                  <li
                    key={label}
                    className="relative flex items-center gap-3 lg:justify-center lg:px-6 lg:text-center"
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-brand-primary shadow-sm ring-1 ring-brand-line/60">
                      <Icon className="h-5 w-5" strokeWidth={1.8} aria-hidden />
                    </span>
                    <span className="text-sm font-semibold leading-snug text-brand-ink/85">
                      {label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
        <div className="mt-6 space-y-10">
          {upcoming.length > 0 && (
            <section>
              <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight text-brand-ink">
                Próximas viagens
              </h2>
              <div className="mt-4 space-y-4">
                {upcoming.map(({ booking, trip }) => (
                  <BookingCard key={booking.id} booking={booking} trip={trip} />
                ))}
              </div>
            </section>
          )}

          {history.length > 0 && (
            <section>
              <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight text-brand-ink">
                Histórico de viagens
              </h2>
              <div className="mt-4 space-y-4">
                {history.map(({ booking, trip }) => (
                  <BookingCard key={booking.id} booking={booking} trip={trip} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {eligibleTrips.length > 0 && (
        <section className="mt-10 pb-4">
          <PhotoShareCard trips={eligibleTrips} />
        </section>
      )}
      </div>
    </div>
  );
}