import Image from "next/image";
import Link from "next/link";
import { buildWhatsAppUrl } from "@/lib/contact";
import type { BrandSettings } from "@/types";

const nav = [
  { href: "/", label: "Início" },
  { href: "/excursoes", label: "Excursões" },
  { href: "/ofertas", label: "Ofertas" },
  { href: "/sobre", label: "Sobre" },
  { href: "/contato", label: "Contato" },
  { href: "/login", label: "Área do cliente" },
];

export function SiteFooter({ brand }: { brand: BrandSettings }) {
  return (
    <footer className="mt-8">
      <div className="h-1.5 bg-gradient-to-r from-brand-primary via-brand-secondary to-brand-primary" />

      <div className="bg-white">
        <div className="container-page grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white ring-1 ring-brand-line shadow-sm">
                <Image
                  src={brand.logoUrl}
                  alt={brand.companyName}
                  width={48}
                  height={48}
                  className="h-10 w-10 object-contain"
                />
              </span>
              <div className="min-w-0">
                <p className="font-display truncate text-xl font-bold tracking-tight text-brand-ink">
                  {brand.companyName}
                </p>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-secondary">
                  Agência de viagens
                </p>
              </div>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-brand-muted">
              {brand.footerText ||
                "Praias, parques, day use e viagens especiais com reserva online, pagamento facilitado e voucher digital."}
            </p>
          </div>

          <div>
            <p className="text-sm font-bold tracking-tight text-brand-ink">Navegação</p>
            <ul className="mt-3 space-y-2">
              {nav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-brand-muted transition hover:text-brand-primary"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="min-w-0">
            <p className="text-sm font-bold tracking-tight text-brand-ink">Contato</p>
            <ul className="mt-3 space-y-2 text-sm text-brand-muted">
              <li className="break-all">WhatsApp: {brand.whatsapp}</li>
              {brand.phone ? <li className="break-all">Telefone: {brand.phone}</li> : null}
              <li className="break-all">E-mail: {brand.email}</li>
              <li>Instagram: @{brand.instagram}</li>
            </ul>
            <Link
              href={buildWhatsAppUrl(brand.whatsapp, brand.whatsappMessage)}
              className="inline-flex items-center gap-1.5 rounded-full bg-brand-tint px-4 py-2 text-sm font-semibold text-brand-primary transition hover:bg-brand-grad hover:text-white hover:shadow-glow"
            >
              Falar no WhatsApp
            </Link>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-r from-brand-deep via-brand-primary to-brand-secondary">
        <div className="container-page flex flex-col gap-2 py-5 text-xs text-white/85 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {brand.companyName}. Todos os direitos reservados.
          </p>
          <p className="font-medium">Sistema de reservas · Voucher digital · Check-in</p>
        </div>
      </div>
    </footer>
  );
}