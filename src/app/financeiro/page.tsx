import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, canAccess } from "@/lib/auth/session";
import { getDashboardMetrics } from "@/lib/admin/actions";
import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import { formatCurrency } from "@/lib/utils";
import { simulateGatewayConfirm } from "@/lib/booking/actions";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/lib/auth/actions";
import { navItemsForRole } from "@/lib/navigation";
import { homeForRole, roleLabel } from "@/lib/roles";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR").format(new Date(value));
}

function metricIcon(label: string) {
  const icons: Record<string, string> = {
    Receitas: "↗",
    Despesas: "↘",
    Taxas: "%",
    Comissões: "♙",
    "Valor líquido": "▣",
    Lucro: "↗",
  };

  return icons[label] || "•";
}

export default async function FinancePage() {
  const session = await getSession();

  if (!session || !canAccess(session.role, "financeiro")) {
    redirect("/login");
  }

  const metrics = await getDashboardMetrics();
  const store = await getRepositoryRuntime().read();
  const navItems = navItemsForRole(session.role);
  const panelHome = homeForRole(session.role);

  const byTrip = store.trips.map((t) => {
    const revenue = store.bookings
      .filter((b) => b.tripId === t.id)
      .reduce((s, b) => s + b.totalAmount, 0);

    const expenses = store.expenses
      .filter((e) => e.tripId === t.id)
      .reduce((s, e) => s + e.amount, 0);

    const commissions = store.commissions
      .filter(
        (c) =>
          store.bookings.find((b) => b.id === c.bookingId)?.tripId === t.id,
      )
      .reduce((s, c) => s + c.amount, 0);

    const fees = store.payments
      .filter(
        (p) =>
          store.bookings.find((b) => b.id === p.bookingId)?.tripId === t.id,
      )
      .reduce((s, p) => s + p.feeAmount, 0);

    return {
      trip: t,
      revenue,
      expenses,
      commissions,
      fees,
      profit: revenue - expenses - commissions - fees,
    };
  });

  const pendingPayments = store.payments.filter(
    (p) => p.status === "PENDENTE",
  );

  const metricsCards = [
    ["Receitas", metrics.revenue],
    ["Despesas", metrics.expenses],
    ["Taxas", metrics.fees],
    ["Comissões", metrics.commissions],
    ["Valor líquido", metrics.revenue - metrics.fees],
    ["Lucro", metrics.profit],
  ] as const;

  return (
    <div className="min-h-screen bg-[#FAF7F8] text-[#241B20]">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 border-r border-[#E8DFE3] bg-white lg:flex lg:flex-col">
          <div className="border-b border-[#F0E8EB] px-5 py-6">
            <Link href={panelHome} className="flex items-center gap-3">
              <Image
                src={store.brand.logoUrl}
                alt={store.brand.companyName}
                width={58}
                height={58}
                className="h-14 w-14 rounded-full object-cover ring-2 ring-[#E84C91]/15"
              />

              <div className="min-w-0">
                <p className="truncate font-[family-name:var(--font-display)] text-lg font-bold">
                  {store.brand.companyName}
                </p>
                <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-black/40">
                  {roleLabel(session.role)}
                </p>
              </div>
            </Link>
          </div>

          <nav className="flex-1 px-3 py-5">
            <p className="px-3 pb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-black/35">
              Administração
            </p>

            <div className="space-y-1">
              {navItems.map((item) => {
                const active = item.href === "/financeiro";

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                      active
                        ? "bg-[#FCE4EE] text-[#C52D70]"
                        : "text-[#4A3B42] hover:bg-[#FFF3F7] hover:text-[#C52D70]"
                    }`}
                  >
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-xl text-sm ${
                        active
                          ? "bg-white/80"
                          : "bg-black/[0.035]"
                      }`}
                    >
                      {item.icon}
                    </span>

                    {item.label}
                  </Link>
                );
              })}
            </div>
          </nav>

          <div className="border-t border-[#F0E8EB] p-4">
            <form action={logoutAction}>
              <button
                type="submit"
                className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-[#4A3B42] transition hover:bg-[#FFF3F7] hover:text-[#C52D70]"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-black/[0.035]">
                  ↪
                </span>
                Sair
              </button>
            </form>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 flex min-h-[76px] items-center justify-between border-b border-[#E8DFE3] bg-white/95 px-5 backdrop-blur-xl md:px-8">
            <Link
              href={panelHome}
              className="inline-flex items-center gap-2 rounded-2xl border border-[#F0B7CE] px-4 py-2.5 text-sm font-bold text-[#C52D70] transition hover:bg-[#FFF3F7]"
            >
              <span className="text-lg">←</span>
              Painel
            </Link>

            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-bold">{session.fullName}</p>
                <p className="text-xs text-black/45">{roleLabel(session.role)}</p>
              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#E84C91] text-sm font-bold text-white">
                {session.fullName
                  .split(" ")
                  .slice(0, 2)
                  .map((name) => name[0])
                  .join("")
                  .toUpperCase()}
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-[1380px] px-5 py-8 md:px-8 md:py-10">
            <div className="mb-8">
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#E84C91]">
                Gestão financeira
              </p>

              <h1 className="mt-1 font-[family-name:var(--font-display)] text-4xl font-bold tracking-tight md:text-5xl">
                Financeiro
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-black/50 md:text-base">
                Acompanhe receitas, despesas, taxas, comissões e lucro por
                viagem.
              </p>
            </div>

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {metricsCards.map(([label, value]) => {
                const numericValue = Number(value);
                const negative = numericValue < 0;

                return (
                  <div
                    key={label}
                    className="group rounded-[28px] bg-white p-6 shadow-[0_8px_30px_rgba(50,30,40,0.04)] ring-1 ring-black/[0.05] transition hover:-translate-y-0.5 hover:shadow-[0_12px_35px_rgba(50,30,40,0.07)]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-black/40">
                          {label}
                        </p>

                        <p
                          className={`mt-3 text-2xl font-bold tracking-tight md:text-3xl ${
                            negative ? "text-[#C52D70]" : "text-[#241B20]"
                          }`}
                        >
                          {formatCurrency(numericValue)}
                        </p>
                      </div>

                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#FCE8F0] text-xl font-bold text-[#D83A7D]">
                        {metricIcon(label)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </section>

            <section className="mt-10">
              <div className="mb-4">
                <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold">
                  Resultado por viagem
                </h2>
                <p className="mt-1 text-sm text-black/45">
                  Visão financeira individual de cada excursão.
                </p>
              </div>

              <div className="space-y-3">
                {byTrip.map((row) => (
                  <div
                    key={row.trip.id}
                    className="group rounded-[24px] bg-white p-5 shadow-[0_6px_24px_rgba(50,30,40,0.035)] ring-1 ring-black/[0.05] transition hover:-translate-y-0.5 hover:ring-[#E84C91]/20"
                  >
                    <div className="flex items-center justify-between gap-5">
                      <div className="min-w-0">
                        <p className="truncate font-bold text-base md:text-lg">
                          {row.trip.name}
                        </p>

                        <p className="mt-1 text-sm leading-relaxed text-black/55">
                          Fat. {formatCurrency(row.revenue)} · Desp.{" "}
                          {formatCurrency(row.expenses)} · Com.{" "}
                          {formatCurrency(row.commissions)} · Taxas{" "}
                          {formatCurrency(row.fees)} · Lucro{" "}
                          <strong
                            className={
                              row.profit < 0
                                ? "text-[#C52D70]"
                                : "text-[#21845A]"
                            }
                          >
                            {formatCurrency(row.profit)}
                          </strong>
                        </p>
                      </div>

                      <span className="hidden text-2xl text-black/25 transition group-hover:text-[#E84C91] sm:block">
                        ›
                      </span>
                    </div>
                  </div>
                ))}

                {byTrip.length === 0 && (
                  <div className="rounded-[24px] bg-white p-8 text-center text-sm text-black/45 ring-1 ring-black/[0.05]">
                    Nenhuma viagem cadastrada.
                  </div>
                )}
              </div>
            </section>

            <section className="mt-10">
              <div className="mb-4">
                <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold">
                  Pagamentos pendentes
                </h2>
                <p className="mt-1 text-sm text-black/45">
                  Pagamentos aguardando confirmação pelo gateway.
                </p>
              </div>

              <div className="space-y-3">
                {pendingPayments.map((payment) => {
                  const booking = store.bookings.find(
                    (b) => b.id === payment.bookingId,
                  );

                  if (!booking) return null;

                  return (
                    <div
                      key={payment.id}
                      className="flex flex-col gap-4 rounded-[24px] bg-white p-5 ring-1 ring-black/[0.05] md:flex-row md:items-center md:justify-between"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-bold">{booking.reference}</p>
                          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
                            Pendente
                          </span>
                        </div>

                        <p className="mt-2 text-sm text-black/50">
                          {payment.method} · {formatCurrency(payment.amount)}
                        </p>

                        <p className="mt-1 text-xs text-black/40">
                          Criado em {formatDate(payment.createdAt)}
                        </p>
                      </div>

                      <form
                        action={async () => {
                          "use server";
                          await simulateGatewayConfirm(payment.id);
                        }}
                      >
                        <Button type="submit" size="sm">
                          Confirmar via webhook
                        </Button>
                      </form>
                    </div>
                  );
                })}

                {pendingPayments.length === 0 && (
                  <div className="rounded-[24px] bg-white p-8 text-center text-sm text-black/45 ring-1 ring-black/[0.05]">
                    Nenhum pagamento pendente.
                  </div>
                )}
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
