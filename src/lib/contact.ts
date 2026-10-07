import "server-only";

import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import { formatTripDepartureDate, onlyDigits } from "@/lib/utils";
import type { Contact, ContactKind, ContactPurpose, Trip } from "@/types";

export const DEFAULT_WHATSAPP_MESSAGE =
  "Olá! Vim pelo site da Prado's Tour e gostaria de mais informações.";

/**
 * Mensagens por finalidade. `{nome}` é substituído pelo nome do cliente quando
 * ele está autenticado/identificado no site; sem o nome, a variação sem o
 * "Meu nome é..." é usada para o texto continuar natural.
 */
export const PURPOSE_MESSAGES: Record<
  ContactPurpose,
  { withName: string; withoutName: string }
> = {
  suporte: {
    withName:
      "Olá! Meu nome é {nome}. Vim pelo site da Prado's Tour e preciso de ajuda!",
    withoutName:
      "Olá! Vim pelo site da Prado's Tour e preciso de ajuda!",
  },
  reservas: {
    withName:
      "Olá! Meu nome é {nome}. Estou com dúvidas e gostaria de mais informações sobre as viagens da Prado's Tour.",
    withoutName:
      "Olá! Estou com dúvidas e gostaria de mais informações sobre as viagens da Prado's Tour.",
  },
  geral: {
    withName: DEFAULT_WHATSAPP_MESSAGE,
    withoutName: DEFAULT_WHATSAPP_MESSAGE,
  },
};

/** Mensagem automática da finalidade, com o nome do cliente quando disponível. */
export function messageForPurpose(
  purpose: ContactPurpose,
  customerName?: string | null,
): string {
  const template = PURPOSE_MESSAGES[purpose] ?? PURPOSE_MESSAGES.geral;
  const name = customerName?.trim();
  return name ? template.withName.replace("{nome}", name) : template.withoutName;
}

/** DDI padrão do site. Todo contato é gravado em número nacional + DDI. */
export const DEFAULT_COUNTRY_CODE = "55";

/** Maior número nacional gravado no sistema (celular brasileiro com DDD). */
const MAX_NATIONAL_DIGITS = 11;

/**
 * Dígitos do número internacional (DDI + número), como o wa.me espera.
 *
 * O número é gravado em formato nacional (10 ou 11 dígitos no caso brasileiro).
 * Números mais longos que isso já vieram com o DDI embutido — é o caso do
 * WhatsApp legado herdado de settings.brand — e por isso não recebem prefixo
 * de novo. A checagem de tamanho evita o erro clássico de confundir o DDD com
 * o DDI: "11971653517" começa com "1", mas é nacional, não um número dos EUA.
 */
function internationalDigits(phone: string | null, countryCode: string | null): string {
  const national = onlyDigits(phone ?? "");
  if (!national) return "";
  const ddi = onlyDigits(countryCode ?? DEFAULT_COUNTRY_CODE) || DEFAULT_COUNTRY_CODE;
  if (national.length > MAX_NATIONAL_DIGITS) return national;
  return `${ddi}${national}`;
}

/**
 * Monta o link do WhatsApp a partir do número internacional.
 * Aceita o número já com DDI ou nacional + countryCode. A mensagem é
 * URL-encoded.
 */
export function buildWhatsAppUrl(
  phone: string | null,
  message?: string,
  countryCode?: string,
): string {
  const number = internationalDigits(phone, countryCode ?? DEFAULT_COUNTRY_CODE);
  if (!number) {
    return message
      ? `https://wa.me/?text=${encodeURIComponent(message)}`
      : `https://wa.me/`;
  }
  return message
    ? `https://wa.me/${number}?text=${encodeURIComponent(message)}`
    : `https://wa.me/${number}`;
}

/** Link `tel:` para contatos de telefone. */
export function buildTelUrl(phone: string | null, countryCode?: string): string {
  const number = internationalDigits(phone, countryCode ?? DEFAULT_COUNTRY_CODE);
  return number ? `tel:+${number}` : "tel:";
}

