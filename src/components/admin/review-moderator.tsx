"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteReviewAction,
  moderateReviewAction,
} from "@/lib/reviews/actions";

export function ReviewModerator({
  reviewId,
  status,
}: {
  reviewId: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ success?: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await action();
      if (result.error) alert(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status !== "APROVADO" && (
        <button
          disabled={pending}
          onClick={() =>
            run(() => moderateReviewAction(reviewId, "APROVADO"))
          }
          className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
        >
          Aprovar
        </button>
      )}
      {status !== "REJEITADO" && (
        <button
          disabled={pending}
          onClick={() =>
            run(() => moderateReviewAction(reviewId, "REJEITADO"))
          }
          className="rounded-full bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-600 disabled:opacity-50"
        >
          Rejeitar
        </button>
      )}
      <button
        disabled={pending}
        onClick={() => {
          if (confirm("Excluir esta avaliação?")) {
            run(() => deleteReviewAction(reviewId));
          }
        }}
        className="rounded-full bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
      >
        Excluir
      </button>
    </div>
  );
}