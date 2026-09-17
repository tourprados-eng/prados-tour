"use client";

import { useState } from "react";
import { Camera, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GalleryPhotoForm } from "@/components/gallery/gallery-photo-form";

type TripOption = {
  id: string;
  name: string;
  date: string;
};

/**
 * Convite visual recolhido para envio de foto. Ao clicar, expande o
 * GalleryPhotoForm existente (upload/aprovação intactos) e permite recolher.
 */
export function PhotoShareCard({ trips }: { trips: TripOption[] }) {
  const [open, setOpen] = useState(false);

  if (trips.length === 0) return null;

  if (!open) {
    return (
      <div className="relative overflow-hidden rounded-[2rem] bg-white shadow-[0_24px_60px_-24px_rgb(47_35_40_/_0.22)] ring-1 ring-brand-line/60">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-brand-primary via-brand-secondary to-brand-primary"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand-secondary/10 blur-2xl"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-12 -left-6 h-40 w-40 rounded-full bg-brand-primary/10 blur-2xl"
        />

        <div
          aria-hidden
          className="pointer-events-none absolute right-12 top-10 hidden rotate-2 gap-4 lg:flex"
        >
          <span className="-rotate-6 rounded-xl bg-white p-2 shadow-lg ring-1 ring-black/5 transition duration-300 hover:rotate-0">
            <span className="block h-20 w-16 rounded bg-gradient-to-br from-[#FFD6E5] to-[#FCE3EE]" />
            <span className="mx-1.5 mt-1.5 block h-1 w-12 rounded bg-brand-primary/20" />
          </span>
          <span className="mt-6 rotate-6 rounded-xl bg-white p-2 shadow-lg ring-1 ring-black/5 transition duration-300 hover:rotate-0">
            <span className="block h-20 w-16 rounded bg-gradient-to-br from-[#FFE3C4] to-[#FFF0DC]" />
            <span className="mx-1.5 mt-1.5 block h-1 w-12 rounded bg-brand-secondary/25" />
          </span>
          <span className="mt-12 -rotate-3 rounded-xl bg-white p-2 shadow-lg ring-1 ring-black/5 transition duration-300 hover:rotate-0">
            <span className="block h-16 w-14 rounded bg-gradient-to-br from-brand-tint to-[#FFF6EC]" />
            <span className="mx-1.5 mt-1.5 block h-1 w-10 rounded bg-brand-primary/15" />
          </span>
        </div>

        <div className="relative flex flex-col gap-6 p-6 sm:p-10 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <span className="relative grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand-primary to-brand-secondary text-white shadow-md shadow-brand-primary/30">
              <Camera className="h-8 w-8" strokeWidth={1.6} aria-hidden />
              <span
                aria-hidden
                className="absolute -right-1.5 -top-1.5 h-4 w-4 rounded-full border-2 border-white bg-brand-secondary"
              />
            </span>
            <div>
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-brand-secondary">
                <span
                  aria-hidden
                  className="h-1 w-5 rounded-full bg-gradient-to-r from-brand-primary to-brand-secondary"
                />
                Compartilhe sua experiência
              </p>
              <h3 className="mt-2 font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight text-brand-ink sm:text-3xl">
                Já viajou com a Prado&apos;s Tour?
              </h3>
              <p className="mt-2 max-w-lg text-sm leading-relaxed text-brand-muted sm:text-base">
                Envie uma foto da sua viagem e faça parte da nossa galeria de viajantes.
                É rápido e fácil.
              </p>
            </div>
          </div>
          <Button
            variant="primary"
            size="lg"
            className="relative shrink-0"
            onClick={() => setOpen(true)}
          >
            Compartilhar minha experiência
          </Button>
        </div>

        <div className="relative border-t border-brand-line/70 bg-brand-tint/50 px-4 py-3 sm:px-10">
          <p className="flex flex-wrap items-center gap-2 text-xs text-brand-faint">
            <Camera className="h-3.5 w-3.5 shrink-0" aria-hidden />
            As fotos passam pela aprovação da nossa equipe antes de serem publicadas na
            galeria.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-[2rem] bg-white shadow-[0_24px_60px_-24px_rgb(47_35_40_/_0.22)] ring-1 ring-brand-line/60">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-brand-primary via-brand-secondary to-brand-primary"
      />
      <div className="relative flex flex-wrap items-start justify-between gap-4 p-6 pb-5 sm:p-8 sm:pb-5">
        <div>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-brand-secondary">
            <span
              aria-hidden
              className="h-1 w-5 rounded-full bg-gradient-to-r from-brand-primary to-brand-secondary"
            />
            Compartilhe sua experiência
          </p>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-brand-muted">
            Escolha a viagem, envie sua foto e deixe uma legenda. A publicação passa pela
            aprovação da nossa equipe.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setOpen(false)}
          className="shrink-0 text-brand-muted"
        >
          <ChevronUp className="h-4 w-4" aria-hidden />
          Recolher
        </Button>
      </div>
      <div className="relative border-t border-brand-line/70 px-6 py-6 sm:px-8 sm:py-7">
        <GalleryPhotoForm trips={trips} />
      </div>
    </div>
  );
}