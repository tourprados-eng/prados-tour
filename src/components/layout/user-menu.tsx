"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, Heart, Plane, CreditCard, Bell, LogOut, Shield } from "lucide-react";
import { logoutAction } from "@/lib/auth/actions";
import { homeForRole, isStaffRole, roleLabel } from "@/lib/roles";
import type { AppRole } from "@/types";

const links = [
  { href: "/meu-perfil", label: "Meu perfil", icon: Heart },
  { href: "/minhas-viagens", label: "Minhas viagens", icon: Plane },
  { href: "/meus-pagamentos", label: "Meus pagamentos", icon: CreditCard },
  { href: "/notificacoes", label: "Notificações", icon: Bell },
];

export function UserMenu({
  fullName,
  email,
  role,
}: {
  fullName: string;
  email?: string;
  role: AppRole;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const staff = isStaffRole(role);
  // Contas staff exibem o papel (ex.: "Super Admin"); clientes exibem o nome.
  const displayName = staff ? roleLabel(role) : fullName.trim().split(/\s+/)[0] || "Cliente";
  const avatarInitial = displayName.charAt(0).toUpperCase();
  const panelHref = staff ? homeForRole(role) : null;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex h-9 min-h-9 max-w-[8.5rem] items-center gap-1.5 rounded-full border border-brand-line bg-white px-3 text-sm font-semibold text-brand-ink shadow-sm transition hover:border-brand-primary/40 hover:bg-brand-tint sm:max-w-[10rem]"
      >
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-grad text-white">
          <span className="text-[11px] font-bold uppercase">{avatarInitial}</span>
        </span>
        <span className="min-w-0 flex-1 truncate text-left">{displayName}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-brand-muted transition duration-200 ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-60 origin-top-right rounded-2xl border border-brand-line bg-white p-1.5 shadow-lift"
        >
          <div className="border-b border-brand-line px-3 pb-2.5 pt-2">
            <div className="flex items-center justify-between gap-2">
              <p className="min-w-0 truncate text-sm font-bold text-brand-ink">
                {fullName.trim() ? fullName : roleLabel(role)}
              </p>
              {staff && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-tint px-2 py-0.5 text-[11px] font-bold text-brand-primary">
                  <Shield className="h-3 w-3" aria-hidden />
                  {roleLabel(role)}
                </span>
              )}
            </div>
            {email && <p className="mt-0.5 truncate text-xs text-brand-muted">{email}</p>}
          </div>

          <div className="pt-1.5">
            {panelHref && (
              <Link
                href={panelHref}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold text-brand-ink transition hover:bg-brand-tint hover:text-brand-primary"
              >
                <Shield className="h-4 w-4 shrink-0 text-brand-primary" aria-hidden />
                Painel administrativo
              </Link>
            )}
            {links.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-brand-ink transition hover:bg-brand-tint hover:text-brand-primary"
              >
                <item.icon className="h-4 w-4 shrink-0 text-brand-secondary" aria-hidden />
                {item.label}
              </Link>
            ))}
          </div>

          <form action={logoutAction} className="pt-1">
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-brand-ink transition hover:bg-brand-tint hover:text-brand-primary"
            >
              <LogOut className="h-4 w-4 shrink-0 text-brand-secondary" aria-hidden />
              Sair
            </button>
          </form>
        </div>
      )}
    </div>
  );
}