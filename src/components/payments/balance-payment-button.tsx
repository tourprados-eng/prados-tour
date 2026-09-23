"use client";

import { useEffect, useState } from "react";
import { useActionState } from "react";
import QRCode from "qrcode";
import { payBalanceAction, type BalançoActionResult } from "@/lib/payments/balance-actions";
import { PixCopyButton } from "@/components/checkout/pix-copy-button";
import { formatCurrency } from "@/lib/utils";

const initialState: BalançoActionResult = { ok: true, status: "pending", amount: 0, bookingId: "" };

export function BalancePaymentButton({
  bookingId,
  label = "Pagar saldo restante",
  compact = false,
}: {
  bookingId: string;
  label?: string;
  compact?: boolean;
}) {
  const [state, action, pending] = useActionState(
    async () => payBalanceAction(bookingId),
    initialState,
  );
  const [qr, setQr] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let active = true;
    if (state.ok && state.pixCopyPaste) {
      setQr(null);
      QRCode.toDataURL(state.pixCopyPaste, { margin: 1, width: 220 })
        .then((url) => active && setQr(url))
        .catch(() => active && setQr(null));
    }
    return () => {
      active = false;
    };
  }, [state]);

  function reset() {
    setSubmitted(false);
    setQr(null);
  }

  if (!submitted || pending) {
    return (
      <div className={compact ? "" : "mt-3"}>
        <form action={action} onSubmit={() => setSubmitted(true)}>
          <button
            type="submit"
            disabled={pending}
            className={
              compact
                ? "rounded-xl border border-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-[var(--brand-primary)] transition hover:bg-[var(--brand-primary)] hover:text-white disabled:opacity-50"
                : "w-full rounded-xl bg-[#ec3f88] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            }
          >
            {pending ? "Gerando PIX..." : label}
          </button>
        </form>
      </div>
    );
  }

  if (!state.ok) {
    return (
      <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
        {state.error || "Não foi possível gerar o PIX do saldo."}
        <button
          type="button"
          onClick={reset}
          className="mt-2 block text-xs font-semibold underline-offset-2 hover:underline"
        >
          Tente novamente
        </button>
      </div>
    );
  }

  return (
    <div className={compact ? "" : "mt-3"}>
      <div className="rounded-2xl bg-black/[0.02] p-4 ring-1 ring-black/5">
        {state.status === "alreadyPaid" ? (
          <>
            <p className="text-sm font-semibold text-emerald-600">
              Esta reserva já está com o saldo quitado.
            </p>
            <button
              type="button"
              onClick={reset}
              className="mt-2 text-xs font-semibold text-black/50 underline-offset-2 hover:underline"
            >
              Fechar
            </button>
          </>
        ) : (
          <>
            {state.status === "pending" && state.paymentUrl && (
              <a
                href={state.paymentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mb-4 block w-full rounded-xl bg-[#ec3f88] px-4 py-3 text-center text-base font-bold text-white shadow-sm transition hover:opacity-90"
              >
                Pagar agora
              </a>
            )}
            <p className="text-sm font-semibold text-[var(--brand-primary)]">
              PIX — saldo restante
            </p>
            <p className="mt-1 text-2xl font-bold">
              {formatCurrency(state.amount)}
            </p>
            {state.reused && (
              <p className="mt-1 text-xs text-black/50">
                Utilizamos o PIX já gerado para esta reserva (sem duplicar a
                cobrança).
              </p>
            )}
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr} alt="QR Code PIX do saldo" className="mx-auto mt-4 rounded-2xl" />
            ) : (
              <div className="mt-4 grid h-[220px] w-[220px] place-items-center rounded-2xl bg-black/5 text-xs text-black/40">
                Carregando QR Code...
              </div>
            )}
            {state.pixCopyPaste && (
              <>
                <p className="mt-4 break-all rounded-2xl bg-black/5 p-3 text-left text-xs">
                  {state.pixCopyPaste}
                </p>
                <PixCopyButton value={state.pixCopyPaste} />
                <p className="mt-3 text-xs text-black/50">
                  Assim que o pagamento for confirmado, sua reserva fica
                  totalmente quitada.
                </p>
                <button
                  type="button"
                  onClick={reset}
                  className="mt-2 text-xs font-semibold text-black/50 underline-offset-2 hover:underline"
                >
                  Fechar
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}