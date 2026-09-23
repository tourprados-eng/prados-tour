import Link from "next/link";
import { getSession, canAccess } from "@/lib/auth/session";
import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import { getBalanceInfo } from "@/lib/payments/balance";
import { formatCurrency, formatTripDepartureDate } from "@/lib/utils";
import DeleteBookingButton from "@/components/admin/delete-booking-button";
import { BalanceRotinaActions } from "@/components/payments/balance-rotina-actions";

type SearchParams = Promise<{
  q?: string;
  status?: string;
}>;

const statusOptions = [
  { value: "", label: "Todos os status" },
  { value: "PENDENTE", label: "Pendentes" },
  { value: "CONFIRMADA", label: "Confirmadas" },
  { value: "CANCELADA", label: "Canceladas" },
  { value: "CONCLUIDA", label: "Concluídas" },
];

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR").format(new Date(value));
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    PENDENTE: "Pendente",
    CONFIRMADA: "Confirmada",
    CANCELADA: "Cancelada",
    CONCLUIDA: "Concluída",
  };

  return labels[status] || status;
}

function statusClass(status: string) {
  const classes: Record<string, string> = {
    PENDENTE: "bg-amber-50 text-amber-700 ring-amber-200",
    CONFIRMADA: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    CANCELADA: "bg-red-50 text-red-700 ring-red-200",
    CONCLUIDA: "bg-blue-50 text-blue-700 ring-blue-200",
  };

  return classes[status] || "bg-gray-50 text-gray-700 ring-gray-200";
}

