import { getDashboardMetrics } from "@/lib/admin/actions";
import { getSession } from "@/lib/auth/session";
import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";

const lastActionLabel: Record<string, string> = {
  PERFORM_CHECKIN: "Check-in de passageiro",
  CREATE_EXPENSE: "Lançamento de despesa",
  UPDATE_EXPENSE: "Atualização de despesa",
  DELETE_EXPENSE: "Exclusão de despesa",
  PAYMENT_CONFIRMED: "Pagamento confirmado",
  MODERATE_REVIEW: "Moderação de avaliação",
  DELETE_REVIEW: "Exclusão de avaliação",
};

export default async function AdminPage() {
  const session = await getSession();
  const metrics = await getDashboardMetrics();
  const cards = [
    { label: "Faturamento", value: formatCurrency(metrics.revenue) },
    { label: "Vendas", value: String(metrics.sales) },
    { label: "Reservas confirmadas", value: String(metrics.bookings) },
    { label: "Passageiros", value: String(metrics.passengers) },
    { label: "Viagens", value: String(metrics.trips) },
    { label: "Vagas restantes", value: String(metrics.seats) },
    { label: "Pagamentos pendentes", value: String(metrics.pendingPayments) },
    { label: "Comissões", value: formatCurrency(metrics.commissions) },
    { label: "Comissões a pagar", value: formatCurrency(metrics.pendingCommissions) },
    { label: "Lucro", value: formatCurrency(metrics.profit) },
  ];

  let recentLogs: Array<{ id: string; action: string; actorName: string; createdAt: string }> = [];
  if (session?.role === "SUPER_ADMIN") {
    const store = await getRepositoryRuntime().read();
    recentLogs = [...store.auditLogs]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 5)
      .map((log) => ({
        id: log.id,
        action: log.action,
        actorName: log.userId
          ? store.profiles.find((p) => p.id === log.userId)?.fullName ?? "Usuário"
          : "Sistema (gateway)",
        createdAt: log.createdAt,
      }));
  }

  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">
        Painel administrativo
      </h1>
      <p className="mt-2 text-black/60">Visão geral da operação Prado&apos;s Tour</p>

      {metrics.pendingCommissions > 0 && (
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl bg-amber-50 px-4 py-3 ring-1 ring-amber-200">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            ◉
          </span>
          <p className="text-sm font-semibold text-amber-800">
            Você tem {formatCurrency(metrics.pendingCommissions)} em comissões
            pendentes de pagamento. Acesse{" "}
            <Link href="/admin/vendedores" className="underline underline-offset-2">
              Vendedores
            </Link>{" "}
            para pagar.
          </p>
        </div>
      )}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-3xl bg-white/90 p-5 ring-1 ring-black/5">
            <p className="text-xs font-semibold uppercase tracking-wide text-black/45">
              {c.label}
            </p>
            <p className="mt-2 text-2xl font-bold text-[var(--brand-primary)]">{c.value}</p>
          </div>
        ))}
      </div>

      {session?.role === "SUPER_ADMIN" && (
        <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="rounded-3xl bg-white/90 p-6 ring-1 ring-black/5">
            <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-[#2F2328]">
              Controle do sistema
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Link
                href="/admin/auditoria"
                className="rounded-2xl bg-brand-tint p-4 text-sm font-semibold text-brand-primary transition hover:opacity-80"
              >
                ✎ Auditoria
              </Link>
              <Link
                href="/admin/avaliacoes"
                className="rounded-2xl bg-brand-tint p-4 text-sm font-semibold text-brand-primary transition hover:opacity-80"
              >
                ★ Avaliações
              </Link>
              <Link
                href="/admin/configuracoes"
                className="rounded-2xl bg-brand-tint p-4 text-sm font-semibold text-brand-primary transition hover:opacity-80"
              >
                ⚙ Configurações
              </Link>
            </div>
          </div>

          <div className="rounded-3xl bg-white/90 p-6 ring-1 ring-black/5">
            <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-[#2F2328]">
              Últimas ações
            </h2>
            <ul className="mt-4 space-y-3">
              {recentLogs.length === 0 ? (
                <li className="text-sm text-black/45">Nenhuma ação registrada.</li>
              ) : (
                recentLogs.map((log) => (
                  <li key={log.id}>
                    <p className="text-sm font-semibold text-[#2F2328]">
                      {log.actorName}
                    </p>
                    <p className="text-xs text-black/45">
                      {lastActionLabel[log.action] ?? log.action}
                    </p>
                  </li>
                ))
              )}
            </ul>
            <Link
              href="/admin/auditoria"
              className="mt-4 inline-block text-sm font-semibold text-brand-primary underline underline-offset-2"
            >
              Ver histórico completo
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
