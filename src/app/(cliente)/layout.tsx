import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import { SiteHeader, MobileNav } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";

export default async function ClienteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const store = await getRepositoryRuntime().read();

  return (
    <>
      <SiteHeader />
      <main className="min-w-0 overflow-x-hidden">{children}</main>
      <SiteFooter brand={store.brand} />
      <MobileNav />
    </>
  );
}
