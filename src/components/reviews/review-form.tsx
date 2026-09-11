"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createReviewAction } from "@/lib/reviews/actions";

export function ReviewForm({ tripId }: { tripId: string }) {
  const router = useRouter();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createReviewAction({ tripId, rating, comment });
      if (result?.error) setError(result.error);
      else {
        setComment("");
        router.refresh();
      }
    });
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-3xl bg-white/90 p-5 ring-1 ring-black/5"
    >
      <p className="font-semibold text-[#2F2328]">Avalie esta viagem</p>
      <div className="mt-3 flex gap-1 text-2xl">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            className={n <= rating ? "text-amber-500" : "text-black/15"}
            aria-label={`${n} estrelas`}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
        placeholder="Conte como foi a experiência (opcional)..."
        className="mt-3 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#E84C91]/40"
      />
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
      <button
        disabled={pending}
        className="mt-3 rounded-full bg-[#E84C91] px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Enviando..." : "Enviar avaliação"}
      </button>
      <p className="mt-2 text-xs text-black/40">
        Sua avaliação será publicada após a aprovação da equipe.
      </p>
    </form>
  );
}