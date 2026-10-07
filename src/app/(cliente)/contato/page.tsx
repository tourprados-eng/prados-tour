import {
  buildWhatsAppUrl,
  formatPhoneBR,
  getContactProfile,
  messageForPurpose,
} from "@/lib/contact";
import { getSession } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import type { Contact, ContactKind } from "@/types";

export const metadata = { title: "Contato" };

const KIND_LABEL: Record<ContactKind, string> = {
  whatsapp: "WhatsApp",
  email: "E-mail",
  telefone: "Telefone",
};

export default async function ContactPage() {
  const session = await getSession();
  const customerName = session?.fullName ?? "";
  const profile = await getContactProfile();

  // Os contatos cadastrados no Admin vêm primeiro. O e-mail e o Instagram
  // continuam vindo das settings da marca, como antes.
  const cards = profile.contacts.map((contact) => ({
    key: contact.id,
    label: contact.name || KIND_LABEL[contact.kind],
    sublabel: KIND_LABEL[contact.kind],
    value: contactDisplayValue(contact),
    href: contactHref(contact, customerName),
  }));

  const rows = [
    ...cards,
    ...(profile.email && !cards.some((c) => c.sublabel === "E-mail")
      ? [{ key: "brand-email", label: "E-mail", sublabel: KIND_LABEL.email, value: profile.email, href: `mailto:${profile.email}` }]
      : []),
    ...(profile.instagram
      ? [
          {
            key: "brand-instagram",
            label: "Instagram",
            sublabel: KIND_LABEL.email,
            value: `@${profile.instagram}`,
            href: `https://instagram.com/${profile.instagram}`,
          },
        ]
      : []),
  ];

  return (
    <div className="section-pad">
      <div className="container-page max-w-3xl">
        <p className="eyebrow">Atendimento</p>
        <h1 className="section-title mt-2">Contato</h1>
        <p className="section-lead">
          Tire dúvidas sobre destinos, reservas, pagamentos ou embarque — ou
          fale com o suporte do site, se estiver precisando de ajuda.
        </p>

        <div className="surface-card mt-10 space-y-5 p-6 md:p-8">
          {rows.map((row) => (
            <Row key={row.key} label={row.label} value={row.value} href={row.href} />
          ))}

          <div className="flex flex-wrap gap-3 pt-2">
            {profile.reservas
              ? (
                <Button
                  href={buildWhatsAppUrl(
                    profile.reservas.phone,
                    messageForPurpose("reservas", customerName),
                    profile.reservas.countryCode,
                  )}
                  size="lg"
                >
                  Reservas e dúvidas
                </Button>
              )
              : null}
            {profile.suporte
              ? (
                <Button
                  href={buildWhatsAppUrl(
                    profile.suporte.phone,
                    messageForPurpose("suporte", customerName),
                    profile.suporte.countryCode,
                  )}
                  size="lg"
                  variant="secondary"
                >
                  Suporte do site
                </Button>
              )
              : null}
            <Button href="/excursoes" variant="outline" size="lg">
              Ver excursões
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Valor mascarado/legível de cada canal. */
function contactDisplayValue(contact: Contact): string {
  if (contact.kind === "email") return contact.email ?? "";
  return formatPhoneBR(contact.phone);
}

function contactHref(contact: Contact, customerName: string): string {
  if (contact.kind === "email") return `mailto:${contact.email ?? ""}`;
  if (contact.kind === "telefone") return `tel:+${(contact.countryCode ?? "55")}${contact.phone ?? ""}`;
  return buildWhatsAppUrl(
    contact.phone,
    contact.kind === "whatsapp"
      ? messageForPurpose(contact.purpose, customerName) ||
        contact.autoMessage ||
        undefined
      : contact.autoMessage || undefined,
    contact.countryCode,
  );
}

function Row({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}) {
  const content = value || "—";
  return (
    <div className="flex flex-col gap-1 border-b border-brand-line pb-4 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm font-medium text-brand-faint">{label}</span>
      {href && value ? (
        <a
          href={href}
          target={href.startsWith("http") ? "_blank" : undefined}
          rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
          className="break-all text-base font-semibold text-brand-ink hover:underline"
        >
          {content}
        </a>
      ) : (
        <span className="break-all text-base font-semibold text-brand-ink">{content}</span>
      )}
    </div>
  );
}