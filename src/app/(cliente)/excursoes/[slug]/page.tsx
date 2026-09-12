import { notFound } from "next/navigation";
import Link from "next/link";
import { existsSync } from "fs";
import path from "path";
import { getTripBySlug } from "@/lib/booking/actions";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth/session";
import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import { buildWhatsAppUrl, withTripInfo } from "@/lib/contact";
import {
  bestPromotionForTrip,
  eligiblePromotions,
  promotionSummary,
} from "@/lib/pricing";
import { TripGallery } from "@/components/trips/trip-gallery";
import { ReviewForm } from "@/components/reviews/review-form";

export default async function TripDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getTripBySlug(slug);
  if (!data) notFound();
  const { trip, boarding } = data;
  const session = await getSession();
  const reserveHref = session
    ? `/checkout?trip=${trip.slug}`
    : `/login?next=/checkout?trip=${trip.slug}`;

  const store = await getRepositoryRuntime().read();
  const promotion = bestPromotionForTrip(
    store,
    trip,
    eligiblePromotions(store, trip.id),
    1,
  );
  const promo = promotion ? promotionSummary(store, promotion, trip) : null;
  const approvedReviews = store.reviews.filter(
    (r) => r.tripId === trip.id && r.status === "APROVADO",
  );
  const alreadyReviewed = store.reviews.some(
    (r) => r.customerId === session?.id && r.tripId === trip.id,
  );
  const canReview =
    !!session &&
    !alreadyReviewed &&
    store.bookings.some(
      (b) =>
        b.customerId === session.id &&
        b.tripId === trip.id &&
        (b.status === "CONFIRMADA" || b.status === "CONCLUIDA"),
    );

  // Filtra as URLs realmente utilizáveis para a galeria (absolutas ou presentes
  // no filesystem de public/), evitando thumbnails quebrados.
  const validImages = (trip.images ?? []).filter((url) => {
    if (!url) return false;
    if (/^https?:\/\//i.test(url)) return true;
    try {
      const relative = url.startsWith("/") ? url.slice(1) : url;
      return existsSync(path.join(process.cwd(), "public", relative));
    } catch {
      return false;
    }
  });

  return (
    <div className="section-pad pt-8 md:pt-12">
      <div className="container-page">
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
          <div>
            <TripGallery images={validImages} alt={trip.name} />
          </div>

          <div className="min-w-0">
            <p className="eyebrow">{trip.category}</p>
            <h1 className="mt-2 font-display text-4xl font-bold tracking-tight text-brand-ink md:text-5xl">
              {trip.name}
            </h1>
            <p className="mt-3 text-base text-brand-muted md:text-lg">
              {trip.returnDate
                ? `Saída ${formatDate(trip.date)} às ${trip.departureTime} · Retorno ${formatDate(trip.returnDate)} às ${trip.returnTime}`
                : `${formatDate(trip.date)} · saída ${trip.departureTime} · retorno ${trip.returnTime}`}
            </p>
            <p className="mt-2 text-sm text-brand-muted">{trip.destination}</p>

            <div className="mt-6 rounded-2xl border border-brand-line bg-white p-5 shadow-card">
              {promo && (
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <span className="chip-brand rounded-full px-3 py-1 text-xs font-bold">
                    Oferta ativa
                  </span>
                  <span className="text-sm font-semibold text-brand-primary">
                    {promo.promotion.name}
                  </span>
                  {promo.coupon && (
                    <span className="rounded-full border border-dashed border-brand-primary/50 bg-brand-tint px-3 py-1 text-xs font-bold text-brand-ink">
                      Cupom {promo.coupon.code}
                    </span>
                  )}
                </div>
              )}
              <p className="text-sm text-brand-muted">Valor por pessoa</p>
              <p className="mt-1 text-3xl font-bold text-brand-primary">
                {promo && promo.hasPriceOverride
                  ? formatCurrency(promo.personPrice)
                  : formatCurrency(trip.pricePerson)}
              </p>
              <p className="mt-1 text-sm text-brand-muted">
                Dupla: {formatCurrency(promo ? promo.couplePrice : trip.priceCouple ?? trip.pricePerson * 2)}
              </p>
              {trip.childMaxAge != null && trip.childPrice != null && (
                <p className="mt-1 text-sm text-brand-muted">
                  Criança{" "}
                  {trip.childMaxAge === 0
                    ? ""
                    : `(até ${trip.childMaxAge} ano${trip.childMaxAge === 1 ? "" : "s"})`}
                  : {formatCurrency(trip.childPrice)}
                </p>
              )}
              {trip.insuranceEnabled && (
                <p className="mt-1 text-sm text-brand-muted">
                  Seguro viagem opcional: {formatCurrency(trip.insurancePrice)}/pessoa
                </p>
              )}
              {promo && promo.isPercent && (
                <p className="mt-2 text-sm font-semibold text-emerald-700">
                  {promo.promotion.discountValue}% de desconto nesta oferta
                </p>
              )}
              {promo && promo.isFixed && (
                <p className="mt-2 text-sm font-semibold text-emerald-700">
                  {formatCurrency(promo.promotion.discountValue)} de desconto nesta oferta
                </p>
              )}
              {promo && promo.pixRate > 0 && (
                <p className="mt-1 text-sm text-emerald-700">
                  + {Math.round(promo.pixRate * 100)}% de desconto no PIX
                </p>
              )}
              <div className="mt-5 flex flex-wrap gap-3">
                <Button href={reserveHref} size="lg">
                  Reservar agora
                </Button>
                <Button
                  href={buildWhatsAppUrl(
                    store.brand.whatsapp,
                    withTripInfo(store.brand.whatsappMessage ?? "", trip),
                  )}
                  variant="outline"
                  size="lg"
                >
                  Tirar dúvida no WhatsApp
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
          {trip.transportPolicy && (
            <Section title="Política de transporte" body={trip.transportPolicy} />
          )}
          <Link
            href="/politicas"
            className="surface-card inline-flex items-center justify-center gap-2 p-6 text-sm font-semibold text-brand-primary transition hover:bg-brand-tint"
          >
            Ver políticas e condições
          </Link>
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

        {approvedReviews.length > 0 && (
          <div className="surface-card mt-10 p-6 md:p-8">
            <h2 className="font-display text-2xl font-bold text-brand-ink">
              Avaliações de quem já viajou
            </h2>
            <ul className="mt-5 space-y-4">
              {approvedReviews.map((r) => {
                const reviewer = store.profiles.find(
                  (p) => p.id === r.customerId,
                );
                return (
                  <li
                    key={r.id}
                    className="border-b border-brand-line pb-4 last:border-0 last:pb-0"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-brand-ink">
                        {reviewer?.fullName ?? "Cliente"}
                      </p>
                      <span className="text-amber-500">
                        {"★".repeat(r.rating)}
                        {"☆".repeat(5 - r.rating)}
                      </span>
                    </div>
                    {r.comment && (
                      <p className="mt-1 text-sm leading-relaxed text-brand-muted">
                        {r.comment}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {canReview && (
          <div className="mt-10">
            <ReviewForm tripId={trip.id} />
          </div>
        )}
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
