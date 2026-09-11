import { redirect } from "next/navigation";
import { getSession, canAccess } from "@/lib/auth/session";
import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export default async function OperationalPage() {
  const session = await getSession();
  if (!session || !canAccess(session.role, "operacional")) redirect("/login");
  const store = await getRepositoryRuntime().read();
  const trips = store.trips
    .filter((t) => !t.deletedAt && (t.status === "PUBLICADA" || t.status === "ESGOTADA"))
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">
        Painel operacional
      </h1>
      <p className="mt-2 text-black/60">Monitor/guia — sem acesso ao financeiro.</p>
      <div className="mt-6">
        <Button href="/check-in">Abrir check-in</Button>
      </div>
      <div className="mt-8 space-y-4">
        {trips.map((t) => {
          const bookings = store.bookings.filter(
            (b) => b.tripId === t.id && b.status === "CONFIRMADA",
          );
          const passengers = store.passengers.filter((p) =>
            bookings.some((b) => b.id === p.bookingId),
          );
          const checkins = store.checkins.filter((c) =>
            bookings.some((b) => b.id === c.bookingId),
          );
          const boarding = store.tripBoardingPoints
            .filter((x) => x.tripId === t.id)
            .map((x) => ({
              ...x,
              point: store.boardingPoints.find((b) => b.id === x.boardingPointId)!,
            }));
          return (
            <div key={t.id} className="rounded-3xl bg-white/90 p-5 ring-1 ring-black/5">
              <p className="font-bold">
                {t.name} · {formatDate(t.date)}
              </p>
              <p className="text-sm text-black/60">
                Passageiros: {passengers.length} · Check-ins: {checkins.length}
              </p>
              <ul className="mt-3 text-sm">
                {boarding.map((b) => (
                  <li key={b.id}>
                    {b.point.name} — {b.time}
                  </li>
                ))}
              </ul>
              <ul className="mt-3 divide-y divide-black/5 text-sm">
                {passengers.map((p) => {
                  const seat = store.seats.find((s) => s.id === p.seatId);
                  const done = store.checkins.some((c) => c.passengerId === p.id);
                  return (
                    <li key={p.id} className="flex justify-between py-2">
                      <span>
                        {p.name}
                        {seat ? ` · assento ${seat.seatNumber}` : ""}
                      </span>
                      <span className={done ? "text-emerald-600" : "text-black/45"}>
                        {done ? "Check-in OK" : "Pendente"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
