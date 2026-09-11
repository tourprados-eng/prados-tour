import Image from "next/image";
import { ImageOff } from "lucide-react";
import { resolveTripCoverUrl } from "@/lib/trip-cover";

type TripCoverProps = {
  images: string[] | undefined;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
};

/**
 * Capa de uma viagem. Renderiza a primeira imagem realmente disponível
 * (verificada no servidor) ou um placeholder — nunca uma imagem quebrada.
 */
export function TripCover({ images, alt, sizes, priority, className }: TripCoverProps) {
  const src = resolveTripCoverUrl(images);

  if (!src) {
    return (
      <div className="grid h-full w-full place-items-center bg-gradient-to-br from-[#fff0f6] via-brand-tint to-[#f3d9e6]">
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
    <Image
      src={src}
      alt={alt}
      fill
      priority={priority}
      sizes={sizes}
      className={className}
    />
  );
}