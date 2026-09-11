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

export const AREA_ROLES: Record<
  "admin" | "financeiro" | "vendedor" | "operacional" | "customer",
  AppRole[]
> = {
  admin: ["SUPER_ADMIN", "ADMIN"],
  financeiro: ["SUPER_ADMIN", "ADMIN", "FINANCEIRO"],
  vendedor: ["SUPER_ADMIN", "ADMIN", "VENDEDOR"],
  operacional: ["SUPER_ADMIN", "ADMIN", "MONITOR"],
  customer: ["SUPER_ADMIN", "ADMIN", "FINANCEIRO", "VENDEDOR", "MONITOR", "CLIENTE"],
};

/**
 * Verificação central de acesso por área. Middleware, guards de rota, server
 * actions e rotas de API devem usar esta função em vez de arrays inline.
 */
export function canAccessRole(role: AppRole, area: keyof typeof AREA_ROLES): boolean {
  return AREA_ROLES[area].includes(role);
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
