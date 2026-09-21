"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteReviewAction,
  moderateReviewAction,
  setReviewHomeVisibilityAction,
} from "@/lib/reviews/actions";

export function ReviewModerator({
  reviewId,
  status,
  showOnHome,
}: {
  reviewId: string;
  status: string;
  showOnHome: boolean;
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
      {status === "APROVADO" && (
        <button
          disabled={pending}
          onClick={() =>
            run(() =>
              setReviewHomeVisibilityAction(reviewId, !showOnHome),
            )
          }
          className={
            showOnHome
              ? "rounded-full bg-black/70 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-black disabled:opacity-50"
              : "rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#2F2328] ring-1 ring-black/15 transition hover:bg-black/5 disabled:opacity-50"
          }
        >
          {showOnHome ? "Ocultar da Home" : "Exibir na Home"}
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