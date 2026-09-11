import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import CouponForm from "@/components/admin/coupon-form";

export const dynamic = "force-dynamic";

export default async function NewCouponPage() {
  const store = await getRepositoryRuntime().read();
  const trips = store.trips.filter((t) => !t.deletedAt);

  return (
    <div className="mx-auto w-full max-w-[1400px]">
      <CouponForm trips={trips} />
    </div>
  );
}