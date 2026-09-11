import Link from "next/link";
import { MapPin } from "lucide-react";
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
        <div className="brand-panel">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-white/80">Promoções</p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight md:text-4xl">
            Ofertas
          </h1>
          <p className="mt-3 max-w-xl text-white/90">
            Preço de dupla, cupom <strong className="font-bold text-white">PRADOS10</strong> e
            desconto automático no PIX 100%.
          </p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {trips.map((t) => (
            <Link
              key={t.id}
              href={`/excursoes/${t.slug}`}
              className="surface-card group flex min-w-0 flex-col justify-between p-6 transition hover:-translate-y-1 hover:border-brand-primary/35 hover:shadow-lift"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wide text-brand-secondary">
                    {t.category}
                  </p>
                  <h2 className="mt-1 font-display text-2xl font-bold text-brand-ink">{t.name}</h2>
                  <p className="mt-2 text-sm text-brand-muted">
                    {formatDate(t.date)} · {t.destination}
                  </p>
                </div>
                <MapPin className="h-5 w-5 shrink-0 text-brand-primary" aria-hidden />
              </div>
              <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs text-brand-faint">Pessoa · Dupla</p>
                  <p className="mt-1 text-lg font-bold text-brand-primary">
                    {formatCurrency(t.pricePerson)}{" "}
                    <span className="text-sm font-medium text-brand-muted">
                      · {formatCurrency(t.priceCouple!)}
                    </span>
                  </p>
                </div>
                <span className="text-sm font-semibold text-brand-ink transition group-hover:text-brand-primary">
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