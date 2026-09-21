import Image from "next/image";
import { ShieldCheck, Bus, Ticket, HeartHandshake, Check } from "lucide-react";
import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import { getSession } from "@/lib/auth/session";
import { buildWhatsAppUrl } from "@/lib/contact";
import { Button } from "@/components/ui/button";
import { ClientGalleryCarousel } from "@/components/gallery/client-gallery-carousel";
import { TripCard } from "@/components/trips/trip-card";
import { OffersGrid } from "@/components/promotions/offers-grid";
import { HomeHero } from "@/components/home/hero";
import { PublicReviewForm } from "@/components/reviews/public-review-form";
import { ReviewsCarousel } from "@/components/reviews/reviews-carousel";
import { DEMO_PASSWORD_HINT } from "@/lib/constants";

const benefits = [
  {
    icon: Bus,
    number: "01",
    title: "Embarque organizado",
    text: "Pontos e horários claros, com monitor acompanhando cada saída.",
    highlight: "Mais tranquilidade para sua viagem",
    image: "/images/beneficio-embarque.jpg",
  },
  {
    icon: Ticket,
    number: "02",
    title: "Reserva e voucher digital",
    text: "Reserve online, pague no PIX ou parcelado e leve o QR Code no celular.",
    highlight: "Praticidade do início ao embarque",
    image: "/images/beneficio-voucher.png",
  },
  {
    icon: ShieldCheck,
    number: "03",
    title: "Segurança em cada etapa",
    text: "Confirmação real de pagamento, vagas controladas e check-in na viagem.",
    highlight: "Viagem segura e sem preocupações",
    image: "/images/beneficio-seguranca.jpg",
  },
  {
    icon: HeartHandshake,
    number: "04",
    title: "Atendimento próximo",
    text: "Equipe pronta para orientar antes, durante e depois da excursão.",
    highlight: "Sempre com você em cada destino",
    image: "/images/beneficio-atendimento.jpg",
  },
];

