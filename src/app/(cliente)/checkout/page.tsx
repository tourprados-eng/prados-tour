import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getPublicTripState, getTripBySlug } from "@/lib/booking/actions";
import { CheckoutWizard } from "@/components/checkout/checkout-wizard";
import { getRepositoryRuntime } from "@/lib/repositories/runtime";

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ trip?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login?next=/checkout");
  const { trip: slug } = await searchParams;
  if (!slug) redirect("/excursoes");
  const data = await getTripBySlug(slug);
  if (!data) {
    // Viagem já realizada: leva para a página da própria viagem, que explica
    // o encerramento. Sem isso o cliente cairia numa lista genérica sem
    // entender o motivo. Viagem inexistente/cancelada vai para o catálogo.
    const publicState = await getPublicTripState(slug);
    if (publicState.status === "REALIZADA") redirect(`/excursoes/${slug}`);
    redirect("/excursoes");
  }
  const store = await getRepositoryRuntime().read();
  const profile = store.profiles.find((p) => p.id === session.id);

  return (
    <CheckoutWizard
      trip={data.trip}
      boarding={data.boarding}
      availableSeats={data.availableSeats}
      defaultName={profile?.fullName || session.fullName}
      defaultPhone={profile?.phone || ""}
      defaultEmail={session.email}
      whatsapp={store.brand.whatsapp}
      brandName={store.brand.companyName}
    />
  );
}
