"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmBookingFormAction } from "@/lib/booking/actions";
import { Button } from "@/components/ui/button";

type PostPaymentFormProps = {
  bookingId: string;
  formUrl: string;
};

export function PostPaymentForm({
  bookingId,
  formUrl,
}: PostPaymentFormProps) {
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    setError(null);

    if (!confirmed) {
      setError("Confirme que você preencheu o formulário para continuar.");
      return;
    }

    startTransition(async () => {
      const result = await confirmBookingFormAction(bookingId);

      if (result?.error) {
        setError(result.error);
        return;
      }

      router.refresh();
    });
  }

  return (
    <div className="mt-8 rounded-3xl bg-pink-50 p-5 ring-1 ring-pink-100">
      <p className="text-sm font-semibold uppercase tracking-widest text-[var(--brand-primary)]">
        Última etapa
      </p>

      <h2 className="mt-2 text-xl font-bold">
        Preencha o formulário do passageiro
      </h2>

      <p className="mt-2 text-sm text-black/60">
        Seu pagamento já foi confirmado. Agora preencha o formulário com os
        dados dos passageiros. O voucher será liberado depois da confirmação
        do preenchimento.
      </p>

      <div className="mt-5">
        <a
          href={formUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center rounded-xl bg-[var(--brand-primary)] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90"
        >
          Preencher formulário
        </a>
      </div>

      <label className="mt-5 flex cursor-pointer items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
          disabled={pending}
          className="mt-1 h-4 w-4 accent-[var(--brand-primary)]"
        />
        <span>
          Confirmo que preenchi o formulário com os dados dos passageiros.
        </span>
      </label>

      {error && (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      <Button
        type="button"
        variant="secondary"
        className="mt-5 w-full"
        onClick={handleConfirm}
        disabled={pending}
      >
        {pending ? "Confirmando..." : "Confirmar preenchimento e liberar voucher"}
      </Button>
    </div>
  );
}