export default async function AdminReservasPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getSession();

  if (!session || !canAccess(session.role, "admin")) {
    return null;
  }

  const params = await searchParams;
  const query = String(params.q || "").trim().toLowerCase();
  const selectedStatus = String(params.status || "");

  const store = await getRepositoryRuntime().read();

  const reservations = store.bookings
    .map((booking) => {
      const customer = store.profiles.find(
        (profile) => profile.id === booking.customerId,
      );

      const trip = store.trips.find((item) => item.id === booking.tripId);

      const payment = store.payments.find(
        (item) => item.bookingId === booking.id,
      );

      const passengers = store.passengers.filter(
        (passenger) => passenger.bookingId === booking.id,
      );

      const seller = booking.sellerId
        ? store.sellers.find((item) => item.id === booking.sellerId)
        : null;

      const sellerProfile = seller
        ? store.profiles.find((profile) => profile.id === seller.id)
        : null;

      const balance =
        booking.paymentPlan === "PARCIAL"
          ? getBalanceInfo(store, booking, trip)
          : null;

      return {
        booking,
        customer,
        trip,
        payment,
        balance,
        passengers,
        seller,
        sellerProfile,
      };
    })
    .filter((item) => {
      if (selectedStatus && item.booking.status !== selectedStatus) {
        return false;
      }

      if (!query) {
        return true;
      }

      const searchable = [
        item.booking.reference,
        item.customer?.fullName,
        item.customer?.email,
        item.trip?.name,
        item.trip?.destination,
        item.booking.boardingPoint,
        item.seller?.code,
        item.sellerProfile?.fullName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    })
    .sort(
      (a, b) =>
        new Date(b.booking.createdAt).getTime() -
        new Date(a.booking.createdAt).getTime(),
    );

  const allBookings = store.bookings;

  const totalReservations = allBookings.length;
  const pendingReservations = allBookings.filter(
    (item) => item.status === "PENDENTE",
  ).length;
  const confirmedReservations = allBookings.filter(
    (item) => item.status === "CONFIRMADA",
  ).length;
  const cancelledReservations = allBookings.filter(
    (item) => item.status === "CANCELADA",
  ).length;

  const confirmedRevenue = allBookings
    .filter((item) => item.status === "CONFIRMADA")
    .reduce((sum, item) => sum + item.totalAmount, 0);

  return (
    <div className="space-y-7">
      <div>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-primary)]">
              Operação
            </p>
            <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-bold">
              Central de Reservas
            </h1>
            <p className="mt-2 text-black/55">
              Controle todas as reservas, clientes, passageiros e pagamentos.
            </p>
          </div>

          <div className="rounded-2xl bg-white px-5 py-3 text-sm ring-1 ring-black/5">
            <span className="text-black/45">Reservas exibidas:</span>{" "}
            <strong>{reservations.length}</strong>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-5 ring-1 ring-black/5">
          <div className="border-b border-black/5 pb-3">
            <h2 className="font-[family-name:var(--font-display)] text-lg font-bold">
              Rotinas de saldo
            </h2>
            <p className="mt-1 text-sm text-black/50">
              Lembretes e reconciliação do saldo restante das reservas parciais
              (somente leitura por padrão; aplicar apenas quando autorizado).
            </p>
          </div>
          <div className="mt-4">
            <BalanceRotinaActions />
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-3xl bg-white p-5 ring-1 ring-black/5">
          <p className="text-xs font-semibold uppercase tracking-wide text-black/45">
            Total de reservas
          </p>
          <p className="mt-2 text-2xl font-bold">{totalReservations}</p>
        </div>

        <div className="rounded-3xl bg-white p-5 ring-1 ring-black/5">
          <p className="text-xs font-semibold uppercase tracking-wide text-black/45">
            Pendentes
          </p>
          <p className="mt-2 text-2xl font-bold text-amber-600">
            {pendingReservations}
          </p>
        </div>

        <div className="rounded-3xl bg-white p-5 ring-1 ring-black/5">
          <p className="text-xs font-semibold uppercase tracking-wide text-black/45">
            Confirmadas
          </p>
          <p className="mt-2 text-2xl font-bold text-emerald-600">
            {confirmedReservations}
          </p>
        </div>

        <div className="rounded-3xl bg-white p-5 ring-1 ring-black/5">
          <p className="text-xs font-semibold uppercase tracking-wide text-black/45">
            Canceladas
          </p>
          <p className="mt-2 text-2xl font-bold text-red-600">
            {cancelledReservations}
          </p>
        </div>

        <div className="rounded-3xl bg-white p-5 ring-1 ring-black/5">
          <p className="text-xs font-semibold uppercase tracking-wide text-black/45">
            Faturamento confirmado
          </p>
          <p className="mt-2 text-xl font-bold text-[var(--brand-primary)]">
            {formatCurrency(confirmedRevenue)}
          </p>
        </div>
      </div>

      <form
        method="GET"
        className="rounded-3xl bg-white p-5 ring-1 ring-black/5"
      >
        <div className="grid gap-4 lg:grid-cols-[1fr_220px_auto]">
          <div>
            <label
              htmlFor="q"
              className="mb-2 block text-sm font-semibold text-black/70"
            >
              Buscar reserva
            </label>
            <input
              id="q"
              name="q"
              defaultValue={params.q || ""}
              placeholder="Reserva, cliente, e-mail, viagem ou embarque..."
              className="h-12 w-full rounded-2xl border border-black/10 bg-white px-4 outline-none transition focus:border-[var(--brand-primary)]"
            />
          </div>

          <div>
            <label
              htmlFor="status"
              className="mb-2 block text-sm font-semibold text-black/70"
            >
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={selectedStatus}
              className="h-12 w-full rounded-2xl border border-black/10 bg-white px-4 outline-none transition focus:border-[var(--brand-primary)]"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="h-12 rounded-2xl bg-[var(--brand-primary)] px-6 font-semibold text-white transition hover:opacity-90"
            >
              Filtrar
            </button>

            <Link
              href="/admin/reservas"
              className="flex h-12 items-center rounded-2xl border border-black/10 px-5 font-semibold text-black/70 transition hover:bg-black/[0.03]"
            >
              Limpar
            </Link>
          </div>
        </div>
      </form>

      <div className="overflow-hidden rounded-3xl bg-white ring-1 ring-black/5">
        <div className="border-b border-black/5 px-6 py-5">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">
            Reservas
          </h2>
          <p className="mt-1 text-sm text-black/50">
            As informações abaixo são exclusivas da administração.
          </p>
        </div>

        {reservations.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="font-semibold">Nenhuma reserva encontrada.</p>
            <p className="mt-1 text-sm text-black/50">
              Tente alterar os filtros de busca.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] text-left">
