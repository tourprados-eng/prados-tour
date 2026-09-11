import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSession, canAccess } from "@/lib/auth/session";
import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import TripForm from "@/components/admin/trip-form";

export const metadata: Metadata = {
  title: "Editar Viagem | Prado's Tour Admin",
};

export default async function AdminEditTripPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session || !canAccess(session.role, "admin")) redirect("/login");

  const { id } = await params;
  const store = await getRepositoryRuntime().read();

  const trip = store.trips.find((t) => t.id === id);
  if (!trip || trip.deletedAt) notFound();

  const tripBoardingPoints = store.tripBoardingPoints.filter(
    (link) => link.tripId === trip.id,
  );

  const associatedIds = new Set(
    tripBoardingPoints.map((link) => link.boardingPointId),
  );

  // Inclui os pontos ativos e qualquer ponto associado à viagem mesmo que
  // ele tenha sido desativado depois — assim a edição preserva o vínculo.
  const boardingPoints = store.boardingPoints.filter(
    (point) => point.active || associatedIds.has(point.id),
  );

  return (
    <TripForm
      boardingPoints={boardingPoints}
      trip={trip}
      tripBoardingPoints={tripBoardingPoints}
    />
  );
}