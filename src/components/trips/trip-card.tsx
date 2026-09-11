import Image from "next/image";
import Link from "next/link";
import { MapPin, ArrowRight } from "lucide-react";
import type { Trip } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils";

export function TripCard({ trip }: { trip: Trip }) {
  return (
    <Link
      href={`/excursoes/${trip.slug}`}
      className="group surface-card flex h-full min-w-0 flex-col overflow-hidden transition duration-300 hover:-translate-y-1.5 hover:shadow-lift"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-brand-tint">
        <Image
          src={trip.images[0] || "/images/guaruja.png"}
          alt={trip.name}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          className="object-cover transition duration-500 group-hover:scale-[1.05]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
        <span className="chip-brand absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-bold shadow-sm">
          {trip.category}
        </span>
        <span className="absolute bottom-3 right-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-brand-ink backdrop-blur-sm">
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
            <span className="text-lg font-extrabold tracking-tight text-brand-primary">
              {formatCurrency(trip.pricePerson)}
            </span>
          </p>
          <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-brand-ink transition group-hover:text-brand-primary">
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