<thead className="bg-black/[0.025] text-xs uppercase tracking-wide text-black/45">
                  <tr>
                    <th className="px-6 py-4">Reserva</th>
                    <th className="px-6 py-4">Cliente</th>
                    <th className="px-6 py-4">Viagem</th>
                    <th className="px-6 py-4">Passageiros</th>
                    <th className="px-6 py-4">Embarque</th>
                    <th className="px-6 py-4">Valor</th>
                    <th className="px-6 py-4">Pagamento</th>
                    <th className="px-6 py-4">Saldo</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Ações</th>
                  </tr>
                </thead>

              <tbody className="divide-y divide-black/5">
                {reservations.map(
                  ({
                    booking,
                    customer,
                    trip,
                    payment,
                    balance,
                    passengers,
                  }) => (
                    <tr
                      key={booking.id}
                      className="transition hover:bg-black/[0.018]"
                    >
                      <td className="px-6 py-5">
                        <p className="font-bold">{booking.reference}</p>
                        <p className="mt-1 text-xs text-black/45">
                          {formatDateTime(booking.createdAt)}
                        </p>
                      </td>

                      <td className="px-6 py-5">
                        <p className="font-semibold">
                          {customer?.fullName || "Cliente não encontrado"}
                        </p>
                        <p className="mt-1 max-w-[220px] truncate text-xs text-black/45">
                          {customer?.email || "Sem e-mail"}
                        </p>
                      </td>

                      <td className="px-6 py-5">
                        <p className="max-w-[230px] font-semibold">
                          {trip?.name || "Viagem não encontrada"}
                        </p>
                        <p className="mt-1 text-xs text-black/45">
                          {trip?.departureDate
                            ? formatTripDepartureDate(trip)
                            : "Sem data"}
                        </p>
                      </td>

                      <td className="px-6 py-5">
                        <span className="font-semibold">
                          {passengers.length || booking.quantity}
                        </span>
                        <span className="text-black/45"> pessoa(s)</span>
                      </td>

                      <td className="px-6 py-5">
                        <p className="max-w-[190px] text-sm">
                          {booking.boardingPoint || "Não definido"}
                        </p>
                      </td>

                      <td className="px-6 py-5">
                        <p className="font-bold">
                          {formatCurrency(booking.totalAmount)}
                        </p>
                        {booking.discountAmount > 0 && (
                          <p className="mt-1 text-xs text-emerald-600">
                            Desconto:{" "}
                            {formatCurrency(booking.discountAmount)}
                          </p>
                        )}
                      </td>

                      <td className="px-6 py-5">
                        <p className="text-sm font-semibold">
                          {payment?.method === "CARTAO"
                            ? "Cartão"
                            : payment?.method === "PIX"
                              ? "PIX"
                              : "Não registrado"}
                        </p>
                        <p className="mt-1 text-xs text-black/45">
                          {payment?.status || "Sem pagamento"}
                        </p>
                      </td>

                      <td className="px-6 py-5">
                        {balance ? (
                          <>
                            <p className="text-sm font-bold">
                              {formatCurrency(balance.balance)}
                            </p>
                            {balance.status === "COMPLETO" ? (
                              <span className="mt-1 inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">
                                Completo
                              </span>
                            ) : (
                              <span
                                className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-bold ring-1 ${
                                  balance.isDueDatePassed
                                    ? "bg-red-50 text-red-700 ring-red-200"
                                    : "bg-amber-50 text-amber-700 ring-amber-200"
                                }`}
                              >
                                {balance.isDueDatePassed
                                  ? "Vencido"
                                  : "Em aberto"}
                                {balance.balancePayment ? " · cobrança" : ""}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-xs text-black/35">—</span>
                        )}
                      </td>

                      <td className="px-6 py-5">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ring-1 ${statusClass(
                            booking.status,
                          )}`}
                        >
                          {statusLabel(booking.status)}
                        </span>
                      </td>

                      <td className="px-6 py-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/admin/reservas/${booking.id}`}
                            className="inline-flex rounded-xl border border-black/10 px-4 py-2 text-sm font-semibold transition hover:bg-black/[0.04]"
                          >
                            Ver detalhes
                          </Link>

                          <DeleteBookingButton
                            bookingId={booking.id}
                            reference={booking.reference}
                            customerName={
                              customer?.fullName || "Cliente não encontrado"
                            }
                            hasPaidPayment={payment?.status === "PAGO"}
                          />
                        </div>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
