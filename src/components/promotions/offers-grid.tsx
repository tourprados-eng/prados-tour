import Link from "next/link";
import { ArrowRight, BadgePercent, CalendarDays, MapPin, Ticket } from "lucide-react";
import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import {
  bestPromotionForTrip,
  eligiblePromotions,
  promotionDiscountAmount,
  promotionSummary,
  round2,
} from "@/lib/pricing";
import { formatCurrency, formatTime, formatTripDepartureDate } from "@/lib/utils";
import { tripCategoryLabel } from "@/lib/constants";
import { TripCover } from "@/components/trips/trip-cover";
import { Button } from "@/components/ui/button";
import type { DataStore, Promotion, Trip } from "@/types";

type Offer = { trip: Trip; promotion: Promotion };

function firstBoardingPoint(store: DataStore, tripId: string) {
  const first = [...store.tripBoardingPoints]
    .filter((link) => link.tripId === tripId)
    .sort(
      (a, b) =>
        (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
        a.time.localeCompare(b.time),
    )[0];
  if (!first) return null;
  const point = store.boardingPoints.find((b) => b.id === first.boardingPointId);
  if (!point) return null;
  return { name: point.name, time: first.time };
}

export async function OffersGrid({
  trips,
  showEmptyButton = true,
}: {
  trips: Trip[];
  showEmptyButton?: boolean;
}) {
  const store = await getRepositoryRuntime().read();
  const now = new Date().toISOString();
  const offers: Offer[] = [];
  for (const trip of trips) {
    const promotion = bestPromotionForTrip(
      store,
      trip,
      eligiblePromotions(store, trip.id, now),
      1,
    );
    if (promotion) offers.push({ trip, promotion });
  }
  offers.sort((a, b) => b.promotion.createdAt.localeCompare(a.promotion.createdAt));

  if (offers.length === 0) {
    return (
      <div className="surface-card flex flex-col items-center px-6 py-14 text-center sm:py-16">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-brand-tint text-brand-primary">
          <BadgePercent className="h-7 w-7" strokeWidth={1.6} aria-hidden />
        </span>
        <p className="mt-4 font-display text-xl font-bold text-brand-ink sm:text-2xl">
          Nenhuma oferta ativa no momento
        </p>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-brand-muted">
          Acompanhe a agenda de excursões e confira novos descontos e preços
          especiais.
        </p>
        {showEmptyButton && (
          <Button href="/excursoes" variant="soft" className="mt-6">
            Ver todas as excursões
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-5 md:grid-cols-2">
      {offers.map(({ trip, promotion }) => {
        const summary = promotionSummary(store, promotion, trip);
        const personBase = trip.pricePerson;
        const discount = promotionDiscountAmount(store, promotion, trip, 1);
        const promoPerson = summary.hasPriceOverride
          ? summary.personPrice
          : Math.max(0, round2(personBase - discount));
        const hasDiscount = promoPerson < personBase;
        const boarding = firstBoardingPoint(store, trip.id);

        return (
          <Link
            key={trip.id}
            href={`/excursoes/${trip.slug}`}
            className="group surface-card flex h-full min-w-0 flex-col overflow-hidden border border-brand-line transition duration-300 hover:-translate-y-1.5 hover:shadow-lift"
          >
            <div className="relative aspect-[16/9] overflow-hidden bg-brand-tint">
              <TripCover
                images={trip.images}
                alt={trip.name}
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover transition duration-500 group-hover:scale-[1.05]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent" />
              <span className="chip-brand absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide shadow-sm">
                Oferta especial
              </span>
              <span className="absolute bottom-3 right-3 rounded-full bg-white px-3 py-1.5 text-xs font-extrabold text-brand-ink shadow-sm backdrop-blur-sm">
                {formatTripDepartureDate(trip)}
              </span>
            </div>

            <div className="flex flex-1 flex-col p-5">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-secondary">
                {tripCategoryLabel(trip.category)}
              </p>
              <h3 className="mt-1.5 font-display text-xl font-bold tracking-tight text-brand-ink line-clamp-2">
                {trip.name}
              </h3>

              <div className="mt-3 space-y-1.5 text-sm text-brand-muted">
                <p className="flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4 shrink-0 text-brand-primary" aria-hidden />
                  <span className="min-w-0 truncate">
                    {formatTripDepartureDate(trip)}
                    {trip.departureTime ? ` às ${formatTime(trip.departureTime)}` : ""}
                  </span>
                </p>
                {boarding && (
                  <p className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 shrink-0 text-brand-primary" aria-hidden />
                    <span className="min-w-0 truncate">
                      Saída {boarding.name}
                      {boarding.time ? ` às ${formatTime(boarding.time)}` : ""}
                    </span>
                  </p>
                )}
              </div>

              <div className="mt-auto pt-5">
                <div className="flex flex-wrap items-end gap-x-2 gap-y-1">
                  {hasDiscount && (
                    <span className="text-sm font-medium text-brand-muted line-through">
                      {formatCurrency(personBase)}
                    </span>
                  )}
                  <span className="text-2xl font-extrabold tracking-tight text-brand-primary">
                    {formatCurrency(promoPerson)}
                  </span>
                  <span className="pb-0.5 text-sm font-medium text-brand-muted">
                    por pessoa
                  </span>
                </div>

                {summary.coupon && (
                  <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-dashed border-brand-primary/50 bg-brand-tint px-3 py-1 text-xs font-bold text-brand-ink">
                    <Ticket className="h-3.5 w-3.5 text-brand-primary" aria-hidden />
                    Cupom {summary.coupon.code}
                  </p>
                )}
                {summary.pixRate > 0 && (
                  <p className="mt-2 text-xs font-semibold text-brand-muted">
                    + {Math.round(summary.pixRate * 100)}% OFF no PIX
                  </p>
                )}

                <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-brand-primary px-4 py-2.5 text-sm font-bold text-white shadow-sm transition duration-300 group-hover:bg-brand-deep group-hover:shadow-md">
                  Ver oferta
                  <ArrowRight
                    className="h-4 w-4 transition duration-300 group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}