import { getDashboardMetrics } from "@/lib/admin/actions";
import { formatCurrency } from "@/lib/utils";

export default async function AdminPage() {
  const metrics = await getDashboardMetrics();
  const cards = [
    { label: "Faturamento", value: formatCurrency(metrics.revenue) },
    { label: "Vendas", value: String(metrics.sales) },
    { label: "Reservas confirmadas", value: String(metrics.bookings) },
    { label: "Passageiros", value: String(metrics.passengers) },
    { label: "Viagens", value: String(metrics.trips) },
    { label: "Vagas restantes", value: String(metrics.seats) },
    { label: "Pagamentos pendentes", value: String(metrics.pendingPayments) },
    { label: "Comissões", value: formatCurrency(metrics.commissions) },
    { label: "Lucro", value: formatCurrency(metrics.profit) },
  ];

  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">
        Painel administrativo
      </h1>
      <p className="mt-2 text-black/60">Visão geral da operação Prado&apos;s Tour</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-3xl bg-white/90 p-5 ring-1 ring-black/5">
            <p className="text-xs font-semibold uppercase tracking-wide text-black/45">
              {c.label}
            </p>
            <p className="mt-2 text-2xl font-bold text-[var(--brand-primary)]">{c.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
