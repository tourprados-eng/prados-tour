import Link from "next/link";
import Image from "next/image";
import { Home, Compass, Tickets, User, Phone } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/layout/user-menu";

const publicLinks = [
  { href: "/", label: "Início" },
  { href: "/excursoes", label: "Excursões" },
  { href: "/ofertas", label: "Ofertas" },
  { href: "/sobre", label: "Sobre" },
  { href: "/contato", label: "Contato" },
];

export async function SiteHeader() {
  const [session, store] = await Promise.all([getSession(), getRepositoryRuntime().read()]);
  const brand = store.brand;

  return (
    <header className="sticky top-0 z-50">
      <div className="h-1 bg-gradient-to-r from-brand-primary via-brand-secondary to-brand-primary" />
      <div className="border-b border-brand-line/80 bg-white/85 backdrop-blur-xl">
        <div className="container-page flex h-[4.25rem] items-center justify-between gap-3 md:h-[4.75rem]">
          <Link href="/" className="group flex min-w-0 items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white ring-1 ring-brand-line shadow-sm transition group-hover:ring-brand-primary/50 group-hover:shadow-glow">
              <Image
                src={brand.logoUrl}
                alt={brand.companyName}
                width={44}
                height={44}
                className="h-8 w-8 object-contain"
                priority
              />
            </span>
            <div className="min-w-0 leading-tight">
              <p className="font-display truncate text-base font-bold tracking-tight text-brand-ink md:text-lg">
                {brand.companyName}
              </p>
              <p className="hidden truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-secondary sm:block">
                Agência de viagens
              </p>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {publicLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-full px-4 py-2 text-sm font-semibold text-brand-muted transition hover:bg-brand-tint hover:text-brand-primary"
              >
                {l.label}
              </Link>
            ))}
            <Link
              href={session ? "/minhas-viagens" : "/login"}
              className="rounded-full px-4 py-2 text-sm font-semibold text-brand-muted transition hover:bg-brand-tint hover:text-brand-primary"
            >
              Minhas viagens
            </Link>
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            {session ? (
              <UserMenu fullName={session.fullName} email={session.email} role={session.role} />
            ) : (
              <>
                <Button href="/login" variant="ghost" size="sm">
                  Entrar
                </Button>
                <Button href="/criar-conta" size="sm">
                  Criar conta
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export async function MobileNav() {
  const session = await getSession();
  const items = [
    { href: "/", label: "Início", icon: Home },
    { href: "/excursoes", label: "Excursões", icon: Compass },
    { href: session ? "/minhas-viagens" : "/login", label: session ? "Viagens" : "Entrar", icon: Tickets },
    { href: session ? "/meus-vouchers" : "/criar-conta", label: session ? "Voucher" : "Conta", icon: User },
    { href: "/contato", label: "Contato", icon: Phone },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-brand-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
      <ul className="mx-auto grid max-w-lg grid-cols-5 gap-0.5 px-1 py-1.5">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-semibold text-brand-muted transition hover:bg-brand-tint hover:text-brand-primary"
            >
              <item.icon className="h-5 w-5" strokeWidth={2.2} aria-hidden />
              <span className="max-w-full truncate">{item.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}