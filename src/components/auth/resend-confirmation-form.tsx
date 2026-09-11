"use client";

import { useState, useTransition } from "react";
import { resendSignupConfirmationAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form";

export function ResendConfirmationForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();

        const form = event.currentTarget;
        const data = new FormData(form);

        setMessage(null);

        start(async () => {
          const result = await resendSignupConfirmationAction(data);

          if (result?.message) {
            setMessage(result.message);
          }
        });
      }}
    >
      <div>
        <Label htmlFor="confirmation-email">E-mail cadastrado</Label>
        <Input
          id="confirmation-email"
          name="email"
          type="email"
          placeholder="seuemail@exemplo.com"
          autoComplete="email"
          required
        />
      </div>

      {message && (
        <p className="rounded-xl bg-brand-soft px-3 py-2 text-sm font-medium text-brand-ink">
          {message}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Enviando..." : "Reenviar confirmação"}
      </Button>
    </form>
  );
}
