import Link from "next/link";
import { ArrowRight, CalendarDays, MapPin, Star } from "lucide-react";
import type { Trip } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { tripCategoryLabel } from "@/lib/constants";
import { TripCover } from "@/components/trips/trip-cover";

export function TripCard({ trip }: { trip: Trip }) {
  return (
    <Link
      href={`/excursoes/${trip.slug}`}
      className="group relative flex h-full min-w-0 flex-col overflow-hidden rounded-[1.75rem] border border-brand-line/80 bg-white shadow-card transition duration-300 hover:-translate-y-1.5 hover:border-brand-primary/25 hover:shadow-lift"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-brand-tint">
        <TripCover
          images={trip.images}
          alt={trip.name}
          sizes="(max-width: 768px) 100vw, 33vw"
          className="object-cover transition duration-500 group-hover:scale-[1.05]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />

        <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-bold text-brand-deep shadow-sm ring-1 ring-black/5 backdrop-blur-sm">
          <Star
            className="h-3.5 w-3.5 fill-brand-secondary text-brand-secondary"
            aria-hidden
          />
          {tripCategoryLabel(trip.category)}
        </span>

        <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-brand-deep/90 px-3 py-1.5 text-xs font-extrabold text-white shadow-sm backdrop-blur-sm ring-1 ring-white/15">
          <CalendarDays className="h-3.5 w-3.5" aria-hidden />
          {formatDate(trip.date)}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-6">
        <h3 className="font-display text-xl font-bold leading-snug tracking-tight text-brand-ink line-clamp-2">
          {trip.name}
        </h3>
        <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-brand-muted">
          <MapPin className="h-4 w-4 shrink-0 text-brand-secondary" aria-hidden />
          <span className="min-w-0 truncate">{trip.destination}</span>
        </p>

        <div className="mt-auto flex items-end justify-between gap-3 pt-6">
          <p className="min-w-0">
            <span className="block text-xs font-medium uppercase tracking-wide text-brand-faint">
              a partir de
            </span>
            <span className="text-2xl font-extrabold tracking-tight text-brand-primary">
              {formatCurrency(trip.pricePerson)}
            </span>
          </p>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand-grad px-4 py-2.5 text-sm font-bold text-white shadow-sm transition duration-300 group-hover:shadow-md">
            Ver detalhes
            <ArrowRight
              className="h-4 w-4 transition duration-300 group-hover:translate-x-0.5"
              aria-hidden
            />
          </span>
        </div>
      </div>
    </Link>
  );
}