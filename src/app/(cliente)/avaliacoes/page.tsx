import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import { PublicReviewForm } from "@/components/reviews/public-review-form";
import { ReviewsCarousel } from "@/components/reviews/reviews-carousel";

export const metadata = { title: "Avaliações" };

export default async function ReviewsPage() {
  const store = await getRepositoryRuntime().read();
  const brand = store.brand;

  // Avaliações aprovadas pela moderação, mais recentes primeiro. Comentários
  // vazios não são exibidos.
  const approvedReviews = [...store.reviews]
    .filter(
      (review) =>
        review.status === "APROVADO" &&
        (review.comment ?? "").trim().length > 0,
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((review) => {
      const trip = store.trips.find((item) => item.id === review.tripId);
      const reviewer = review.customerId
        ? store.profiles.find((profile) => profile.id === review.customerId)
        : null;
      return {
        id: `review-${review.id}`,
        name: review.authorName ?? reviewer?.fullName ?? "Cliente",
        trip: trip?.name ?? "",
        rating: review.rating,
        text: review.comment,
      };
    });

  // Lista do formulário de avaliação: aqui viagens JÁ REALIZADAS devem
  // aparecer — a avaliação é escrita depois da viagem. Usa a lista completa
  // de publicadas, não a vitrine filtrada por data.
  const reviewTrips = store.trips
    .filter((t) => t.status === "PUBLICADA" && !t.deletedAt)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(({ id, name }) => ({ id, name }));

  return (
    <section className="bg-brand-ink section-pad text-white">
      <div className="container-page">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-secondary">
              Avaliações
            </p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight md:text-4xl">
              Quem viaja, recomenda
            </h2>
          </div>
          <PublicReviewForm trips={reviewTrips} />
        </div>

        {approvedReviews.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-sm leading-relaxed text-white/60 backdrop-blur-sm">
            Ainda não há avaliações publicadas. Seja o primeiro a compartilhar
            sua experiência com a {brand.companyName}.
          </div>
        ) : (
          <ReviewsCarousel reviews={approvedReviews} />
        )}
      </div>
    </section>
  );
}
