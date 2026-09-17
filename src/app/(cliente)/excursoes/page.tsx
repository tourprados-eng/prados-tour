import { getPublicTrips } from "@/lib/booking/actions";
import { Button } from "@/components/ui/button";
import { TripCard } from "@/components/trips/trip-card";
import { TripCategoryFilter } from "@/components/trips/category-filter";
import { TRIP_CATEGORY_SET } from "@/lib/constants";

export const metadata = { title: "Excursões" };

export default async function TripsPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string }>;
}) {
  const { categoria } = await searchParams;
  const all = await getPublicTrips();

  const trips =
    categoria && TRIP_CATEGORY_SET.has(categoria)
      ? all.filter((t) => t.category === categoria)
      : all;

  return (
    <div className="section-pad min-h-full bg-gradient-to-b from-[#FFF7F2] via-[#FFF9F5] to-brand-tint">
      <div className="container-page">
        <div className="brand-panel -mt-4 px-6 py-10 sm:-mt-6 sm:px-10 sm:py-12 md:-mt-8 md:px-14 md:py-16">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-white/85">
            <span
              aria-hidden
              className="h-0.5 w-6 rounded-full bg-gradient-to-r from-brand-secondary to-white/80"
            />
            Catálogo
          </p>
          <h1 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            Excursões
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-white/90 sm:text-lg">
            Escolha seu destino, veja embarques e reserve com pagamento seguro.
          </p>
        </div>

        <div className="mt-8">
          <TripCategoryFilter />
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-7">
          {trips.map((trip) => (
            <TripCard key={trip.id} trip={trip} />
          ))}
        </div>

        {trips.length === 0 && (
          <div className="surface-card mt-12 p-8 text-center sm:p-10">
            <p className="text-brand-muted">
              Nenhuma excursão encontrada nesta categoria.
            </p>
            <Button href="/excursoes" variant="outline" className="mt-5">
              Ver todas
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}