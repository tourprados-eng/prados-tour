import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import CouponToggle from "@/components/admin/coupon-actions";
import { formatCurrency, formatDate } from "@/lib/utils";

function discountPreview(coupon: {
  type: "PERCENTUAL" | "FIXO";
  value: number;
}) {
  return coupon.type === "PERCENTUAL"
    ? `${coupon.value}%`
    : formatCurrency(coupon.value);
}

export default async function AdminCouponsPage() {
  const store = await getRepositoryRuntime().read();
  const coupons = store.coupons.sort((a, b) => a.code.localeCompare(b.code));

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-primary)]">
            Marketing
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-bold">
            Cupons de desconto
          </h1>
          <p className="mt-2 text-black/55">
            Códigos com limite de usos, período, valor mínimo e cumulatividade
            com promoções.
          </p>
        </div>
        <a
          href="/admin/cupons/novo"
          className="inline-flex h-11 items-center justify-center rounded-xl bg-[#ec3f88] px-6 font-bold text-white shadow-lg shadow-[#ec3f88]/20 transition hover:bg-[#d92f75]"
        >
          Novo cupom
        </a>
      </div>

      {coupons.length === 0 ? (
        <div className="rounded-3xl bg-white p-14 text-center ring-1 ring-black/5">
          <p className="font-semibold">Nenhum cupom cadastrado.</p>
          <p className="mt-1 text-sm text-black/50">
            Clique em &quot;Novo cupom&quot; para criar o primeiro.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl bg-white ring-1 ring-black/5">
          <div className="divide-y divide-black/5">
            {coupons.map((c) => {
              const usages = store.couponUsages.filter(
                (u) => u.couponId === c.id,
              ).length;
              const tripCount = c.tripIds.length;
              const validity =
                c.validFrom || c.validUntil
                  ? `${c.validFrom ? `de ${formatDate(c.validFrom)}` : "desde sempre"}${
                      c.validUntil ? ` até ${formatDate(c.validUntil)}` : ""
                    }`
                  : null;
              return (
                <div
                  key={c.id}
                  className="flex flex-col gap-3 px-6 py-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-[family-name:var(--font-display)] text-lg font-bold tracking-wide">
                        {c.code}
                      </p>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${
                          c.active
                            ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                            : "bg-gray-50 text-gray-700 ring-gray-200"
                        }`}
                      >
                        {c.active ? "Ativo" : "Inativo"}
                      </span>
                      {c.stackable && (
                        <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700 ring-1 ring-violet-200">
                          Cumulativo
                        </span>
                      )}
                      <span className="rounded-full bg-[#fff0f6] px-3 py-1 text-xs font-bold text-[#d92f75] ring-1 ring-[#f4b3ce]">
                        {discountPreview(c)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-black/55">
                      {usages} uso{usages === 1 ? "" : "s"} ·{" "}
                      {c.usageLimit ? `limite ${c.usageLimit} usos` : "sem limite"} ·{" "}
                      {c.perUserLimit
                        ? `${c.perUserLimit}/cliente`
                        : "sem limite por cliente"}
                      {c.minAmount ? ` · mínimo ${formatCurrency(c.minAmount)}` : ""} ·{" "}
                      {tripCount === 0
                        ? "qualquer viagem"
                        : `${tripCount} viagem${tripCount === 1 ? "" : "ns"}`}
                    </p>
                    {(validity || c.description) && (
                      <p className="mt-1 text-xs text-black/40">
                        {validity ? `${validity} · ` : ""}
                        {c.description}
                      </p>
                    )}
                  </div>
                  <CouponToggle couponId={c.id} />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}