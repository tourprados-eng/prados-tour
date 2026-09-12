"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteClientAction } from "@/lib/admin/actions";

type DeleteClientButtonProps = {
  clientId: string;
  clientName: string;
  hasHistory: boolean;
};

export default function DeleteClientButton({
  clientId,
  clientName,
  hasHistory,
}: DeleteClientButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [success, setSuccess] = useState(false);
  const [definitive, setDefinitive] = useState(false);
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
      const result = await deleteClientAction(clientId);
      if (result?.ok) {
        setDefinitive(result.definitive === true);
        setSuccess(true);
      } else {
        setError(result?.error || "Não foi possível excluir o cliente.");
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
        title="Excluir cliente"
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
            aria-labelledby="delete-client-title"
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
                  {definitive
                    ? "Cliente excluído definitivamente."
                    : "Cliente removido."}
                </p>
                <p className="mt-1 text-sm text-emerald-700/70">
                  {definitive
                    ? "A conta e o perfil foram removidos."
                    : "Os dados pessoais foram anonimizados, preservando o histórico financeiro."}
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
                      id="delete-client-title"
                      className="font-[family-name:var(--font-display)] text-xl font-bold"
                    >
                      {hasHistory
                        ? "Remover este cliente?"
                        : "Excluir este cliente?"}
                    </h2>
                    <p className="mt-1 text-sm text-black/55">
                      O cliente <strong>{clientName}</strong> será{" "}
                      {hasHistory
                        ? "anonimizado: nome, CPF, e-mail e telefones serão substituídos por marcadores"
                        : "excluído definitivamente, incluindo a conta de acesso"}
                      .
                    </p>
                    {hasHistory ? (
                      <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
                        O histórico de reservas, pagamentos e comissões será
                        preservado, mas o acesso do cliente será bloqueado.
                      </p>
                    ) : (
                      <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
                        Nenhuma reserva ou vínculo encontrado. Esta ação não
                        pode ser desfeita.
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
                        {hasHistory ? "Removendo..." : "Excluindo..."}
                      </>
                    ) : hasHistory ? (
                      "Remover cliente"
                    ) : (
                      "Excluir definitivamente"
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