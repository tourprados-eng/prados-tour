import Link from "next/link";
import { requireUser } from "@/lib/auth/actions";
import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import { formatDateTime } from "@/lib/utils";

export default async function NotificationsPage() {
  const session = await requireUser();
  const store = await getRepositoryRuntime().read();
  const items = store.notifications
    .filter((n) => n.userId === session.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">
        Notificações
      </h1>
      <div className="mt-8 space-y-3">
        {items.map((n) => {
          // Notificação de passageiro incompleto sempre traz o destino da correção.
          const correction = n.message.match(/(\/minhas-viagens\/[0-9a-f-]+\/passageiros)/);
          return (
            <div key={n.id} className="rounded-3xl bg-white/90 p-5 ring-1 ring-black/5">
              <p className="font-bold">{n.title}</p>
              <p className="mt-1 text-sm text-black/70">{n.message}</p>
              {correction ? (
                <Link
                  href={correction[1]}
                  className="mt-3 inline-block rounded-lg bg-[#E84C91] px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Corrigir dados dos passageiros
                </Link>
              ) : null}
              <p className="mt-2 text-xs text-black/40">{formatDateTime(n.createdAt)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
