import { notFound } from "next/navigation";
import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import CouponForm from "@/components/admin/coupon-form";

export const dynamic = "force-dynamic";

export default async function EditCouponPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const store = await getRepositoryRuntime().read();
  const coupon = store.coupons.find((c) => c.id === id);
  if (!coupon) notFound();

  const trips = store.trips.filter((t) => !t.deletedAt);

  return (
    <div className="mx-auto w-full max-w-[1400px]">
      <CouponForm coupon={coupon} trips={trips} />
    </div>
  );
}