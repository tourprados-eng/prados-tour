"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form";

type Status =
  | { kind: "checking" }
  | { kind: "recovery-ready" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

export default function ResetPasswordPage() {
  const [status, setStatus] = useState<Status>({ kind: "checking" });
  const [pending, setPending] = useState(false);
  const clientRef = useRef<ReturnType<typeof createBrowserSupabase> | null>(null);
  if (!clientRef.current) clientRef.current = createBrowserSupabase();

  useEffect(() => {
    const client = clientRef.current;
    if (!client) {
      setStatus({ kind: "error", message: "Autenticação não configurada." });
      return;
    }

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setStatus({ kind: "recovery-ready" });
      }
      if (event === "INITIAL_SESSION" && session) {
        setStatus({ kind: "recovery-ready" });
      }
      if (event === "SIGNED_OUT") {
        setStatus({ kind: "error", message: "Link inválido ou expirado." });
      }
    });

    client.auth.getSession().then(({ data }) => {
      if (data.session) setStatus({ kind: "recovery-ready" });
      else setStatus((s) => (s.kind === "checking" ? { kind: "error", message: "Link inválido ou expirado." } : s));
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const password = String(fd.get("password") || "");
    const confirm = String(fd.get("confirm") || "");

    if (password.length < 8) {
      setStatus({ kind: "error", message: "A senha deve ter no mínimo 8 caracteres." });
      return;
    }
    if (password !== confirm) {
      setStatus({ kind: "error", message: "As senhas não conferem." });
      return;
    }

    const client = clientRef.current;
    if (!client) {
      setStatus({ kind: "error", message: "Autenticação não configurada." });
      return;
    }

    setPending(true);
    const { data, error } = await client.auth.updateUser({ password });
    setPending(false);

    if (error) {
      setStatus({ kind: "error", message: error.message });
      return;
    }
    if (data.user) {
      setStatus({
        kind: "success",
        message: "Sua senha foi atualizada com sucesso. Acesse com a nova senha.",
      });
    }
  }

  return (
    <div className="container-page max-w-md py-12 md:py-16">
      <div className="surface-card p-6 sm:p-8">
        <p className="eyebrow">Senha</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-[#2F2328]">
          Definir nova senha
        </h1>
        <p className="mt-2 text-sm text-[#6B5B63]">
          Informe a nova senha para acessar sua conta.
        </p>

        {status.kind === "checking" && (
          <p className="mt-8 text-sm text-[#6B5B63]">Verificando link de recuperação…</p>
        )}

        {status.kind === "error" && (
          <div className="mt-8">
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {status.message}
            </p>
            <p className="mt-4 text-sm text-[#6B5B63]">
              Solicite novamente em{" "}
              <Link href="/recuperar-senha" className="font-semibold text-[#E84C91] hover:underline">
                Recuperar senha
              </Link>
              .
            </p>
          </div>
        )}

        {status.kind === "success" && (
          <div className="mt-8">
            <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
              {status.message}
            </p>
            <Button href="/login" className="mt-4 w-full" size="lg">
              Ir para o login
            </Button>
          </div>
        )}

        {status.kind === "recovery-ready" && (
          <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
            <div>
              <Label htmlFor="password">Nova senha</Label>
              <Input id="password" name="password" type="password" required autoComplete="new-password" />
            </div>
            <div>
              <Label htmlFor="confirm">Confirmar nova senha</Label>
              <Input id="confirm" name="confirm" type="password" required autoComplete="new-password" />
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={pending}>
              {pending ? "Salvando..." : "Salvar nova senha"}
            </Button>
          </form>
        )}

        <p className="mt-6 text-sm">
          <Link href="/login" className="font-semibold text-[#E84C91] hover:underline">
            Voltar ao login
          </Link>
        </p>
      </div>
    </div>
  );
}