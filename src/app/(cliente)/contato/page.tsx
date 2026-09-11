import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Contato" };

export default async function ContactPage() {
  const store = await getRepositoryRuntime().read();

  return (
    <div className="section-pad">
      <div className="container-page max-w-3xl">
        <p className="eyebrow">Atendimento</p>
        <h1 className="section-title mt-2">Contato</h1>
        <p className="section-lead">
          Tire dúvidas sobre destinos, reservas, pagamentos ou embarque.
        </p>

        <div className="surface-card mt-10 space-y-5 p-6 md:p-8">
          <Row label="WhatsApp" value={store.brand.whatsapp} />
          <Row label="E-mail" value={store.brand.email} />
          <Row label="Instagram" value={`@${store.brand.instagram}`} />
          <div className="flex flex-wrap gap-3 pt-2">
            <Button href={`https://wa.me/${store.brand.whatsapp}`} size="lg">
              Chamar no WhatsApp
            </Button>
            <Button href="/excursoes" variant="outline" size="lg">
              Ver excursões
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 border-b border-brand-line pb-4 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm font-medium text-brand-faint">{label}</span>
      <span className="break-all text-base font-semibold text-brand-ink">{value}</span>
    </div>
  );
}
