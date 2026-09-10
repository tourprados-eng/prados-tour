import Image from "next/image";
import Link from "next/link";
import type { Trip } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils";

export function TripCard({ trip }: { trip: Trip }) {
  return (
    <Link
      href={`/excursoes/${trip.slug}`}
      className="group surface-card flex h-full min-w-0 flex-col overflow-hidden transition duration-300 hover:-translate-y-1 hover:shadow-[0_12px_40px_rgb(47_35_40/8%)]"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-[#F3EEF0]">
        <Image
          src={trip.images[0] || "/images/guaruja.png"}
          alt={trip.name}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          className="object-cover transition duration-500 group-hover:scale-[1.04]"
        />
        <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-xs font-bold text-[#F28C28] shadow-sm">
          {trip.category}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display text-xl font-bold tracking-tight text-[#2F2328] line-clamp-2">
          {trip.name}
        </h3>
        <p className="mt-1.5 text-sm text-[#6B5B63] line-clamp-2">
          {formatDate(trip.date)} · {trip.destination}
        </p>
        <div className="mt-auto flex items-end justify-between gap-3 pt-5">
          <p className="min-w-0">
            <span className="block text-xs font-medium text-[#8A7A82]">a partir de</span>
            <span className="text-lg font-bold text-[#E84C91]">
              {formatCurrency(trip.pricePerson)}
            </span>
          </p>
          <span className="shrink-0 text-sm font-semibold text-[#2F2328] transition group-hover:text-[#E84C91]">
            Ver detalhes →
          </span>
        </div>
      </div>
    </Link>
  );
}
