import Link from "next/link";
import Image from "next/image";
import { getSession } from "@/lib/auth/session";
import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import { logoutAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

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
    <header className="sticky top-0 z-50 border-b border-[#EBE4E7]/80 bg-white/90 backdrop-blur-xl">
      <div className="container-page flex h-[4.25rem] items-center justify-between gap-3 md:h-[4.75rem]">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <Image
            src={brand.logoUrl}
            alt={brand.companyName}
            width={44}
            height={44}
            className="h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-[#E84C91]/20"
            priority
          />
          <div className="min-w-0 leading-tight">
            <p className="font-display truncate text-base font-bold tracking-tight text-[#2F2328] md:text-lg">
              {brand.companyName}
            </p>
            <p className="hidden truncate text-xs text-[#6B5B63] sm:block">
              Excursões com segurança
            </p>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {publicLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-full px-3.5 py-2 text-sm font-medium text-[#3D2A33] transition hover:bg-[#FFF0F6] hover:text-[#E84C91]"
            >
              {l.label}
            </Link>
          ))}
          {session && (
            <Link
              href="/minhas-viagens"
              className="rounded-full px-3.5 py-2 text-sm font-medium text-[#3D2A33] transition hover:bg-[#FFF0F6] hover:text-[#E84C91]"
            >
              Minhas viagens
            </Link>
          )}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          {session ? (
            <>
              <Button
                href="/meu-perfil"
                variant="ghost"
                size="sm"
                className="hidden max-w-[9rem] truncate sm:inline-flex"
              >
                {session.fullName.split(" ")[0]}
              </Button>
              <form action={logoutAction}>
                <Button type="submit" variant="outline" size="sm">
                  Sair
                </Button>
              </form>
            </>
          ) : (
            <>
              <Button href="/login" variant="ghost" size="sm" className="hidden sm:inline-flex">
                Entrar
              </Button>
              <Button href="/criar-conta" size="sm">
                Criar conta
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export async function MobileNav() {
  const session = await getSession();
  const items = [
    { href: "/", label: "Início" },
    { href: "/excursoes", label: "Excursões" },
    { href: session ? "/minhas-viagens" : "/login", label: session ? "Viagens" : "Entrar" },
    { href: session ? "/meus-vouchers" : "/criar-conta", label: session ? "Voucher" : "Conta" },
    { href: "/contato", label: "Contato" },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-[#EBE4E7] bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
      <ul className="mx-auto grid max-w-lg grid-cols-5 gap-0.5 px-1 py-1.5">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="flex min-h-12 flex-col items-center justify-center rounded-xl px-1 text-[11px] font-semibold text-[#6B5B63] transition hover:bg-[#FFF0F6] hover:text-[#E84C91]"
            >
              <span className="max-w-full truncate">{item.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
