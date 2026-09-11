import Image from "next/image";
import { ShieldCheck, Bus, Ticket, HeartHandshake, Star, Check } from "lucide-react";
import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import { buildWhatsAppUrl } from "@/lib/contact";
import { Button } from "@/components/ui/button";
import { TripCard } from "@/components/trips/trip-card";
import { OffersGrid } from "@/components/promotions/offers-grid";
import { DEMO_PASSWORD_HINT } from "@/lib/constants";

const benefits = [
  {
    icon: Bus,
    title: "Embarque organizado",
    text: "Pontos e horários claros, com monitor acompanhando cada saída.",
  },
  {
    icon: Ticket,
    title: "Reserva e voucher digital",
    text: "Reserve online, pague no PIX ou parcelado e leve o QR Code no celular.",
  },
  {
    icon: ShieldCheck,
    title: "Segurança em cada etapa",
    text: "Confirmação real de pagamento, vagas controladas e check-in na viagem.",
  },
  {
    icon: HeartHandshake,
    title: "Atendimento próximo",
    text: "Equipe pronta para orientar antes, durante e depois da excursão.",
  },
];

const testimonials = [
  {
    name: "Camila R.",
    trip: "Ilhabela",
    text: "Organização impecável do embarque ao retorno. Já quero a próxima saída.",
  },
  {
    name: "Bruno S.",
    trip: "Guarujá",
    text: "Reservei pelo site em minutos e o voucher no celular facilitou tudo.",
  },
  {
    name: "Larissa M.",
    trip: "Paraty",
    text: "Atendimento atencioso e viagem bem cuidada. Recomendo de verdade.",
  },
];

const trustItems = ["Pagamento seguro", "Voucher digital", "Vagas limitadas", "Check-in na viagem"];

export default async function HomePage() {
  const store = await getRepositoryRuntime().read();
  const trips = store.trips.filter((t) => t.status === "PUBLICADA" && !t.deletedAt);
  const featured = trips.slice(0, 3);
  const brand = store.brand;
  const banner = store.promoBanner;
  const gallery = [
    { src: "/images/guaruja.png", label: "Praias" },
    { src: "/images/paraty.png", label: "Cultura" },
    { src: brand.bannerUrl || "/images/guaruja.png", label: "Experiências" },
  ];

  return (
    <div>
      {/* Hero — brand gradient, beach vibes */}
      <section className="relative min-h-[min(92vh,880px)] overflow-hidden bg-brand-deep">
        <Image
          src={brand.bannerUrl || "/images/guaruja.png"}
          alt={`Excursões ${brand.companyName}`}
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-brand-deep/95 via-brand-primary/85 to-brand-secondary/50" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-brand-bg to-transparent" />

        <div className="container-page relative flex min-h-[min(92vh,880px)] flex-col justify-center py-16 md:py-20">
          <div className="max-w-2xl text-white">
            <div className="hero-enter flex items-center gap-3">
              <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/40 backdrop-blur-sm">
                <Image
                  src={brand.logoUrl}
                  alt={brand.companyName}
                  width={72}
                  height={72}
                  className="h-12 w-12 object-contain drop-shadow"
                  priority
                />
              </span>
              <p className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
                {brand.companyName}
              </p>
            </div>

            <h1 className="hero-enter-delay mt-7 font-display text-[2.35rem] font-bold leading-[1.08] tracking-tight sm:text-5xl md:text-[3.4rem]">
              Excursões com alegria, cuidado e segurança
            </h1>

            <p className="hero-enter-late mt-5 max-w-md text-base leading-relaxed text-white/90 sm:text-lg">
              {brand.siteTagline ||
                "Reserve praias, parques e bate-voltas com pagamento fácil e voucher digital."}
            </p>

            <p className="hero-enter-late mt-6 flex max-w-md items-center gap-3 font-display text-lg italic tracking-tight text-[#FFD9E8] sm:text-xl">
              <span
                aria-hidden
                className="h-8 w-1 shrink-0 rounded-full bg-gradient-to-b from-brand-primary to-brand-secondary"
              />
              Transformando quilômetros em histórias
            </p>

            <div className="hero-enter-late mt-8 flex flex-wrap gap-3">
              <Button href="/excursoes" size="lg" variant="primary">
                Ver excursões
              </Button>
              <Button
                href="/criar-conta"
                size="lg"
                className="border border-white/50 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20 focus-visible:ring-white"
              >
                Criar conta
              </Button>
            </div>

            <ul className="hero-enter-late mt-10 flex flex-wrap gap-2">
              {trustItems.map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-white/95 ring-1 ring-white/25 backdrop-blur-sm"
                >
                  <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

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
              <h2 className="section-title mt-2">Ofertas em destaque</h2>
              <p className="section-lead">
                Descontos e preços especiais aplicados automaticamente na
                reserva.
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
      <section className="section-pad">
        <div className="container-page">
          <div className="mx-auto max-w-2xl text-center">
            <p className="eyebrow justify-center">Por que escolher</p>
            <h2 className="section-title mt-2">Benefícios de viajar com a {brand.companyName}</h2>
            <p className="section-lead mx-auto">
              Do primeiro clique ao check-in, tudo pensado para uma experiência tranquila.
            </p>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {benefits.map((item) => (
              <div
                key={item.title}
                className="surface-card p-6 transition duration-300 hover:-translate-y-1 hover:shadow-lift"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-tint text-brand-primary shadow-sm">
                  <item.icon className="h-5 w-5" aria-hidden />
                </div>
                <h3 className="mt-4 font-display text-lg font-bold text-brand-ink">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-brand-muted">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Depoimentos */}
      <section className="bg-brand-ink section-pad text-white">
        <div className="container-page">
          <div className="max-w-xl">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-secondary">
              Avaliações
            </p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight md:text-4xl">
              Quem viaja, recomenda
            </h2>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {testimonials.map((item) => (
              <figure
                key={item.name}
                className="border-t-2 border-brand-primary bg-white/5 p-6 backdrop-blur-sm transition duration-300 hover:bg-white/10"
              >
                <div className="flex gap-1 text-brand-secondary" aria-label="5 estrelas">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-current" />
                  ))}
                </div>
                <blockquote className="mt-4 text-sm leading-relaxed text-white/85">
                  “{item.text}”
                </blockquote>
                <figcaption className="mt-5 text-sm">
                  <span className="font-semibold text-white">{item.name}</span>
                  <span className="text-white/50"> · {item.trip}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* Galeria */}
      <section className="section-pad">
        <div className="container-page">
          <div className="max-w-xl">
            <p className="eyebrow">Experiências</p>
            <h2 className="section-title mt-2">Galeria de momentos</h2>
            <p className="section-lead">
              Praias, centros históricos e dias especiais com a cara de{" "}
              {brand.companyName}.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {gallery.map((item, index) => (
              <div
                key={`${item.src}-${index}`}
                className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-brand-tint shadow-card transition duration-300 hover:shadow-lift sm:aspect-[5/4] md:aspect-[4/5]"
              >
                <Image
                  src={item.src}
                  alt={item.label}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-4 pt-16">
                  <p className="text-sm font-semibold text-white">{item.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

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