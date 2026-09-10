"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { requestPasswordResetAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form";

export default function ForgotPasswordPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="container-page max-w-md py-12 md:py-16">
      <div className="surface-card p-6 sm:p-8">
        <p className="eyebrow">Senha</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-[#2F2328]">
          Recuperar senha
        </h1>
        <p className="mt-2 text-sm text-[#6B5B63]">
          Informe seu e-mail para receber as instruções.
        </p>
        <form
          className="mt-8 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            start(async () => {
              const result = await requestPasswordResetAction(fd);
              setMessage(result.message);
            });
          }}
        >
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          {message && (
            <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {message}
            </p>
          )}
          <Button type="submit" className="w-full" size="lg" disabled={pending}>
            Enviar
          </Button>
        </form>
        <p className="mt-6 text-sm">
          <Link href="/login" className="font-semibold text-[#E84C91] hover:underline">
            Voltar ao login
          </Link>
        </p>
      </div>
    </div>
  );
}
