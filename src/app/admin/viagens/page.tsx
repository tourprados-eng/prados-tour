import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import TripForm from "@/components/admin/trip-form";
import DeleteTripButton from "@/components/admin/delete-trip-button";
import EditTripButton from "@/components/admin/edit-trip-button";
import ArchiveTripButton from "@/components/admin/archive-trip-button";
import { formatCurrency } from "@/lib/utils";

const tripStatusLabels: Record<string, string> = {
  RASCUNHO: "Rascunho",
  PUBLICADA: "Publicada",
  ESGOTADA: "Esgotada",
  CANCELADA: "Cancelada",
  FINALIZADA: "Finalizada",
  ARQUIVADA: "Arquivada",
};

function tripStatusClass(status: string) {
  const classes: Record<string, string> = {
    RASCUNHO: "bg-gray-50 text-gray-700 ring-gray-200",
    PUBLICADA: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    ESGOTADA: "bg-amber-50 text-amber-700 ring-amber-200",
    CANCELADA: "bg-red-50 text-red-700 ring-red-200",
    FINALIZADA: "bg-blue-50 text-blue-700 ring-blue-200",
    ARQUIVADA: "bg-violet-50 text-violet-700 ring-violet-200",
  };

  return classes[status] || "bg-gray-50 text-gray-700 ring-gray-200";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR").format(new Date(value));
}

export default async function AdminTripsPage() {
  const store = await getRepositoryRuntime().read();

  const occupiedPerTrip: Record<string, number> = {};
  for (const booking of store.bookings) {
    if (booking.status !== "PENDENTE" && booking.status !== "CONFIRMADA") continue;
    occupiedPerTrip[booking.tripId] =
      (occupiedPerTrip[booking.tripId] || 0) + booking.quantity;
  }

  const sorted = [...store.trips].sort((a, b) => {
    if (a.deletedAt && !b.deletedAt) return 1;
    if (!a.deletedAt && b.deletedAt) return -1;
    return a.date.localeCompare(b.date);
  });

  const active = sorted.filter((t) => !t.deletedAt);
  const excluded = sorted.filter((t) => t.deletedAt);

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-primary)]">
          Operação
        </p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-bold">
          Viagens e Excursões
        </h1>
        <p className="mt-2 text-black/55">
          Gerencie as viagens publicadas no site e cadastre novas opções.
        </p>
      </div>

      <div className="overflow-hidden rounded-3xl bg-white ring-1 ring-black/5">
        <div className="border-b border-black/5 px-6 py-5">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">
            Viagens cadastradas
          </h2>
          <p className="mt-1 text-sm text-black/50">
            Viagens excluídas aparecem identificadas como excluídas no fim da
            lista e preservam o histórico de reservas.
          </p>
        </div>

        {active.length === 0 && excluded.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="font-semibold">Nenhuma viagem cadastrada.</p>
            <p className="mt-1 text-sm text-black/50">
              Use o formulário abaixo para criar a primeira viagem.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">
              <thead className="bg-black/[0.025] text-xs uppercase tracking-wide text-black/45">
                <tr>
                  <th className="px-6 py-4">Viagem</th>
                  <th className="px-6 py-4">Data</th>
                  <th className="px-6 py-4">Preço</th>
                  <th className="px-6 py-4">Vagas</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Ações</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-black/5">
                {active.map((trip) => {
                  const occupied = occupiedPerTrip[trip.id] || 0;
                  return (
                    <tr key={trip.id} className="transition hover:bg-black/[0.018]">
                      <td className="px-6 py-5">
                        <p className="max-w-[280px] font-bold">{trip.name}</p>
                        <p className="mt-1 text-xs text-black/45">
                          {trip.destination}
                        </p>
                      </td>

                      <td className="px-6 py-5">
                        <p className="font-semibold">
                          {formatDate(`${trip.date}T12:00:00`)}
                        </p>
                        {trip.departureTime && (
                          <p className="mt-1 text-xs text-black/45">
                            Saída {trip.departureTime}
                          </p>
                        )}
                      </td>

                      <td className="px-6 py-5">
                        <p className="font-bold">
                          {formatCurrency(trip.pricePerson)}
                        </p>
                        {trip.priceCouple && (
                          <p className="mt-1 text-xs text-black/45">
                            Casal: {formatCurrency(trip.priceCouple)}
                          </p>
                        )}
                      </td>

                      <td className="px-6 py-5">
                        <span className="font-semibold">
                          {occupied}/{trip.totalSeats}
                        </span>
                        <span className="text-black/45"> ocupadas</span>
                      </td>

                      <td className="px-6 py-5">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ring-1 ${tripStatusClass(
                            trip.status,
                          )}`}
                        >
                          {tripStatusLabels[trip.status] || trip.status}
                        </span>
                      </td>

                      <td className="px-6 py-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <EditTripButton tripId={trip.id} />
                          <ArchiveTripButton
                            tripId={trip.id}
                            tripName={trip.name}
                            archived={trip.status === "ARQUIVADA"}
                          />
                          <DeleteTripButton tripId={trip.id} tripName={trip.name} />
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {excluded.map((trip) => {
                  const occupied = occupiedPerTrip[trip.id] || 0;
                  return (
                    <tr
                      key={trip.id}
                      className="bg-black/[0.015] opacity-70 transition hover:opacity-90"
                    >
                      <td className="px-6 py-5">
                        <p className="max-w-[280px] font-bold">
                          {trip.name}
                          <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-600 ring-1 ring-red-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                            Excluída
                          </span>
                        </p>
                        <p className="mt-1 text-xs text-black/45">
                          {trip.destination}
                        </p>
                      </td>

                      <td className="px-6 py-5">
                        <p className="font-semibold">
                          {formatDate(`${trip.date}T12:00:00`)}
                        </p>
                      </td>

                      <td className="px-6 py-5">
                        <p className="font-bold">
                          {formatCurrency(trip.pricePerson)}
                        </p>
                      </td>

                      <td className="px-6 py-5">
                        <span className="font-semibold">
                          {occupied}/{trip.totalSeats}
                        </span>
                        <span className="text-black/45"> ocupadas</span>
                      </td>

                      <td className="px-6 py-5">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ring-1 ${tripStatusClass(
                            trip.status,
                          )}`}
                        >
                          {tripStatusLabels[trip.status] || trip.status}
                        </span>
                      </td>

                      <td className="px-6 py-5 text-right" />
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">
          Nova viagem
        </h2>
        <p className="mt-1 text-sm text-black/50">
          Preencha os dados abaixo para publicar uma nova viagem no site.
        </p>
        <div className="mt-4">
          <TripForm
            boardingPoints={store.boardingPoints.filter((p) => p.active)}
          />
        </div>
      </div>
    </div>
  );
}