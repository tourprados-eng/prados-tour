"use client";

import { useState, useTransition } from "react";
import { submitPublicReviewAction } from "@/lib/reviews/actions";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/form";

type PublicReviewTrips = { id: string; name: string }[];

export function PublicReviewForm({ trips }: { trips: PublicReviewTrips }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [tripId, setTripId] = useState("");
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  function reset() {
    setName("");
    setTripId("");
    setRating(0);
    setComment("");
    setError(null);
  }

  function close() {
    setOpen(false);
    setSuccess(false);
    reset();
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    setError(null);
    const form = e.currentTarget;
    const website = String(new FormData(form).get("website") ?? "");

    startTransition(async () => {
      const result = await submitPublicReviewAction({
        name,
        tripId,
        rating,
        comment,
        website,
      });
      if (result?.error) {
        setError(result.error);
      } else {
        setSuccess(true);
        reset();
      }
    });
  }

  return (
    <div className="w-full sm:w-auto">
      <Button
        onClick={() => {
          setSuccess(false);
          setOpen((v) => !v);
        }}
        className="border border-white/30 bg-white/5 text-white hover:border-white/50 hover:bg-white/10 focus-visible:ring-white"
      >
        {open ? "Fechar formulário" : "Deixe sua avaliação"}
      </Button>

      {open && (
        <div className="mt-5 rounded-3xl bg-white p-5 text-brand-ink shadow-xl ring-1 ring-black/10 sm:p-6">
          {success ? (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#fde7ef] text-2xl">
                ✦
              </span>
              <p className="max-w-sm text-sm font-semibold leading-relaxed text-brand-ink">
                Obrigado pela sua avaliação! Ela será analisada antes de
                aparecer no site.
              </p>
              <Button variant="soft" size="sm" onClick={() => setSuccess(false)}>
                Enviar outra avaliação
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="grid gap-4">
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="absolute -left-[9999px] h-0 w-0 opacity-0"
              />

              <div>
                <Label htmlFor="review-name">Nome</Label>
                <Input
                  id="review-name"
                  name="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Como devemos te chamar?"
                  maxLength={60}
                  required
                />
              </div>

              <div>
                <Label htmlFor="review-trip">Viagem</Label>
                <Select
                  id="review-trip"
                  name="tripId"
                  value={tripId}
                  onChange={(e) => setTripId(e.target.value)}
                  required
                >
                  <option value="" disabled>
                    Selecione a viagem
                  </option>
                  {trips.map((trip) => (
                    <option key={trip.id} value={trip.id}>
                      {trip.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <Label>Nota</Label>
                <div
                  className="flex gap-1 text-3xl leading-none"
                  role="radiogroup"
                  aria-label="Nota de 1 a 5 estrelas"
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={rating === n}
                      aria-label={`${n} ${n === 1 ? "estrela" : "estrelas"}`}
                      className={`transition-colors ${
                        (hover || rating) >= n ? "text-amber-400" : "text-black/15"
                      }`}
                      onMouseEnter={() => setHover(n)}
                      onMouseLeave={() => setHover(0)}
                      onClick={() => setRating(n)}
                    >
                      {(hover || rating) >= n ? "★" : "☆"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="review-comment">Comentário</Label>
                <Textarea
                  id="review-comment"
                  name="comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Conte como foi a experiência..."
                  minLength={5}
                  maxLength={500}
                  rows={4}
                  required
                />
                <div className="mt-1 text-right text-xs text-brand-faint">
                  {comment.length}/500
                </div>
              </div>

              {error && (
                <p
                  role="alert"
                  className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
                >
                  {error}
                </p>
              )}

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Button type="submit" size="lg" disabled={pending || rating === 0}>
                  {pending ? "Enviando..." : "Enviar avaliação"}
                </Button>
                <button
                  type="button"
                  onClick={close}
                  className="text-sm font-semibold text-brand-muted transition hover:text-brand-ink"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}