"use client";

import { useState, useTransition } from "react";
import { performCheckin } from "@/lib/admin/actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form";

export default function CheckInPage() {
  const [reference, setReference] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">Check-in</h1>
      <p className="mt-2 text-sm text-black/60">
        Escaneie ou digite o código da reserva (ex: PT000001).
      </p>
      <div className="mt-8 rounded-3xl bg-white/90 p-6 ring-1 ring-black/5">
        <Label htmlFor="reference">Código da reserva</Label>
        <Input
          id="reference"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="PT000001"
        />
        <Button
          className="mt-4 w-full"
          disabled={pending}
          onClick={() => {
            setError(null);
            setMessage(null);
            start(async () => {
              const result = await performCheckin(reference);
              if ("error" in result && result.error) setError(result.error);
              else if ("message" in result) setMessage(result.message || "PASSAGEIRO CONFIRMADO");
              else setMessage("PASSAGEIRO CONFIRMADO");
            });
          }}
        >
          Confirmar check-in
        </Button>
        {message && <p className="mt-4 font-semibold text-emerald-700">{message}</p>}
        {error && <p className="mt-4 font-semibold text-red-600">{error}</p>}
      </div>
    </div>
  );
}
