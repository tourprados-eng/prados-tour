import Image from "next/image";
import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import { getSession } from "@/lib/auth/session";
import {
  buildWhatsAppUrl,
  getContactProfile,
  messageForPurpose,
} from "@/lib/contact";
import { Button } from "@/components/ui/button";
import { ClientGalleryCarousel } from "@/components/gallery/client-gallery-carousel";
import { TripCard } from "@/components/trips/trip-card";
import { HomeHero } from "@/components/home/hero";
import {
  isPublicTripVisible,
  tripAvailabilityDate,
} from "@/lib/trips/availability";
import { DEMO_PASSWORD_HINT } from "@/lib/constants";

export default async function HomePage() {
  const [session, store] = await Promise.all([getSession(), getRepositoryRuntime().read()]);
  // Vitrine pública: só viagens publicadas, não excluídas e com data ainda
  // não vencida em São Paulo. Viagem de hoje continua válida o dia inteiro.
  const trips = store.trips.filter((t) => isPublicTripVisible(t));
  const featured = [...trips]
    .sort(
      (a, b) =>
        tripAvailabilityDate(a).localeCompare(tripAvailabilityDate(b)),
    )
    .slice(0, 3);
  const brand = store.brand;
  const profile = await getContactProfile();
  // CTA da home é atendimento comercial → Reservas e dúvidas.
  const whatsappHref = profile.reservas
    ? buildWhatsAppUrl(
        profile.reservas.phone,
        messageForPurpose("reservas", session?.fullName ?? ""),
        profile.reservas.countryCode,
      )
    : null;
  const banner = store.promoBanner;
  const clientGallery = store.galleryPhotos
    .filter((photo) => photo.status === "APROVADO" && photo.showOnHome)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((photo) => {
      const trip = photo.tripId
        ? store.trips.find((item) => item.id === photo.tripId)
        : null;

      return {
        id: photo.id,
        src: photo.url.startsWith("/")
          ? photo.url
          : `/api/gallery/public?id=${encodeURIComponent(photo.id)}`,
        label: trip?.name || "Experiência",
        caption: photo.caption,
      };
    });

  return (
    <div>
      {/* Hero — banner compartilhado com a Home */}
      <HomeHero brand={brand} signedIn={Boolean(session)} />

      {/* Banner de ofertas configurável */}
      {banner.active && (
        <section className="border-b border-brand-line bg-brand-tint">
          <div className="container-page flex flex-col items-center gap-6 py-8 md:flex-row md:py-10">
            <div className="min-w-0 flex-1 text-center md:text-left">
              <p className="eyebrow justify-center md:justify-start">
                {banner.subtitle || "Ofertas"}
              </p>
              <h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-brand-ink md:text-3xl">
                {banner.title}
              </h2>
              {banner.description && (
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-brand-muted">
                  {banner.description}
                </p>
              )}
              {banner.buttonLink && banner.buttonText && (
                <Button href={banner.buttonLink} className="mt-4">
                  {banner.buttonText}
                </Button>
              )}
            </div>
            {banner.imageUrl && (
              <div className="relative h-40 w-full max-w-sm overflow-hidden rounded-2xl shadow-card">
                <Image
                  src={banner.imageUrl}
                  alt={banner.title || "Ofertas"}
                  fill
                  sizes="(max-width: 768px) 100vw, 400px"
                  className="object-cover"
                />
              </div>
            )}
          </div>
        </section>
      )}

      {/* Próximas excursões */}
      <section className="section-pad">
        <div className="container-page">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <p className="eyebrow">Agenda</p>
              <h2 className="section-title mt-2">Próximas excursões</h2>
              <p className="section-lead">
                Destinos selecionados com vagas limitadas e embarque em pontos estratégicos.
              </p>
            </div>
            <Button href="/excursoes" variant="outline" className="self-start sm:self-auto">
              Ver todas
            </Button>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((trip) => (
              <TripCard key={trip.id} trip={trip} />
            ))}
          </div>
        </div>
      </section>

      {/* Galeria — fotos reais dos viajantes */}
      {clientGallery.length > 0 && (
        <section className="section-pad">
          <div className="container-page">
            <div className="max-w-xl">
              <p className="eyebrow">Momentos reais</p>
              <h2 className="section-title mt-2">
                Momentos dos nossos viajantes
              </h2>
              <p className="section-lead">
                Fotos compartilhadas por quem já viveu uma experiência com a{" "}
                {brand.companyName}.
              </p>
            </div>

            <ClientGalleryCarousel items={clientGallery} />
          </div>
        </section>
      )}

      {/* CTA final */}
      <section className="pb-16 md:pb-20">
        <div className="container-page">
          <div className="brand-panel px-6 py-12 sm:px-10 md:px-14 md:py-16">
            <div className="max-w-2xl">
              <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
                Pronto para a próxima saída?
              </h2>
              <p className="mt-3 text-base leading-relaxed text-white/90 md:text-lg">
                Escolha o destino, reserve sua vaga e embarque com{" "}
                {brand.companyName}.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button
                  href="/excursoes"
                  size="lg"
                  variant="white"
                  className="!bg-white !text-brand-primary hover:!bg-[#FFF8FB]"
                >
                  Reservar agora
                </Button>
                <Button
                  href={whatsappHref ?? "/contato"}
                  size="lg"
                  className="border border-white/50 bg-transparent text-white hover:bg-white/10 focus-visible:ring-white"
                >
                  Falar no WhatsApp
                </Button>
              </div>
            </div>
          </div>
          <p className="mt-6 text-center text-xs text-brand-faint">{DEMO_PASSWORD_HINT}</p>
        </div>
      </section>
    </div>
  );
}
