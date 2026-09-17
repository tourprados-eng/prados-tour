import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import { OffersGrid } from "@/components/promotions/offers-grid";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Ofertas" };

export default async function OffersPage() {
  const store = await getRepositoryRuntime().read();
  const trips = store.trips.filter(
    (t) => t.status === "PUBLICADA" && !t.deletedAt,
  );

  return (
    <div className="section-pad">
      <div className="container-page">
        <div className="brand-panel">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-white/80">
            Promoções
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight md:text-4xl">
            Ofertas
          </h1>
          <p className="mt-3 max-w-xl text-white/90">
            Descontos e preços especiais aplicados automaticamente na reserva.
            O valor exibido é o mesmo aplicado na confirmação do pagamento.
          </p>
        </div>

        <div className="mt-10">
          <OffersGrid trips={trips} showEmptyButton={false} />
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