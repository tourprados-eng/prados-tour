import Image from "next/image";
import Link from "next/link";
import { ShieldCheck, Bus, Ticket, HeartHandshake, Star, MapPin } from "lucide-react";
import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TripCard } from "@/components/trips/trip-card";
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
    text: "Equipe Prado's Tour pronta para orientar antes, durante e depois da excursão.",
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

export default async function HomePage() {
  const store = await getRepositoryRuntime().read();
  const trips = store.trips.filter((t) => t.status === "PUBLICADA");
  const featured = trips.slice(0, 3);
  const offers = trips.filter((t) => t.priceCouple).slice(0, 3);
  const brand = store.brand;
  const gallery = [
    { src: "/images/guaruja.png", label: "Praias" },
    { src: "/images/paraty.png", label: "Cultura" },
    { src: brand.bannerUrl || "/images/guaruja.png", label: "Experiências" },
  ];

  return (
    <div>
      {/* Hero — brand first, light elegant composition */}
      <section className="relative min-h-[min(92vh,880px)] overflow-hidden bg-[#2F2328]">
        <Image
          src={brand.bannerUrl || "/images/guaruja.png"}
          alt="Excursões Prado's Tour"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-white via-white/92 to-white/25 md:via-white/88 md:to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#FAF7F8] via-transparent to-transparent md:hidden" />

        <div className="container-page relative flex min-h-[min(92vh,880px)] flex-col justify-center py-16 md:py-20">
          <div className="max-w-xl">
            <div className="hero-enter flex items-center gap-3">
              <Image
                src={brand.logoUrl}
                alt={brand.companyName}
                width={72}
                height={72}
                className="h-[4.5rem] w-[4.5rem] rounded-full object-cover shadow-lg shadow-[#E84C91]/15 ring-4 ring-white"
                priority
              />
              <p className="font-display text-2xl font-bold tracking-tight text-[#E84C91] sm:text-3xl">
                {brand.companyName}
              </p>
            </div>

            <h1 className="hero-enter-delay mt-7 font-display text-[2.35rem] font-bold leading-[1.08] tracking-tight text-[#2F2328] sm:text-5xl md:text-[3.4rem]">
              Excursões com alegria, cuidado e segurança
            </h1>

            <p className="hero-enter-late mt-5 max-w-md text-base leading-relaxed text-[#5C4B53] sm:text-lg">
              Reserve praias, parques e bate-voltas com pagamento fácil e voucher digital.
            </p>

            <div className="hero-enter-late mt-8 flex flex-wrap gap-3">
              <Button href="/excursoes" size="lg">
                Ver excursões
              </Button>
              <Button href="/criar-conta" size="lg" variant="outline">
                Criar conta
              </Button>
            </div>
          </div>
        </div>
      </section>

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
      <section className="border-y border-[#EBE4E7] bg-white section-pad">
        <div className="container-page">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="eyebrow">Destaques</p>
              <h2 className="section-title mt-2">Ofertas em destaque</h2>
              <p className="section-lead">
                Preço de dupla, cupom PRADOS10 e desconto especial no PIX à vista.
              </p>
            </div>
            <Button href="/ofertas" variant="soft">
              Ver ofertas
            </Button>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {offers.map((trip) => (
              <Link
                key={trip.id}
                href={`/excursoes/${trip.slug}`}
                className="surface-card group flex min-w-0 flex-col p-5 transition hover:border-[#E84C91]/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wide text-[#F28C28]">
                      Oferta dupla
                    </p>
                    <h3 className="mt-1 truncate font-display text-xl font-bold text-[#2F2328]">
                      {trip.name}
                    </h3>
                    <p className="mt-1 text-sm text-[#6B5B63]">{formatDate(trip.date)}</p>
                  </div>
                  <MapPin className="h-5 w-5 shrink-0 text-[#E84C91]" aria-hidden />
                </div>
                <div className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-sm text-[#8A7A82] line-through">
                    {formatCurrency(trip.pricePerson * 2)}
                  </span>
                  <span className="text-lg font-bold text-[#E84C91]">
                    {formatCurrency(trip.priceCouple!)}
                  </span>
                  <span className="text-xs font-medium text-[#6B5B63]">para 2 pessoas</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Benefícios */}
      <section className="section-pad">
        <div className="container-page">
          <div className="mx-auto max-w-2xl text-center">
            <p className="eyebrow justify-center">Por que escolher</p>
            <h2 className="section-title mt-2">Benefícios de viajar com a Prado&apos;s Tour</h2>
            <p className="section-lead mx-auto">
              Do primeiro clique ao check-in, tudo pensado para uma experiência tranquila.
            </p>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {benefits.map((item) => (
              <div key={item.title} className="surface-card p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FFF0F6] text-[#E84C91]">
                  <item.icon className="h-5 w-5" aria-hidden />
                </div>
                <h3 className="mt-4 font-display text-lg font-bold text-[#2F2328]">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#6B5B63]">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Depoimentos */}
      <section className="bg-[#2F2328] section-pad text-white">
        <div className="container-page">
          <div className="max-w-xl">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#F28C28]">
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
                className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm"
              >
                <div className="flex gap-1 text-[#F28C28]" aria-label="5 estrelas">
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
              Praias, centros históricos e dias especiais com a cara da Prado&apos;s Tour.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {gallery.map((item, index) => (
              <div
                key={`${item.src}-${index}`}
                className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-[#F3EEF0] sm:aspect-[5/4] md:aspect-[4/5]"
              >
                <Image
                  src={item.src}
                  alt={item.label}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent p-4 pt-16">
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
          <div className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-[#E84C91] to-[#F28C28] px-6 py-12 text-white sm:px-10 md:px-14 md:py-16">
            <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10" />
            <div className="pointer-events-none absolute -bottom-20 left-10 h-48 w-48 rounded-full bg-white/10" />
            <div className="relative max-w-2xl">
              <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
                Pronto para a próxima saída?
              </h2>
              <p className="mt-3 text-base leading-relaxed text-white/90 md:text-lg">
                Escolha o destino, reserve sua vaga e embarque com a Prado&apos;s Tour.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button
                  href="/excursoes"
                  size="lg"
                  variant="white"
                  className="!bg-white !text-[#E84C91] hover:!bg-[#FFF8FB]"
                >
                  Reservar agora
                </Button>
                <Button
                  href={`https://wa.me/${brand.whatsapp}`}
                  size="lg"
                  className="border border-white/50 bg-transparent text-white hover:bg-white/10 focus-visible:ring-white"
                >
                  Falar no WhatsApp
                </Button>
              </div>
            </div>
          </div>
          <p className="mt-6 text-center text-xs text-[#8A7A82]">{DEMO_PASSWORD_HINT}</p>
        </div>
      </section>
    </div>
  );
}
