import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/actions";
import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import { maskCpf } from "@/lib/utils";
import { roleLabel } from "@/lib/roles";
import { Button } from "@/components/ui/button";

export default async function ProfilePage() {
  const session = await requireUser();
  const store = await getRepositoryRuntime().read();
  const profile = store.profiles.find((p) => p.id === session.id);
  if (!profile) redirect("/login");

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">Meu perfil</h1>
      <div className="mt-8 space-y-3 rounded-3xl bg-white/90 p-6 text-sm ring-1 ring-black/5">
        <Row label="Nome" value={profile.fullName} />
        <Row label="E-mail" value={profile.email} />
        <Row label="CPF" value={maskCpf(profile.cpf)} />
        <Row label="Telefone" value={profile.phone || "—"} />
        <Row label="WhatsApp" value={profile.whatsapp || "—"} />
        <Row label="Perfil" value={roleLabel(profile.role)} />
        <Row label="Classificação" value={profile.customerClass} />
        <Row label="Código de indicação" value={profile.referralCode} />
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button href="/minhas-viagens" variant="outline">
          Minhas viagens
        </Button>
        <Button href="/meus-pagamentos" variant="outline">
          Pagamentos
        </Button>
        <Button href="/notificacoes" variant="outline">
          Notificações
        </Button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-black/5 py-2">
      <span className="text-black/50">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
