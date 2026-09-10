import { getPublicTrips } from "@/lib/booking/actions";
import { Button } from "@/components/ui/button";
import { TripCard } from "@/components/trips/trip-card";

export const metadata = { title: "Excursões" };

export default async function TripsPage() {
  const trips = await getPublicTrips();

  return (
    <div className="section-pad">
      <div className="container-page">
        <div className="max-w-2xl">
          <p className="eyebrow">Catálogo</p>
          <h1 className="section-title mt-2">Excursões</h1>
          <p className="section-lead">
            Escolha seu destino, veja embarques e reserve com pagamento seguro.
          </p>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {trips.map((trip) => (
            <TripCard key={trip.id} trip={trip} />
          ))}
        </div>

        {trips.length === 0 && (
          <div className="surface-card mt-10 p-8 text-center">
            <p className="text-[#6B5B63]">Nenhuma viagem publicada no momento.</p>
            <Button href="/" variant="outline" className="mt-4">
              Voltar ao início
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
