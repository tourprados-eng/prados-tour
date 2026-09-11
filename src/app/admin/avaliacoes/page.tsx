import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import { ReviewModerator } from "@/components/admin/review-moderator";

const statusLabel: Record<string, string> = {
  PENDENTE: "Pendente",
  APROVADO: "Aprovada",
  REJEITADO: "Rejeitada",
};

const statusColor: Record<string, string> = {
  PENDENTE: "bg-amber-100 text-amber-800",
  APROVADO: "bg-emerald-100 text-emerald-800",
  REJEITADO: "bg-rose-100 text-rose-800",
};

function stars(rating: number) {
  return "★".repeat(rating) + "☆".repeat(5 - rating);
}

export default async function AdminReviewsPage() {
  const store = await getRepositoryRuntime().read();

  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">
        Avaliações
      </h1>
      <p className="mt-2 text-black/60">
        Avaliações enviadas por clientes. Aprove as adequadas e rejeite ou exclua
        as que não respeitam as regras da comunidade.
      </p>

      <div className="mt-8 space-y-3">
        {store.reviews.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-black/15 bg-white/60 p-8 text-center">
            <p className="text-sm text-black/55">
              Nenhuma avaliação recebida ainda.
            </p>
          </div>
        ) : (
          store.reviews.map((r) => {
            const customer = store.profiles.find((p) => p.id === r.customerId);
            const trip = store.trips.find((t) => t.id === r.tripId);
            return (
              <div
                key={r.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-2xl bg-white/90 p-4 ring-1 ring-black/5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-[#2F2328]">
                      {customer?.fullName ?? "Cliente"}
                    </p>
                    <span className="text-amber-500">{stars(r.rating)}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusColor[r.status]}`}
                    >
                      {statusLabel[r.status]}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-black/60">
                    {trip?.name ?? "Viagem"} ·{" "}
                    {new Intl.DateTimeFormat("pt-BR").format(
                      new Date(r.createdAt),
                    )}
                  </p>
                  {r.comment && (
                    <p className="mt-2 text-sm text-black/75">{r.comment}</p>
                  )}
                </div>
                <ReviewModerator reviewId={r.id} status={r.status} />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}