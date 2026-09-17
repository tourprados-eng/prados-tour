"use client";

import { useState } from "react";
import { Save, ArrowLeft } from "lucide-react";
import { upsertCoupon } from "@/lib/admin/actions";
import { formatTripDepartureDate } from "@/lib/utils";
import type { Coupon, Trip } from "@/types";

function toLocalInput(value?: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

function fromLocalInput(value: string) {
  if (!value) return null;
  const d = new Date(`${value}T23:59:59`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export default function CouponForm({
  coupon,
  trips,
}: {
  coupon?: Coupon | null;
  trips: Trip[];
}) {
  const [type, setType] = useState(coupon?.type ?? "PERCENTUAL");
  const [activeTripIds, setActiveTripIds] = useState<string[]>(
    coupon?.tripIds ?? [],
  );

  function toggleTrip(id: string) {
    setActiveTripIds((current) =>
      current.includes(id) ? current.filter((t) => t !== id) : [...current, id],
    );
  }

  async function submit(formData: FormData) {
    const result = await upsertCoupon({
      id: coupon?.id,
      code: String(formData.get("code") || ""),
      type: type as "PERCENTUAL" | "FIXO",
      value: Number(formData.get("value") || 0),
      usageLimit: Number(formData.get("usageLimit") || 0) || null,
      validUntil: fromLocalInput(String(formData.get("validUntil") || "")),
      validFrom: fromLocalInput(String(formData.get("validFrom") || "")),
      minAmount: Number(formData.get("minAmount") || 0) || null,
      perUserLimit: Number(formData.get("perUserLimit") || 0) || null,
      stackable: formData.get("stackable") === "on",
      description: String(formData.get("description") || "") || null,
      tripIds: activeTripIds,
      active: formData.get("active") !== "off",
    });

    if (result?.error) {
      alert(result.error);
      return;
    }
    window.location.href = "/admin/cupons";
  }

  const inputClass =
    "h-12 w-full rounded-xl border border-[#ddd2d8] bg-white px-4 text-sm uppercase tracking-wide outline-none transition focus:border-[#ec3f88] focus:ring-4 focus:ring-[#ec3f88]/10";
  const plainInputClass =
    "h-12 w-full rounded-xl border border-[#ddd2d8] bg-white px-4 text-sm outline-none transition focus:border-[#ec3f88] focus:ring-4 focus:ring-[#ec3f88]/10";
  const labelClass = "mb-2 block text-sm font-semibold text-[#302229]";

  return (
    <form action={submit} className="pb-12">
      <div className="mb-6 flex items-center gap-4">
        <a
          href="/admin/cupons"
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#eadfe4] bg-white text-[#38272e] shadow-sm transition hover:bg-[#fff4f8]"
        >
          <ArrowLeft size={20} />
        </a>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#21171b]">
            {coupon ? `Editar cupom ${coupon.code}` : "Novo cupom"}
          </h1>
          <p className="mt-1 text-sm text-[#77666e]">
            Códigos aplicados no checkout, com limites e período próprios.
          </p>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <section className="rounded-3xl border border-[#eadfe4] bg-white p-6 shadow-[0_10px_35px_rgba(61,29,44,0.05)]">
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className={labelClass}>Código *</label>
                <input
                  name="code"
                  required
                  defaultValue={coupon?.code ?? ""}
                  placeholder="EXEMPLO10"
                  className={inputClass}
                />
                <p className="mt-1 text-xs text-[#77666e]">
                  O cliente digita este código (sem espaços).
                </p>
              </div>
              <div>
                <label className={labelClass}>Tipo *</label>
                <select
                  name="type"
                  value={type}
                  onChange={(e) => setType(e.target.value as "PERCENTUAL" | "FIXO")}
                  className={plainInputClass}
                >
                  <option value="PERCENTUAL">Percentual (%)</option>
                  <option value="FIXO">Valor fixo (R$)</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>
                  {type === "PERCENTUAL" ? "Desconto (%) *" : "Desconto (R$) *"}
                </label>
                <input
                  name="value"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  defaultValue={coupon?.value ?? ""}
                  className={plainInputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Valor mínimo da compra (R$)</label>
                <input
                  name="minAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={coupon?.minAmount ?? ""}
                  placeholder="0 = sem mínimo"
                  className={plainInputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Válido a partir de</label>
                <input
                  name="validFrom"
                  type="date"
                  defaultValue={toLocalInput(coupon?.validFrom)}
                  className={plainInputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Válido até</label>
                <input
                  name="validUntil"
                  type="date"
                  defaultValue={toLocalInput(coupon?.validUntil)}
                  className={plainInputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Limite de usos (total)</label>
                <input
                  name="usageLimit"
                  type="number"
                  min="1"
                  defaultValue={coupon?.usageLimit ?? ""}
                  placeholder="Sem limite"
                  className={plainInputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Limite por cliente</label>
                <input
                  name="perUserLimit"
                  type="number"
                  min="1"
                  defaultValue={coupon?.perUserLimit ?? ""}
                  placeholder="Sem limite"
                  className={plainInputClass}
                />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Descrição (opcional)</label>
                <input
                  name="description"
                  defaultValue={coupon?.description ?? ""}
                  placeholder="Ex.: Cupom de boas-vindas"
                  className={plainInputClass}
                />
              </div>
            </div>

            <label className="mt-5 flex cursor-pointer items-center gap-3 rounded-xl border border-[#eee5e9] bg-[#fffafc] p-4">
              <input
                type="checkbox"
                name="stackable"
                defaultChecked={coupon?.stackable ?? false}
                className="h-5 w-5 accent-[#ec3f88]"
              />
              <div>
                <p className="text-sm font-semibold text-[#302229]">
                  Cumulativo com promoções
                </p>
                <p className="mt-1 text-xs text-[#77666e]">
                  Permite somar com promoções marcadas como cumulativas. Senão,
                  vale o maior desconto.
                </p>
              </div>
            </label>
          </section>

          <section className="rounded-3xl border border-[#eadfe4] bg-white p-6 shadow-[0_10px_35px_rgba(61,29,44,0.05)]">
            <div>
              <h2 className="text-lg font-bold text-[#21171b]">
                Viagens elegíveis
              </h2>
              <p className="mt-1 text-sm text-[#77666e]">
                Deixe em branco para valer em qualquer viagem.
              </p>
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-2">
              {trips.map((trip) => {
                const checked = activeTripIds.includes(trip.id);
                return (
                  <label
                    key={trip.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${
                      checked
                        ? "border-[#f4b3ce] bg-[#fff7fa]"
                        : "border-[#eee5e9] bg-white"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleTrip(trip.id)}
                      className="h-5 w-5 accent-[#ec3f88]"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-[#302229]">
                        {trip.name}
                      </span>
                      <span className="block text-xs text-[#77666e]">
                        {formatTripDepartureDate(trip)} · R$ {trip.pricePerson}
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
            <h2 className="font-bold text-[#21171b]">Status</h2>
            <p className="mt-1 text-xs text-[#77666e]">
              Cupons desativados não validam no checkout.
            </p>
            <div className="mt-4 space-y-3">
              <label className="flex items-center gap-2.5">
                <input
                  type="radio"
                  name="active"
                  value="on"
                  defaultChecked={coupon ? coupon.active : true}
                  className="h-5 w-5 accent-[#ec3f88]"
                />
                <span className="text-sm font-semibold">Ativo</span>
              </label>
              <label className="flex items-center gap-2.5">
                <input
                  type="radio"
                  name="active"
                  value="off"
                  defaultChecked={coupon ? !coupon.active : false}
                  className="h-5 w-5 accent-[#ec3f88]"
                />
                <span className="text-sm font-semibold">Inativo</span>
              </label>
            </div>
          </section>

          <div className="flex gap-3">
            <a
              href="/admin/cupons"
              className="flex h-13 flex-1 items-center justify-center rounded-xl border-2 border-[#ec3f88] bg-white font-bold text-[#9e275c] transition hover:bg-[#fff3f7]"
            >
              Cancelar
            </a>
            <button
              type="submit"
              className="flex h-13 flex-[1.4] items-center justify-center gap-2 rounded-xl bg-[#ec3f88] font-bold text-white shadow-lg shadow-[#ec3f88]/20 transition hover:bg-[#d92f75]"
            >
              <Save size={19} />
              {coupon ? "Salvar Alterações" : "Criar Cupom"}
            </button>
          </div>
        </aside>
      </div>
    </form>
  );
}