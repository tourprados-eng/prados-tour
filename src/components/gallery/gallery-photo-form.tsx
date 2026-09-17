"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createGalleryPhotoAction } from "@/lib/gallery/actions";

type TripOption = {
  id: string;
  name: string;
  date: string;
};

export function GalleryPhotoForm({
  trips,
}: {
  trips: TripOption[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [tripId, setTripId] = useState(trips[0]?.id ?? "");
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleFileChange(nextFile: File | null) {
    setError(null);
    setSuccess(null);

    if (!nextFile) {
      setFile(null);
      setPreview(null);
      return;
    }

    const allowed = ["image/jpeg", "image/png", "image/webp"];

    if (!allowed.includes(nextFile.type)) {
      setError("Escolha uma imagem JPG, PNG ou WebP.");
      if (inputRef.current) inputRef.current.value = "";
      setFile(null);
      setPreview(null);
      return;
    }

    if (nextFile.size > 5 * 1024 * 1024) {
      setError("A imagem deve ter no máximo 5 MB.");
      if (inputRef.current) inputRef.current.value = "";
      setFile(null);
      setPreview(null);
      return;
    }

    setFile(nextFile);
    setPreview(URL.createObjectURL(nextFile));
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!tripId) {
      setError("Selecione a viagem.");
      return;
    }

    if (!file) {
      setError("Selecione uma foto.");
      return;
    }

    startTransition(async () => {
      const uploadData = new FormData();
      uploadData.append("file", file);

      let uploadResult: {
        success?: boolean;
        fileId?: string;
        error?: string;
      };

      try {
        const response = await fetch("/api/gallery/upload", {
          method: "POST",
          body: uploadData,
        });

        uploadResult = await response.json();
      } catch {
        setError("Não foi possível enviar a foto. Tente novamente.");
        return;
      }

      if (!uploadResult.success || !uploadResult.fileId) {
        setError(uploadResult.error ?? "Não foi possível enviar a foto.");
        return;
      }

      const result = await createGalleryPhotoAction({
        tripId,
        fileId: uploadResult.fileId,
        caption,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      setFile(null);
      setPreview(null);
      setCaption("");
      if (inputRef.current) inputRef.current.value = "";
      setSuccess(
        "Foto enviada! Ela ficará aguardando aprovação da nossa equipe.",
      );
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
          Compartilhe uma foto da sua viagem
        </p>
        <p className="mt-1 text-sm leading-relaxed text-brand-muted">
          Envie uma lembrança da sua experiência com a Prado&apos;s Tour.
          A publicação passa por aprovação da nossa equipe.
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
              {trip.name} · {trip.date}
            </option>
          ))}
        </select>
      </label>

      <div className="mt-6">
        <span className="text-sm font-semibold text-brand-ink">
          Sua foto
        </span>

        <label className="mt-2 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-brand-primary/25 bg-brand-tint/35 px-4 py-6 text-center transition hover:border-brand-primary/50 hover:bg-brand-tint/55">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) =>
              handleFileChange(event.target.files?.[0] ?? null)
            }
            disabled={pending}
            className="sr-only"
          />
          <span className="text-sm font-semibold text-brand-primary">
            Escolher uma foto
          </span>
          <span className="mt-1 text-xs text-brand-muted">
            JPG, PNG ou WebP · até 5 MB
          </span>
        </label>
      </div>

      {preview && (
        <div className="mt-5 overflow-hidden rounded-2xl bg-brand-tint">
          <div className="relative aspect-[4/3] w-full">
            <Image
              src={preview}
              alt="Pré-visualização da foto escolhida"
              fill
              unoptimized
              className="object-cover"
            />
          </div>
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

      {success && (
        <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">
          {success}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-6 w-full rounded-full bg-gradient-to-r from-brand-primary to-brand-secondary px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:brightness-[1.06] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Enviando foto..." : "Enviar foto para aprovação"}
      </button>

      <p className="mt-3 text-center text-xs leading-relaxed text-brand-faint">
        Sua foto só será exibida publicamente depois da aprovação da equipe.
      </p>
    </form>
  );
}
