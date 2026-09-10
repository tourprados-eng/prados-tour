import Image from "next/image";
import Link from "next/link";
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
    <footer className="mt-8 border-t border-[#EBE4E7] bg-white">
      <div className="container-page grid gap-10 py-12 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <Image
              src={brand.logoUrl}
              alt={brand.companyName}
              width={48}
              height={48}
              className="h-12 w-12 rounded-full object-cover ring-2 ring-[#E84C91]/15"
            />
            <div className="min-w-0">
              <p className="font-display truncate text-xl font-bold text-[#2F2328]">
                {brand.companyName}
              </p>
              <p className="text-sm text-[#6B5B63]">Excursões bate-volta com segurança</p>
            </div>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-[#6B5B63]">
            Praias, parques, day use e viagens especiais com reserva online, pagamento
            facilitado e voucher digital.
          </p>
        </div>

        <div>
          <p className="text-sm font-bold text-[#2F2328]">Navegação</p>
          <ul className="mt-3 space-y-2">
            {nav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-sm text-[#6B5B63] transition hover:text-[#E84C91]"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="min-w-0">
          <p className="text-sm font-bold text-[#2F2328]">Contato</p>
          <ul className="mt-3 space-y-2 text-sm text-[#6B5B63]">
            <li className="break-all">WhatsApp: {brand.whatsapp}</li>
            <li className="break-all">E-mail: {brand.email}</li>
            <li>Instagram: @{brand.instagram}</li>
          </ul>
          <Link
            href={`https://wa.me/${brand.whatsapp}`}
            className="mt-4 inline-flex text-sm font-semibold text-[#E84C91] hover:underline"
          >
            Falar no WhatsApp
          </Link>
        </div>
      </div>

      <div className="border-t border-[#EBE4E7]">
        <div className="container-page flex flex-col gap-2 py-5 text-xs text-[#8A7A82] sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {brand.companyName}. Todos os direitos reservados.
          </p>
          <p>Sistema de reservas · Voucher digital · Check-in</p>
        </div>
      </div>
    </footer>
  );
}
