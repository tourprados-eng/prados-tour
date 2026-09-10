import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import TripForm from "@/components/admin/trip-form";

export default async function AdminTripsPage() {
  const store = await getRepositoryRuntime().read();

  return (
    <div className="mx-auto w-full max-w-[1500px]">
      <TripForm boardingPoints={store.boardingPoints.filter((p) => p.active)} />
    </div>
  );
}
