"use client";

import { useState } from "react";
import { Save, ArrowLeft, Info } from "lucide-react";
import { upsertPromotion } from "@/lib/admin/actions";
import type { Coupon, Promotion, Trip } from "@/types";

function toLocalInput(value?: string | null) {
  if (!value) return "";
  return value.slice(0, 16);
}

function fromLocalInput(value: string) {
  if (!value) return null;
  return new Date(value).toISOString();
}

export default function PromotionForm({
  promotion,
  trips,
  coupons,
  couponOptions,
}: {
  promotion?: Promotion | null;
  trips: Trip[];
  coupons: Coupon[];
  couponOptions?: Coupon[];
}) {
  const [discountType, setDiscountType] = useState(
    promotion?.discountType ?? "PERCENTUAL",
  );
  const [allTrips, setAllTrips] = useState(promotion?.allTrips ?? false);
  const [activeTripIds, setActiveTripIds] = useState<string[]>(
    promotion?.tripIds ?? [],
  );
  const [active, setActive] = useState(promotion?.active ?? true);
  const [stackable, setStackable] = useState(promotion?.stackable ?? false);

  function toggleTrip(id: string) {
    setActiveTripIds((current) =>
      current.includes(id) ? current.filter((t) => t !== id) : [...current, id],
    );
  }

  async function submit(formData: FormData) {
    const result = await upsertPromotion({
      id: promotion?.id,
      name: String(formData.get("name") || ""),
      description: String(formData.get("description") || ""),
      active,
      discountType: discountType as "PERCENTUAL" | "FIXO" | "PRECO",
      discountValue: Number(formData.get("discountValue") || 0),
      promoPricePerson: Number(formData.get("promoPricePerson") || 0) || null,
      promoPriceCouple: Number(formData.get("promoPriceCouple") || 0) || null,
      pixDiscountPercent:
        Number(formData.get("pixDiscountPercent") || 0) > 0
          ? Number(formData.get("pixDiscountPercent")) / 100
          : null,
      stackable,
      couponId: String(formData.get("couponId") || "") || null,
      allTrips,
      tripIds: allTrips ? [] : activeTripIds,
      usageLimit: Number(formData.get("usageLimit") || 0) || null,
      perUserLimit: Number(formData.get("perUserLimit") || 0) || null,
      startDate: fromLocalInput(String(formData.get("startDate") || "")),
      endDate: fromLocalInput(String(formData.get("endDate") || "")),
    });

    if (result?.error) {
      alert(result.error);
      return;
    }
    window.location.href = "/admin/promocoes";
  }

  const inputClass =
    "h-12 w-full rounded-xl border border-[#ddd2d8] bg-white px-4 text-sm outline-none transition focus:border-[#ec3f88] focus:ring-4 focus:ring-[#ec3f88]/10";
  const labelClass = "mb-2 block text-sm font-semibold text-[#302229]";

  return (
    <form action={submit} className="pb-12">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <a
            href="/admin/promocoes"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#eadfe4] bg-white text-[#38272e] shadow-sm transition hover:bg-[#fff4f8]"
          >
            <ArrowLeft size={20} />
          </a>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[#21171b]">
              {promotion ? "Editar Promoção" : "Nova Promoção"}
            </h1>
            <p className="mt-1 text-sm text-[#77666e]">
              {promotion
                ? "Atualize as condições desta oferta"
                : "Crie uma oferta exibida no site e aplicada no checkout"}
            </p>
          </div>
        </div>
        <div className="hidden items-center gap-3 md:flex">
          <span className="text-sm text-[#77666e]">
            {allTrips ? "Todas as viagens" : `${activeTripIds.length} viagens`}
          </span>
          <span className="h-2 w-2 rounded-full bg-[#ec3f88]" />
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <section className="rounded-3xl border border-[#eadfe4] bg-white p-6 shadow-[0_10px_35px_rgba(61,29,44,0.05)]">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className={labelClass}>Nome da promoção *</label>
                <input
                  name="name"
                  required
                  defaultValue={promotion?.name ?? ""}
                  placeholder="Ex.: Promoção de primavera"
                  className={inputClass}
                />
              </div>

              <div className="md:col-span-2">
                <label className={labelClass}>Descrição</label>
                <textarea
                  name="description"
                  rows={3}
                  defaultValue={promotion?.description ?? ""}
                  placeholder="Breve descrição exibida na página de ofertas"
                  className="w-full resize-y rounded-2xl border border-[#ddd2d8] p-4 text-sm leading-6 outline-none focus:border-[#ec3f88]"
                />
              </div>

              <div>
                <label className={labelClass}>Tipo de desconto *</label>
                <select
                  name="discountType"
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value as "PERCENTUAL" | "FIXO" | "PRECO")}
                  className={inputClass}
                >
                  <option value="PERCENTUAL">Percentual (%)</option>
                  <option value="FIXO">Valor fixo (R$)</option>
                  <option value="PRECO">Preço promocional / dupla</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>
                  {discountType === "PERCENTUAL" && "Desconto (%) *"}
                  {discountType === "FIXO" && "Desconto (R$) *"}
                  {discountType === "PRECO" && "Percentual (opcional)"}
                </label>
                <input
                  name="discountValue"
                  type="number"
                  min="0"
                  step="0.01"
                  required={discountType !== "PRECO"}
                  defaultValue={promotion?.discountValue ?? ""}
                  placeholder={
                    discountType === "PERCENTUAL"
                      ? "10"
                      : discountType === "FIXO"
                        ? "30,00"
                        : "0"
                  }
                  className={inputClass}
                />
              </div>

              {discountType === "PRECO" && (
                <>
                  <div>
                    <label className={labelClass}>Preço promocional / pessoa (R$)</label>
                    <input
                      name="promoPricePerson"
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={promotion?.promoPricePerson ?? ""}
                      placeholder="150,00"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Preço promocional / dupla (R$)</label>
                    <input
                      name="promoPriceCouple"
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={promotion?.promoPriceCouple ?? ""}
                      placeholder="280,00"
                      className={inputClass}
                    />
                  </div>
                </>
              )}

              <div>
                <label className={labelClass}>Desconto PIX da promoção (%)</label>
                <input
                  name="pixDiscountPercent"
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  defaultValue={
                    promotion?.pixDiscountPercent != null
                      ? promotion.pixDiscountPercent * 100
                      : ""
                  }
                  placeholder="Vazio = usa o desconto padrão"
                  className={inputClass}
                />
                <p className="mt-1 text-xs text-[#77666e]">
                  Em branco usa o desconto PIX configurado no sistema.
                </p>
              </div>

              <div className="md:col-span-2">
                <label className={labelClass}>Cupom vinculado (opcional)</label>
                <select name="couponId" defaultValue={promotion?.couponId ?? ""} className={inputClass}>
                  <option value="">Nenhum cupom</option>
                  {(couponOptions?.length ? couponOptions : coupons).map((coupon) => (
                    <option key={coupon.id} value={coupon.id}>
                      {coupon.code} · {coupon.active ? "ativo" : "inativo"}
                    </option>
                  ))}
                </select>
              </div>

              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#eee5e9] bg-[#fffafc] p-4 md:col-span-2">
                <input
                  type="checkbox"
                  checked={stackable}
                  onChange={(e) => setStackable(e.target.checked)}
                  className="h-5 w-5 accent-[#ec3f88]"
                />
                <div>
                  <p className="text-sm font-semibold text-[#302229]">
                    Cumulativa com cupom
                  </p>
                  <p className="mt-1 text-xs text-[#77666e]">
                    Se marcada, o cliente pode somar esta promoção a um cupom.
                    Senão, vale o maior desconto entre promoção e cupom.
                  </p>
                </div>
              </label>
            </div>
          </section>

          <section className="rounded-3xl border border-[#eadfe4] bg-white p-6 shadow-[0_10px_35px_rgba(61,29,44,0.05)]">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ffe5f0] text-[#ec3f88]">
                <Info size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#21171b]">Viagens participantes</h2>
                <p className="mt-1 text-sm text-[#77666e]">
                  Escolha as viagens que receberão esta oferta.
                </p>
              </div>
            </div>

            <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-xl border border-[#eee5e9] bg-[#fffafc] p-4">
              <input
                type="checkbox"
                checked={allTrips}
                onChange={(e) => {
                  setAllTrips(e.target.checked);
                  if (e.target.checked) setActiveTripIds([]);
                }}
                className="h-5 w-5 accent-[#ec3f88]"
              />
              <div>
                <p className="text-sm font-semibold text-[#302229]">
                  Todas as viagens elegíveis
                </p>
                <p className="mt-1 text-xs text-[#77666e]">
                  A promoção vale para toda viagem publicada (atual e futura).
                </p>
              </div>
            </label>

            <div className="mt-4 grid gap-2 md:grid-cols-2">
              {trips.map((trip) => {
                const checked = activeTripIds.includes(trip.id);
                return (
                  <label
                    key={trip.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${
                      allTrips
                        ? "cursor-not-allowed opacity-40"
                        : checked
                          ? "border-[#f4b3ce] bg-[#fff7fa]"
                          : "border-[#eee5e9] bg-white"
                    }`}
                  >
                    <input
                      type="checkbox"
                      disabled={allTrips}
                      checked={checked}
                      onChange={() => toggleTrip(trip.id)}
                      className="h-5 w-5 accent-[#ec3f88]"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-[#302229]">
                        {trip.name}
                      </span>
                      <span className="block text-xs text-[#77666e]">
                        {trip.date} · R$ {trip.pricePerson}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="rounded-3xl border border-[#eadfe4] bg-white p-5 shadow-[0_10px_35px_rgba(61,29,44,0.05)]">
            <h2 className="font-bold text-[#21171b]">Período e limites</h2>
            <div className="mt-4 space-y-4">
              <div>
                <label className={labelClass}>Início</label>
                <input
                  name="startDate"
                  type="datetime-local"
                  defaultValue={toLocalInput(promotion?.startDate)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Fim</label>
                <input
                  name="endDate"
                  type="datetime-local"
                  defaultValue={toLocalInput(promotion?.endDate)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Limite de usos total</label>
                <input
                  name="usageLimit"
                  type="number"
                  min="1"
                  defaultValue={promotion?.usageLimit ?? ""}
                  placeholder="Sem limite"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Limite por cliente</label>
                <input
                  name="perUserLimit"
                  type="number"
                  min="1"
                  defaultValue={promotion?.perUserLimit ?? ""}
                  placeholder="Sem limite"
                  className={inputClass}
                />
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-[#eadfe4] bg-white p-5 shadow-[0_10px_35px_rgba(61,29,44,0.05)]">
            <h2 className="font-bold text-[#21171b]">Status</h2>
            <p className="mt-1 text-xs text-[#77666e]">
              A promoção só é exibida quando está ativa e dentro do período.
            </p>
            <button
              type="button"
              onClick={() => setActive((v) => !v)}
              className={`mt-4 relative h-8 w-14 rounded-full transition ${
                active ? "bg-[#ec3f88]" : "bg-[#d7cbd1]"
              }`}
            >
              <span
                className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition ${
                  active ? "left-7" : "left-1"
                }`}
              />
            </button>
            <span className="ml-3 text-sm font-semibold text-[#302229]">
              {active ? "Ativa" : "Inativa"}
            </span>
          </section>

          <div className="flex gap-3">
            <a
              href="/admin/promocoes"
              className="flex h-13 flex-1 items-center justify-center rounded-xl border-2 border-[#ec3f88] bg-white font-bold text-[#9e275c] transition hover:bg-[#fff3f7]"
            >
              Cancelar
            </a>
            <button
              type="submit"
              className="flex h-13 flex-[1.4] items-center justify-center gap-2 rounded-xl bg-[#ec3f88] font-bold text-white shadow-lg shadow-[#ec3f88]/20 transition hover:bg-[#d92f75]"
            >
              <Save size={19} />
              {promotion ? "Salvar Alterações" : "Criar Promoção"}
            </button>
          </div>
        </aside>
      </div>
    </form>
  );
}