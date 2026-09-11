import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import { SiteHeader, MobileNav } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { SellerTracker } from "@/components/layout/seller-tracker";

export default async function ClienteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const store = await getRepositoryRuntime().read();

  return (
    <div className="relative flex min-h-dvh flex-col isolate">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-gradient-to-b from-brand-tint via-brand-tint/40 to-transparent"
      />
      <SiteHeader />
      <SellerTracker validCodes={store.sellers.map((s) => s.code)} />
      <main className="min-w-0 flex-1 overflow-x-hidden">{children}</main>
      <SiteFooter brand={store.brand} />
      <MobileNav />
    </div>
  );
}