import type { TripCategory } from "@/types";

export const DEMO_PASSWORD_HINT = "";

/** Categorias oficiais de excursões, na ordem exibida para o cliente. */
export const TRIP_CATEGORIES: TripCategory[] = [
  "PRAIA",
  "PARQUE",
  "CIDADE_TURISMO",
  "NATUREZA",
  "OUTROS",
];

/** Rótulos de exibição (formulário admin, cards, badges). */
export const TRIP_CATEGORY_LABELS: Record<TripCategory, string> = {
  PRAIA: "Praia",
  PARQUE: "Parque",
  CIDADE_TURISMO: "Cidades e Turismo",
  NATUREZA: "Natureza",
  OUTROS: "Outros",
};

/** Rótulos do filtro público de /excursoes. */
export const TRIP_CATEGORY_FILTER_LABELS: Record<TripCategory, string> = {
  PRAIA: "Praias",
  PARQUE: "Parques",
  CIDADE_TURISMO: "Cidades",
  NATUREZA: "Natureza",
  OUTROS: "Outros",
};

/**
 * Mapeamento das categorias legadas (string livre usada antes da padronização)
 * para o enum atual. Chaves sempre em minúsculas.
 */
export const TRIP_CATEGORY_LEGACY_MAP: Record<string, TripCategory> = {
  praia: "PRAIA",
  parque: "PARQUE",
  "day use": "PARQUE",
  "turismo cultural": "CIDADE_TURISMO",
  "turismo religioso": "CIDADE_TURISMO",
  "rota dos vinhos": "NATUREZA",
  cachoeira: "NATUREZA",
  trilha: "NATUREZA",
  outros: "OUTROS",
};

/** Normaliza qualquer valor (novo, legado ou vazio) para uma categoria válida. */
export function normalizeTripCategory(
  raw: string | null | undefined,
): TripCategory {
  if (!raw) return "OUTROS";
  const key = raw.trim().toLowerCase();
  return TRIP_CATEGORY_LEGACY_MAP[key] ?? "OUTROS";
}

/** Label de exibição de uma categoria, com fallback seguro para valores desconhecidos. */
export function tripCategoryLabel(category: string): string {
  return TRIP_CATEGORY_LABELS[category as TripCategory] ?? category;
}

/** Conjunto de categorias válidas (para validação de query params, etc.). */
export const TRIP_CATEGORY_SET: ReadonlySet<string> = new Set(TRIP_CATEGORIES);