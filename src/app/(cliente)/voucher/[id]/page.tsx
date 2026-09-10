import QRCode from "qrcode";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import { formatCurrency, formatDate, maskCpf } from "@/lib/utils";

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
  const payload = JSON.stringify({
    ref: booking.reference,
    bookingId: booking.id,
  });
  const qr = await QRCode.toDataURL(payload, { width: 200, margin: 1 });

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
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt="QR Code da reserva" className="mx-auto mt-6" />
        <div className="mt-6 space-y-2 text-left text-sm">
          <p>
            <strong>Cliente:</strong> {customer.fullName} ({maskCpf(customer.cpf)})
          </p>
          <p>
            <strong>Viagem:</strong> {trip.name}
          </p>
          <p>
            <strong>Data:</strong> {formatDate(trip.date)}
          </p>
          <p>
            <strong>Embarque:</strong> {booking.boardingPoint}
          </p>
          <p>
            <strong>Pagamento:</strong> {payment?.method} · {formatCurrency(booking.totalAmount)}
          </p>
          <div>
            <strong>Passageiros:</strong>
            <ul className="mt-1 list-disc pl-5">
              {passengers.map((p) => {
                const seat = store.seats.find((s) => s.id === p.seatId);
                return (
                  <li key={p.id}>
                    {p.name}
                    {seat ? ` · assento ${seat.seatNumber}` : ""}
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
