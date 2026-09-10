import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import { formatCurrency } from "@/lib/utils";

export default async function AdminSellersPage() {
  const store = await getRepositoryRuntime().read();
  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">Vendedores</h1>
      <div className="mt-6 space-y-3">
        {store.sellers.map((s) => {
          const profile = store.profiles.find((p) => p.id === s.id)!;
          const commissions = store.commissions.filter((c) => c.sellerId === s.id);
          const total = commissions.reduce((a, c) => a + c.amount, 0);
          return (
            <div key={s.id} className="rounded-2xl bg-white/90 p-4 ring-1 ring-black/5">
              <p className="font-bold">
                {profile.fullName} · {s.code}
              </p>
              <p className="text-sm text-black/60">
                Comissão padrão {(s.commissionRate * 100).toFixed(0)}% · Gerada{" "}
                {formatCurrency(total)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
