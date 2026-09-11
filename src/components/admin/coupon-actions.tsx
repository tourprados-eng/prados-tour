"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Power } from "lucide-react";
import { toggleCouponAction } from "@/lib/admin/actions";

export default function CouponToggle({ couponId }: { couponId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    setError(null);
    startTransition(async () => {
      const result = await toggleCouponAction(couponId);
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
        onClick={toggle}
        disabled={pending}
        title="Ativar / desativar"
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#eadfe4] bg-white text-[#77666e] transition hover:border-[#ec3f88] hover:text-[#d92f75]"
      >
        <Power size={16} />
      </button>
      <a
        href={`/admin/cupons/${couponId}/editar`}
        title="Editar"
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#eadfe4] bg-white text-[#77666e] transition hover:border-[#ec3f88] hover:text-[#d92f75]"
      >
        <span className="text-xs font-bold">Ed.</span>
      </a>
      {error && <span className="text-xs font-semibold text-red-600">{error}</span>}
    </div>
  );
}