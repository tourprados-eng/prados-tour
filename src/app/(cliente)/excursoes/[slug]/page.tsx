import { notFound } from "next/navigation";
import { getTripBySlug } from "@/lib/booking/actions";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth/session";
import { TripCover } from "@/components/trips/trip-cover";

export default async function TripDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getTripBySlug(slug);
  if (!data) notFound();
  const { trip, boarding, availableSeats } = data;
  const session = await getSession();
  const reserveHref = session
    ? `/checkout?trip=${trip.slug}`
    : `/login?next=/checkout?trip=${trip.slug}`;

  return (
    <div className="section-pad pt-8 md:pt-12">
      <div className="container-page">
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
          <div className="relative aspect-[4/3] overflow-hidden rounded-[1.5rem] bg-brand-tint shadow-card">
            <TripCover
              images={trip.images}
              alt={trip.name}
              sizes="(max-width: 1024px) 100vw, 50vw"
              priority
              className="object-cover"
            />
          </div>

          <div className="min-w-0">
            <p className="eyebrow">{trip.category}</p>
            <h1 className="mt-2 font-display text-4xl font-bold tracking-tight text-brand-ink md:text-5xl">
              {trip.name}
            </h1>
            <p className="mt-3 text-base text-brand-muted md:text-lg">
              {formatDate(trip.date)} · saída {trip.departureTime} · retorno {trip.returnTime}
            </p>
            <p className="mt-2 text-sm text-brand-muted">{trip.destination}</p>

            <div className="mt-6 rounded-2xl border border-brand-line bg-white p-5 shadow-card">
              <p className="text-sm text-brand-muted">Valor por pessoa</p>
              <p className="mt-1 text-3xl font-bold text-brand-primary">
                {formatCurrency(trip.pricePerson)}
              </p>
              {trip.priceCouple && (
                <p className="mt-1 text-sm text-brand-muted">
                  Dupla: {formatCurrency(trip.priceCouple)}
                </p>
              )}
              <p className="mt-3 text-sm font-medium text-brand-ink">
                {availableSeats} vagas disponíveis de {trip.totalSeats}
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button href={reserveHref} size="lg">
                  Reservar agora
                </Button>
                <Button href="/excursoes" variant="outline" size="lg">
                  Ver outras
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-2">
          <Section title="Descrição" body={trip.description} />
          <Section title="Roteiro" body={trip.itinerary} />
          <Section title="Incluso" body={trip.included} />
          <Section title="Não incluso" body={trip.notIncluded} />
          <Section title="Regras" body={trip.rules} />
          <Section title="Cancelamento" body={trip.cancellationPolicy} />
        </div>

        <div className="surface-card mt-10 p-6 md:p-8">
          <h2 className="font-display text-2xl font-bold text-brand-ink">
            Pontos de embarque
          </h2>
          <ul className="mt-5 divide-y divide-brand-line">
            {boarding.map((b) => (
              <li
                key={b.id}
                className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-brand-ink">{b.point.name}</p>
                  <p className="text-sm text-brand-muted">{b.point.address}</p>
                </div>
                <p className="shrink-0 text-base font-bold text-brand-primary">{b.time}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Section({ title, body }: { title: string; body: string }) {
  return (
    <div className="surface-card p-6">
      <h2 className="text-lg font-bold text-brand-ink">{title}</h2>
      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-brand-muted">{body}</p>
    </div>
  );
}
