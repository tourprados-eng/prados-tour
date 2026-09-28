import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import { collectPassengerIssuesForQuantity } from "@/lib/booking/passengers";
import { isPastTrip, PAST_TRIP_MESSAGE } from "@/lib/trips/availability";
import { PassengerCorrectionForm } from "@/components/booking/passenger-correction-form";

/**
 * Página de correção dos dados dos passageiros de uma reserva já criada.
 *
 * É o destino da notificação enviada quando o webhook recusa um pagamento por
 * passageiro incompleto: sem ela, o cliente é avisado mas não tem onde corrigir.
 */
export const dynamic = "force-dynamic";

const STAFF_ROLES = ["SUPER_ADMIN", "ADMIN", "FINANCEIRO", "VENDEDOR"];

export default async function PassengerCorrectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  const store = await getRepositoryRuntime().read();
  const booking = store.bookings.find((b) => b.id === id);
  if (!booking) notFound();

  const isOwner = booking.customerId === session.id;
  const isStaff = STAFF_ROLES.includes(session.role);
  if (!isOwner && !isStaff) notFound();

  const trip = store.trips.find((t) => t.id === booking.tripId);
  const passengers = store.passengers.filter((p) => p.bookingId === booking.id);

  let blockedReason: string | null = null;
  if (booking.status === "CONCLUIDA") {
    blockedReason = "Esta viagem já foi concluída e os dados não podem mais ser alterados.";
  } else if (trip && isPastTrip(trip)) {
    blockedReason = PAST_TRIP_MESSAGE;
  } else if (passengers.length !== booking.quantity) {
    blockedReason =
      "A lista de passageiros não bate com a reserva. Fale com o atendimento.";
  }

  const issues = collectPassengerIssuesForQuantity(passengers, booking.quantity);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold text-[#2F2328]">Dados dos passageiros</h1>
      <p className="mt-1 text-sm text-[#6B5B63]">Reserva {booking.reference}</p>

      {issues.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="font-semibold text-amber-900">Dados pendentes</p>
          <ul className="mt-2 list-inside list-disc text-sm text-amber-900">
            {issues.map((issue) => (
              <li key={`${issue.index}-${issue.field}`}>
                Passageiro {issue.index}: {issue.message}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          Todos os passageiros desta reserva estão com os dados completos.
        </div>
      )}

      <div className="mt-6">
        <PassengerCorrectionForm
          bookingId={booking.id}
          reference={booking.reference}
          canEdit={blockedReason === null}
          blockedReason={blockedReason}
          initial={passengers.map((p) => ({
            id: p.id,
            name: p.name ?? "",
            cpf: p.cpf ?? "",
            phone: p.phone ?? "",
            rg: p.rg ?? "",
            birthDate: p.birthDate ?? "",
            dataDeclaration: Boolean(p.dataDeclarationAt),
          }))}
        />
      </div>
    </main>
  );
}
