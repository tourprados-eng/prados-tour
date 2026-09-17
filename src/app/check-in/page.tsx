"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, UserRound } from "lucide-react";
import { lookupCheckinBooking, performCheckin } from "@/lib/admin/actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form";
import { formatTime, formatTripDepartureDate } from "@/lib/utils";

type PassengerRow = {
  id: string;
  name: string;
  seat: string | null;
  checkedIn: boolean;
  checkedAt: string | null;
};

type LookupResult = {
  booking: {
    reference: string;
    status: string;
    quantity: number;
    customerName: string;
  };
  trip: {
    name: string;
    date: string;
    departureDate: string | null;
    departureTime: string | null;
  } | null;
  passengers: PassengerRow[];
};

export default function CheckInPage() {
  const [reference, setReference] = useState("");
  const [result, setResult] = useState<LookupResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  async function lookup(code: string) {
    setError(null);
    setMessage(null);
    setResult(null);
    const response = await lookupCheckinBooking(code);
    if ("error" in response && response.error) {
      setError(response.error);
      return;
    }
    setResult(response as LookupResult);
  }

  function handleConfirm(passengerId: string) {
    setError(null);
    setMessage(null);
    setConfirmingId(passengerId);
    start(async () => {
      const response = await performCheckin(reference, passengerId);
      if (response && "error" in response) {
        setError(response.error || "Não foi possível confirmar o check-in.");
      } else {
        setMessage("Check-in realizado");
      }
      if (result) {
        const fresh = await lookupCheckinBooking(reference);
        if (!("error" in fresh && fresh.error)) {
          setResult(fresh as LookupResult);
        }
      }
      setConfirmingId(null);
    });
  }

  const confirmedCount =
    result?.passengers.filter((p) => p.checkedIn).length ?? 0;

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <Link
        href="/operacional"
        className="inline-flex items-center gap-2 text-sm font-semibold text-[#5b3f7e] transition hover:text-[#ec3f88]"
      >
        <ArrowLeft size={16} className="shrink-0" />
        Painel operacional
      </Link>

      <h1 className="mt-4 font-[family-name:var(--font-display)] text-3xl font-bold">
        Check-in
      </h1>
      <p className="mt-2 text-sm text-black/60">
        Escaneie ou digite o código da reserva (ex: PT000001) e confirme cada
        passageiro na porta do ônibus.
      </p>

      <div className="mt-8 rounded-3xl bg-white/90 p-6 ring-1 ring-black/5">
        <Label htmlFor="reference">Código da reserva</Label>
        <div className="mt-2 flex gap-2">
          <Input
            id="reference"
            value={reference}
            onChange={(event) => {
              setReference(event.target.value);
              setResult(null);
              setMessage(null);
              setError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                start(async () => lookup(reference));
              }
            }}
            placeholder="PT000001"
            className="uppercase"
          />
          <Button
            className="shrink-0"
            disabled={pending || !reference.trim()}
            onClick={() => {
              start(async () => lookup(reference));
            }}
          >
            Buscar
          </Button>
        </div>
      </div>

      {error && (
        <div className="mt-5 rounded-2xl bg-red-50 px-5 py-4 ring-1 ring-red-200">
          <p className="font-semibold text-red-700">{error}</p>
        </div>
      )}

      {message && (
        <div className="mt-5 rounded-2xl bg-emerald-50 px-5 py-4 ring-1 ring-emerald-200">
          <p className="font-semibold text-emerald-700">
            <CheckCircle2 size={18} className="mr-1.5 inline -translate-y-0.5" />
            {message}
          </p>
        </div>
      )}

      {result && (
        <>
          <div className="mt-5 rounded-3xl bg-white/90 p-5 ring-1 ring-black/5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-black/45">
                  {result.trip?.name ?? "Reserva"}
                </p>
                <p className="mt-1 text-lg font-bold">
                  {result.booking.reference}
                </p>
                <p className="text-sm text-black/55">
                  {result.trip
                    ? `${formatTripDepartureDate(result.trip)} · saída ${formatTime(result.trip.departureTime)}`
                    : ""}
                </p>
              </div>
              <div className="text-right">
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${
                    result.booking.status === "CONFIRMADA"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {result.booking.status}
                </span>
                <p className="mt-1 text-xs text-black/45">
                  {result.booking.customerName} ·{" "}
                  {confirmedCount}/{result.booking.quantity} confirmados
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {result.booking.status !== "CONFIRMADA" && (
              <div className="rounded-2xl bg-amber-50 px-5 py-4 ring-1 ring-amber-200">
                <p className="text-sm font-semibold text-amber-800">
                  Esta reserva ainda não está confirmada. O check-in só pode ser
                  feito após a confirmação do pagamento.
                </p>
              </div>
            )}

            {result.passengers.length === 0 && (
              <div className="rounded-2xl bg-white/90 px-5 py-4 text-sm text-black/55 ring-1 ring-black/5">
                Nenhum passageiro vinculado a esta reserva.
              </div>
            )}

            {result.passengers.map((passenger) => (
              <div
                key={passenger.id}
                className="flex items-center justify-between gap-3 rounded-2xl bg-white/90 p-4 ring-1 ring-black/5"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-bold ${
                      passenger.checkedIn
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-black/[0.04] text-black/50"
                    }`}
                  >
                    <UserRound size={18} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-bold">{passenger.name}</p>
                    <p className="text-xs text-black/50">
                      {passenger.checkedIn
                        ? `Check-in às ${passenger.checkedAt
                            ? new Intl.DateTimeFormat("pt-BR", {
                                hour: "2-digit",
                                minute: "2-digit",
                              }).format(new Date(passenger.checkedAt))
                            : ""}`
                        : passenger.seat ?? "Pendente"}
                    </p>
                  </div>
                </div>

                {passenger.checkedIn ? (
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700">
                    <CheckCircle2 size={16} />
                    Embarcado
                  </span>
                ) : (
                  <Button
                    className="shrink-0"
                    disabled={
                      confirmingId !== null ||
                      result.booking.status !== "CONFIRMADA"
                    }
                    onClick={() => handleConfirm(passenger.id)}
                  >
                    {confirmingId === passenger.id
                      ? "Confirmando..."
                      : "Confirmar"}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}