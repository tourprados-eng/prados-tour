"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Power, Trash2 } from "lucide-react";
import {
  togglePromotionAction,
  duplicatePromotionAction,
  deletePromotionAction,
} from "@/lib/admin/actions";

export default function PromotionActions({
  promotionId,
  active,
}: {
  promotionId: string;
  active: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: "toggle" | "duplicate" | "delete") {
    setError(null);
    if (action === "delete" && !confirm("Excluir esta promoção? Reservas já feitas serão preservadas.")) {
      return;
    }
    startTransition(async () => {
      const result =
        action === "toggle"
          ? await togglePromotionAction(promotionId)
          : action === "duplicate"
            ? await duplicatePromotionAction(promotionId)
            : await deletePromotionAction(promotionId);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => run("toggle")}
        disabled={pending}
        title={active ? "Desativar" : "Ativar"}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#eadfe4] bg-white text-[#77666e] transition hover:border-[#ec3f88] hover:text-[#d92f75]"
      >
        <Power size={16} />
      </button>
      <a
        href={`/admin/promocoes/${promotionId}/editar`}
        title="Editar"
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#eadfe4] bg-white text-[#77666e] transition hover:border-[#ec3f88] hover:text-[#d92f75]"
      >
        <span className="text-xs font-bold">Ed.</span>
      </a>
      <button
        type="button"
        onClick={() => run("duplicate")}
        disabled={pending}
        title="Duplicar"
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#eadfe4] bg-white text-[#77666e] transition hover:border-[#ec3f88] hover:text-[#d92f75]"
      >
        <Copy size={16} />
      </button>
      <button
        type="button"
        onClick={() => run("delete")}
        disabled={pending}
        title="Excluir"
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#eadfe4] bg-white text-[#77666e] transition hover:border-red-300 hover:text-red-600"
      >
        <Trash2 size={16} />
      </button>
      {error && <span className="text-xs font-semibold text-red-600">{error}</span>}
    </div>
  );
}