"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { registerAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form";

export function RegisterForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const nextQuery = next ? `?next=${encodeURIComponent(next)}` : "";

  return (
    <div className="surface-card p-6 sm:p-8">
      <p className="eyebrow">Cadastro</p>
      <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-brand-ink">
        Criar conta
      </h1>
      <p className="mt-2 text-sm text-brand-muted">Preencha seus dados para reservar</p>

      <form
        className="mt-8 grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          setError(null);
          start(async () => {
            const result = await registerAction(fd);
            if (result?.error) setError(result.error);
          });
        }}
      >
        <input type="hidden" name="next" value={next ?? ""} />
        <div className="sm:col-span-2">
          <Label htmlFor="fullName">Nome completo</Label>
          <Input id="fullName" name="fullName" required />
        </div>
        <div>
          <Label htmlFor="cpf">CPF</Label>
          <Input id="cpf" name="cpf" required placeholder="somente números" />
        </div>
        <div>
          <Label htmlFor="birthDate">Nascimento</Label>
          <Input id="birthDate" name="birthDate" type="date" required />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" name="email" type="email" required />
        </div>
        <div>
          <Label htmlFor="phone">Telefone</Label>
          <Input id="phone" name="phone" required />
        </div>
        <div>
          <Label htmlFor="whatsapp">WhatsApp</Label>
          <Input id="whatsapp" name="whatsapp" required />
        </div>
        <div>
          <Label htmlFor="password">Senha</Label>
          <Input id="password" name="password" type="password" minLength={8} required />
        </div>
        <div>
          <Label htmlFor="confirmPassword">Confirmar senha</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            minLength={8}
            required
          />
        </div>
        {error && (
          <p className="sm:col-span-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {error}
          </p>
        )}
        <div className="sm:col-span-2">
          <Button type="submit" className="w-full" size="lg" disabled={pending}>
            {pending ? "Criando..." : "Criar conta"}
          </Button>
        </div>
      </form>

      <p className="mt-6 text-sm text-brand-muted">
        Já tem conta?{" "}
        <Link href={`/login${nextQuery}`} className="font-semibold text-brand-primary hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}
