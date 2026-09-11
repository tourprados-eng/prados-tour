import QRCode from "qrcode";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import { formatCurrency, formatDate, maskCpf } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export default async function VoucherPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  const store = await getRepositoryRuntime().read();
  const booking = store.bookings.find((b) => b.id === id);
  if (!booking) notFound();
  if (
    !session ||
    (booking.customerId !== session.id &&
      !["SUPER_ADMIN", "ADMIN", "MONITOR", "VENDEDOR"].includes(session.role))
  ) {
    notFound();
  }
  const trip = store.trips.find((t) => t.id === booking.tripId)!;
  const customer = store.profiles.find((p) => p.id === booking.customerId)!;
  const passengers = store.passengers.filter((p) => p.bookingId === booking.id);
  const payment = store.payments.find((p) => p.bookingId === booking.id);
  const installments = store.installments.filter(
    (i) => i.bookingId === booking.id,
  );
  const boardingTime =
    store.tripBoardingPoints.find(
      (link) =>
        link.tripId === trip.id &&
        link.boardingPointId === booking.boardingPointId,
    )?.time ?? null;

  // O voucher só é liberado após a confirmação de pagamento.
  if (booking.status !== "CONFIRMADA") {
    return (
      <div className="mx-auto max-w-lg px-4 py-12">
        <div className="rounded-3xl bg-white p-8 text-center shadow-lg ring-1 ring-black/5">
          <p className="text-sm font-semibold uppercase tracking-widest text-[var(--brand-primary)]">
            {store.brand.companyName}
          </p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold">
            Voucher
          </h1>
          <p className="mt-1 text-lg font-bold">{booking.reference}</p>

          <p className="mt-6 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
            Este voucher ainda não está disponível.
          </p>
          <p className="mt-3 text-sm text-black/60">
            O pagamento da reserva <strong>{booking.reference}</strong> ainda
            está pendente. Assim que a confirmação do seu pagamento chegar, o
            voucher com os dados de embarque será liberado aqui mesmo.
          </p>

          {payment && (
            <div className="mt-4 space-y-1 text-sm text-black/60">
              <p>
                Status do pagamento:{" "}
                <strong className="text-black">
                  {payment.status === "PAGO" ? "PAGO" : payment.status}
                </strong>
              </p>
              <p>
                Valor {payment.method}:{" "}
                <strong className="text-black">{formatCurrency(payment.amount)}</strong>
              </p>
            </div>
          )}

          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Button href={`/checkout/sucesso?booking=${booking.id}`}>
              Ver orientações de pagamento
            </Button>
            <Button href="/minhas-viagens" variant="outline">
              Minhas viagens
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const showQr = store.voucher.showQr;
  const payload = JSON.stringify({
    ref: booking.reference,
    bookingId: booking.id,
  });
  const qr = showQr ? await QRCode.toDataURL(payload, { width: 200, margin: 1 }) : null;

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <div className="rounded-3xl bg-white p-8 text-center shadow-lg ring-1 ring-black/5">
        <p className="text-sm font-semibold uppercase tracking-widest text-[var(--brand-primary)]">
          {store.brand.companyName}
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold">
          Voucher
        </h1>
        <p className="mt-1 text-lg font-bold">{booking.reference}</p>
        <p className="mt-4 text-sm">
          Status:{" "}
          <strong>{booking.status === "CONFIRMADA" ? "CONFIRMADO" : booking.status}</strong>
        </p>
        {showQr && qr && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt="QR Code da reserva" className="mx-auto mt-6" />
        )}
        <div className="mt-6 space-y-2 text-left text-sm">
          <p className="rounded-xl bg-emerald-50 px-3 py-2 font-semibold text-emerald-700">
            Pagamento confirmado
          </p>
          <p>
            <strong>Responsável pela compra:</strong> {customer.fullName}
          </p>
          <p className="text-xs text-black/50">
            CPF {maskCpf(customer.cpf)} · e-mail {customer.email}
          </p>
          <p>
            <strong>Viagem:</strong> {trip.name}
          </p>
          <p>
            <strong>Data:</strong> {formatDate(trip.date)}
          </p>
          <p>
            <strong>Embarque:</strong> {booking.boardingPoint}
            {boardingTime ? ` às ${boardingTime}` : ""}
          </p>

          <div className="mt-3 border-t border-black/5 pt-3">
            <p className="font-semibold">Pagamento</p>
            {payment && (
              <>
                <p className="mt-1">
                  {payment.method} · {formatCurrency(booking.totalAmount)} ·{" "}
                  <span className="font-semibold text-emerald-700">PAGO</span>
                </p>
                {payment.plan === "PARCIAL" && (
                  <ul className="mt-1 space-y-1">
                    {installments.map((i) => (
                      <li key={i.id} className="text-xs text-black/60">
                        Parcela {i.number} ({i.status}):{" "}
                        {formatCurrency(i.value)}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>

          <div>
            <p className="font-semibold">Passageiros</p>
            <ul className="mt-1 list-disc pl-5">
              {passengers.map((p) => {
                const seat = store.seats.find((s) => s.id === p.seatId);
                const travelsTogether =
                  p.seatGroup && !p.seatGroup.startsWith("SEPARADO");
                return (
                  <li key={p.id}>
                    {p.name}
                    {seat ? ` · assento ${seat.seatNumber}` : ""}
                    {travelsTogether && (
                      <span className="text-black/50">
                        {" "}
                        · viaja junto com o grupo
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}