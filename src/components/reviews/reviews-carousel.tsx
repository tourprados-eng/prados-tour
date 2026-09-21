"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";

type Review = {
  id: string;
  name: string;
  trip: string;
  rating: number;
  text: string;
};

function Stars({ rating }: { rating: number }) {
  return (
    <div
      className="flex gap-1 text-brand-secondary"
      aria-label={`${rating} ${rating === 1 ? "estrela" : "estrelas"}`}
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${i < rating ? "fill-current" : "text-white/25"}`}
        />
      ))}
    </div>
  );
}

/**
 * Carrossel de avaliações (seção "Quem viaja, recomenda").
 *
 * Desktop: 3 cards por linha em navegação horizontal por página.
 * Mobile: 1 card por vez (snap), com swipe e navegação por setas/indicadores.
 * Os cards sempre têm a mesma altura; a paginação evita linhas órfãs.
 */
export function ReviewsCarousel({ reviews }: { reviews: Review[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [perView, setPerView] = useState(1);
  const [total, setTotal] = useState(reviews.length);
  const [page, setPage] = useState(0);

  const measure = useCallback(() => {
    const track = trackRef.current;
    const slide = track?.firstElementChild as HTMLElement | null;
    if (!track || !slide || slide.offsetWidth === 0) return;
    const per = Math.max(1, Math.round(track.clientWidth / slide.offsetWidth));
    const count = Math.max(1, Math.ceil(reviews.length / per));
    setPerView(per);
    setTotal(count);
    setPage((p) => Math.min(p, count - 1));
  }, [reviews.length]);

  useLayoutEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const slide = track.firstElementChild as HTMLElement | null;

    const onScroll = () => {
      if (!slide || slide.offsetWidth === 0) return;
      const per = Math.max(1, Math.round(track.clientWidth / slide.offsetWidth));
      const cardIndex = Math.round(track.scrollLeft / slide.offsetWidth);
      const count = Math.max(1, Math.ceil(reviews.length / per));
      setPage(Math.min(Math.floor(cardIndex / per), count - 1));
    };

    track.addEventListener("scroll", onScroll, { passive: true });
    return () => track.removeEventListener("scroll", onScroll);
  }, [reviews.length]);

  function scrollToPage(target: number) {
    const track = trackRef.current;
    const slide = track?.firstElementChild as HTMLElement | null;
    if (!track || !slide) return;
    const next = Math.min(Math.max(target, 0), total - 1);
    const maxLeft = track.scrollWidth - track.clientWidth;
    track.scrollTo({
      left: Math.min(next * perView * slide.offsetWidth, maxLeft),
      behavior: "smooth",
    });
  }

  if (reviews.length === 0) return null;

  const showControls = total > 1;

  return (
    <div className="mt-10">
      <div
        role="region"
        aria-roledescription="carrossel de avaliações"
        aria-label="Avaliações de clientes"
      >
        <div
          ref={trackRef}
          className="-mx-2.5 flex snap-x snap-mandatory items-stretch overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {reviews.map((item, index) => (
            <div
              key={item.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`Avaliação ${index + 1} de ${reviews.length}`}
              className="w-full shrink-0 snap-start px-2.5 md:w-1/3"
            >
              <figure className="flex h-full flex-col border-t-2 border-brand-primary bg-white/5 p-6 backdrop-blur-sm transition duration-300 hover:bg-white/10">
                <Stars rating={item.rating} />
                <blockquote className="mt-4 text-sm leading-relaxed text-white/85">
                  “{item.text}”
                </blockquote>
                <figcaption className="mt-auto flex items-baseline gap-1.5 pt-5 text-sm">
                  <span className="font-semibold text-white">{item.name}</span>
                  {item.trip && (
                    <span className="text-white/50"> · {item.trip}</span>
                  )}
                </figcaption>
              </figure>
            </div>
          ))}
        </div>
      </div>

      {showControls && (
        <div className="mt-8 flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => scrollToPage(page - 1)}
            aria-label="Avaliações anteriores"
            disabled={page === 0}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-white transition duration-300 hover:border-brand-secondary hover:text-brand-secondary disabled:pointer-events-none disabled:opacity-30 focus-visible:ring-2 focus-visible:ring-brand-primary"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <div className="flex gap-2" role="tablist" aria-label="Páginas de avaliações">
            {Array.from({ length: total }).map((_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === page}
                aria-label={`Ir para página ${i + 1}`}
                onClick={() => scrollToPage(i)}
                className={`h-2.5 rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary ${
                  i === page
                    ? "w-7 bg-brand-primary"
                    : "w-2.5 bg-brand-primary/25 hover:bg-brand-primary/50"
                }`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => scrollToPage(page + 1)}
            aria-label="Próximas avaliações"
            disabled={page >= total - 1}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-white transition duration-300 hover:border-brand-secondary hover:text-brand-secondary disabled:pointer-events-none disabled:opacity-30 focus-visible:ring-2 focus-visible:ring-brand-primary"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}