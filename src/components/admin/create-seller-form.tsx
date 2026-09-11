"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { createSellerAction } from "@/lib/admin/actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form";

export default function CreateSellerForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setError(null);
        setSuccess(false);
        startTransition(async () => {
          const result = await createSellerAction(fd);
          if (result?.ok) {
            setSuccess(true);
            router.refresh();
          } else {
            setError(result?.error || "Não foi possível criar o vendedor.");
          }
        });
      }}
      className="grid max-w-xl gap-3 rounded-3xl bg-white/90 p-6 ring-1 ring-black/5"
    >
      <div>
        <Label htmlFor="seller-fullName">Nome completo</Label>
        <Input id="seller-fullName" name="fullName" required minLength={3} placeholder="Maria Vendedora" />
      </div>
      <div>
        <Label htmlFor="seller-email">E-mail</Label>
        <Input id="seller-email" name="email" type="email" required placeholder="vendedor@empresa.com" />
      </div>
      <div>
        <Label htmlFor="seller-password">Senha</Label>
        <Input id="seller-password" name="password" type="password" required minLength={8} />
        <p className="mt-1.5 text-xs text-[#6B5B63]">O vendedor usará este e-mail e esta senha para entrar.</p>
      </div>
      <div>
        <Label htmlFor="seller-phone">Telefone / WhatsApp</Label>
        <Input id="seller-phone" name="phone" placeholder="(11) 99999-9999" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="seller-rate">Comissão (%)</Label>
          <Input id="seller-rate" name="commissionRate" type="number" min="0" max="100" step="0.5" defaultValue="10" />
        </div>
        <div>
          <Label htmlFor="seller-code">Código (opcional)</Label>
          <Input id="seller-code" name="sellerCode" placeholder="Ex.: VD002" />
        </div>
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>
      )}
      {success && (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
          Vendedor criado com sucesso.
        </p>
      )}

      <Button type="submit" disabled={pending} className="flex items-center justify-center gap-2">
        <UserPlus size={16} />
        {pending ? "Criando..." : "Criar vendedor"}
      </Button>
    </form>
  );
}