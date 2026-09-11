import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getRepositoryRuntime } from "@/lib/repositories/runtime";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

const actionLabel: Record<string, string> = {
  CREATE_SELLER: "Cadastro de vendedor",
  UPDATE_BRAND: "Atualização da marca",
  UPDATE_PAYMENT_SETTINGS: "Atualização dos pagamentos",
  UPDATE_VOUCHER_SETTINGS: "Atualização do voucher",
  UPDATE_TRIP: "Atualização de viagem",
  CREATE_TRIP: "Criação de viagem",
  ARCHIVE_TRIP: "Arquivamento de viagem",
  PUBLISH_TRIP: "Publicação de viagem",
  DELETE_TRIP: "Exclusão de viagem",
  UPDATE_COUPON: "Atualização de cupom",
  CREATE_COUPON: "Criação de cupom",
  UPDATE_PROMOTION: "Atualização de promoção",
  CREATE_PROMOTION: "Criação de promoção",
  DUPLICATE_PROMOTION: "Duplicação de promoção",
  DELETE_PROMOTION: "Exclusão de promoção",
  UPDATE_PROMO_BANNER: "Atualização do banner de ofertas",
  PAY_SELLER_COMMISSIONS: "Pagamento de comissões",
  MODERATE_REVIEW: "Moderação de avaliação",
  DELETE_REVIEW: "Exclusão de avaliação",
  PERFORM_CHECKIN: "Check-in de passageiro",
  CREATE_EXPENSE: "Lançamento de despesa",
  UPDATE_EXPENSE: "Atualização de despesa",
  DELETE_EXPENSE: "Exclusão de despesa",
  PAYMENT_CONFIRMED: "Pagamento confirmado",
};

export default async function AdminAuditPage() {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") redirect("/admin");
  const store = await getRepositoryRuntime().read();
  const logs = [...store.auditLogs].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );

  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">
        Auditoria
      </h1>
      <p className="mt-2 text-black/60">
        Registro de todas as alterações administrativas feitas no sistema.
      </p>

      <div className="mt-8 overflow-hidden rounded-2xl bg-white/90 ring-1 ring-black/5">
        {logs.length === 0 ? (
          <p className="p-8 text-center text-sm text-black/55">
            Nenhuma ação registrada.
          </p>
        ) : (
          <ul className="divide-y divide-black/5">
            {logs.map((log) => (
              <li
                key={log.id}
                className="flex flex-wrap items-start gap-x-4 gap-y-1 px-4 py-3"
              >
                <span className="mt-0.5 shrink-0 rounded-full bg-brand-tint px-2 py-0.5 text-xs font-semibold text-brand-primary">
                  {actionLabel[log.action] ?? log.action}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#2F2328]">
                    {log.userId
                      ? store.profiles.find((p) => p.id === log.userId)
                          ?.fullName ?? "Usuário"
                      : "Sistema (gateway)"}
                  </p>
                  <p className="text-xs text-black/45">
                    {log.entity} · {log.entityId}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-black/45">
                  {formatDate(log.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}