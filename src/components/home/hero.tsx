import Image from "next/image";
import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BrandSettings } from "@/types";

const heroTrustItems = [
  "Pagamento seguro",
  "Voucher digital",
  "Vagas limitadas",
  "Check-in na viagem",
];

const heroPills = ["Bate-voltas", "Praias", "Parques", "Viagens em grupo"];

type HomeHeroProps = {
  brand: BrandSettings | null;
  signedIn?: boolean;
  /**
   * Conteúdo próprio da página (ex.: /minhas-viagens). Quando fornecido,
   * reaproveita o fundo/banner visual da Home e renderiza children dentro.
   * Sem children, renderiza o conteúdo padrão da Home.
   */
  children?: ReactNode;
};

/**
 * Banner/hero compartilhado da Home. Usado pela Home e pela área do cliente
 * (/minhas-viagens) — fonte única do fundo visual. Com children, apenas o
 * fundo é reutilizado; o conteúdo fica a cargo de cada página.
 */
export function HomeHero({ brand, signedIn = false, children }: HomeHeroProps) {
  const resolved = brand ?? {
    companyName: "Prado's Tour",
    siteTagline: null,
    bannerUrl: "/images/guaruja.png",
    logoUrl: "/images/logo-prados.png",
  } as BrandSettings;

  // No modo children (área do cliente) o banner é mais compacto, mantendo o
  // fundo visual compartilhado; a Home (sem children) preserva a altura atual.
  const heroSizing = children
    ? "min-h-[min(66vh,640px)]"
    : "min-h-[min(92vh,880px)]";

  return (
    <section className={`relative overflow-hidden bg-brand-deep ${heroSizing}`}>
      <Image
        src={resolved.bannerUrl || "/images/guaruja.png"}
        alt={`Excursões ${resolved.companyName}`}
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-brand-deep/95 via-brand-primary/85 to-brand-secondary/50" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-brand-bg to-transparent" />

      <div
        className={`container-page relative flex ${heroSizing} flex-col justify-center py-16 md:py-20`}
      >
        {children ? (
          <div className="max-w-2xl text-white">{children}</div>
        ) : (
          <div className="max-w-2xl text-white">
            <div className="hero-enter flex items-center gap-3">
            <span className="shrink-0">
              <Image
                src={resolved.logoUrl}
                alt={resolved.companyName}
                width={72}
                height={72}
                className="h-16 w-16 object-contain drop-shadow-[0_6px_14px_rgba(0,0,0,0.28)] transition duration-300 hover:scale-105"
                priority
              />
            </span>
            <p className="font-display text-2xl font-bold tracking-tight text-white drop-shadow-[0_3px_8px_rgba(70,10,45,0.45)] sm:text-3xl">
              {resolved.companyName}
            </p>
          </div>

          <div className="hero-enter-late mt-7 flex flex-wrap gap-2">
            {heroPills.map((item) => (
              <span
                key={item}
                className="rounded-full bg-gradient-to-r from-brand-primary to-brand-secondary px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md"
              >
                {item}
              </span>
            ))}
          </div>

          <h1 className="hero-enter-delay mt-5 font-display text-[2.35rem] font-bold leading-[1.08] tracking-tight sm:text-5xl md:text-[3.4rem]">
            Excursões com alegria, cuidado e segurança
          </h1>

          <p className="hero-enter-late mt-5 max-w-md text-base leading-relaxed text-white/90 sm:text-lg">
            {resolved.siteTagline || "Reserve praias, parques e bate-voltas com pagamento fácil e voucher digital."}
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
              href={signedIn ? "/minhas-viagens" : "/criar-conta"}
              size="lg"
              className="bg-brand-deep text-white shadow-[0_5px_18px_rgba(0,0,0,0.28)] transition duration-300 hover:-translate-y-0.5 hover:bg-[#a91f5c] hover:shadow-[0_7px_22px_rgba(0,0,0,0.32)] focus-visible:ring-white"
            >
              {signedIn ? "Minhas viagens" : "Criar conta"}
            </Button>
          </div>

          <ul className="hero-enter-late mt-10 flex flex-wrap gap-2">
            {heroTrustItems.map((item) => (
              <li
                key={item}
                className="flex items-center gap-2 rounded-full border border-white/25 bg-brand-deep/35 px-4 py-2 text-xs font-bold text-white shadow-[0_4px_14px_rgba(0,0,0,0.14)] backdrop-blur-md transition duration-300 hover:-translate-y-0.5 hover:bg-brand-deep/45"
              >
                <Check
                  className="h-4 w-4 shrink-0 rounded-full bg-gradient-to-br from-brand-primary to-brand-secondary p-0.5 text-white shadow-sm"
                  strokeWidth={3}
                  aria-hidden
                />
                {item}
              </li>
            ))}
          </ul>
        </div>
        )}
      </div>
    </section>
  );
}
