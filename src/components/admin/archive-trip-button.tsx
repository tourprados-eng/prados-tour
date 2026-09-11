"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, RotateCcw } from "lucide-react";
import { setTripStatusAction } from "@/lib/admin/actions";

type ArchiveTripButtonProps = {
  tripId: string;
  tripName: string;
  archived: boolean;
};

export default function ArchiveTripButton({
  tripId,
  tripName,
  archived,
}: ArchiveTripButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const dialogRef = useRef<HTMLDivElement>(null);

  function handle() {
    setError(null);
    startTransition(async () => {
      const target = archived ? "PUBLICADA" : "ARQUIVADA";
      const result = await setTripStatusAction(tripId, target);
      if (result?.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setError(result?.error || "Não foi possível atualizar a viagem.");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          archived
            ? "inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
            : "inline-flex items-center gap-1.5 rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm font-semibold text-violet-700 transition hover:bg-violet-50"
        }
        title={archived ? "Reativar viagem" : "Arquivar viagem"}
      >
        {archived ? <RotateCcw size={15} /> : <Archive size={15} />}
        <span>{archived ? "Reativar" : "Arquivar"}</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => !pending && setOpen(false)}
          />

          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-black/10"
          >
            {error ? (
              <div>
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                    <Archive size={20} />
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
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-600">
                    {archived ? <RotateCcw size={20} /> : <Archive size={20} />}
                  </div>
                  <div>
                    <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">
                      {archived ? "Reativar viagem?" : "Arquivar esta viagem?"}
                    </h2>
                    <p className="mt-1 text-sm text-black/55">
                      {archived
                        ? `A viagem ${tripName} voltará a ficar visível e poderá
                          receber novas reservas.`
                        : `A viagem ${tripName} deixará de aparecer para o cliente
                          e não poderá receber novas reservas.`}
                    </p>
                    <p className="mt-3 rounded-xl bg-violet-50 px-3 py-2 text-xs text-violet-700">
                      Reservas, clientes, pagamentos e comissões existentes são
                      preservados (arquivamento reversível).
                    </p>
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
                    onClick={handle}
                    disabled={pending}
                    className={
                      archived
                        ? "flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                        : "flex items-center justify-center gap-2 rounded-2xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-60"
                    }
                  >
                    {pending
                      ? "Atualizando..."
                      : archived
                        ? "Reativar viagem"
                        : "Arquivar viagem"}
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