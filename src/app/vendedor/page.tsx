import { redirect } from "next/navigation";
import { getSession, canAccess } from "@/lib/auth/session";
import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import { getPublicSiteUrl } from "@/lib/env/public";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CopyLinkButton } from "@/components/seller/copy-link-button";

export default async function SellerPage() {
  const session = await getSession();
  if (!session || !canAccess(session.role, "vendedor")) redirect("/login");
  const store = await getRepositoryRuntime().read();
  const seller = store.sellers.find((s) => s.id === session.id);
  const bookings = store.bookings.filter((b) => b.sellerId === session.id);
  const commissions = store.commissions.filter((c) => c.sellerId === session.id);
  const paid = commissions.filter((c) => c.status === "PAGA").reduce((s, c) => s + c.amount, 0);
  const pending = commissions
    .filter((c) => c.status === "PENDENTE" || c.status === "APROVADA")
    .reduce((s, c) => s + c.amount, 0);
  const customers = new Set(bookings.map((b) => b.customerId)).size;
  const referralLink = seller ? `${getPublicSiteUrl()}/?sel=${seller.code}` : "";

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">
        Painel do vendedor
      </h1>
      <p className="mt-2 text-black/60">Código: {seller?.code || "—"}</p>

      {seller && (
        <div className="mt-6 rounded-3xl bg-white/90 p-5 ring-1 ring-black/5">
          <p className="text-sm font-semibold">Seu link de indicação</p>
          <p className="mt-1 text-sm text-black/60">
            Compartilhe este link. Quando um cliente entrar pelo link e comprar,
            esta venda fica vinculada a você.
          </p>
          <div className="mt-3">
            <CopyLinkButton value={referralLink} label="Copiar link" />
          </div>
          <p className="mt-2 text-xs text-black/40">
            Taxa: {(seller.commissionRate * 100).toFixed(0)}% por venda indicada.
          </p>
        </div>
      )}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          ["Minhas vendas", String(bookings.length)],
          ["Total vendido", formatCurrency(bookings.reduce((s, b) => s + b.totalAmount, 0))],
          ["Comissão gerada", formatCurrency(commissions.reduce((s, c) => s + c.amount, 0))],
          ["Comissão paga", formatCurrency(paid)],
          ["Comissão pendente", formatCurrency(pending)],
          ["Clientes", String(customers)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-3xl bg-white/90 p-5 ring-1 ring-black/5">
            <p className="text-xs uppercase text-black/45">{label}</p>
            <p className="mt-2 text-2xl font-bold text-[var(--brand-primary)]">{value}</p>
          </div>
        ))}
      </div>
      <div className="mt-8">
        <Button href="/excursoes">Nova venda / reservar</Button>
      </div>
      <h2 className="mt-10 text-xl font-bold">Vendas recentes</h2>
      <div className="mt-4 space-y-3">
        {bookings.map((b) => {
          const trip = store.trips.find((t) => t.id === b.tripId)!;
          return (
            <div key={b.id} className="rounded-2xl bg-white/90 p-4 ring-1 ring-black/5">
              <p className="font-bold">
                {b.reference} · {trip.name}
              </p>
              <p className="text-sm text-black/60">{formatCurrency(b.totalAmount)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
