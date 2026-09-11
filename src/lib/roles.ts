import type { AppRole } from "@/types";

export const ROLE_LABELS: Record<AppRole, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Administrador",
  FINANCEIRO: "Financeiro",
  VENDEDOR: "Vendedor",
  MONITOR: "Monitor",
  CLIENTE: "Cliente",
};

export function roleLabel(role: AppRole): string {
  return ROLE_LABELS[role] ?? role;
}

export function isStaffRole(role: AppRole): boolean {
  return role !== "CLIENTE";
}

export function homeForRole(role: AppRole) {
  switch (role) {
    case "SUPER_ADMIN":
    case "ADMIN":
      return "/admin";
    case "FINANCEIRO":
      return "/financeiro";
    case "VENDEDOR":
      return "/vendedor";
    case "MONITOR":
      return "/operacional";
    default:
      return "/minhas-viagens";
  }
}
