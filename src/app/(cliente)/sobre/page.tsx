import Image from "next/image";
import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Sobre" };

export default async function AboutPage() {
  const store = await getRepositoryRuntime().read();

  return (
    <div className="section-pad">
      <div className="container-page grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div className="min-w-0">
          <p className="eyebrow">Nossa história</p>
          <h1 className="section-title mt-2">Sobre a {store.brand.companyName}</h1>
          <p className="mt-5 text-base leading-relaxed text-brand-ink/85 md:text-lg">
            {store.brand.aboutText ||
              "Somos uma agência especializada em excursões bate-volta, praias, parques, day use, trilhas, cachoeiras, turismo religioso e viagens especiais — com operação digital completa do catálogo ao check-in."}
          </p>
          <p className="mt-4 text-base leading-relaxed text-brand-muted">
            Nossa prioridade é que cada cliente saiba exatamente o que está comprando,
            quanto vai pagar, onde embarcar e como será a experiência.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button href="/excursoes">Ver excursões</Button>
            <Button href="/contato" variant="outline">
              Falar conosco
            </Button>
          </div>
        </div>

        <div className="relative mx-auto aspect-square w-full max-w-md overflow-hidden rounded-[1.75rem] bg-brand-tint shadow-card">
          <Image
            src={store.brand.logoUrl}
            alt={store.brand.companyName}
            fill
            className="object-contain p-10"
            sizes="400px"
          />
        </div>
      </div>
    </div>
  );
}
