import Image from "next/image";
import { notFound } from "next/navigation";
import { getTripBySlug } from "@/lib/booking/actions";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth/session";

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
          <div className="relative aspect-[4/3] overflow-hidden rounded-[1.5rem] bg-[#F3EEF0] shadow-sm">
            <Image
              src={trip.images[0] || "/images/guaruja.png"}
              alt={trip.name}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
          </div>

          <div className="min-w-0">
            <p className="eyebrow">{trip.category}</p>
            <h1 className="mt-2 font-display text-4xl font-bold tracking-tight text-[#2F2328] md:text-5xl">
              {trip.name}
            </h1>
            <p className="mt-3 text-base text-[#6B5B63] md:text-lg">
              {formatDate(trip.date)} · saída {trip.departureTime} · retorno {trip.returnTime}
            </p>
            <p className="mt-2 text-sm text-[#6B5B63]">{trip.destination}</p>

            <div className="mt-6 rounded-2xl border border-[#EBE4E7] bg-white p-5">
              <p className="text-sm text-[#6B5B63]">Valor por pessoa</p>
              <p className="mt-1 text-3xl font-bold text-[#E84C91]">
                {formatCurrency(trip.pricePerson)}
              </p>
              {trip.priceCouple && (
                <p className="mt-1 text-sm text-[#6B5B63]">
                  Dupla: {formatCurrency(trip.priceCouple)}
                </p>
              )}
              <p className="mt-3 text-sm font-medium text-[#2F2328]">
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
          <h2 className="font-display text-2xl font-bold text-[#2F2328]">
            Pontos de embarque
          </h2>
          <ul className="mt-5 divide-y divide-[#EBE4E7]">
            {boarding.map((b) => (
              <li
                key={b.id}
                className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-[#2F2328]">{b.point.name}</p>
                  <p className="text-sm text-[#6B5B63]">{b.point.address}</p>
                </div>
                <p className="shrink-0 text-base font-bold text-[#E84C91]">{b.time}</p>
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
      <h2 className="text-lg font-bold text-[#2F2328]">{title}</h2>
      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-[#6B5B63]">{body}</p>
    </div>
  );
}
