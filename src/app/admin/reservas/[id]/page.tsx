import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession, canAccess } from "@/lib/auth/session";
import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import { getBalanceInfo } from "@/lib/payments/balance";
import { formatCurrency, formatDate, formatTripDepartureDate } from "@/lib/utils";
import { BalancePaymentButton } from "@/components/payments/balance-payment-button";

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR").format(new Date(value));
}

function formatBirthDate(value: string | null | undefined) {
  if (!value) return "Não informado";

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
  }

  return value;
}

function bookingStatus(status: string) {
  const labels: Record<string, string> = {
    PENDENTE: "Pendente",
    CONFIRMADA: "Confirmada",
    CANCELADA: "Cancelada",
    CONCLUIDA: "Concluída",
  };

  return labels[status] || status;
}

export default async function AdminReservaDetalhesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();

  if (!session || !canAccess(session.role, "admin")) {
    return null;
  }

  const { id } = await params;
  const store = await getRepositoryRuntime().read();

  const booking = store.bookings.find((item) => item.id === id);

  if (!booking) {
    notFound();
  }

  const customer = store.profiles.find(
    (profile) => profile.id === booking.customerId,
  );

  const trip = store.trips.find((item) => item.id === booking.tripId);

  const passengers = store.passengers.filter(
    (passenger) => passenger.bookingId === booking.id,
  );

  const payment = store.payments.find(
    (item) => item.bookingId === booking.id,
  );

  const balanceInfo = getBalanceInfo(store, booking, trip);
  const showBalanceAction =
    balanceInfo.status === "PENDENTE" || balanceInfo.status === "VENCIDO";

  const installments = store.installments.filter(
    (item) => item.bookingId === booking.id,
  );

  const seats = store.seats.filter(
    (seat) => seat.bookingId === booking.id,
  );

  const seller = booking.sellerId
    ? store.sellers.find((item) => item.id === booking.sellerId)
    : null;

  const sellerProfile = seller
    ? store.profiles.find((profile) => profile.id === seller.id)
    : null;

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link
            href="/admin/reservas"
            className="text-sm font-semibold text-[var(--brand-primary)]"
          >
            ← Voltar para reservas
          </Link>

          <p className="mt-5 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-primary)]">
            Reserva
          </p>

          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">
              {booking.reference}
            </h1>

            <span className="rounded-full bg-black/[0.04] px-3 py-1 text-xs font-bold">
              {bookingStatus(booking.status)}
            </span>
          </div>

          <p className="mt-2 text-sm text-black/50">
            Criada em {formatDateTime(booking.createdAt)}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            disabled
            className="rounded-2xl border border-black/10 px-5 py-3 text-sm font-semibold text-black/35"
            title="Ações serão ativadas na próxima etapa"
          >
            Ações da reserva
          </button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <section className="rounded-3xl bg-white p-6 ring-1 ring-black/5">
          <div className="border-b border-black/5 pb-5">
            <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">
              Cliente responsável
            </h2>
            <p className="mt-1 text-sm text-black/50">
              Dados cadastrais do responsável pela reserva.
            </p>
          </div>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-black/40">
                Nome completo
              </p>
              <p className="mt-1 font-semibold">
                {customer?.fullName || "Não encontrado"}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-black/40">
                CPF
              </p>
              <p className="mt-1 font-semibold">
                {customer?.cpf || "Não informado"}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-black/40">
                E-mail
              </p>
              <p className="mt-1 font-semibold">
                {customer?.email || "Não informado"}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-black/40">
                Telefone
              </p>
              <p className="mt-1 font-semibold">
                {customer?.phone || customer?.whatsapp || "Não informado"}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-6 ring-1 ring-black/5">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">
            Resumo financeiro
          </h2>

          <div className="mt-6 space-y-4">
            <div className="flex justify-between gap-4">
              <span className="text-black/50">Valor base</span>
              <strong>{formatCurrency(booking.baseAmount)}</strong>
            </div>

            <div className="flex justify-between gap-4">
              <span className="text-black/50">Desconto</span>
              <strong className="text-emerald-600">
                - {formatCurrency(booking.discountAmount)}
              </strong>
            </div>

            <div className="border-t border-black/5 pt-4">
              <div className="flex justify-between gap-4">
                <span className="font-semibold">Total</span>
                <strong className="text-xl text-[var(--brand-primary)]">
                  {formatCurrency(booking.totalAmount)}
                </strong>
              </div>
            </div>

            <div className="rounded-2xl bg-black/[0.025] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-black/40">
                Pagamento
              </p>

              <p className="mt-2 font-semibold">
                {payment?.method === "CARTAO"
                  ? "Cartão"
                  : payment?.method === "PIX"
                    ? "PIX"
                    : "Não registrado"}
              </p>

              <p className="mt-1 text-sm text-black/50">
                Status: {payment?.status || "Não registrado"}
              </p>

              {payment?.plan && (
                <p className="mt-1 text-sm text-black/50">
                  Modalidade:{" "}
                  {payment.plan === "PARCIAL" ? "Parcial" : "Total"}
                </p>
              )}
            </div>

            <div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-black/5">
              <p className="text-xs font-semibold uppercase tracking-wide text-black/40">
                Saldo restante
              </p>

              <div className="mt-2 space-y-1 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-black/50">Total</span>
                  <strong>{formatCurrency(balanceInfo.total)}</strong>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-black/50">Já pago</span>
                  <strong className="text-emerald-600">
                    {formatCurrency(balanceInfo.paid)}
                  </strong>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-black/50">Saldo</span>
                  <strong className="text-[var(--brand-primary)]">
                    {formatCurrency(balanceInfo.balance)}
                  </strong>
                </div>
              </div>

              {balanceInfo.dueDate && (
                <p className="mt-2 text-xs text-black/50">
                  Prazo: {balanceInfo.dueDate}
                  {balanceInfo.isDueDatePassed && balanceInfo.status !== "COMPLETO" ? (
                    <span className="ml-1 font-semibold text-red-600">
                      (vencido)
                    </span>
                  ) : (
                    <span className="ml-1 font-semibold text-emerald-600">
                      em dia
                    </span>
                  )}
                </p>
              )}

              <p className="mt-2 text-xs">
                Status do saldo:{" "}
                <strong
                  className={
                    balanceInfo.status === "COMPLETO"
                      ? "text-emerald-600"
                      : balanceInfo.status === "VENCIDO"
                        ? "text-red-600"
                        : "text-black/70"
                  }
                >
                  {balanceInfo.status === "COMPLETO"
                    ? "Pagamento completo"
                    : balanceInfo.status === "VENCIDO"
                      ? "Saldo vencido"
                      : balanceInfo.status === "VIAGEM_REALIZADA"
                        ? "Viagem realizada"
                        : "Saldo pendente"}
                </strong>
              </p>

              {balanceInfo.balancePayment && (
                <p className="mt-2 text-xs text-black/50">
                  Cobrança de saldo:{" "}
                  {balanceInfo.balancePayment.gatewayPaymentId || "sem id Asaas"}{" "}
                  · {balanceInfo.balancePayment.status} ·{" "}
                  {formatCurrency(balanceInfo.balancePayment.amount)}
                </p>
              )}

              {showBalanceAction ? (
                <div className="mt-3">
                  <BalancePaymentButton
                    bookingId={booking.id}
                    label={
                      balanceInfo.balancePayment?.gatewayPaymentId
                        ? "Reutilizar / consultar PIX do saldo"
                        : "Gerar cobrança do saldo"
                    }
                    compact
                  />
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-3xl bg-white p-6 ring-1 ring-black/5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">
              Viagem
            </h2>
            <p className="mt-1 text-sm text-black/50">
              Informações operacionais da reserva.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-black/40">
              Destino
            </p>
            <p className="mt-1 font-semibold">
              {trip?.name || "Não encontrado"}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-black/40">
              Data
            </p>
            <p className="mt-1 font-semibold">
              {trip?.departureDate
                ? formatTripDepartureDate(trip)
                : "Não informada"}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-black/40">
              Embarque
            </p>
            <p className="mt-1 font-semibold">
              {booking.boardingPoint || "Não definido"}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-black/40">
              Quantidade
            </p>
            <p className="mt-1 font-semibold">
              {booking.quantity} passageiro(s)
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl bg-white ring-1 ring-black/5">
        <div className="border-b border-black/5 px-6 py-5">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">
            Passageiros
          </h2>
          <p className="mt-1 text-sm text-black/50">
            Dados dos passageiros vinculados a esta reserva.
          </p>
        </div>

        {passengers.length === 0 ? (
          <div className="px-6 py-10 text-sm text-black/50">
            Nenhum passageiro cadastrado.
          </div>
        ) : (
          <div className="divide-y divide-black/5">
            {passengers.map((passenger, index) => {
              const seat = passenger.seatId
                ? store.seats.find((item) => item.id === passenger.seatId)
                : null;

              return (
                <div
                  key={passenger.id}
                  className="grid gap-5 px-6 py-5 lg:grid-cols-[60px_1.5fr_1fr_1fr_1fr]"
                >
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-black/40">
                      Nº
                    </p>
                    <p className="mt-1 text-lg font-bold">{index + 1}</p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-black/40">
                      Passageiro
                    </p>
                    <p className="mt-1 font-semibold">{passenger.name}</p>
                    <p className="mt-1 text-xs text-black/45">
                      CPF: {passenger.cpf || "Não informado"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-black/40">
                      Nascimento
                    </p>
                    <p className="mt-1 font-semibold">
                      {formatBirthDate(passenger.birthDate)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-black/40">
                      Telefone
                    </p>
                    <p className="mt-1 font-semibold">
                      {passenger.phone || "Não informado"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-black/40">
                      Assento
                    </p>
                    <p className="mt-1 font-semibold">
                      {seat?.seatNumber || "Pendente"}
                    </p>
                    <p className="mt-1 text-xs text-black/45">
                      {passenger.seatAssignmentStatus}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-3xl bg-white p-6 ring-1 ring-black/5">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">
            Parcelas
          </h2>

          {installments.length === 0 ? (
            <p className="mt-5 text-sm text-black/50">
              Nenhuma parcela registrada.
            </p>
          ) : (
            <div className="mt-5 space-y-3">
              {installments.map((installment) => (
                <div
                  key={installment.id}
                  className="flex items-center justify-between rounded-2xl bg-black/[0.025] p-4"
                >
                  <div>
                    <p className="font-semibold">
                      Parcela {installment.number}
                    </p>
                    <p className="mt-1 text-xs text-black/45">
                      Vencimento: {formatDate(installment.dueDate)}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="font-bold">
                      {formatCurrency(installment.value)}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-black/50">
                      {installment.status}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-3xl bg-white p-6 ring-1 ring-black/5">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">
            Operação
          </h2>

          <div className="mt-5 space-y-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-black/40">
                Ponto de embarque
              </p>
              <p className="mt-1 font-semibold">
                {booking.boardingPoint || "Não definido"}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-black/40">
                Vendedor
              </p>
              <p className="mt-1 font-semibold">
                {sellerProfile?.fullName ||
                  seller?.code ||
                  "Venda direta / não informado"}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-black/40">
                Cupom
              </p>
              <p className="mt-1 font-semibold">
                {booking.couponCode || "Nenhum cupom utilizado"}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-black/40">
                Observações
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-black/65">
                {booking.notes || "Nenhuma observação registrada."}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-black/40">
                Assentos vinculados
              </p>
              <p className="mt-1 font-semibold">
                {seats.length > 0
                  ? seats.map((seat) => seat.seatNumber).join(", ")
                  : "Ainda não atribuídos"}
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
