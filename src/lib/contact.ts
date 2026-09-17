import "server-only";

import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import { formatTripDepartureDate, onlyDigits } from "@/lib/utils";
import type { Trip } from "@/types";

export const DEFAULT_WHATSAPP_MESSAGE =
  "Olá! Vim pelo site da Prado's Tour e gostaria de mais informações.";

/**
 * Monta o link oficial do WhatsApp a partir do número institucional.
 * O número é normalizado (apenas dígitos); a mensagem é URL-encoded.
 */
export function buildWhatsAppUrl(phone: string, message?: string): string {
  const number = onlyDigits(phone);
  if (!number) {
    return message
      ? `https://wa.me/?text=${encodeURIComponent(message)}`
      : `https://wa.me/`;
  }
  return message
    ? `https://wa.me/${number}?text=${encodeURIComponent(message)}`
    : `https://wa.me/${number}`;
}

/**
 * Anexa os dados da viagem à mensagem padrão (ex.: botões em página de viagem).
 */
export function withTripInfo(
  message: string,
  trip?: Pick<Trip, "name" | "date" | "departureDate">,
): string {
  const base = message.trim() || DEFAULT_WHATSAPP_MESSAGE;
  if (!trip) return base;
  return `${base}\n\nViagem: ${trip.name} · ${formatTripDepartureDate(trip)}`;
}

/**
 * Perfil de contato institucional (fonte: settings — editável no painel).
 */
export async function getContactProfile() {
  const store = await getRepositoryRuntime().read();
  return {
    whatsapp: store.brand.whatsapp,
    email: store.brand.email,
    phone: store.brand.phone ?? "",
    instagram: store.brand.instagram,
    whatsappMessage:
      store.brand.whatsappMessage?.trim() || DEFAULT_WHATSAPP_MESSAGE,
  };
}