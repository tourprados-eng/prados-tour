import {
  buildWhatsAppUrl,
  formatPhoneBR,
  getContactProfile,
  messageForPurpose,
} from "@/lib/contact";
import { getSession } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { WhatsAppIcon } from "@/components/layout/whatsapp-icon";
import { cn } from "@/lib/utils";
import type { Contact } from "@/types";

export const metadata = { title: "Contato" };

type ServiceCard = {
  key: string;
  title: string;
  tagline: string;
  description: string;
  action: string;
  accent: "reservas" | "suporte";
  contact: Contact;
  href: string;
};

export default async function ContactPage() {
  const session = await getSession();
  const customerName = session?.fullName ?? "";
  const profile = await getContactProfile();

  const cards: ServiceCard[] = [];
  if (profile.reservas) {
    cards.push({
      key: "reservas",
      title: "Reservas e dúvidas",
      tagline: "Valores · Disponibilidade · Dúvidas de viagem",
      description:
        "Quer reservar uma viagem, consultar valores, disponibilidade ou tirar dúvidas sobre nossos passeios?",
      action: "Falar com Reservas",
      accent: "reservas",
      contact: profile.reservas,
      href: buildWhatsAppUrl(
        profile.reservas.phone,
        messageForPurpose("reservas", customerName),
        profile.reservas.countryCode,
      ),
    });
  }
  if (profile.suporte) {
    cards.push({
      key: "suporte",
      title: "Suporte do site",
      tagline: "Ajuda com o funcionamento do site",
      description:
        "Está com dificuldade para usar o site, fazer uma compra ou precisa de ajuda com alguma função?",
      action: "Falar com Suporte",
      accent: "suporte",
      contact: profile.suporte,
      href: buildWhatsAppUrl(
        profile.suporte.phone,
        messageForPurpose("suporte", customerName),
        profile.suporte.countryCode,
      ),
    });
  }

  const channels = [
    profile.email
      ? { key: "email", label: "E-mail", value: profile.email, href: `mailto:${profile.email}` }
      : null,
    profile.instagram
      ? {
          key: "instagram",
          label: "Instagram",
          value: `@${profile.instagram}`,
          href: `https://instagram.com/${profile.instagram}`,
        }
      : null,
  ].filter((c): c is { key: string; label: string; value: string; href: string } => c !== null);

  return (
    <div className="section-pad">
      <div className="container-page max-w-5xl">
        <header className="text-center">
          <p className="eyebrow">Atendimento</p>
          <h1 className="section-title mt-2">Fale com a Prado&apos;s Tour</h1>
          <p className="section-lead mx-auto max-w-xl">
            Escolha abaixo o atendimento que você precisa.
          </p>
        </header>

        <div className="mx-auto mt-10 grid max-w-4xl gap-5 md:grid-cols-2">
          {cards.map((card) => (
            <ServiceCard key={card.key} card={card} />
          ))}
        </div>

        {channels.length > 0 ? (
          <div className="mx-auto mt-8 max-w-4xl">
            <div className="surface-card flex flex-wrap items-center justify-center gap-x-8 gap-y-3 px-6 py-4 md:justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-brand-faint">
                Outros canais
              </p>
              {channels.map((channel) => (
                <a
                  key={channel.key}
                  href={channel.href}
                  className="flex items-center gap-1.5 text-sm font-semibold text-brand-muted transition hover:text-brand-primary"
                >
                  <span className="font-bold text-brand-ink">{channel.label}</span>
                  {channel.value}
                </a>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-8 text-center">
          <Button href="/excursoes" variant="outline" size="lg">
            Ver excursões
          </Button>
        </div>
      </div>
    </div>
  );
}

function ServiceCard({ card }: { card: ServiceCard }) {
  const isReservas = card.accent === "reservas";
  const phone = formatPhoneBR(card.contact.phone);

  return (
    <section
      className={cn(
        "surface-card relative flex flex-col overflow-hidden p-6 md:p-8",
        isReservas
          ? "ring-1 ring-brand-primary/20"
          : "ring-1 ring-brand-secondary/20",
      )}
    >
      <div
        aria-hidden
        className={cn(
          "absolute inset-x-0 top-0 h-1.5",
          isReservas ? "bg-brand-grad" : "bg-brand-secondary",
        )}
      />
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "grid h-12 w-12 shrink-0 place-items-center rounded-2xl",
            isReservas
              ? "bg-brand-primary/10 text-brand-primary"
              : "bg-brand-secondary/10 text-brand-secondary",
          )}
        >
          <WhatsAppIcon className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <h2 className="text-[17px] font-extrabold leading-tight tracking-tight text-brand-ink md:text-lg">
            {card.title}
          </h2>
          <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-brand-faint">
            {card.tagline}
          </p>
        </div>
      </div>

      <p className="mt-4 text-[15px] leading-relaxed text-brand-muted">
        {card.description}
      </p>

      <div className="mt-5 flex flex-1 flex-col">
        <Button
          href={card.href}
          size="lg"
          variant={isReservas ? "primary" : "secondary"}
          className="w-full"
        >
          {card.action}
        </Button>
        <a
          href={card.href}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 self-center text-xl font-extrabold tracking-tight text-brand-ink transition hover:text-brand-primary sm:self-start"
        >
          {phone}
        </a>
      </div>
    </section>
  );
}