/** Link `mailto:` para contatos de e-mail. */
export function buildEmailUrl(email: string | null, subject?: string): string {
  const address = (email ?? "").trim();
  if (!address) return "mailto:";
  return subject
    ? `mailto:${address}?subject=${encodeURIComponent(subject)}`
    : `mailto:${address}`;
}

/** `(11) 97165-3517` a partir de `11971653517`. */
export function formatPhoneBR(phone: string | null): string {
  const d = onlyDigits(phone ?? "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d;
}

/**
 * Link de contato conforme o canal. WhatsApp e telefone usam número;
 * e-mail usa endereço. Mensagem automática só entra no WhatsApp.
 */
export function buildContactLink(contact: Contact, message?: string): string {
  if (contact.kind === "email") return buildEmailUrl(contact.email);
  if (contact.kind === "telefone") return buildTelUrl(contact.phone, contact.countryCode);
  return buildWhatsAppUrl(
    contact.phone,
    message ?? contact.autoMessage ?? undefined,
    contact.countryCode,
  );
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

/** Contatos ativos, na ordem de exibição do Admin. */
export async function getActiveContacts(): Promise<Contact[]> {
  const store = await getRepositoryRuntime().read();
  return (store.contacts ?? [])
    .filter((contact) => contact.isActive)
    .sort(
      (a, b) =>
        a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "pt-BR"),
    );
}

/** Contatos ativos, na ordem de exibição (overload síncrono para reuso). */
function sortActiveContacts(contacts: Contact[]): Contact[] {
  return contacts
    .filter((contact) => contact.isActive)
    .sort(
      (a, b) =>
        a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "pt-BR"),
    );
}

/**
 * Contato de WhatsApp ativo para uma finalidade (ex.: "suporte", "reservas").
 * Sem contato com a finalidade, cai no primeiro contato de WhatsApp ativo para
 * o site nunca ficar sem botão; sem nenhum, devolve `null`.
 */
export async function getPurposeContact(
  purpose: ContactPurpose,
): Promise<Contact | null> {
  const active = await getActiveContacts();
  const whatsapp = active.filter((c) => c.kind === "whatsapp");
  return whatsapp.find((c) => c.purpose === purpose) ?? whatsapp[0] ?? null;
}

/**
 * Contato exibido nas páginas públicas: o ativo marcado como principal.
 * Sem principal definido, cai no primeiro ativo que tenha o canal pedido.
 * Sem nenhum contato, cai para as settings antigas (brand) para o site não
 * ficar sem botão de contato.
 */
export async function getPrimaryContact(kind: ContactKind = "whatsapp"): Promise<Contact | null> {
  const active = await getActiveContacts();
  const match = active.filter((contact) => contact.kind === kind);
  return match.find((contact) => contact.isPrimary) ?? match[0] ?? null;
}

/**
 * Perfil de contato para as páginas públicas. Expõe todos os contatos ativos e
 * resolve os atalhos por finalidade (suporte/reservas). O `whatsapp` e
 * `whatsappMessage` mantêm o comportamento legado apontando para "reservas"
 * (atendimento comercial), usado no checkout e no painel do Admin.
 */
export async function getContactProfile() {
  const store = await getRepositoryRuntime().read();
  const contacts = sortActiveContacts(store.contacts ?? []);

  const whatsappContacts = contacts.filter((c) => c.kind === "whatsapp");
  const suporte =
    whatsappContacts.find((c) => c.purpose === "suporte") ?? null;
  const reservas =
    whatsappContacts.find((c) => c.purpose === "reservas") ??
    suporte ??
    null;
  const whatsappContact = reservas;

  return {
    contacts,
    suporte,
    reservas,
    whatsappContact,
    // Número internacional pronto para uso, já com DDI.
    whatsapp: internationalDigits(
      whatsappContact?.phone ?? store.brand.whatsapp,
      whatsappContact?.countryCode ?? null,
    ),
    email: whatsappContact?.email ?? store.brand.email ?? null,
    phone: whatsappContact?.phone ?? store.brand.phone ?? null,
    phoneFormatted: formatPhoneBR(whatsappContact?.phone ?? store.brand.phone ?? null),
    instagram: store.brand.instagram,
    whatsappMessage: messageForPurpose("reservas"),
  };
}
