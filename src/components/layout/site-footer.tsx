import Image from "next/image";
import Link from "next/link";
import {
  Check,
  Headphones,
  LockKeyhole,
  MapPin,
  Mail,
  Phone,
} from "lucide-react";
import { buildWhatsAppUrl } from "@/lib/contact";
import type { BrandSettings } from "@/types";

const nav = [
  { href: "/", label: "Início" },
  { href: "/excursoes", label: "Excursões" },
  { href: "/ofertas", label: "Ofertas" },
  { href: "/sobre", label: "Sobre" },
  { href: "/politicas", label: "Políticas" },
  { href: "/contato", label: "Contato" },
  { href: "/login", label: "Área do cliente" },
];

const CNPJ = "54.316.091/0001-06";
const CADASTUR = "54.316.091/0001-06";
const PHONE = "(11) 99863-9502";

function WhatsAppIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.297-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.095 3.2 5.076 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982 1-3.648-.235-.374a9.86 9.86 0 0 1-1.511-5.26c.001-5.45 4.437-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.44 9.884-9.886 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.89c0 2.096.547 4.142 1.588 5.945L.057 24l6.304-1.654a11.88 11.88 0 0 0 5.684 1.448h.005c6.554 0 11.89-5.335 11.893-11.89a11.82 11.82 0 0 0-3.479-8.416"/>
    </svg>
  );
}

function InstagramIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="5"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17.4" cy="6.7" r="1" fill="currentColor" />
    </svg>
  );
}

