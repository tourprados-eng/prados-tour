"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteBookingAction } from "@/lib/booking/actions";

type DeleteBookingButtonProps = {
  bookingId: string;
  reference: string;
  customerName: string;
  hasPaidPayment?: boolean;
};

export default function DeleteBookingButton({
  bookingId,
  reference,
  customerName,
  hasPaidPayment,
}: DeleteBookingButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open]);

  useEffect(() => {
    if (success) {
      const timer = window.setTimeout(() => {
        setOpen(false);
        setSuccess(false);
        router.refresh();
      }, 1400);
      return () => window.clearTimeout(timer);
    }
  }, [success, router]);

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteBookingAction(bookingId);
      if (result?.ok) {
        setSuccess(true);
      } else {
        setError(result?.error || "Não foi possível excluir a reserva.");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setError(null);
        }}
        className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
        title="Excluir reserva"
      >
        <Trash2 size={15} />
        <span>Excluir</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => !pending && !success && setOpen(false)}
          />

          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-booking-title"
            className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-black/10"
          >
            {success ? (
              <div className="py-2 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    className="h-6 w-6"
                    aria-hidden="true"
                  >
                    <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <p className="mt-4 text-lg font-bold text-emerald-700">
                  Reserva excluída com sucesso.
                </p>
              </div>
            ) : error ? (
              <div>
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                    <Trash2 size={20} />
                  </div>
                  <div>
                    <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">
                      Ocorreu um erro
                    </h2>
                    <p className="mt-1 text-sm text-black/55">{error}</p>
                  </div>
                </div>
                <div className="mt-6 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-2xl border border-black/10 px-5 py-3 text-sm font-semibold transition hover:bg-black/[0.03]"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                    <Trash2 size={20} />
                  </div>
                  <div>
                    <h2
                      id="delete-booking-title"
                      className="font-[family-name:var(--font-display)] text-xl font-bold"
                    >
                      Excluir esta reserva?
                    </h2>
                    <p className="mt-1 text-sm text-black/55">
                      Esta ação remove permanentemente a reserva{" "}
                      <strong>{reference}</strong> de{" "}
                      <strong>{customerName}</strong>.
                    </p>
                    {hasPaidPayment && (
                      <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
                        Esta reserva possui pagamento confirmado, que também será
                        removido conforme a regra do banco de dados.
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-6 flex flex-col-reverse justify-end gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    disabled={pending}
                    className="rounded-2xl border border-black/10 px-5 py-3 text-sm font-semibold transition hover:bg-black/[0.03] disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={pending}
                    className="flex items-center justify-center gap-2 rounded-2xl bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                  >
                    {pending ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                        Excluindo...
                      </>
                    ) : (
                      "Excluir reserva"
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}