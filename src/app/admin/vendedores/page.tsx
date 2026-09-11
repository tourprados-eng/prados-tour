import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import { formatCurrency } from "@/lib/utils";
import CreateSellerForm from "@/components/admin/create-seller-form";
import { paySellerCommissionsAction } from "@/lib/admin/actions";
import { getPublicSiteUrl } from "@/lib/env/public";
import { CopyLinkButton } from "@/components/seller/copy-link-button";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR").format(new Date(value));
}

export default async function AdminSellersPage() {
  const store = await getRepositoryRuntime().read();
  const siteUrl = getPublicSiteUrl();
  const pendingTotal = store.commissions
    .filter((c) => c.status !== "PAGA" && c.status !== "CANCELADA")
    .reduce((s, c) => s + c.amount, 0);

  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">Vendedores</h1>
      <p className="mt-2 text-black/60">
        Crie contas de acesso para vendedores, compartilhe os links de indicação e
        faça o pagamento das comissões.
      </p>

      {pendingTotal > 0 && (
        <div className="mt-5 flex flex-wrap items-center gap-2 rounded-2xl bg-amber-50 px-4 py-3 ring-1 ring-amber-200">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            ◉
          </span>
          <p className="text-sm font-semibold text-amber-800">
            Você tem {formatCurrency(pendingTotal)} em comissões pendentes de
            pagamento aos vendedores.
          </p>
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-3">
          {store.sellers.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-black/15 bg-white/60 p-8 text-center">
              <p className="text-sm text-black/55">Nenhum vendedor cadastrado ainda.</p>
            </div>
          ) : (
            store.sellers.map((s) => {
              const profile = store.profiles.find((p) => p.id === s.id);
              const commissions = store.commissions.filter((c) => c.sellerId === s.id);
              const total = commissions.reduce((a, c) => a + c.amount, 0);
              const pending = commissions
                .filter((c) => c.status !== "PAGA" && c.status !== "CANCELADA")
                .map((c) => c);
              const pendingSum = pending.reduce((a, c) => a + c.amount, 0);
              return (
                <div key={s.id} className="rounded-2xl bg-white/90 p-4 ring-1 ring-black/5">
                  <div>
                    <p className="font-bold">
                      {profile?.fullName || "Vendedor"} · {s.code}
                    </p>
                    <p className="text-sm text-black/60">
                      {profile?.email || "E-mail não informado"} · Comissão{" "}
                      {(s.commissionRate * 100).toFixed(0)}%
                    </p>
                  </div>
                  <p className="mt-2 text-sm font-medium text-[#4A3941]">
                    Comissão gerada: {formatCurrency(total)}
                  </p>

                  <div className="mt-2">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-black/40">
                      Link de indicação
                    </p>
                    <CopyLinkButton
                      value={`${siteUrl}/?sel=${s.code}`}
                      label="Copiar"
                    />
                  </div>

                  {pending.length > 0 && (
                    <div className="mt-3 rounded-xl bg-amber-50/70 p-3 ring-1 ring-amber-100">
                      <p className="text-xs font-bold uppercase tracking-wide text-amber-800">
                        A pagar: {formatCurrency(pendingSum)}
                      </p>
                      <ul className="mt-2 space-y-1">
                        {pending.map((c) => {
                          const booking = store.bookings.find((b) => b.id === c.bookingId);
                          const trip = booking
                            ? store.trips.find((t) => t.id === booking.tripId)
                            : null;
                          return (
                            <li
                              key={c.id}
                              className="flex flex-wrap items-center justify-between gap-2 text-sm text-black/70"
                            >
                              <span>
                                {booking?.reference ?? "Reserva"} ·{" "}
                                {trip?.name ?? "Viagem"} ·{" "}
                                <strong>{formatCurrency(c.amount)}</strong>
                              </span>
                              <span className="text-xs text-black/40">
                                {formatDate(booking?.createdAt ?? c.paidAt ?? new Date().toISOString())}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                      <form action={paySellerCommissionsAction}>
                        <input type="hidden" name="sellerId" value={s.id} />
                        <button
                          type="submit"
                          className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
                        >
                          Pagar {formatCurrency(pendingSum)} ao vendedor
                        </button>
                      </form>
                    </div>
                  )}

                  {pending.length === 0 && total > 0 && (
                    <p className="mt-2 text-xs font-medium text-emerald-700">
                      Todas as comissões foram pagas.
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="lg:sticky lg:top-6">
          <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl font-bold">
            Criar vendedor
          </h2>
          <CreateSellerForm />
        </div>
      </div>
    </div>
  );
}