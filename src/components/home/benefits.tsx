import Image from "next/image";
import { ShieldCheck, Bus, Ticket, HeartHandshake, Check } from "lucide-react";

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

/**
 * Seção institucional de benefícios. Originalmente exibida na Home; agora
 * aparece na página /sobre (conteúdo institucional) preservando o layout,
 * as imagens e os estilos originais.
 */
export function BenefitsSection({ companyName }: { companyName: string }) {
  return (
    <section
      className="relative overflow-hidden bg-[#f8dce8] bg-cover bg-center bg-no-repeat section-pad"
      style={{ backgroundImage: 'url("/images/fundo-beneficios.png")' }}
    >
      <div className="container-page relative">
        <div className="mx-auto max-w-3xl text-center">
          <p className="eyebrow justify-center">Por que escolher</p>
          <h2 className="mt-2 font-display text-3xl font-bold leading-tight tracking-tight text-brand-ink sm:text-4xl md:text-5xl">
            Benefícios de viajar com a{" "}
            <span className="text-brand-primary">{companyName}</span>
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

        {/* Ondas decorativas */}
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
  );
}