export function SiteFooter({ brand }: { brand: BrandSettings }) {
  return (
    <footer className="mt-12">
      {/* LINHA SUPERIOR */}
      <div className="h-1.5 bg-gradient-to-r from-brand-primary via-brand-secondary to-brand-primary" />

      {/* =========================================================
          ÁREA PRINCIPAL DO RODAPÉ
          ========================================================= */}
      <section className="relative isolate overflow-hidden bg-[#FFF8FC]">
        {/* FUNDO DECORATIVO — OCUPA TODA A ÁREA */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
        >
          {/* PALMEIRA ESQUERDA */}
          <svg
            viewBox="0 0 320 500"
            className="absolute -left-24 top-8 h-[430px] w-[280px] text-brand-primary/[0.07]"
            fill="currentColor"
          >
            <path d="M153 495h18V220h-18z" />
            <path d="M161 225C115 175 54 166 5 181c45 15 79 39 112 75-43-20-83-17-117-5 49 25 87 47 127 39-35 13-57 37-76 66 50-13 88-34 109-76 11-21 14-40 14-55 18-62 66-111 132-137-71-12-112 10-146 47 20-47 21-87 7-125-35 51-45 99-27 145 9 22 21 43 21 70Z" />
          </svg>

          {/* CONCHA */}
          <svg
            viewBox="0 0 100 100"
            className="absolute bottom-10 left-12 h-24 w-24 rotate-[-12deg] text-brand-primary/[0.11]"
            fill="none"
          >
            <path
              d="M15 68c15-32 34-49 59-54 9 18 8 39-6 57-14 18-34 25-53 21Z"
              stroke="currentColor"
              strokeWidth="5"
            />
            <path
              d="M28 68c10-22 23-36 42-44M38 78c8-23 19-39 34-51M51 83c6-22 14-37 27-49"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinecap="round"
            />
          </svg>

          {/* CÍRCULOS ESQUERDOS */}
          <div className="absolute -left-24 bottom-[-150px] h-[430px] w-[430px] rounded-full border-[55px] border-brand-primary/[0.045]" />
          <div className="absolute -left-10 bottom-[-190px] h-[390px] w-[390px] rounded-full border-[35px] border-brand-secondary/[0.035]" />

          {/* AVIÃO + ROTA */}
          <svg
            viewBox="0 0 500 250"
            className="absolute right-0 top-4 h-52 w-[430px] text-brand-primary/[0.12]"
            fill="none"
          >
            <path
              d="M45 180C130 75 235 235 325 135c45-50 79-65 130-75"
              stroke="currentColor"
              strokeWidth="4"
              strokeDasharray="10 10"
              strokeLinecap="round"
            />
            <path
              d="M421 48l37-25-13 34 25 18-38-7-21 30 4-36-30-13 36-1Z"
              fill="currentColor"
            />
          </svg>

          {/* CÍRCULOS DIREITOS */}
          <div className="absolute -right-40 bottom-[-190px] h-[500px] w-[500px] rounded-full border-[60px] border-brand-primary/[0.055]" />
          <div className="absolute right-[-100px] top-20 h-64 w-64 rounded-full bg-brand-primary/[0.035]" />

          {/* ONDAS INFERIORES */}
          <svg
            viewBox="0 0 1600 260"
            preserveAspectRatio="none"
            className="absolute bottom-0 left-0 h-40 w-full text-[#F7C9DE]"
            fill="currentColor"
          >
            <path d="M0 150C170 70 300 235 510 150s320-80 500-5 350 95 590-35v150H0Z" />
          </svg>

          <svg
            viewBox="0 0 1600 260"
            preserveAspectRatio="none"
            className="absolute bottom-0 left-0 h-32 w-full text-[#FAD9E8]/80"
            fill="currentColor"
          >
            <path d="M0 205c210-100 330-70 500-5 190 72 300-40 500-75 210-37 340 92 600 0v135H0Z" />
          </svg>
        </div>

        {/* CONTEÚDO */}
        <div className="container-page relative z-10 grid gap-10 py-12 md:grid-cols-2 lg:grid-cols-[1.2fr_0.75fr_1.1fr_1fr] lg:items-center lg:gap-12 lg:py-14">
          {/* MARCA */}
          <div className="min-w-0">
            <Image
              src={brand.logoUrl}
              alt={brand.companyName}
              width={180}
              height={180}
              className="h-32 w-32 object-contain drop-shadow-[0_8px_18px_rgba(232,76,145,0.16)]"
            />

            <p className="mt-2 text-[11px] font-extrabold uppercase tracking-[0.3em] text-brand-primary">
              Agência de viagens
            </p>

            <p className="mt-4 max-w-md text-sm leading-relaxed text-brand-muted">
              {brand.footerText ||
                "Praias, parques, trilhas e destinos incríveis com mais conforto, segurança e experiências inesquecíveis."}
            </p>

            <p className="mt-5 font-display text-xl font-bold italic text-brand-primary">
              Viajar faz bem!
              <span className="ml-2 text-brand-secondary">♡</span>
            </p>
          </div>

          {/* NAVEGAÇÃO */}
          <div>
            <p className="font-display text-xl font-bold text-brand-primary">
              Navegação
            </p>

            <ul className="mt-5 space-y-2.5">
              {nav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-brand-ink/80 transition hover:translate-x-1 hover:text-brand-primary"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* CONTATO */}
          <div className="min-w-0">
            <p className="font-display text-xl font-bold text-brand-primary">
              Contato
            </p>

            <ul className="mt-5 space-y-3.5 text-sm text-brand-muted">
              <li className="flex items-center gap-3">
                <WhatsAppIcon className="h-5 w-5 shrink-0 text-brand-primary" />
                <span>WhatsApp: {PHONE}</span>
              </li>

              <li className="flex items-center gap-3">
                <Phone className="h-5 w-5 shrink-0 text-brand-primary" />
                <span>Telefone: {PHONE}</span>
              </li>

              <li className="flex items-center gap-3">
                <Mail className="h-5 w-5 shrink-0 text-brand-primary" />
                <span className="whitespace-nowrap">
                  E-mail: {brand.email}
                </span>
              </li>

              <li className="flex items-center gap-3">
                <InstagramIcon className="h-5 w-5 shrink-0 text-brand-primary" />
                <span>Instagram: @{brand.instagram}</span>
              </li>

              <li className="flex items-center gap-3">
                <MapPin className="h-5 w-5 shrink-0 text-brand-primary" />
                <span>Santana de Parnaíba - SP</span>
              </li>
            </ul>

            <Link
              href={buildWhatsAppUrl(
                brand.whatsapp,
                brand.whatsappMessage,
              )}
              className="mt-6 inline-flex items-center gap-3 rounded-full bg-brand-primary px-7 py-3.5 text-sm font-extrabold !text-white shadow-[0_10px_25px_rgba(232,76,145,0.28)] transition duration-300 hover:-translate-y-1 hover:bg-brand-deep hover:shadow-[0_14px_30px_rgba(232,76,145,0.35)]"
            >
              <WhatsAppIcon className="h-6 w-6" />
              Falar no WhatsApp
              <span className="ml-1 text-xl">→</span>
            </Link>
          </div>

          {/* FRASE */}
          <div className="relative min-h-[230px]">
            <div className="relative z-10 flex h-full flex-col items-center justify-center text-center">
              <p className="font-display text-[2rem] font-bold italic leading-[1.12] text-brand-primary sm:text-[2.2rem]">
                Mais que viagens,
                <br />
                boas histórias!
              </p>

              <div className="mt-5 h-1 w-44 rotate-[-3deg] rounded-full bg-brand-secondary" />

              <p className="mt-4 text-4xl leading-none text-brand-primary">
                ♡
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          CERTIFICAÇÕES E SEGURANÇA
          ========================================================= */}
      <section className="border-y border-brand-primary/10 bg-[#FFF0F6]">
        <div className="container-page py-7">
          <div className="flex items-center gap-5">
            <div className="hidden h-px flex-1 bg-brand-primary/25 md:block" />

            <h2 className="shrink-0 text-center text-xs font-extrabold uppercase tracking-[0.24em] text-brand-primary sm:text-sm">
              Certificações e segurança
            </h2>

            <div className="hidden h-px flex-1 bg-brand-primary/25 md:block" />
          </div>

          <div className="mt-7 grid gap-6 md:grid-cols-2 lg:grid-cols-4 lg:gap-5">
            {/* CADASTUR */}
            <a
              href="https://cadastur.turismo.gov.br/hotsite/#!/public/sou-turista/inicio"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-4 border-brand-primary/15 lg:border-r lg:pr-6"
              aria-label="Consultar cadastro da Prado's Tour no Cadastur"
            >
              <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white shadow-sm ring-1 ring-[#1769AA]/10 transition duration-300 group-hover:-translate-y-0.5 group-hover:shadow-md">
                <div className="text-center leading-none">
                  <span className="block text-[10px] font-black italic text-[#1769AA]">
                    Cadastur
                  </span>
                  <span className="mt-1 block text-[7px] font-semibold text-[#1769AA]/80">
                    Ministério do Turismo
                  </span>
                </div>
              </div>

              <div className="min-w-0">
                <p className="text-[11px] font-extrabold uppercase text-brand-ink">
                  Agência de turismo
                </p>
                <p className="text-sm font-bold text-brand-primary">
                  Cadastrada no Cadastur
                </p>
                <p className="mt-1 text-[11px] text-brand-muted">
                  Cadastur: {CADASTUR}
                </p>
                <p className="text-[11px] text-brand-muted">
                  Ministério do Turismo
                </p>
              </div>
            </a>

            {/* SITE PROTEGIDO */}
            <div className="flex items-center gap-4 border-brand-primary/15 lg:border-r lg:pr-6">
              <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white text-brand-primary shadow-sm">
                <ShieldIcon />
              </div>

              <div>
                <p className="text-sm font-extrabold text-brand-primary">
                  Site protegido
                </p>
                <p className="mt-1 text-xs leading-relaxed text-brand-muted">
                  Conexão HTTPS e
                  <br />
                  proteção de dados
                </p>
              </div>
            </div>

            {/* PAGAMENTOS */}
            <div className="flex items-center gap-4 border-brand-primary/15 lg:border-r lg:pr-6">
              <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white text-brand-primary shadow-sm">
                <LockKeyhole className="h-8 w-8" />
              </div>

              <div>
                <p className="text-sm font-extrabold text-brand-primary">
                  Pagamentos seguros
                </p>
                <p className="mt-1 text-xs leading-relaxed text-brand-muted">
                  Seus dados são processados
                  <br />
                  de forma segura
                </p>
              </div>
            </div>

            {/* ATENDIMENTO */}
            <div className="flex items-center gap-4">
              <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white text-brand-primary shadow-sm">
                <Headphones className="h-8 w-8" />
              </div>

              <div>
                <p className="text-sm font-extrabold text-brand-primary">
                  Atendimento personalizado
                </p>
                <p className="mt-1 text-xs leading-relaxed text-brand-muted">
                  Suporte antes, durante
                  <br />
                  e depois da sua viagem
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          BARRA FINAL
          ========================================================= */}
      <section className="relative overflow-hidden bg-gradient-to-r from-brand-primary via-[#ef4f91] to-brand-secondary">
        <div
          aria-hidden="true"
          className="absolute -left-16 -bottom-20 h-36 w-96 rotate-[-8deg] rounded-[50%] bg-white/10"
        />

        <div
          aria-hidden="true"
          className="absolute -right-16 -top-20 h-40 w-96 rotate-[8deg] rounded-[50%] bg-white/10"
        />

        <div className="container-page relative z-10 py-5 text-xs text-white">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-center">
            <p className="font-bold">
              Prado&apos;s Tour | Agência de viagens
            </p>

            <p className="flex items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0" />
              Santana de Parnaíba - SP
            </p>

            <p>
              <span className="font-bold">CNPJ:</span> {CNPJ}
            </p>

            <p>
              <span className="font-bold">Cadastur:</span> {CADASTUR}
            </p>
          </div>

          <div className="my-3 h-px bg-white/25" />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <span className="flex items-center gap-2">
                <InstagramIcon className="h-4 w-4" />
                @{brand.instagram}
              </span>

              <span className="flex items-center gap-2">
                <WhatsAppIcon className="h-4 w-4" />
                {PHONE}
              </span>
            </div>

            <p className="text-white/90">
              © {new Date().getFullYear()} {brand.companyName}. Todos os
              direitos reservados.
            </p>
          </div>

          <div className="mt-2 flex items-center gap-2 text-white/80">
            <Check className="h-4 w-4" />
            Sistema de reservas · Voucher digital · Check-in
          </div>
        </div>
      </section>
    </footer>
  );
}

function ShieldIcon() {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className="h-9 w-9"
      aria-hidden="true"
    >
      <path
        d="M16 3 27 7v8c0 7.2-4.4 11.8-11 14-6.6-2.2-11-6.8-11-14V7l11-4Z"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path
        d="m10.5 16 3.5 3.5 7.5-8"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
