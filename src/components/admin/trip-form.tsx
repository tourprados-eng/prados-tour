
"use client";

import { useMemo, useRef, useState } from "react";
import { ImagePlus, MapPin, UploadCloud, Trash2, Lightbulb, Save, ArrowLeft, Star, GripVertical, X } from "lucide-react";
import { upsertTrip } from "@/lib/admin/actions";
import {
  normalizeTripCategory,
  TRIP_CATEGORIES,
  TRIP_CATEGORY_LABELS,
} from "@/lib/constants";
import type { Trip, TripBoardingPoint, TripItineraryDay, TripStatus } from "@/types";

type BoardingPoint = {
  id: string;
  name: string;
  address: string;
  active: boolean;
};

type ImageItem = {
  key: string;
  source: "saved" | "new";
  url?: string;
  file?: File;
  preview?: string;
};

export default function TripForm({
  boardingPoints,
  trip,
  tripBoardingPoints,
}: {
  boardingPoints: BoardingPoint[];
  trip?: Trip;
  tripBoardingPoints?: TripBoardingPoint[];
}) {
  const existingUrls = trip?.images ?? [];
  const initialPoints: Record<string, boolean> = {};
  const initialTimes: Record<string, string> = {};
  for (const link of tripBoardingPoints ?? []) {
    initialPoints[link.boardingPointId] = true;
    initialTimes[link.boardingPointId] = link.time;
  }

  const [items, setItems] = useState<ImageItem[]>(
    existingUrls.map((url) => ({ key: url, source: "saved", url })),
  );
  const [imageDragIndex, setImageDragIndex] = useState<number | null>(null);
  const [selectedPoints, setSelectedPoints] = useState<Record<string, boolean>>(initialPoints);
  const [times, setTimes] = useState<Record<string, string>>(initialTimes);
  const [order, setOrder] = useState<string[]>(
    (() => {
      if (tripBoardingPoints && tripBoardingPoints.length > 0) {
        return [...tripBoardingPoints]
          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
          .map((link) => link.boardingPointId);
      }
      return boardingPoints.filter((point) => initialPoints[point.id]).map((point) => point.id);
    })(),
  );
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [featured, setFeatured] = useState(true);
  const [formUrl, setFormUrl] = useState(trip?.formUrl ?? "");
  const [formRequired, setFormRequired] = useState(trip?.formRequired ?? true);
  const [childUnder5FreeWithTwoAdults, setChildUnder5FreeWithTwoAdults] = useState(
    trip?.childUnder5FreeWithTwoAdults ?? false,
  );
  const [insuranceEnabled, setInsuranceEnabled] = useState(
    trip?.insuranceEnabled ?? false,
  );
  const [itineraryDays, setItineraryDays] = useState<TripItineraryDay[]>(
    trip?.itineraryDays ?? [],
  );

  function addItineraryDay() {
    setItineraryDays((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        date: "",
        title: "",
        description: "",
      },
    ]);
  }

  function updateItineraryDay(
    id: string,
    field: keyof Omit<TripItineraryDay, "id">,
    value: string,
  ) {
    setItineraryDays((current) =>
      current.map((day) =>
        day.id === id ? { ...day, [field]: value } : day,
      ),
    );
  }

  function removeItineraryDay(id: string) {
    setItineraryDays((current) => current.filter((day) => day.id !== id));
  }

  const inputRef = useRef<HTMLInputElement>(null);

  const selectedCount = useMemo(
    () => Object.values(selectedPoints).filter(Boolean).length,
    [selectedPoints],
  );

  function togglePoint(id: string) {
    const isSelected = Boolean(selectedPoints[id]);
    setSelectedPoints((current) => ({
      ...current,
      [id]: !current[id],
    }));
    if (isSelected) {
      setOrder((current) => current.filter((pointId) => pointId !== id));
    } else {
      setOrder((current) =>
        current.includes(id) ? current : [...current, id],
      );
    }
  }

  function movePoint(from: number, to: number) {
    setOrder((current) => {
      if (from < 0 || from >= current.length || to < 0 || to >= current.length) {
        return current;
      }
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function changeTime(id: string, value: string) {
    setTimes((current) => ({
      ...current,
      [id]: value,
    }));
  }

  function addImages(files: FileList | null) {
    if (!files) return;

    const accepted = Array.from(files).filter((file) =>
      ["image/jpeg", "image/png", "image/webp"].includes(file.type),
    );

    const next: ImageItem[] = accepted.map((file) => ({
      key: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
      source: "new",
      file,
      preview: URL.createObjectURL(file),
    }));

    setItems((current) => [...current, ...next]);
  }

  function removeImage(key: string) {
    setItems((current) => {
      const found = current.find((image) => image.key === key);
      if (found?.preview) URL.revokeObjectURL(found.preview);
      return current.filter((image) => image.key !== key);
    });
  }

  function moveImage(from: number, to: number) {
    setItems((current) => {
      if (from < 0 || from >= current.length || to < 0 || to >= current.length) {
        return current;
      }
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function setMainImage(key: string) {
    setItems((current) => {
      if (current.length <= 1) return current;
      const index = current.findIndex((image) => image.key === key);
      if (index <= 0) return current;
      const next = [...current];
      const [moved] = next.splice(index, 1);
      next.unshift(moved);
      return next;
    });
  }

  async function submit(formData: FormData) {
    const selectedBoardingPoints = order
      .map((pointId) => {
        const point = boardingPoints.find((point) => point.id === pointId);
        return point
          ? { boardingPointId: point.id, time: times[point.id] || "" }
          : null;
      })
      .filter(
        (item): item is { boardingPointId: string; time: string } =>
          item !== null,
      );

    formData.set(
      "boardingPoints",
      JSON.stringify(selectedBoardingPoints),
    );

    formData.set("featured", featured ? "true" : "false");

    formData.set("insuranceEnabled", insuranceEnabled ? "true" : "false");

    /*
     * As imagens são enviadas para a API de upload antes de salvar a viagem.
     * A ordem dos itens define a ordem final (a primeira é a foto principal);
     * imagens já salvas são mantidas e novas são enviadas na posição em que o
     * administrador as deixou.
     */
    const orderedUrls: string[] = [];

    for (const item of items) {
      if (item.source === "saved" && item.url) {
        orderedUrls.push(item.url);
        continue;
      }
      if (item.source === "new" && item.file) {
        const uploadData = new FormData();
        uploadData.append("file", item.file);

        const response = await fetch("/api/admin/trip-images", {
          method: "POST",
          body: uploadData,
        });

        if (!response.ok) {
          alert("Não foi possível enviar uma das imagens.");
          return;
        }

        const result = await response.json();

        if (result.url) {
          orderedUrls.push(result.url);
        }
      }
    }

    formData.set("imageUrls", JSON.stringify(orderedUrls));

    const date = String(formData.get("date"));
    const departureDate = String(formData.get("departureDate"));
    const returnDate = String(formData.get("returnDate") || "");

    if (returnDate && returnDate < departureDate) {
      alert("A data de retorno não pode ser anterior à data de saída.");
      return;
    }

    const result = await upsertTrip({
      id: trip?.id,
      name: String(formData.get("name")),
      destination: String(formData.get("destination")),
      category: String(formData.get("category")),
      date,
      departureDate,
      departureTime: String(formData.get("departureTime")),
      returnTime: String(formData.get("returnTime")),
      returnDate: returnDate || undefined,
      pricePerson: Number(formData.get("pricePerson")),
      priceCouple: Number(formData.get("priceCouple") || 0),
      childPrice: Math.max(0, Number(formData.get("childPrice") || 0)),
      childMaxAge: 5,
      childUnder5FreeWithTwoAdults,
      insuranceEnabled: insuranceEnabled,
      insurancePrice: Number(formData.get("insurancePrice") || 20),
      transportPolicy: String(formData.get("transportPolicy")),
      totalSeats: Number(formData.get("totalSeats")),
      description: String(formData.get("description")),
      itinerary: String(formData.get("itinerary")),
      itineraryDays,
      included: String(formData.get("included")),
      notIncluded: String(formData.get("notIncluded")),
      rules: String(formData.get("rules")),
      cancellationPolicy: String(formData.get("cancellationPolicy")),
      status: String(formData.get("status")) as TripStatus,
      imageUrl: orderedUrls[0] || undefined,
      imageUrls: orderedUrls,
      formUrl: formUrl.trim() || undefined,
      formRequired,
      boardingPoints: selectedBoardingPoints,
    });

    if (result?.error) {
      alert(result.error);
      return;
    }

    window.location.href = "/admin/viagens";
  }

  return (
    <form action={submit} className="pb-12">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <a
            href="/admin/viagens"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#eadfe4] bg-white text-[#38272e] shadow-sm transition hover:bg-[#fff4f8]"
          >
            <ArrowLeft size={20} />
          </a>

          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[#21171b]">
              {trip ? "Editar Viagem" : "Nova Viagem"}
            </h1>
            <p className="mt-1 text-sm text-[#77666e]">
              {trip
                ? "Atualize as informações desta viagem"
                : "Preencha as informações da viagem"}
            </p>
          </div>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <span className="text-sm text-[#77666e]">
            {selectedCount} pontos selecionados
          </span>
          <span className="h-2 w-2 rounded-full bg-[#ec3f88]" />
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_410px]">
        <div className="space-y-5">

          {/* INFORMAÇÕES */}
          <section className="rounded-3xl border border-[#eadfe4] bg-white p-6 shadow-[0_10px_35px_rgba(61,29,44,0.05)]">
            <div className="grid gap-5 md:grid-cols-2">

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#302229]">
                  Nome da viagem *
                </label>
                <input
                  name="name"
                  required
                  defaultValue={trip?.name ?? ""}
                  placeholder="Ex.: Guarujá - Praia da Enseada"
                  className="h-12 w-full rounded-xl border border-[#ddd2d8] bg-white px-4 text-sm outline-none transition focus:border-[#ec3f88] focus:ring-4 focus:ring-[#ec3f88]/10"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#302229]">
                  Categoria *
                </label>
                <select
                  name="category"
                  required
                  defaultValue={normalizeTripCategory(trip?.category)}
                  className="h-12 w-full rounded-xl border border-[#ddd2d8] bg-white px-4 text-sm outline-none focus:border-[#ec3f88]"
                >
                  {TRIP_CATEGORIES.map((value) => (
                    <option key={value} value={value}>
                      {TRIP_CATEGORY_LABELS[value]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#302229]">
                  Destino *
                </label>
                <input
                  name="destination"
                  required
                  defaultValue={trip?.destination ?? ""}
                  placeholder="Ex.: Guarujá - SP"
                  className="h-12 w-full rounded-xl border border-[#ddd2d8] px-4 text-sm outline-none focus:border-[#ec3f88]"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#302229]">
                  Data da viagem *
                </label>
                <input
                  name="date"
                  type="date"
                  required
                  defaultValue={trip?.date ?? ""}
                  className="h-12 w-full rounded-xl border border-[#ddd2d8] bg-white px-4 text-sm outline-none focus:border-[#ec3f88]"
                />
              </div>

              <div className="rounded-2xl border border-[#f2dce5] bg-[#fff8fb] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#ec3f88]">
                  Saída
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-[#302229]">
                      Data da saída *
                    </label>
                    <input
                      name="departureDate"
                      type="date"
                      required
                      defaultValue={trip?.departureDate ?? trip?.date ?? ""}
                      className="h-12 w-full rounded-xl border border-[#ddd2d8] bg-white px-4 text-sm outline-none focus:border-[#ec3f88]"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-[#302229]">
                      Horário da saída *
                    </label>
                    <input
                      name="departureTime"
                      type="time"
                      required
                      defaultValue={trip?.departureTime ?? ""}
                      className="h-12 w-full rounded-xl border border-[#ddd2d8] bg-white px-4 text-sm outline-none focus:border-[#ec3f88]"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-[#f2dce5] bg-[#fff8fb] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#f28c28]">
                  Retorno
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-[#302229]">
                      Data do retorno *
                    </label>
                    <input
                      name="returnDate"
                      type="date"
                      required
                      defaultValue={trip?.returnDate ?? ""}
                      min={trip?.departureDate ?? trip?.date ?? undefined}
                      className="h-12 w-full rounded-xl border border-[#ddd2d8] bg-white px-4 text-sm outline-none focus:border-[#ec3f88]"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-[#302229]">
                      Horário do retorno *
                    </label>
                    <input
                      name="returnTime"
                      type="time"
                      required
                      defaultValue={trip?.returnTime ?? ""}
                      className="h-12 w-full rounded-xl border border-[#ddd2d8] bg-white px-4 text-sm outline-none focus:border-[#ec3f88]"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#302229]">
                  Preço por pessoa (R$) *
                </label>
                <input
                  name="pricePerson"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  defaultValue={trip?.pricePerson ?? ""}
                  placeholder="175,00"
                  className="h-12 w-full rounded-xl border border-[#ddd2d8] px-4 text-sm outline-none focus:border-[#ec3f88]"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#302229]">
                  Preço para casal (R$)
                </label>
                <input
                  name="priceCouple"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={trip?.priceCouple ?? ""}
                  placeholder="320,00"
                  className="h-12 w-full rounded-xl border border-[#ddd2d8] px-4 text-sm outline-none focus:border-[#ec3f88]"
                />
              </div>

              <div className="md:col-span-2">
                <div className="rounded-2xl border border-[#f2dce5] bg-[#fff8fb] p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#f28c28]">
                    Política de crianças
                  </p>

                  <div className="mt-3">
                    <label className="mb-2 block text-sm font-semibold text-[#302229]">
                      Preço da criança (R$)
                    </label>
                    <input
                      name="childPrice"
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      defaultValue={trip?.childPrice ?? 0}
                      placeholder="0,00"
                      className="h-12 w-full rounded-xl border border-[#ddd2d8] px-4 text-sm outline-none focus:border-[#ec3f88]"
                    />
                    <p className="mt-1 text-xs text-[#77666e]">
                      Defina livremente o valor infantil desta viagem. R$ 0,00 é válido.
                    </p>
                  </div>

                  <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-[#eee5e9] bg-white p-4">
                    <input
                      type="checkbox"
                      checked={childUnder5FreeWithTwoAdults}
                      onChange={(e) => setChildUnder5FreeWithTwoAdults(e.target.checked)}
                      className="mt-0.5 h-5 w-5 accent-[#ec3f88]"
                    />
                    <div>
                      <p className="text-sm font-semibold text-[#302229]">
                        Menor de 5 anos viaja grátis com 2 adultos pagantes
                      </p>
                      <p className="mt-1 text-xs text-[#77666e]">
                        Quando ativada, a criança com menos de 5 anos viaja gratuitamente
                        acompanhada de 2 adultos pagantes e viajando no colo.
                        Com apenas 1 adulto pagante, será cobrado 50% do preço infantil.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#eee5e9] bg-[#fffafc] p-4">
                  <input
                    type="checkbox"
                    checked={insuranceEnabled}
                    onChange={(e) => setInsuranceEnabled(e.target.checked)}
                    className="h-5 w-5 accent-[#ec3f88]"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-[#302229]">
                      Seguro viagem opcional
                    </p>
                    <p className="mt-1 text-xs text-[#77666e]">
                      O cliente poderá adicionar o seguro por passageiro no
                      momento da reserva.
                    </p>
                  </div>
                  <div className="w-[150px]">
                    <label className="mb-1 block text-xs font-medium text-[#77666e]">
                      Valor por pessoa (R$)
                    </label>
                    <input
                      name="insurancePrice"
                      type="number"
                      step="0.01"
                      min="0"
                      disabled={!insuranceEnabled}
                      defaultValue={trip?.insurancePrice ?? 20}
                      className="h-11 w-full rounded-xl border border-[#ddd2d8] bg-white px-3 text-sm font-semibold outline-none focus:border-[#ec3f88] disabled:cursor-not-allowed disabled:bg-[#f6f2f4] disabled:text-[#b3a4ac]"
                    />
                  </div>
                </label>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#302229]">
                  Total de vagas *
                </label>
                <input
                  name="totalSeats"
                  type="number"
                  min="1"
                  defaultValue={trip?.totalSeats ?? 46}
                  required
                  className="h-12 w-full rounded-xl border border-[#ddd2d8] px-4 text-sm outline-none focus:border-[#ec3f88]"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#302229]">
                  Status *
                </label>
                <select
                  name="status"
                  defaultValue={trip?.status ?? "PUBLICADA"}
                  className="h-12 w-full rounded-xl border border-[#ddd2d8] px-4 text-sm outline-none focus:border-[#ec3f88]"
                >
                  <option value="PUBLICADA">Publicada</option>
                  <option value="RASCUNHO">Rascunho</option>
                  <option value="ESGOTADA">Esgotada</option>
                  <option value="CANCELADA">Cancelada</option>
                  <option value="FINALIZADA">Finalizada</option>
                  <option value="ARQUIVADA">Arquivada</option>
                </select>
              </div>
            </div>
          </section>

          {/* FORMULÁRIO DO PASSAGEIRO */}
          <section className="rounded-3xl border border-[#eadfe4] bg-white p-6 shadow-[0_10px_35px_rgba(61,29,44,0.05)]">
            <div className="mb-5 flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#ffe5f0] text-[#ec3f88]">
                <Lightbulb size={22} />
              </div>

              <div>
                <h2 className="text-xl font-bold text-[#21171b]">
                  Formulário do passageiro
                </h2>
                <p className="mt-1 text-sm text-[#77666e]">
                  Cadastre o formulário que o cliente deverá preencher antes de concluir a reserva.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-[#302229]">
                  Link do formulário
                </label>
                <input
                  type="url"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  placeholder="https://forms.google.com/..."
                  className="h-12 w-full rounded-xl border border-[#ddd2d8] bg-white px-4 text-sm outline-none transition focus:border-[#ec3f88] focus:ring-4 focus:ring-[#ec3f88]/10"
                />
                <p className="mt-2 text-xs text-[#77666e]">
                  Ex.: Google Forms ou outro formulário externo utilizado pela Prado’s Tour.
                </p>
              </div>

              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#eee5e9] bg-[#fffafc] p-4">
                <input
                  type="checkbox"
                  checked={formRequired}
                  onChange={(e) => setFormRequired(e.target.checked)}
                  className="h-5 w-5 accent-[#ec3f88]"
                />
                <div>
                  <p className="text-sm font-semibold text-[#302229]">
                    Exigir preenchimento antes da reserva
                  </p>
                  <p className="mt-1 text-xs text-[#77666e]">
                    O cliente deverá confirmar que preencheu o formulário para continuar.
                  </p>
                </div>
              </label>
            </div>
          </section>

          {/* PONTOS */}
          <section className="rounded-3xl border border-[#eadfe4] bg-white p-6 shadow-[0_10px_35px_rgba(61,29,44,0.05)]">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div className="flex gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#ffe5f0] text-[#ec3f88]">
                  <MapPin size={23} />
                </div>

                <div>
                  <h2 className="text-xl font-bold text-[#21171b]">
                    Pontos de embarque
                  </h2>
                  <p className="mt-1 text-sm text-[#77666e]">
                    Selecione os pontos que estarão disponíveis nesta viagem e
                    informe o horário de cada um.
                  </p>
                </div>
              </div>

              <div className="hidden rounded-xl bg-[#ffe1ee] px-4 py-2 text-sm font-bold text-[#d82e73] sm:block">
                {selectedCount} ponto{selectedCount === 1 ? "" : "s"} selecionado{selectedCount === 1 ? "" : "s"}
              </div>
            </div>

            <div className="space-y-2">
              {order.length === 0 && (
                <p className="rounded-2xl border border-dashed border-[#e3d5dc] bg-[#fffafc] p-4 text-sm text-[#9a8a92]">
                  Nenhum ponto selecionado ainda. Adicione os pontos na ordem
                  em que o ônibus passará por eles.
                </p>
              )}

              {order.map((pointId, index) => {
                const point = boardingPoints.find((point) => point.id === pointId);
                if (!point) return null;

                return (
                  <div
                    key={point.id}
                    draggable
                    onDragStart={() => setDragIndex(index)}
                    onDragOver={(event) => event.preventDefault()}
                    onDragEnd={() => setDragIndex(null)}
                    onDrop={() => {
                      if (dragIndex !== null && dragIndex !== index) {
                        movePoint(dragIndex, index);
                      }
                      setDragIndex(null);
                    }}
                    className={`flex items-center gap-3 rounded-2xl border p-3 transition ${
                      dragIndex === index
                        ? "border-[#ec3f88] bg-[#ffe5f0]"
                        : "border-[#f4b3ce] bg-[#fff7fa]"
                    }`}
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#ec3f88] text-xs font-bold text-white">
                      {index + 1}
                    </span>

                    <span
                      className="cursor-grab select-none text-[#b297a3]"
                      title="Arraste para reordenar"
                    >
                      <GripVertical size={18} />
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-[#302229]">
                        {point.name}
                      </p>
                      <p className="text-sm text-[#77666e]">
                        {point.address}
                      </p>
                    </div>

                    <div className="w-[145px]">
                      <label className="mb-1 block text-xs font-medium text-[#77666e]">
                        Horário de embarque
                      </label>
                      <input
                        name={`boardingTime_${point.id}`}
                        type="time"
                        value={times[point.id] || ""}
                        onChange={(event) => changeTime(point.id, event.target.value)}
                        className="h-11 w-full rounded-xl border border-[#ddd2d8] bg-white px-3 text-sm font-semibold outline-none focus:border-[#ec3f88]"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => togglePoint(point.id)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#b197a2] transition hover:bg-red-50 hover:text-red-500"
                      title="Remover ponto"
                    >
                      <X size={18} />
                    </button>

                    <input
                      type="checkbox"
                      name="boardingPointIds"
                      value={point.id}
                      checked={Boolean(selectedPoints[point.id])}
                      onChange={() => togglePoint(point.id)}
                      className="hidden"
                    />
                  </div>
                );
              })}
            </div>

            {boardingPoints.filter((point) => !order.includes(point.id)).length > 0 && (
              <div className="mt-4 rounded-2xl border border-dashed border-[#e3d5dc] bg-white p-3">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#9a8a92]">
                  Adicionar pontos
                </p>
                <div className="space-y-1">
                  {boardingPoints
                    .filter((point) => !order.includes(point.id))
                    .map((point) => (
                      <div
                        key={point.id}
                        className="flex items-center justify-between gap-3 rounded-xl px-2 py-2 hover:bg-[#fffafc]"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-[#302229]">
                            {point.name}
                          </p>
                          <p className="text-xs text-[#77666e]">
                            {point.address}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => togglePoint(point.id)}
                          className="shrink-0 rounded-lg border border-[#f4b3ce] px-3 py-1.5 text-xs font-semibold text-[#d82e73] transition hover:bg-[#ffe5f0]"
                        >
                          + Adicionar
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </section>

          {/* TEXTOS */}
          <section className="rounded-3xl border border-[#eadfe4] bg-white p-6 shadow-[0_10px_35px_rgba(61,29,44,0.05)]">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ffe5f0] text-[#ec3f88]">
                <ImagePlus size={20} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-[#21171b]">
                  Descrição da viagem
                </h2>
                <p className="text-sm text-[#77666e]">
                  Informações que aparecerão para o cliente.
                </p>
              </div>
            </div>

            <textarea
              name="description"
              required
              rows={5}
              defaultValue={trip?.description ?? ""}
              placeholder="Descreva a viagem, atrações, o que será feito, etc."
              className="w-full resize-y rounded-2xl border border-[#ddd2d8] p-4 text-sm leading-6 outline-none focus:border-[#ec3f88] focus:ring-4 focus:ring-[#ec3f88]/10"
            />

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <label className="block text-sm font-semibold">
                      Roteiro por dia
                    </label>
                    <p className="mt-1 text-xs text-[#77666e]">
                      Cadastre cada dia da viagem. O dia da semana será calculado automaticamente pela data.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={addItineraryDay}
                    className="shrink-0 rounded-xl bg-[#ec3f88] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#d82e73]"
                  >
                    + Adicionar dia
                  </button>
                </div>

                {itineraryDays.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[#e3d5dc] bg-[#fffafc] p-5 text-center">
                    <p className="text-sm font-semibold text-[#77666e]">
                      Nenhum dia cadastrado
                    </p>
                    <p className="mt-1 text-xs text-[#9a8a92]">
                      Clique em “Adicionar dia” para montar o roteiro da viagem.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {itineraryDays.map((day, index) => (
                      <div
                        key={day.id}
                        className="rounded-2xl border border-[#eadfe4] bg-[#fffafc] p-4"
                      >
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <div>
                            <span className="text-xs font-bold uppercase tracking-wide text-[#ec3f88]">
                              Dia {index + 1}
                            </span>
                            {day.date && (
                              <p className="mt-1 text-xs font-medium text-[#77666e]">
                                {new Intl.DateTimeFormat("pt-BR", {
                                  weekday: "long",
                                  timeZone: "UTC",
                                }).format(new Date(`${day.date}T00:00:00`))}
                              </p>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => removeItineraryDay(day.id)}
                            className="rounded-lg p-2 text-[#b197a2] transition hover:bg-red-50 hover:text-red-500"
                            title="Remover dia"
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
                          <div>
                            <label className="mb-2 block text-xs font-semibold text-[#77666e]">
                              Data
                            </label>
                            <input
                              type="date"
                              value={day.date}
                              onChange={(event) =>
                                updateItineraryDay(
                                  day.id,
                                  "date",
                                  event.target.value,
                                )
                              }
                              className="h-11 w-full rounded-xl border border-[#ddd2d8] bg-white px-3 text-sm outline-none focus:border-[#ec3f88]"
                            />
                          </div>

                          <div>
                            <label className="mb-2 block text-xs font-semibold text-[#77666e]">
                              Título / local
                            </label>
                            <input
                              type="text"
                              value={day.title}
                              onChange={(event) =>
                                updateItineraryDay(
                                  day.id,
                                  "title",
                                  event.target.value,
                                )
                              }
                              placeholder="Ex.: ARRAIAL DO CABO"
                              className="h-11 w-full rounded-xl border border-[#ddd2d8] bg-white px-3 text-sm outline-none focus:border-[#ec3f88]"
                            />
                          </div>
                        </div>

                        <div className="mt-4">
                          <label className="mb-2 block text-xs font-semibold text-[#77666e]">
                            Descrição
                          </label>
                          <textarea
                            value={day.description}
                            onChange={(event) =>
                              updateItineraryDay(
                                day.id,
                                "description",
                                event.target.value,
                              )
                            }
                            rows={3}
                            placeholder="Informe o que acontecerá neste dia..."
                            className="w-full resize-y rounded-xl border border-[#ddd2d8] bg-white p-3 text-sm leading-6 outline-none focus:border-[#ec3f88]"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <input
                  type="hidden"
                  name="itinerary"
                  value={trip?.itinerary ?? ""}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Incluso *
                </label>
                <textarea
                  name="included"
                  required
                  rows={5}
                  defaultValue={trip?.included ?? ""}
                  placeholder="Transporte, ingresso, guia..."
                  className="w-full rounded-2xl border border-[#ddd2d8] p-4 text-sm outline-none focus:border-[#ec3f88]"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Não incluso *
                </label>
                <textarea
                  name="notIncluded"
                  required
                  rows={4}
                  defaultValue={trip?.notIncluded ?? ""}
                  placeholder="Alimentação, despesas pessoais..."
                  className="w-full rounded-2xl border border-[#ddd2d8] p-4 text-sm outline-none focus:border-[#ec3f88]"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Regras *
                </label>
                <textarea
                  name="rules"
                  required
                  rows={4}
                  defaultValue={trip?.rules ?? ""}
                  placeholder="Regras da viagem..."
                  className="w-full rounded-2xl border border-[#ddd2d8] p-4 text-sm outline-none focus:border-[#ec3f88]"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-semibold">
                  Cancelamento *
                </label>
                <textarea
                  name="cancellationPolicy"
                  required
                  rows={4}
                  defaultValue={trip?.cancellationPolicy ?? ""}
                  placeholder="Política de cancelamento..."
                  className="w-full rounded-2xl border border-[#ddd2d8] p-4 text-sm outline-none focus:border-[#ec3f88]"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-semibold">
                  Política de transporte
                </label>
                <textarea
                  name="transportPolicy"
                  rows={4}
                  defaultValue={trip?.transportPolicy ?? ""}
                  placeholder="Regras de transporte, embarque, poltronas, crianças no ônibus..."
                  className="w-full rounded-2xl border border-[#ddd2d8] p-4 text-sm outline-none focus:border-[#ec3f88]"
                />
              </div>
            </div>
          </section>
        </div>

        {/* COLUNA DIREITA */}
        <aside className="space-y-5">

          {/* IMAGENS */}
          <section className="rounded-3xl border border-[#eadfe4] bg-white p-5 shadow-[0_10px_35px_rgba(61,29,44,0.05)]">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ffe5f0] text-[#ec3f88]">
                <ImagePlus size={21} />
              </div>

              <div>
                <h2 className="font-bold text-[#21171b]">
                  Imagens da viagem
                </h2>
                <p className="text-xs text-[#77666e]">
                  Fotos exibidas na página da viagem.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#f19bc0] bg-[#fff8fb] px-5 py-8 text-center transition hover:bg-[#fff0f6]"
            >
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#ffe0ed] text-[#ec3f88]">
                <UploadCloud size={27} />
              </div>

              <p className="text-sm font-bold text-[#302229]">
                Clique para selecionar imagens
              </p>

              <p className="mt-1 text-xs text-[#ec3f88]">
                ou arraste e solte aqui
              </p>

              <p className="mt-3 text-[11px] text-[#77666e]">
                PNG, JPG ou WEBP
              </p>
            </button>

            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              onChange={(e) => addImages(e.target.files)}
              className="hidden"
            />

            {items.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-semibold text-[#77666e]">
                  Arraste para reordenar. A primeira foto é a capa da viagem.
                </p>

                {items.map((image, index) => (
                  <div
                    key={image.key}
                    draggable
                    onDragStart={() => setImageDragIndex(index)}
                    onDragOver={(event) => event.preventDefault()}
                    onDragEnd={() => setImageDragIndex(null)}
                    onDrop={() => {
                      if (imageDragIndex !== null && imageDragIndex !== index) {
                        moveImage(imageDragIndex, index);
                      }
                      setImageDragIndex(null);
                    }}
                    className={`flex items-center gap-3 rounded-2xl border bg-white p-2 pr-3 transition ${
                      imageDragIndex === index
                        ? "border-[#ec3f88] bg-[#ffe5f0]"
                        : "border-[#f4b3ce] bg-[#fff7fa]"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- preview usa blob: URL (objectURL) ou URL remota/fixa */}
                    <img
                      src={image.source === "saved" ? image.url : image.preview}
                      alt=""
                      className="h-16 w-20 shrink-0 rounded-xl object-cover"
                    />

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-[#302229]">
                        {image.source === "saved"
                          ? "Foto da viagem"
                          : image.file?.name || "Foto da viagem"}
                      </p>
                      <p className="text-xs text-[#77666e]">
                        {index === 0
                          ? "Foto principal (capa)"
                          : `Posição ${index + 1}`}
                      </p>
                    </div>

                    {index !== 0 && (
                      <button
                        type="button"
                        onClick={() => setMainImage(image.key)}
                        title="Definir como foto principal"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#b197a2] transition hover:bg-amber-50 hover:text-amber-500"
                      >
                        <Star size={17} />
                      </button>
                    )}

                    <span
                      className="cursor-grab select-none text-[#b297a3]"
                      title="Arraste para reordenar"
                    >
                      <GripVertical size={18} />
                    </span>

                    <button
                      type="button"
                      onClick={() => removeImage(image.key)}
                      title="Remover foto"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#b197a2] transition hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 flex gap-3 rounded-2xl border border-[#f2dce5] bg-[#fff8fb] p-4">
              <Lightbulb
                size={21}
                className="shrink-0 text-[#f28c28]"
              />
              <p className="text-xs leading-5 text-[#66535b]">
                Adicione de 3 a 6 imagens para deixar a viagem mais atrativa.
              </p>
            </div>
          </section>

          {/* DESTAQUE */}
          <section className="flex items-center justify-between rounded-3xl border border-[#eadfe4] bg-white p-5 shadow-[0_10px_35px_rgba(61,29,44,0.05)]">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ffe5f0] text-[#ec3f88]">
                <Star size={20} />
              </div>

              <div>
                <p className="font-bold text-[#21171b]">
                  Destaque da viagem
                </p>
                <p className="text-xs text-[#77666e]">
                  Exibir esta viagem nos destaques
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setFeatured((value) => !value)}
              className={`relative h-7 w-12 rounded-full transition ${
                featured ? "bg-[#ec3f88]" : "bg-[#d7cbd1]"
              }`}
              aria-label="Alternar destaque"
            >
              <span
                className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${
                  featured ? "left-6" : "left-1"
                }`}
              />
            </button>
          </section>

          {/* BOTÕES */}
          <div className="flex gap-3">
            <a
              href="/admin/viagens"
              className="flex h-13 flex-1 items-center justify-center rounded-xl border-2 border-[#ec3f88] bg-white font-bold text-[#9e275c] transition hover:bg-[#fff3f7]"
            >
              Cancelar
            </a>

            <button
              type="submit"
              className="flex h-13 flex-[1.4] items-center justify-center gap-2 rounded-xl bg-[#ec3f88] font-bold text-white shadow-lg shadow-[#ec3f88]/20 transition hover:bg-[#d92f75]"
            >
              <Save size={19} />
              {trip ? "Salvar Alterações" : "Salvar Viagem"}
            </button>
          </div>
        </aside>
      </div>
    </form>
  );
}
