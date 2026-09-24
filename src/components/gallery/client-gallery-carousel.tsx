"use client";

import { useEffect, useState } from "react";
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Heart,
  MapPin,
  Palmtree,
  X,
} from "lucide-react";

type GalleryItem = {
  id: string;
  src: string;
  label: string;
  caption: string | null;
};

export function ClientGalleryCarousel({
  items,
}: {
  items: GalleryItem[];
}) {
  const [index, setIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const current = items[index];

  function go(direction: number) {
    setIndex(
      (currentIndex) =>
        (currentIndex + direction + items.length) % items.length,
    );
  }

  function openLightbox() {
    setLightboxOpen(true);
  }

  function closeLightbox() {
    setLightboxOpen(false);
  }

  useEffect(() => {
    if (!lightboxOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeLightbox();
      }

      if (event.key === "ArrowLeft" && items.length > 1) {
        go(-1);
      }

      if (event.key === "ArrowRight" && items.length > 1) {
        go(1);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [lightboxOpen, items.length]);

  if (items.length === 0) {
    return null;
  }

  return (
    <>
      <div className="relative mx-auto mt-10 max-w-6xl px-0 lg:px-28">
        {/* Decoração lateral esquerda */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-2 top-16 hidden w-40 xl:block"
        >
          <div className="relative">
            <MapPin
              className="ml-8 h-10 w-10 text-brand-primary"
              fill="currentColor"
            />

            <div className="mt-2 h-20 w-28 -rotate-12 rounded-bl-[4rem] border-b-2 border-l-2 border-dashed border-brand-secondary" />

            <p className="mt-5 font-display text-2xl font-bold italic leading-tight text-brand-primary">
              Viajar também é
              <br />
              colecionar
              <br />
              boas histórias!
            </p>

            <div className="mt-2 ml-10 h-1 w-24 rotate-[-8deg] rounded-full bg-brand-secondary" />

            <Heart className="ml-24 mt-3 h-7 w-7 text-brand-primary" />
          </div>
        </div>

        {/* Decoração lateral direita */}
        <div
          aria-hidden
          className="pointer-events-none absolute right-2 top-4 hidden w-40 xl:block"
        >
          <Palmtree className="ml-8 h-36 w-36 text-brand-primary/15" />

          <p className="mt-10 text-center font-display text-2xl font-bold italic leading-tight text-brand-primary">
            Gente real
            <br />
            em lugares
            <br />
            incríveis
          </p>

          <div className="mx-auto mt-3 h-1 w-24 rotate-[-7deg] rounded-full bg-brand-secondary" />

          <Camera className="ml-14 mt-12 h-14 w-14 rotate-[-8deg] text-brand-primary" />
        </div>

        {/* Carrossel principal */}
        <div className="relative mx-auto max-w-3xl">
          <div className="rounded-[2rem] bg-gradient-to-r from-brand-primary via-[#f47aa9] to-brand-secondary p-[3px] shadow-[0_18px_45px_rgba(47,35,40,0.24),0_0_35px_rgba(232,76,145,0.22)]">
            <button
              type="button"
              onClick={openLightbox}
              aria-label="Ampliar foto"
              className="group relative block aspect-[16/9] w-full overflow-hidden rounded-[1.85rem] bg-brand-tint text-left outline-none focus-visible:ring-4 focus-visible:ring-brand-primary/30"
            >
              <img
                src={current.src}
                alt={current.caption || current.label}
                className="absolute inset-0 h-full w-full object-contain transition duration-500 group-hover:scale-[1.02]"
              />

              <div className="absolute inset-0 bg-transparent transition duration-300 group-hover:bg-black/5" />

              {items.length > 1 && (
                <span className="absolute right-5 top-5 rounded-full border border-white/30 bg-black/55 px-4 py-2 text-sm font-bold text-white backdrop-blur-md">
                  {index + 1} / {items.length}
                </span>
              )}

              {items.length > 1 && (
                <>
                  <span
                    role="button"
                    aria-label="Foto anterior"
                    onClick={(event) => {
                      event.stopPropagation();
                      go(-1);
                    }}
                    className="absolute left-5 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border-2 border-brand-primary bg-white text-brand-primary shadow-lg transition duration-300 hover:scale-105 hover:bg-brand-primary hover:text-white"
                  >
                    <ChevronLeft className="h-6 w-6" strokeWidth={3} />
                  </span>

                  <span
                    role="button"
                    aria-label="Próxima foto"
                    onClick={(event) => {
                      event.stopPropagation();
                      go(1);
                    }}
                    className="absolute right-5 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border-2 border-brand-primary bg-white text-brand-primary shadow-lg transition duration-300 hover:scale-105 hover:bg-brand-primary hover:text-white"
                  >
                    <ChevronRight className="h-6 w-6" strokeWidth={3} />
                  </span>
                </>
              )}

              <span className="absolute bottom-5 right-5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold text-brand-primary opacity-0 shadow-md transition duration-300 group-hover:opacity-100">
                Clique para ampliar
              </span>
            </button>
          </div>

          {/* Legenda da foto (fora da imagem) */}
          <div className="mx-auto mt-5 flex w-fit max-w-full items-start justify-center gap-2 rounded-[1rem] bg-white/60 px-5 py-3 shadow-sm ring-1 ring-brand-primary/10">
            <MapPin
              className="mt-0.5 h-5 w-5 shrink-0 text-brand-primary"
              fill="currentColor"
            />
            <div className="min-w-0 text-center">
              <p className="font-extrabold text-brand-primary">
                {current.label}
              </p>

              {current.caption && (
                <p className="mt-0.5 text-sm leading-relaxed text-brand-muted">
                  {current.caption}
                </p>
              )}
            </div>
          </div>

          {/* Miniaturas */}
          {items.length > 1 && (
            <>
              <div className="mt-5 flex justify-center gap-3 overflow-x-auto pb-1">
                {items.map((item, itemIndex) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setIndex(itemIndex)}
                    aria-label={`Ver foto ${itemIndex + 1}`}
                    className={`relative h-14 w-20 shrink-0 overflow-hidden rounded-xl ring-2 transition duration-300 ${
                      itemIndex === index
                        ? "scale-105 ring-brand-primary shadow-lg"
                        : "ring-transparent opacity-75 hover:opacity-100 hover:ring-brand-primary/50"
                    }`}
                  >
                    <img
                      src={item.src}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>

              <div className="mt-4 flex justify-center gap-2">
                {items.map((item, itemIndex) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setIndex(itemIndex)}
                    aria-label={`Ir para foto ${itemIndex + 1}`}
                    className={`h-2.5 rounded-full transition-all ${
                      itemIndex === index
                        ? "w-7 bg-brand-primary"
                        : "w-2.5 bg-brand-primary/25 hover:bg-brand-primary/50"
                    }`}
                  />
                ))}
              </div>
            </>
          )}

          {/* Assinatura */}
          <div className="mx-auto mt-7 flex w-fit items-center gap-3 rounded-full border border-brand-primary/10 bg-white/35 px-6 py-3 shadow-sm">
            <Camera className="h-5 w-5 text-brand-primary" />
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-brand-primary">
              Mais que viagens, conexões para a vida
            </span>
          </div>
        </div>
      </div>

      {/* Lightbox — foto grande limpa */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-[100] flex overflow-y-auto bg-black/85 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Visualização ampliada da foto"
          onClick={closeLightbox}
        >
          <button
            type="button"
            onClick={closeLightbox}
            aria-label="Fechar imagem"
            className="absolute right-5 top-5 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-brand-ink shadow-xl transition hover:scale-105"
          >
            <X className="h-5 w-5" />
          </button>

          <div
            className="relative m-auto flex w-full max-w-6xl flex-col items-center justify-center gap-5 md:flex-row md:gap-7"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative flex min-h-0 w-full items-center justify-center md:w-auto">
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => go(-1)}
                  aria-label="Foto anterior"
                  className="absolute left-2 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-brand-primary shadow-xl transition hover:scale-105"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
              )}

              <img
                src={current.src}
                alt={current.caption || current.label}
                className="max-h-[70vh] w-auto max-w-full rounded-2xl object-contain shadow-[0_25px_80px_rgba(0,0,0,0.5)] md:max-h-[85vh]"
              />

              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => go(1)}
                  aria-label="Próxima foto"
                  className="absolute right-2 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-brand-primary shadow-xl transition hover:scale-105"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              )}
            </div>

            <div className="flex max-w-md shrink-0 flex-col items-center text-center md:items-start md:text-left">
              <h2 className="text-lg font-extrabold text-white md:text-xl">
                {current.label}
              </h2>

              {current.caption && (
                <p className="mt-2 text-sm leading-relaxed text-white/85">
                  {current.caption}
                </p>
              )}

              {items.length > 1 && (
                <span className="mt-4 rounded-full bg-white/10 px-4 py-1.5 text-sm font-bold text-white">
                  {index + 1} / {items.length}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
