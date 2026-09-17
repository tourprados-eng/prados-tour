import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Trip } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatDate(value: string) {
  const datePart = value.trim().slice(0, 10);
  const match = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) return "—";

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return "—";
  }

  return new Intl.DateTimeFormat("pt-BR").format(date);
}

/** Data de saída efetiva da viagem, conforme cadastrada no Admin. */
export function tripDepartureDate(
  trip: Pick<Trip, "date" | "departureDate">,
): string | null {
  return trip.departureDate;
}

/** Data de retorno efetiva, conforme cadastrada no Admin. Sem retorno, null. */
export function tripReturnDate(
  trip: Pick<Trip, "returnDate">,
): string | null {
  return trip.returnDate ?? null;
}

/**
 * Formata a data de saída para exibição pública. Sem valor cadastrado no
 * Admin, retorna "—" (nunca inventa uma data).
 */
export function formatTripDepartureDate(
  trip: Pick<Trip, "date" | "departureDate">,
): string {
  return formatDate(trip.departureDate ?? trip.date);
}

/**
 * Formata a data de retorno para exibição pública. Sem retorno cadastrado,
 * exibe apenas o horário (se houver) ou nada — nunca assume o mesmo dia.
 */
export function formatTripReturn(
  trip: Pick<Trip, "returnDate" | "returnTime">,
): string {
  const parts: string[] = [];
  if (trip.returnDate) parts.push(formatDate(trip.returnDate));
  if (trip.returnTime) parts.push(formatTime(trip.returnTime));
  return parts.join(" às ");
}

/** Exibe horário "HH:mm", ignorando segundos vindos do Postgres (HH:mm:ss). */
export function formatTime(value: string | null | undefined) {
  if (!value) return "";
  const match = value.trim().match(/^(\d{2}:\d{2})/);
  return match ? match[1] : value.trim();
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function slugify(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function isValidCpf(cpf: string) {
  const digits = onlyDigits(cpf);
  if (digits.length !== 11 || /^(\d)\1+$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(digits[i]) * (10 - i);
  let rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  if (rest !== Number(digits[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(digits[i]) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  return rest === Number(digits[10]);
}

export function maskCpf(cpf: string) {
  const d = onlyDigits(cpf);
  if (d.length < 11) return cpf;
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
}

export function calculateTripPrice(
  quantity: number,
  pricePerson: number,
  priceCouple: number | null,
) {
  const couple = priceCouple ?? pricePerson * 2;
  return Math.floor(quantity / 2) * couple + (quantity % 2) * pricePerson;
}

/**
 * Aceita apenas caminhos internos seguros para redirecionamento pós-login.
 * Rejeita URLs absolutas, protocolos e "//" para evitar open redirect.
 */
export function safeInternalRedirectPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const path = value.trim();
  if (!path.startsWith("/")) return null;
  if (path.startsWith("//")) return null;
  if (/[\r\n\u0000]/.test(path)) return null;
  return path;
}
