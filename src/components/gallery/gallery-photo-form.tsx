"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { X } from "lucide-react";
import { createGalleryPhotosAction } from "@/lib/gallery/actions";
import { formatTripDepartureDate } from "@/lib/utils";

type TripOption = {
  id: string;
  name: string;
  date: string;
  departureDate: string | null;
};

type SelectedPhoto = {
  id: string;
  file: File;
  preview: string;
};

const MAX_PHOTOS = 10;
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

export function GalleryPhotoForm({
  trips,
}: {
  trips: TripOption[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [tripId, setTripId] = useState(trips[0]?.id ?? "");
  const [caption, setCaption] = useState("");
  const [photos, setPhotos] = useState<SelectedPhoto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function releasePreviews(list: SelectedPhoto[]) {
    for (const photo of list) {
      URL.revokeObjectURL(photo.preview);
    }
  }

  function handleFilesSelection(files: FileList | null) {
    if (!files || files.length === 0) return;

    setError(null);
    setSuccess(null);
    setWarning(null);

    const selected: SelectedPhoto[] = [];
    const problems: string[] = [];

    for (const file of Array.from(files)) {
      if (!ALLOWED.includes(file.type)) {
        problems.push(
          `${file.name}: formato inválido. Use JPG, PNG ou WebP.`,
        );
        continue;
      }

      if (file.size <= 0 || file.size > MAX_BYTES) {
        problems.push(`${file.name}: deve ter no máximo 5 MB.`);
        continue;
      }

      if (photos.length + selected.length >= MAX_PHOTOS) {
        problems.push(`Máximo de ${MAX_PHOTOS} fotos por envio.`);
        break;
      }

      selected.push({
        id: crypto.randomUUID(),
        file,
        preview: URL.createObjectURL(file),
      });
    }

    if (selected.length > 0) {
      setPhotos((prev) => [...prev, ...selected]);
    }

    if (problems.length > 0) {
      setError(problems.join(" "));
    }

    if (inputRef.current) inputRef.current.value = "";
  }

  function removePhoto(id: string) {
    setError(null);
    setSuccess(null);
    setWarning(null);

    setPhotos((prev) => {
      const target = prev.find((photo) => photo.id === id);
      if (target) URL.revokeObjectURL(target.preview);
      return prev.filter((photo) => photo.id !== id);
    });
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setWarning(null);

    if (pending) return;

    if (!tripId) {
      setError("Selecione a viagem.");
      return;
    }

    if (photos.length === 0) {
      setError("Selecione ao menos uma foto.");
      return;
    }

    startTransition(async () => {
      const uploadedFileIds: string[] = [];
      const failedPhotos: SelectedPhoto[] = [];

      for (let i = 0; i < photos.length; i += 1) {
        const photo = photos[i];
        setProgress(`Enviando foto ${i + 1} de ${photos.length}...`);

        const uploadData = new FormData();
        uploadData.append("file", photo.file);

        try {
          const response = await fetch("/api/gallery/upload", {
            method: "POST",
            body: uploadData,
          });

          const uploadResult = await response.json();

          if (uploadResult?.success && uploadResult.fileId) {
            uploadedFileIds.push(uploadResult.fileId);
          } else {
            failedPhotos.push(photo);
          }
        } catch {
          failedPhotos.push(photo);
        }
      }

      setProgress(null);

      let createdCount = 0;
      let serverMissed = 0;
      let actionError: string | null = null;

      if (uploadedFileIds.length > 0) {
        const result = await createGalleryPhotosAction({
          tripId,
          fileIds: uploadedFileIds,
          caption,
        });

        if (result.error) {
          actionError = result.error;
        } else {
          createdCount = result.createdCount ?? 0;
          serverMissed = result.failedFileIds?.length ?? 0;
        }
      }

      const failedIds = new Set(failedPhotos.map((photo) => photo.id));

      if (actionError) {
        setError(actionError);
      } else if (createdCount > 0) {
        setSuccess(
          `${createdCount} ${createdCount === 1 ? "foto enviada" : "fotos enviadas"} para aprovação da equipe.`,
        );
      } else if (uploadedFileIds.length === 0) {
        setError(
          "Nenhuma foto foi enviada. Verifique sua conexão e tente novamente.",
        );
      }

      if (failedPhotos.length > 0) {
        setWarning(
          `Não foi possível enviar: ${failedPhotos
            .map((photo) => photo.file.name)
            .join(", ")}. ${failedPhotos.length === 1 ? "Ela continua" : "Elas continuam"} selecionada(s) para você tentar de novo.`,
        );
      } else if (serverMissed > 0) {
        setWarning(
          `${serverMissed} ${serverMissed === 1 ? "foto" : "fotos"} não ${serverMissed === 1 ? "foi" : "foram"} validada(s) no servidor, mas o restante foi enviado.`,
        );
      }

      if (!actionError) {
        const kept = photos.filter(
          (photo) => failedIds.has(photo.id),
        );

        releasePreviews(
          photos.filter((photo) => !failedIds.has(photo.id)),
        );

        setPhotos(kept);
        setCaption("");
      }

      router.refresh();
    });
  }

  if (trips.length === 0) {
    return null;
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-3xl bg-white/90 p-6 shadow-card ring-1 ring-black/5 sm:p-7"
    >
      <div>
        <p className="font-[family-name:var(--font-display)] text-xl font-bold text-brand-ink">
          Compartilhe fotos da sua viagem
        </p>
        <p className="mt-1 text-sm leading-relaxed text-brand-muted">
          Envie lembranças da sua experiência com a Prado&apos;s Tour (até{" "}
          {MAX_PHOTOS} fotos). As publicações passam por aprovação da nossa
          equipe.
        </p>
      </div>

      <label className="mt-6 block">
        <span className="text-sm font-semibold text-brand-ink">
          Qual viagem?
        </span>
        <select
          value={tripId}
          onChange={(event) => setTripId(event.target.value)}
          disabled={pending}
          className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 disabled:opacity-60"
        >
          {trips.map((trip) => (
            <option key={trip.id} value={trip.id}>
              {trip.name} · {formatTripDepartureDate(trip)}
            </option>
          ))}
        </select>
      </label>

      <div className="mt-6">
        <span className="flex items-center justify-between text-sm font-semibold text-brand-ink">
          Suas fotos
          <span className="text-xs font-normal text-brand-faint">
            {photos.length}/{MAX_PHOTOS}
          </span>
        </span>

        <label className="mt-2 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-brand-primary/25 bg-brand-tint/35 px-4 py-6 text-center transition hover:border-brand-primary/50 hover:bg-brand-tint/55">
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) =>
              handleFilesSelection(event.target.files)
            }
            disabled={pending || photos.length >= MAX_PHOTOS}
            className="sr-only"
          />
          <span className="text-sm font-semibold text-brand-primary">
            {photos.length > 0
              ? "Adicionar mais fotos"
              : "Escolher fotos"}
          </span>
          <span className="mt-1 text-xs text-brand-muted">
            JPG, PNG ou WebP · até 5 MB por foto
          </span>
        </label>
      </div>

      {photos.length > 0 && (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="relative overflow-hidden rounded-2xl bg-brand-tint"
            >
              <div className="relative aspect-[4/3] w-full">
                <Image
                  src={photo.preview}
                  alt={`Pré-visualização de ${photo.file.name}`}
                  fill
                  unoptimized
                  className="object-cover"
                />
              </div>
              <button
                type="button"
                onClick={() => removePhoto(photo.id)}
                disabled={pending}
                aria-label={`Remover ${photo.file.name}`}
                className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-white/95 text-brand-ink shadow ring-1 ring-black/10 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          ))}
        </div>
      )}

      <label className="mt-6 block">
        <span className="text-sm font-semibold text-brand-ink">
          Legenda
        </span>
        <textarea
          value={caption}
          onChange={(event) => setCaption(event.target.value)}
          maxLength={300}
          rows={3}
          placeholder="Conte um pouquinho desse momento..."
          disabled={pending}
          className="mt-2 w-full resize-none rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 disabled:opacity-60"
        />
        <span className="mt-1 block text-right text-xs text-brand-faint">
          {caption.length}/300
        </span>
      </label>

      {error && (
        <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
          {error}
        </p>
      )}

      {warning && (
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-700">
          {warning}
        </p>
      )}

      {success && (
        <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">
          {success}
        </p>
      )}

      {progress && (
        <p className="mt-3 rounded-xl bg-brand-tint px-3 py-2.5 text-sm text-brand-muted">
          {progress}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-6 w-full rounded-full bg-gradient-to-r from-brand-primary to-brand-secondary px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:brightness-[1.06] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending
          ? "Enviando fotos..."
          : photos.length > 0
            ? `Enviar ${photos.length} ${photos.length === 1 ? "foto" : "fotos"} para aprovação`
            : "Enviar fotos para aprovação"}
      </button>

      <p className="mt-3 text-center text-xs leading-relaxed text-brand-faint">
        Suas fotos só serão exibidas publicamente depois da aprovação da
        equipe.
      </p>
    </form>
  );
}