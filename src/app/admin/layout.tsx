import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, canAccess } from "@/lib/auth/session";
import { logoutAction } from "@/lib/auth/actions";
import { navItemsForRole } from "@/lib/navigation";
import { Button } from "@/components/ui/button";

function resolveGreetingName(fullName: string): string {
  const first = fullName?.trim().split(/\s+/)[0] ?? "";
  if (!first || first.toLowerCase() === "cliente") return "Administrador";
  return first;
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session || !canAccess(session.role, "admin")) {
    redirect("/login");
  }

  const greetingName = resolveGreetingName(session.fullName);
  const navItems = navItemsForRole(session.role);

  return (
    <div className="min-h-screen bg-[#F7F4F5]">
      <div className="mx-auto flex max-w-[1500px]">

        <aside className="hidden min-h-screen w-64 shrink-0 border-r border-[#E8DFE3] bg-white lg:block">
          <div className="sticky top-0 p-5">

            <div className="mb-6 rounded-2xl bg-[#FFF0F6] p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-[#E84C91]">
                Prado&apos;s Tour
              </p>
              <p className="mt-1 text-sm font-semibold text-[#2F2328]">
                Painel administrativo
              </p>
              <p className="mt-1 text-xs text-[#6B5B63]">
                Gestão da agência
              </p>
            </div>

            <nav className="space-y-1">
              {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center rounded-xl px-4 py-3 text-sm font-semibold text-[#4A3941] transition hover:bg-[#FFF0F6] hover:text-[#E84C91]"
                  >
                    {item.label}
                  </Link>
                ))}
            </nav>

            <div className="mt-8 border-t border-[#E8DFE3] pt-5">
              <Link
                href="/"
                className="block rounded-xl px-4 py-3 text-sm font-semibold text-[#6B5B63] hover:bg-[#F7F4F5]"
              >
                Ver site
              </Link>

              <form action={logoutAction} className="mt-1">
                <Button
                  type="submit"
                  variant="outline"
                  className="w-full justify-start rounded-xl"
                >
                  Sair
                </Button>
              </form>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 p-4 md:p-6 lg:p-8">
          <div className="mb-6 flex items-center justify-between rounded-2xl border border-[#E8DFE3] bg-white px-5 py-4 shadow-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#E84C91]">
                Administração
              </p>
              <p className="mt-1 text-sm font-semibold text-[#2F2328]">
                Olá, {greetingName}
              </p>
            </div>

            <span className="rounded-full bg-[#FFF0F6] px-3 py-1.5 text-xs font-bold text-[#E84C91]">
              {session.role}
            </span>
          </div>

          {children}
        </main>
      </div>
    </div>
  );
}
