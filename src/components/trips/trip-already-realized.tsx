import { CalendarX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatTripDepartureDate } from "@/lib/utils";
import { PAST_TRIP_MESSAGE } from "@/lib/trips/availability";
import type { Trip } from "@/types";

/**
 * Página de uma viagem que já foi realizada.
 *
 * Existe para o caso de URL antiga (link compartilhado, favoritos, busca)
 * e para deixar explícito que a venda encerrou — sem expor preço, pontos de
 * embarque, avaliação nem qualquer caminho que inicie uma reserva.
 *
 * A viagem continua no banco e visível no Admin: esta tela é apenas a
 * representação pública de um evento que já aconteceu.
 */
export function TripAlreadyRealized({ trip }: { trip: Trip }) {
  return (
    <div className="section-pad min-h-full bg-gradient-to-b from-[#FFF7F2] via-[#FFF9F5] to-brand-tint">
      <div className="container-page">
        <div className="mx-auto max-w-2xl rounded-3xl bg-white/90 p-8 text-center shadow-sm ring-1 ring-black/5 md:p-12">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-brand-tint text-brand-primary">
            <CalendarX className="h-8 w-8" aria-hidden />
          </span>

          <h1 className="mt-6 font-display text-2xl font-bold tracking-tight text-brand-ink md:text-3xl">
            {trip.name}
          </h1>

          <p className="mt-1 text-sm text-brand-muted">
            {formatTripDepartureDate(trip)}
          </p>

          <p className="mt-6 text-base leading-relaxed text-brand-ink/80">
            {PAST_TRIP_MESSAGE}
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button href="/excursoes" className="w-full sm:w-auto">
              Ver próximas viagens
            </Button>

            <Button
              href="/minhas-viagens"
              variant="outline"
              className="w-full sm:w-auto"
            >
              Minhas viagens
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
