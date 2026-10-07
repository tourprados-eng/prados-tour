import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import { buildWhatsAppUrl, getContactProfile, messageForPurpose } from "@/lib/contact";
import { getSession } from "@/lib/auth/session";
import { SiteHeader, MobileNav } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { SellerTracker } from "@/components/layout/seller-tracker";
import {
  WhatsAppFloat,
  type WhatsAppFloatOption,
} from "@/components/layout/whatsapp-float";

// Depende de sessão autenticada e de dados dinâmicos do repositório; não é
// estático e não deve ser pré-renderizado em build.
export const dynamic = "force-dynamic";

export default async function ClienteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [store, session] = await Promise.all([
    getRepositoryRuntime().read(),
    getSession(),
  ]);
  const customerName = session?.fullName ?? "";

  // Cabeçalho e rodapé são atendimento comercial: apontam para o número de
  // Reservas e dúvidas. O botão flutuante abre uma escolha entre Reservas e
  // Suporte, cada opção com a finalidade correta e a mensagem adequada.
  const contactProfile = await getContactProfile();
  const reservasHref = contactProfile.reservas
    ? buildWhatsAppUrl(
        contactProfile.reservas.phone,
        messageForPurpose("reservas", customerName),
        contactProfile.reservas.countryCode,
      )
    : null;
  const suporteHref = contactProfile.suporte
    ? buildWhatsAppUrl(
        contactProfile.suporte.phone,
        messageForPurpose("suporte", customerName),
        contactProfile.suporte.countryCode,
      )
    : null;

  const whatsappOptions: WhatsAppFloatOption[] = [
    reservasHref
      ? {
          id: "reservas",
          title: "Reservas e dúvidas",
          description: "Quero informações sobre viagens",
          href: reservasHref,
        }
      : null,
    suporteHref
      ? {
          id: "suporte",
          title: "Suporte do site",
          description: "Preciso de ajuda com o site",
          href: suporteHref,
        }
      : null,
  ].filter((option): option is WhatsAppFloatOption => option !== null);

  return (
    <div className="relative flex min-h-dvh flex-col isolate">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-gradient-to-b from-brand-tint via-brand-tint/40 to-transparent"
      />
      <SiteHeader whatsappHref={reservasHref} />
      <SellerTracker validCodes={store.sellers.map((s) => s.code)} />
      <main className="min-w-0 flex-1 overflow-x-hidden">{children}</main>
      <SiteFooter
        brand={store.brand}
        whatsappHref={reservasHref}
        phoneFormatted={contactProfile.phoneFormatted}
      />
      <MobileNav />
      <WhatsAppFloat options={whatsappOptions} />
    </div>
  );
}