export default async function HomePage() {
  const [session, store] = await Promise.all([getSession(), getRepositoryRuntime().read()]);
  const trips = store.trips.filter((t) => t.status === "PUBLICADA" && !t.deletedAt);
  const featured = [...trips]
    .filter((trip) => new Date(trip.date).getTime() >= Date.now())
    .sort(
      (a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime(),
    )
    .slice(0, 3);
  const brand = store.brand;
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

  // Avaliações aprovadas E com visibilidade na Home habilitada — mais
  // recentes primeiro. Comentários vazios não são exibidos no carrossel.
  const approvedReviews = [...store.reviews]
    .filter(
      (review) =>
        review.status === "APROVADO" &&
        review.showOnHome &&
        (review.comment ?? "").trim().length > 0,
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 9)
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

  const reviewTrips = trips
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(({ id, name }) => ({ id, name }));

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

      {/* Ofertas */}
      <section className="border-y border-brand-line bg-white section-pad">
        <div className="container-page">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="eyebrow">Destaques</p>
              <h2 className="section-title mt-2">Ofertas da semana</h2>
              <p className="section-lead">
                Condições especiais para você viajar mais.
              </p>
            </div>
            <Button href="/ofertas" variant="soft">
              Ver ofertas
            </Button>
          </div>

          <div className="mt-10">
            <OffersGrid trips={trips} />
          </div>
        </div>
      </section>

      {/* Benefícios */}
      <section
        className="relative overflow-hidden bg-[#f8dce8] bg-cover bg-center bg-no-repeat section-pad"
        style={{ backgroundImage: 'url("/images/fundo-beneficios.png")' }}
      >
        <div className="container-page relative">
          <div className="mx-auto max-w-3xl text-center">
            <p className="eyebrow justify-center">Por que escolher</p>
            <h2 className="mt-2 font-display text-3xl font-bold leading-tight tracking-tight text-brand-ink sm:text-4xl md:text-5xl">
              Benefícios de viajar com a{" "}
              <span className="text-brand-primary">{brand.companyName}</span>
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-brand-muted md:text-lg">
              Do primeiro clique ao check-in, tudo pensado para uma experiência tranquila.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {benefits.map((item) => (
              <article
                key={item.title}
                className="group relative flex min-h-[545px] flex-col overflow-hidden rounded-[2rem] border border-white/80 bg-white shadow-[0_12px_35px_rgba(93,29,57,0.10)] transition duration-500 hover:-translate-y-2 hover:shadow-[0_20px_45px_rgba(93,29,57,0.16)]"
              >
                <div className="relative z-10 p-6 pb-5">
                  <span className="inline-flex h-10 min-w-10 items-center justify-center rounded-xl bg-[#fde2ed] px-3 text-sm font-extrabold text-brand-primary shadow-sm">
                    {item.number}
                  </span>

                  <div className="mt-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#fde7ef] text-brand-primary shadow-[0_6px_18px_rgba(232,76,145,0.12)] transition duration-500 group-hover:scale-105 group-hover:bg-brand-primary group-hover:text-white">
                    <item.icon className="h-7 w-7" strokeWidth={1.8} aria-hidden />
                  </div>

                  <h3 className="mt-5 min-h-[3.5rem] font-display text-xl font-bold leading-tight tracking-tight text-brand-ink">
                    {item.title}
                  </h3>

                  <p className="mt-3 text-sm leading-relaxed text-brand-muted">
                    {item.text}
                  </p>

                  <div className="mt-5 flex items-center gap-3 rounded-2xl bg-[#fde7ef] px-4 py-3.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-primary to-brand-secondary text-white shadow-sm">
                      <Check className="h-4 w-4" strokeWidth={3} aria-hidden />
                    </span>
                    <span className="text-sm font-semibold leading-snug text-brand-ink">
                      {item.highlight}
                    </span>
                  </div>
                </div>

                <div className="relative mt-auto h-[205px] overflow-hidden">
                  <Image
                    src={item.image}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    className="object-cover transition duration-700 group-hover:scale-105"
                  />

                  <svg
                    aria-hidden="true"
                    className="absolute -top-1 left-0 h-16 w-full"
                    viewBox="0 0 500 80"
                    preserveAspectRatio="none"
                  >
                    <path
                      d="M0 42C75 70 115 8 190 30C270 55 315 5 385 25C435 40 465 30 500 5V0H0Z"
                      fill="white"
                    />
                  </svg>

                  <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
                </div>
              </article>
            ))}
          </div>

          <div className="mx-auto mt-10 flex max-w-4xl flex-wrap items-center justify-center gap-x-8 gap-y-4 rounded-3xl border border-white/70 bg-white/65 px-6 py-5 shadow-sm backdrop-blur-sm">
            <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-brand-ink">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#fde2ed] text-brand-primary">
                <HeartHandshake className="h-4 w-4" aria-hidden />
              </span>
              Experiências reais
            </span>
            <span className="hidden h-7 w-px bg-brand-primary/15 sm:block" />
            <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-brand-ink">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#fde2ed] text-brand-primary">
                <Bus className="h-4 w-4" aria-hidden />
              </span>
              Viagens em grupo
            </span>
            <span className="hidden h-7 w-px bg-brand-primary/15 sm:block" />
            <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-brand-ink">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#fde2ed] text-brand-primary">
                <HeartHandshake className="h-4 w-4" aria-hidden />
              </span>
              Conexões para a vida toda
            </span>
          </div>

          {/* Ondas decorativas na transição para avaliações */}
          <div
            aria-hidden="true"
            className="pointer-events-none relative left-1/2 mt-10 w-screen -translate-x-1/2"
          >
            <svg
              className="block h-24 w-full"
              viewBox="0 0 1440 120"
              preserveAspectRatio="none"
              fill="none"
            >
              <path
                d="M0 68C180 125 300 15 500 62C700 109 805 18 1000 55C1170 87 1300 45 1440 18V120H0Z"
                fill="white"
                fillOpacity="0.72"
              />
              <path
                d="M0 90C190 135 330 38 520 80C720 124 860 38 1040 72C1200 102 1310 72 1440 42V120H0Z"
                fill="#E84C91"
                fillOpacity="0.10"
              />
              <path
                d="M0 105C190 145 350 72 540 101C760 135 900 70 1080 94C1230 114 1340 95 1440 76V120H0Z"
                fill="#F28C28"
                fillOpacity="0.12"
              />
            </svg>
          </div>
        </div>
      </section>

      {/* Depoimentos */}
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
                  href={buildWhatsAppUrl(brand.whatsapp, brand.whatsappMessage)}
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
