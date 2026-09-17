import Link from "next/link";
import QRCode from "qrcode";
import { notFound } from "next/navigation";
import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import { getSession } from "@/lib/auth/session";
import { formatCurrency, formatDate, formatTripDepartureDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PixCopyButton } from "@/components/checkout/pix-copy-button";
import { simulateGatewayConfirm } from "@/lib/booking/actions";
import { buildWhatsAppUrl } from "@/lib/contact";

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ booking?: string }>;
}) {
  const { booking: bookingId } = await searchParams;
  if (!bookingId) notFound();
  const session = await getSession();
  const store = await getRepositoryRuntime().read();
  const booking = store.bookings.find((b) => b.id === bookingId);
  if (!booking) notFound();
  if (
    session &&
    booking.customerId !== session.id &&
    !["SUPER_ADMIN", "ADMIN", "FINANCEIRO", "VENDEDOR"].includes(session.role)
  ) {
    notFound();
  }
  const trip = store.trips.find((t) => t.id === booking.tripId);
  if (!trip) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="rounded-3xl bg-white/90 p-8 ring-1 ring-black/5">
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">
            Reserva indisponível
          </h1>
          <p className="mt-2 text-black/60">
            Não foi possível encontrar os detalhes desta viagem. Tente novamente
            em instantes ou consulte em Minhas viagens.
          </p>
          <p className="mt-6 text-center text-sm">
            <Link href="/excursoes" className="text-[var(--brand-primary)]">
              Continuar explorando
            </Link>
          </p>
        </div>
      </div>
    );
  }
  const payment = store.payments.find((p) => p.bookingId === booking.id);
  const balance = store.installments.find(
    (i) => i.bookingId === booking.id && i.number === 2 && i.status === "PENDENTE",
  );
  const qr =
    payment && payment.pixCopyPaste && payment.status === "PENDENTE"
      ? await QRCode.toDataURL(payment.pixCopyPaste, { margin: 1, width: 220 })
      : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="rounded-3xl bg-white/90 p-8 ring-1 ring-black/5">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">
          Reserva {booking.status === "CONFIRMADA" ? "confirmada" : "criada"}
        </h1>
        <p className="mt-2 text-black/60">
          {booking.reference} · {trip.name} · {formatTripDepartureDate(trip)}
        </p>

        <div className="mt-6 space-y-2 text-sm">
          <p>
            Status da reserva: <strong>{booking.status}</strong>
          </p>
          {payment ? (
            <p>
              Pagamento: <strong>{payment.status}</strong> ·{" "}
              {formatCurrency(payment.amount)}
            </p>
          ) : (
            <p className="rounded-2xl bg-orange-50 p-3 text-orange-900">
              PIX ainda sendo gerado. Tente abrir a reserva novamente em
              instantes ou veja em Minhas viagens.
            </p>
          )}
          {balance && (
            <p className="rounded-2xl bg-orange-50 p-3 text-orange-900">
              Saldo restante: {formatCurrency(balance.value)} · vencimento{" "}
              {formatDate(balance.dueDate)}
            </p>
          )}
        </div>

        {payment && payment.method === "PIX" && payment.status === "PENDENTE" && (
          <div className="mt-8 text-center">
            <p className="font-semibold">PIX — pague o valor abaixo</p>
            <p className="mt-1 text-2xl font-bold text-[var(--brand-primary)]">
              {formatCurrency(payment.amount)}
            </p>
            {qr && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr} alt="QR Code PIX" className="mx-auto mt-4 rounded-2xl" />
            )}
            <p className="mt-4 break-all rounded-2xl bg-black/5 p-3 text-left text-xs">
              {payment.pixCopyPaste}
            </p>
            {payment.pixCopyPaste && (
              <PixCopyButton value={payment.pixCopyPaste} />
            )}
            <p className="mt-3 text-xs text-black/50">
              Assim que o pagamento for confirmado, seu voucher ficará disponível
              em Minhas viagens.
            </p>
          </div>
        )}

        {payment?.method === "CARTAO" && payment?.status === "PENDENTE" && (
          <div className="mt-8 rounded-2xl bg-pink-50 p-4 text-sm">
            Cartão: o atendimento de{" "}
            {store.brand.companyName || "Prado's Tour"} finalizará a cobrança
            pelo WhatsApp. O status só muda após a confirmação do pagamento.
            <div className="mt-3">
              <Button
                href={buildWhatsAppUrl(
                  store.brand.whatsapp,
                  `Quero pagar a reserva ${booking.reference}`,
                )}
                variant="secondary"
              >
                Falar no WhatsApp
              </Button>
            </div>
          </div>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          {booking.status === "CONFIRMADA" && (
            <Button href={`/voucher/${booking.id}`}>Ver voucher</Button>
          )}
          <Button href="/minhas-viagens" variant="outline">
            Minhas viagens
          </Button>
        </div>

        {session && ["SUPER_ADMIN", "ADMIN", "FINANCEIRO"].includes(session.role) && payment?.status === "PENDENTE" && (
          <form
            action={async () => {
              "use server";
              await simulateGatewayConfirm(payment!.id);
            }}
            className="mt-6"
          >
            <Button type="submit" variant="ghost" size="sm">
              Confirmar pagamento recebido
            </Button>
          </form>
        )}

        <p className="mt-6 text-center text-sm">
          <Link href="/excursoes" className="text-[var(--brand-primary)]">
            Continuar explorando
          </Link>
        </p>
      </div>
    </div>
  );
}
