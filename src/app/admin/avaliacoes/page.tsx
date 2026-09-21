import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import {
  ReviewsManager,
  type ReviewRow,
} from "@/components/admin/reviews-manager";

export default async function AdminReviewsPage() {
  const store = await getRepositoryRuntime().read();
  const reviews = [...store.reviews].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );

  const rows: ReviewRow[] = reviews.map((r) => {
    const customer = store.profiles.find((p) => p.id === r.customerId);
    const trip = store.trips.find((t) => t.id === r.tripId);
    const reviewer = r.reviewedBy
      ? store.profiles.find((p) => p.id === r.reviewedBy)
      : null;
    return {
      id: r.id,
      author: r.authorName ?? customer?.fullName ?? "Cliente",
      trip: trip?.name ?? "Viagem",
      rating: r.rating,
      comment: r.comment ?? "",
      status: r.status,
      showOnHome: r.showOnHome ?? false,
      createdAt: r.createdAt,
      reviewedAt: r.reviewedAt,
      reviewedByName: reviewer?.fullName ?? null,
      customerId: r.customerId,
    };
  });

  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">
        Avaliações
      </h1>
      <p className="mt-2 text-black/60">
        Avaliações enviadas por clientes. Aprove as adequadas e rejeite ou exclua
        as que não respeitam as regras da comunidade. Avaliações aprovadas
        aparecem automaticamente na página inicial.
      </p>

      <div className="mt-8">
        <ReviewsManager reviews={rows} />
      </div>
    </div>
  );
}