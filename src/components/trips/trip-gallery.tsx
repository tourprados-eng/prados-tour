"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";

type TripGalleryProps = {
  images: string[];
  alt: string;
  sizes?: string;
};

/**
 * Galeria/carrossel da viagem. A primeira imagem é a capa; as demais aparecem
 * em miniaturas reordenadas por toque/teclado (setas laterais).
 */
export function TripGallery({ images, alt, sizes }: TripGalleryProps) {
  const [index, setIndex] = useState(0);
  const count = images.length;

  const go = (direction: number) => {
    setIndex((current) => (current + direction + count) % count);
  };

  if (count === 0) {
    return (
      <div className="grid aspect-[4/3] h-full w-full place-items-center rounded-[1.5rem] bg-gradient-to-br from-[#fff0f6] via-brand-tint to-[#f3d9e6]">
        <div className="flex flex-col items-center gap-2 text-brand-secondary/70">
          <ImageOff className="h-10 w-10" strokeWidth={1.5} aria-hidden />
          <span className="text-xs font-semibold uppercase tracking-wider">
            Imagem em breve
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative aspect-[4/3] overflow-hidden rounded-[1.5rem] bg-brand-tint shadow-card">
        <Image
          key={images[index]}
          src={images[index]}
          alt={alt}
          fill
          priority
          sizes={sizes ?? "(max-width: 1024px) 100vw, 50vw"}
          className="object-cover"
        />

        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Foto anterior"
              className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-brand-ink shadow-card transition hover:bg-white"
            >
              <ChevronLeft size={22} />
            </button>

            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Próxima foto"
              className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-brand-ink shadow-card transition hover:bg-white"
            >
              <ChevronRight size={22} />
            </button>

            <span className="absolute bottom-3 right-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-bold text-white">
              {index + 1} / {count}
            </span>
          </>
        )}
      </div>

      {count > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((src, i) => (
            <button
              key={`${src}-${i}`}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Ver foto ${i + 1}`}
              className={`relative h-16 w-20 shrink-0 overflow-hidden rounded-xl ring-2 transition ${
                i === index
                  ? "ring-brand-primary"
                  : "ring-transparent opacity-70 hover:opacity-100 hover:ring-brand-primary/40"
              }`}
            >
              <Image
                src={src}
                alt=""
                fill
                sizes="80px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}