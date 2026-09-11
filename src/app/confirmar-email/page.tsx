import Link from "next/link";
import { ResendConfirmationForm } from "@/components/auth/resend-confirmation-form";

export default function ConfirmarEmailPage() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-2xl items-center px-4 py-12">
      <section className="surface-card w-full p-6 sm:p-10">
        <p className="eyebrow">Confirmação de e-mail</p>

        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-brand-ink">
          Confirme seu e-mail
        </h1>

        <p className="mt-4 text-brand-muted">
          Seu cadastro foi realizado. Enviamos um link de confirmação para o
          e-mail informado.
        </p>

        <div className="mt-6 rounded-2xl bg-brand-soft p-4 text-sm text-brand-ink">
          <p className="font-semibold">Antes de entrar na sua conta:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Abra o e-mail enviado pela Prado&apos;s Tour.</li>
            <li>Clique no link de confirmação.</li>
            <li>Se não encontrar, verifique também a pasta de spam ou lixo eletrônico.</li>
          </ul>
        </div>

        <div className="mt-8">
          <ResendConfirmationForm />
        </div>

        <p className="mt-6 text-center text-sm text-brand-muted">
          Já confirmou seu e-mail?{" "}
          <Link
            href="/login"
            className="font-semibold text-brand-primary hover:underline"
          >
            Entrar
          </Link>
        </p>
      </section>
    </main>
  );
}
