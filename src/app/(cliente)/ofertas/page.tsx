import Link from "next/link";
import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Ofertas" };

export default async function OffersPage() {
  const store = await getRepositoryRuntime().read();
  const trips = store.trips.filter((t) => t.status === "PUBLICADA" && t.priceCouple);

  return (
    <div className="section-pad">
      <div className="container-page">
        <div className="max-w-2xl">
          <p className="eyebrow">Promoções</p>
          <h1 className="section-title mt-2">Ofertas</h1>
          <p className="section-lead">
            Preço de dupla, cupom <strong className="text-[#E84C91]">PRADOS10</strong> e
            desconto automático no PIX 100%.
          </p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {trips.map((t) => (
            <Link
              key={t.id}
              href={`/excursoes/${t.slug}`}
              className="surface-card group flex min-w-0 flex-col justify-between p-6 transition hover:border-[#E84C91]/35"
            >
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[#F28C28]">
                  {t.category}
                </p>
                <h2 className="mt-1 font-display text-2xl font-bold text-[#2F2328]">{t.name}</h2>
                <p className="mt-2 text-sm text-[#6B5B63]">
                  {formatDate(t.date)} · {t.destination}
                </p>
              </div>
              <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs text-[#8A7A82]">Pessoa · Dupla</p>
                  <p className="mt-1 text-lg font-bold text-[#E84C91]">
                    {formatCurrency(t.pricePerson)}{" "}
                    <span className="text-sm font-medium text-[#6B5B63]">
                      · {formatCurrency(t.priceCouple!)}
                    </span>
                  </p>
                </div>
                <span className="text-sm font-semibold text-[#2F2328] group-hover:text-[#E84C91]">
                  Reservar →
                </span>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-10">
          <Button href="/excursoes" variant="outline">
            Ver todas as excursões
          </Button>
        </div>
      </div>
    </div>
  );
}
