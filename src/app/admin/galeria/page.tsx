import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import { GalleryPhotoModerator } from "@/components/admin/gallery-photo-moderator";

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

export default async function AdminGalleryPage() {
  const store = await getRepositoryRuntime().read();

  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">
        Galeria
      </h1>

      <p className="mt-2 text-black/60">
        Fotos enviadas por clientes. Aprove, rejeite, exclua e defina quais
        fotos aprovadas podem aparecer na página inicial.
      </p>

      <div className="mt-8 space-y-3">
        {store.galleryPhotos.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-black/15 bg-white/60 p-8 text-center">
            <p className="text-sm text-black/55">
              Nenhuma foto recebida ainda.
            </p>
          </div>
        ) : (
          store.galleryPhotos.map((photo) => {
            const customer = photo.customerId
              ? store.profiles.find((p) => p.id === photo.customerId)
              : null;

            const trip = photo.tripId
              ? store.trips.find((t) => t.id === photo.tripId)
              : null;

            return (
              <div
                key={photo.id}
                className="flex flex-col gap-4 rounded-2xl bg-white/90 p-4 ring-1 ring-black/5 lg:flex-row lg:items-start lg:justify-between"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-4 sm:flex-row">
                  <div className="relative h-48 w-full shrink-0 overflow-hidden rounded-2xl bg-brand-tint sm:h-32 sm:w-44">
                    <img
                      src={`/api/gallery/view?id=${encodeURIComponent(photo.id)}`}
                      alt={photo.caption || "Foto enviada por cliente"}
                      className="h-full w-full object-cover"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-[#2F2328]">
                      {customer?.fullName ?? "Cliente"}
                    </p>

                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusColor[photo.status]}`}
                    >
                      {statusLabel[photo.status]}
                    </span>

                    {photo.showOnHome && (
                      <span className="rounded-full bg-[#FFF0F6] px-2 py-0.5 text-xs font-semibold text-[#E84C91]">
                        Exibida na Home
                      </span>
                    )}
                  </div>

                  <p className="mt-1 text-sm text-black/60">
                    {trip?.name ?? "Viagem não vinculada"} ·{" "}
                    {new Intl.DateTimeFormat("pt-BR").format(
                      new Date(photo.createdAt),
                    )}
                  </p>

                  {photo.caption && (
                    <p className="mt-2 text-sm text-black/75">
                      {photo.caption}
                    </p>
                  )}

                  <p className="mt-2 break-all text-xs text-black/35">
                    {photo.url}
                  </p>
                  </div>
                </div>

                <GalleryPhotoModerator
                  photoId={photo.id}
                  status={photo.status}
                  showOnHome={photo.showOnHome}
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
