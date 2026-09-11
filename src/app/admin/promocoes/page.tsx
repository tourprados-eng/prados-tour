import { updatePromoBannerAction } from "@/lib/admin/actions";
import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import PromotionForm from "@/components/admin/promotion-form";
import PromotionActions from "@/components/admin/promotion-actions";
import { formatCurrency, formatDateTime } from "@/lib/utils";

function discountPreview(promo: {
  discountType: string;
  discountValue: number;
  promoPricePerson: number | null;
  promoPriceCouple: number | null;
}) {
  if (promo.discountType === "PERCENTUAL") return `${promo.discountValue}% de desconto`;
  if (promo.discountType === "FIXO") return `${formatCurrency(promo.discountValue)} de desconto`;
  const parts: string[] = [];
  if (promo.promoPricePerson != null) {
    parts.push(`pessoa ${formatCurrency(promo.promoPricePerson)}`);
  }
  if (promo.promoPriceCouple != null) {
    parts.push(`dupla ${formatCurrency(promo.promoPriceCouple)}`);
  }
  return parts.length ? `Preço ${parts.join(" · ")}` : "Preço promocional";
}

export default async function AdminPromotionsPage() {
  const store = await getRepositoryRuntime().read();
  const trips = store.trips.filter((t) => !t.deletedAt);
  const promotions = store.promotions
    .filter((p) => !p.deletedAt)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const banner = store.promoBanner;

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-primary)]">
          Marketing
        </p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-bold">
          Promoções e Ofertas
        </h1>
        <p className="mt-2 text-black/55">
          Crie ofertas com desconto, preço promocional/dupla, cupom vinculado e
          desconto PIX especial. Reservas recalculam o valor no servidor.
        </p>
      </div>

      <section className="overflow-hidden rounded-3xl bg-white ring-1 ring-black/5">
        <div className="border-b border-black/5 px-6 py-5">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">
            Promoções cadastradas
          </h2>
          <p className="mt-1 text-sm text-black/50">
            Somente promoções ativas e dentro do período aparecem no site e no
            checkout.
          </p>
        </div>

        {promotions.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="font-semibold">Nenhuma promoção cadastrada.</p>
            <p className="mt-1 text-sm text-black/50">
              Use o formulário abaixo para criar a primeira oferta.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-black/5">
            {promotions.map((p) => {
              const usages = store.promotionUsages.filter((u) => u.promotionId === p.id).length;
              const tripCount = p.allTrips
                ? "todas as viagens"
                : `${p.tripIds.length} viagem${p.tripIds.length === 1 ? "" : "ns"}`;
              const status = p.active ? "Ativa" : "Inativa";
              return (
                <div
                  key={p.id}
                  className="flex flex-col gap-3 px-6 py-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold">{p.name}</p>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${
                          p.active
                            ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                            : "bg-gray-50 text-gray-700 ring-gray-200"
                        }`}
                      >
                        {status}
                      </span>
                      {p.stackable && (
                        <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700 ring-1 ring-violet-200">
                          Cumulativa
                        </span>
                      )}
                      {p.pixDiscountPercent != null && (
                        <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-700 ring-1 ring-sky-200">
                          PIX extra {Math.round(p.pixDiscountPercent * 100)}%
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-black/55">
                      {discountPreview(p)} · {tripCount} · {usages} uso
                      {usages === 1 ? "" : "s"}
                    </p>
                    <p className="mt-1 text-xs text-black/40">
                      {p.startDate
                        ? `Início ${formatDateTime(p.startDate)}`
                        : "Início imediato"}
                      {p.endDate ? ` · fim ${formatDateTime(p.endDate)}` : ""}
                      {p.usageLimit ? ` · limite ${p.usageLimit} usos` : ""}
                      {p.perUserLimit ? ` · ${p.perUserLimit}/cliente` : ""}
                    </p>
                  </div>
                  <PromotionActions promotionId={p.id} active={p.active} />
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Banner de ofertas */}
      <section className="rounded-3xl bg-white p-6 ring-1 ring-black/5">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">
            Banner de ofertas (home)
          </h2>
          <p className="mt-1 text-sm text-black/50">
            Configurável e exibido na home quando marcado como ativo.
          </p>
        </div>

        <form
          action={async (fd) => {
            "use server";
            await updatePromoBannerAction({
              title: String(fd.get("title") || ""),
              subtitle: String(fd.get("subtitle") || ""),
              description: String(fd.get("description") || ""),
              imageUrl: String(fd.get("imageUrl") || ""),
              buttonText: String(fd.get("buttonText") || ""),
              buttonLink: String(fd.get("buttonLink") || ""),
              active: fd.get("active") === "on",
              sortOrder: Number(fd.get("sortOrder") || 0),
            });
          }}
          className="mt-4 grid max-w-3xl gap-4 sm:grid-cols-2"
        >
          <div>
            <label className="mb-2 block text-sm font-semibold text-[#302229]">
              Título
            </label>
            <input
              name="title"
              defaultValue={banner.title}
              className="h-11 w-full rounded-xl border border-[#ddd2d8] bg-white px-4 text-sm outline-none focus:border-[#ec3f88]"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-[#302229]">
              Subtítulo
            </label>
            <input
              name="subtitle"
              defaultValue={banner.subtitle}
              className="h-11 w-full rounded-xl border border-[#ddd2d8] bg-white px-4 text-sm outline-none focus:border-[#ec3f88]"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-2 block text-sm font-semibold text-[#302229]">
              Descrição
            </label>
            <textarea
              name="description"
              rows={2}
              defaultValue={banner.description}
              className="w-full rounded-xl border border-[#ddd2d8] p-3 text-sm outline-none focus:border-[#ec3f88]"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-2 block text-sm font-semibold text-[#302229]">
              URL da imagem (opcional)
            </label>
            <input
              name="imageUrl"
              defaultValue={banner.imageUrl}
              placeholder="https://... ou /uploads/..."
              className="h-11 w-full rounded-xl border border-[#ddd2d8] bg-white px-4 text-sm outline-none focus:border-[#ec3f88]"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-[#302229]">
              Texto do botão
            </label>
            <input
              name="buttonText"
              defaultValue={banner.buttonText}
              className="h-11 w-full rounded-xl border border-[#ddd2d8] bg-white px-4 text-sm outline-none focus:border-[#ec3f88]"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-[#302229]">
              Link do botão
            </label>
            <input
              name="buttonLink"
              defaultValue={banner.buttonLink}
              className="h-11 w-full rounded-xl border border-[#ddd2d8] bg-white px-4 text-sm outline-none focus:border-[#ec3f88]"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-[#302229]">
              Ordem
            </label>
            <input
              name="sortOrder"
              type="number"
              defaultValue={banner.sortOrder}
              className="h-11 w-full rounded-xl border border-[#ddd2d8] bg-white px-4 text-sm outline-none focus:border-[#ec3f88]"
            />
          </div>
          <div className="flex items-end">
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#eee5e9] bg-[#fffafc] p-4">
              <input
                type="checkbox"
                name="active"
                defaultChecked={banner.active}
                className="h-5 w-5 accent-[#ec3f88]"
              />
              <div>
                <p className="text-sm font-semibold text-[#302229]">
                  Exibir banner na home
                </p>
                <p className="text-xs text-[#77666e]">
                  O banner aparece na primeira dobra da página inicial.
                </p>
              </div>
            </label>
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-[#ec3f88] px-6 font-bold text-white transition hover:bg-[#d92f75]"
            >
              Salvar banner
            </button>
          </div>
        </form>
      </section>

      <div>
        <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">
          Nova promoção
        </h2>
        <div className="mt-4">
          <PromotionForm trips={trips} coupons={store.coupons} />
        </div>
      </div>
    </div>
  );
}