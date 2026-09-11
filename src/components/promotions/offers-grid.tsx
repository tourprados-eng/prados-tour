import Link from "next/link";
import { MapPin, Ticket } from "lucide-react";
import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import {
  bestPromotionForTrip,
  eligiblePromotions,
  promotionSummary,
} from "@/lib/pricing";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Promotion, Trip } from "@/types";

type Offer = { trip: Trip; promotion: Promotion };

export async function OffersGrid({ trips }: { trips: Trip[] }) {
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
      <div className="rounded-3xl border border-dashed border-brand-line bg-white/70 p-10 text-center">
        <p className="font-display text-lg font-bold text-brand-ink">
          Em breve novas ofertas!
        </p>
        <p className="mt-2 text-sm text-brand-muted">
          Acompanhe a agenda de excursões e confira novos descontos.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-5 md:grid-cols-2">
      {offers.map(({ trip, promotion }) => {
        const summary = promotionSummary(store, promotion, trip);
        const badge =
          summary.isPercent && summary.promotion.discountValue > 0
            ? `${summary.promotion.discountValue}% OFF`
            : summary.isFixed && summary.promotion.discountValue > 0
              ? `${formatCurrency(summary.promotion.discountValue)} OFF`
              : "Oferta";
        return (
          <Link
            key={trip.id}
            href={`/excursoes/${trip.slug}`}
            className="surface-card group flex min-w-0 flex-col justify-between p-6 transition hover:-translate-y-1 hover:border-brand-primary/35 hover:shadow-lift"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="chip-brand rounded-full px-3 py-1 text-xs font-bold">
                    {badge}
                  </span>
                  <p className="text-xs font-bold uppercase tracking-wide text-brand-secondary">
                    {trip.category}
                  </p>
                </div>
                <h2 className="mt-2 font-display text-2xl font-bold text-brand-ink">
                  {trip.name}
                </h2>
                <p className="mt-2 text-sm text-brand-muted">
                  {formatDate(trip.date)} · {trip.destination}
                </p>
              </div>
              <MapPin className="h-5 w-5 shrink-0 text-brand-primary" aria-hidden />
            </div>

            <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
              <div>
                {summary.isPercent || summary.isFixed ? (
                  <p className="text-xs font-semibold text-emerald-700">
                    {summary.isPercent ? "desconto" : "desconto"} aplicado no checkout
                  </p>
                ) : (
                  <p className="text-xs font-semibold text-emerald-700">
                    preço promocional
                  </p>
                )}
                <p className="mt-1 text-lg font-bold text-brand-primary">
                  {formatCurrency(summary.personPrice)}
                  <span className="text-sm font-medium text-brand-muted">
                    {" "}
                    · dupla {formatCurrency(summary.couplePrice)}
                  </span>
                </p>
                {summary.coupon && (
                  <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-dashed border-brand-primary/50 bg-brand-tint px-3 py-1 text-xs font-bold text-brand-ink">
                    <Ticket className="h-3.5 w-3.5 text-brand-primary" aria-hidden />
                    Cupom {summary.coupon.code}
                  </p>
                )}
                {summary.pixRate > 0 && (
                  <p className="mt-2 text-xs font-semibold text-brand-muted">
                    + {Math.round(summary.pixRate * 100)}% OFF no PIX
                  </p>
                )}
              </div>
              <span className="text-sm font-semibold text-brand-ink transition group-hover:text-brand-primary">
                Reservar →
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}