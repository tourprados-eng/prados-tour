import { notFound } from "next/navigation";
import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import PromotionForm from "@/components/admin/promotion-form";

export const dynamic = "force-dynamic";

export default async function EditPromotionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const store = await getRepositoryRuntime().read();
  const promotion = store.promotions.find((p) => p.id === id && !p.deletedAt);
  if (!promotion) notFound();

  const trips = store.trips.filter((t) => !t.deletedAt);

  return (
    <div className="mx-auto w-full max-w-[1400px]">
      <PromotionForm
        promotion={promotion}
        trips={trips}
        coupons={store.coupons}
      />
    </div>
  );
}