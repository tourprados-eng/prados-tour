import Link from "next/link";
import { MapPin, ArrowRight } from "lucide-react";
import type { Trip } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { TripCover } from "@/components/trips/trip-cover";

export function TripCard({ trip }: { trip: Trip }) {
  return (
    <Link
      href={`/excursoes/${trip.slug}`}
      className="group surface-card flex h-full min-w-0 flex-col overflow-hidden border border-brand-line transition duration-300 hover:-translate-y-1.5 hover:shadow-lift"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-brand-tint">
        <TripCover
          images={trip.images}
          alt={trip.name}
          sizes="(max-width: 768px) 100vw, 33vw"
          className="object-cover transition duration-500 group-hover:scale-[1.05]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent" />
        <span className="chip-brand absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-bold shadow-sm">
          {trip.category}
        </span>
        <span className="absolute bottom-3 right-3 rounded-full bg-white px-3 py-1.5 text-xs font-extrabold text-brand-ink shadow-sm backdrop-blur-sm">
          {formatDate(trip.date)}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display text-xl font-bold tracking-tight text-brand-ink line-clamp-2">
          {trip.name}
        </h3>
        <p className="mt-1.5 flex items-center gap-1.5 text-sm text-brand-muted">
          <MapPin className="h-4 w-4 shrink-0 text-brand-secondary" aria-hidden />
          <span className="min-w-0 truncate">{trip.destination}</span>
        </p>
        <div className="mt-auto flex items-end justify-between gap-3 pt-5">
          <p className="min-w-0">
            <span className="block text-xs font-medium text-brand-faint">a partir de</span>
            <span className="text-xl font-extrabold tracking-tight text-brand-primary">
              {formatCurrency(trip.pricePerson)}
            </span>
          </p>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand-primary px-4 py-2.5 text-sm font-bold text-white shadow-sm transition duration-300 group-hover:bg-brand-deep group-hover:shadow-md">
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