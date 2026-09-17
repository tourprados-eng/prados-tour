"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { loginAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form";
import { DEMO_PASSWORD_HINT } from "@/lib/constants";

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const nextQuery = next ? `?next=${encodeURIComponent(next)}` : "";

  return (
    <div className="surface-card p-6 sm:p-8">
      <p className="eyebrow">Acesso</p>
      <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-brand-ink">
        Entrar
      </h1>
      <p className="mt-2 text-sm text-brand-muted">Acesse sua conta Prado&apos;s Tour</p>

      <form
        className="mt-8 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          setError(null);
          start(async () => {
            const result = await loginAction(fd);
            if (result?.error) setError(result.error);
          });
        }}
      >
        <input type="hidden" name="next" value={next ?? ""} />
        <div>
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" name="email" type="email" required placeholder="voce@email.com" />
        </div>
        <div>
          <Label htmlFor="password">Senha</Label>
          <Input id="password" name="password" type="password" required />
        </div>
        {error && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" size="lg" disabled={pending}>
          {pending ? "Entrando..." : "Entrar"}
        </Button>
      </form>

      <div className="mt-6 space-y-2 text-sm text-brand-muted">
        <p>
          <Link href="/recuperar-senha" className="font-semibold text-brand-primary hover:underline">
            Recuperar senha
          </Link>
        </p>
        <p>
          Não tem conta?{" "}
          <Link href={`/criar-conta${nextQuery}`} className="font-semibold text-brand-primary hover:underline">
            Criar conta
          </Link>
        </p>
        <p className="pt-3 text-xs leading-relaxed text-brand-faint">{DEMO_PASSWORD_HINT}</p>
      </div>
    </div>
  );
}
