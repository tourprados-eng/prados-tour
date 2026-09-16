"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteGalleryPhotoAction,
  moderateGalleryPhotoAction,
} from "@/lib/gallery/actions";

export function GalleryPhotoModerator({
  photoId,
  status,
  showOnHome,
}: {
  photoId: string;
  status: string;
  showOnHome: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(
    action: () => Promise<{ success?: boolean; error?: string }>,
  ) {
    startTransition(async () => {
      const result = await action();

      if (result.error) {
        alert(result.error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status !== "APROVADO" && (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(() =>
              moderateGalleryPhotoAction(photoId, "APROVADO", false),
            )
          }
          className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
        >
          Aprovar
        </button>
      )}

      {status !== "REJEITADO" && (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(() => moderateGalleryPhotoAction(photoId, "REJEITADO", false))
          }
          className="rounded-full bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-600 disabled:opacity-50"
        >
          Rejeitar
        </button>
      )}

      {status === "APROVADO" && (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(() =>
              moderateGalleryPhotoAction(
                photoId,
                "APROVADO",
                !showOnHome,
              ),
            )
          }
          className={`rounded-full px-3 py-1.5 text-xs font-semibold text-white transition disabled:opacity-50 ${
            showOnHome
              ? "bg-slate-600 hover:bg-slate-700"
              : "bg-[#E84C91] hover:bg-[#C93677]"
          }`}
        >
          {showOnHome ? "Ocultar da Home" : "Exibir na Home"}
        </button>
      )}

      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (confirm("Excluir esta foto?")) {
            run(() => deleteGalleryPhotoAction(photoId));
          }
        }}
        className="rounded-full bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
      >
        Excluir
      </button>
    </div>
  );
}
