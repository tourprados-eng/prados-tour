import { canAccessRole } from "@/lib/roles";
import type { AppRole } from "@/types";

export type NavItem = {
  href: string;
  label: string;
  icon: string;
  area: "admin" | "financeiro";
  superOnly?: boolean;
};

/**
 * Fonte única do menu de gestão. Cada item declara a área de acesso; as
 * telas filtram por perfil (ex.: Financeiro não enxerga Viagens/Configurações).
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: "⌂", area: "admin" },
  { href: "/admin/reservas", label: "Reservas", icon: "▣", area: "admin" },
  { href: "/admin/viagens", label: "Viagens", icon: "▤", area: "admin" },
  { href: "/admin/clientes", label: "Clientes", icon: "♙", area: "admin" },
  { href: "/admin/vendedores", label: "Vendedores", icon: "♧", area: "admin" },
  { href: "/admin/cupons", label: "Cupons", icon: "◇", area: "admin" },
  { href: "/admin/promocoes", label: "Promoções", icon: "%", area: "admin" },
  { href: "/admin/despesas", label: "Despesas", icon: "▤", area: "admin" },
  { href: "/financeiro", label: "Financeiro", icon: "▥", area: "financeiro" },
  {
    href: "/admin/avaliacoes",
    label: "Avaliações",
    icon: "★",
    area: "admin",
    superOnly: true,
  },
  {
    href: "/admin/auditoria",
    label: "Auditoria",
    icon: "✎",
    area: "admin",
    superOnly: true,
  },
  {
    href: "/admin/configuracoes",
    label: "Configurações",
    icon: "⚙",
    area: "admin",
    superOnly: true,
  },
];

export function navItemsForRole(role: AppRole): NavItem[] {
  return NAV_ITEMS.filter(
    (item) =>
      (!item.superOnly || role === "SUPER_ADMIN") &&
      canAccessRole(role, item.area),
  );
}