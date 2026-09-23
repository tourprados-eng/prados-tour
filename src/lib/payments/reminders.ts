import "server-only";

import { promises as fs } from "fs";
import path from "path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { v4 as uuid } from "uuid";
import { getDataBackend, getSupabaseEnvironment } from "@/lib/supabase/config";
import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import { getBalanceInfo } from "@/lib/payments/balance";
import type { Booking, DataStore, Trip } from "@/types";

/**
 * Lembretes de SALDO RESTANTE — idempotentes e auditáveis.
 *
 * A categoria (público) do e-mail de CONFIRMAÇÃO DE CADASTRO é responsabilidade
 * exclusiva do Supabase Auth e NÃO é alterada aqui.
 *
 * Fonte de dados: bookings CONFIRMADA com plano PARCIAL, viagem futura e saldo
 * pendente. A cada execução da rotina são avaliadas TRÊS janelas:
 *   PRAZO_PROXIMO  -> prazo (viagem - 7d) dentro dos próximos 7 dias;
 *   PRAZO_VENCIDO  -> prazo é hoje;
 *   SALDO_VENCIDO  -> prazo já passou e a viagem ainda é futura (permite novo
 *                     lembrete, limitado a 1 por dia e com intervalo mínimo).
 *
 * IDEMPOTÊNCIA: cada envio é registrado em `balance_reminders`
 * (UNIQUE booking_id+kind+reminder_date localmente, e UNIQUE booking_id+kind
 * para as janelas únicas). Em ambiente local (DATA_BACKEND=local) a rotina
 * grava em `.data/balance-reminders.json` com a mesma semântica.
 *
 * ENTREGA: usa o remetente transacional quando configurado
 * (RESEND_API_KEY + RESEND_FROM_EMAIL). Sem remetente configurado, registra o
 * lembrete como REGISTRADA (não envia e-mail real) e cria uma notificação
 * interna para o cliente — decisão segura e observável.
 */

export type BalanceReminderKind =
  | "PRAZO_PROXIMO"
  | "PRAZO_VENCIDO"
  | "SALDO_VENCIDO"
  | "AVISO_INICIAL";

const KIND_LABELS: Record<BalanceReminderKind, string> = {
  PRAZO_PROXIMO: "Prazo próximo",
  PRAZO_VENCIDO: "Prazo venceu hoje",
  SALDO_VENCIDO: "Saldo vencido",
  AVISO_INICIAL: "Aviso inicial do saldo",
};

export type BalanceReminderRow = {
  id: string;
  bookingId: string;
  kind: BalanceReminderKind;
  email: string;
  reminderDate: string;
  status: "REGISTRADA" | "ENVIADA";
  sentAt: string | null;
  createdAt: string;
};

type ReminderDbRow = {
  id: string;
  booking_id: string;
  kind: BalanceReminderKind;
  email: string;
  reminder_date: string;
  status: "REGISTRADA" | "ENVIADA";
  sent_at: string | null;
  created_at: string;
};

const LOCAL_REMINDERS_PATH = path.join(process.cwd(), ".data", "balance-reminders.json");

let client: SupabaseClient | null | undefined = undefined;

function getDbClient(): SupabaseClient | null {
  if (client !== undefined) return client;
  client = null;
  const config = getSupabaseEnvironment();
  if (
    getDataBackend() === "supabase" &&
    config.hasServerCredentials &&
    config.url &&
    config.serviceRoleKey
  ) {
    client = createClient(config.url, config.serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return client;
}

function isMissingTableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("42P01") ||
    message.toLowerCase().includes("does not exist") ||
    message.includes("PGRST204")
  );
}

const overdueIntervalMs = 3 * 24 * 60 * 60 * 1000;

async function readLocalReminders(): Promise<BalanceReminderRow[]> {
  try {
    const raw = await fs.readFile(LOCAL_REMINDERS_PATH, "utf8");
    const parsed = JSON.parse(raw) as BalanceReminderRow[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeLocalReminders(rows: BalanceReminderRow[]): Promise<void> {
  await fs.mkdir(path.dirname(LOCAL_REMINDERS_PATH), { recursive: true, mode: 0o700 });
  await fs.writeFile(
    LOCAL_REMINDERS_PATH,
    JSON.stringify(rows, null, 2),
    { encoding: "utf8", mode: 0o600 },
  );
}

async function alreadyExists(
  bookingId: string,
  kind: BalanceReminderKind,
  reminderDate: string,
): Promise<boolean> {
  const db = getDbClient();
  if (!db) {
    const rows = await readLocalReminders();
    return rows.some(
      (r) =>
        r.bookingId === bookingId &&
        r.kind === kind &&
        r.reminderDate === reminderDate,
    );
  }
  try {
    const { data, error } = await db
      .from("balance_reminders")
      .select("id")
      .eq("booking_id", bookingId)
      .eq("kind", kind)
      .eq("reminder_date", reminderDate)
      .maybeSingle();
    if (error) throw error;
    return Boolean(data);
  } catch (error) {
    if (isMissingTableError(error)) return false;
    throw error;
  }
}

async function lastOverdueAt(bookingId: string): Promise<string | null> {
  const db = getDbClient();
  if (!db) {
    const rows = await readLocalReminders();
    const sent = rows
      .filter((r) => r.bookingId === bookingId && r.kind === "SALDO_VENCIDO")
      .map((r) => r.reminderDate)
      .sort();
    return sent[sent.length - 1] ?? null;
  }
  try {
    const { data, error } = await db
      .from("balance_reminders")
      .select("reminder_date")
      .eq("booking_id", bookingId)
      .eq("kind", "SALDO_VENCIDO")
      .order("reminder_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return (data?.reminder_date as string | undefined) ?? null;
  } catch (error) {
    if (isMissingTableError(error)) return null;
    throw error;
  }
}

async function recordReminder(row: BalanceReminderRow): Promise<void> {
  const db = getDbClient();
  if (db) {
    const payload: ReminderDbRow = {
      id: row.id,
      booking_id: row.bookingId,
      kind: row.kind,
      email: row.email,
      reminder_date: row.reminderDate,
      status: row.status,
      sent_at: row.sentAt,
      created_at: row.createdAt,
    };
    try {
      const { error } = await db.from("balance_reminders").insert(payload);
      if (error) throw error;
      return;
    } catch (error) {
      if (!isMissingTableError(error)) throw error;
    }
  }
  const rows = await readLocalReminders();
  rows.push(row);
  await writeLocalReminders(rows);
}

export type BalanceReminderReport = {
  created: number;
  sent: number;
  registeredOnly: number;
  items: Array<{
    bookingId: string;
    reference: string;
    kind: string;
    email: string;
    status: string;
  }>;
};

/**
 * Envia e-mail transacional quando configurado; caso contrário apenas registra
 * (e cria notificação interna). Nunca loga conteúdo sensível além do assunto.
 */
export async function sendReminderEmail(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<{ delivered: boolean }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();

  if (apiKey && from) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [input.to],
          subject: input.subject,
          html: input.html,
          text: input.text,
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (res.ok) return { delivered: true };
      console.error("[SALDO LEMBRETE] Falha ao enviar via Resend:", res.status);
    } catch (error) {
      console.error(
        "[SALDO LEMBRETE] Erro ao enviar via Resend:",
        error instanceof Error ? error.message : error,
      );
    }
    return { delivered: false };
  }

  // Sem remetente transacional configurado: registra sem enviar (seguro).
  console.log(`[SALDO LEMBRETE] (sem remetente) -> ${input.to} — ${input.subject}`);
  return { delivered: false };
}

function buildReminderContent(reference: string, balance: number, dueDate: string | null, tripName: string) {
  const subject = `${reference}: saldo pendente na Prado's Tour`;
  const text = [
    `Olá! A reserva ${reference} (${tripName}) ainda possui saldo restante de R$ ${balance.toFixed(2).replace(".", ",")}.`,
    dueDate ? `Prazo de pagamento: ${dueDate}.` : "",
    "Você pode pagar em poucos cliques em Minhas viagens.",
    "",
    "Prado's Tour",
  ]
    .filter(Boolean)
    .join("\n");

  const html = [
    "<p>Olá!</p>",
    `<p>A reserva <strong>${reference}</strong> (${tripName}) ainda possui <strong>saldo restante de R$ ${balance
      .toFixed(2)
      .replace(".", ",")}</strong>.</p>`,
    dueDate ? `<p>Prazo de pagamento: <strong>${dueDate}</strong>.</p>` : "",
    "<p>Você pode pagar em poucos cliques em <strong>Minhas viagens</strong> no site.</p>",
    "<p>Atenciosamente,<br/>Prado's Tour</p>",
  ].join("");

  return { subject, text, html };
}

/**
 * Executa a rotina de lembretes (idempotente). Chamada sob ação de equipe.
 */
export async function runBalanceReminders(
  opts?: { now?: Date },
): Promise<BalanceReminderReport> {
  const now = opts?.now ?? new Date();
  const today = now.toISOString().slice(0, 10);
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const store = await getRepositoryRuntime().read();
  const items: BalanceReminderReport["items"] = [];
  let created = 0;
  let sent = 0;
  let registeredOnly = 0;

  const candidates = store.bookings.filter((b) => b.status === "CONFIRMADA");

  for (const booking of candidates) {
    const trip = store.trips.find((t) => t.id === booking.tripId);
    const profile = store.profiles.find((p) => p.id === booking.customerId);
    if (!trip || !profile || !profile.email) continue;

    const tripDate = trip.departureDate ?? trip.date;
    if (tripDate < today) continue;

    const info = getBalanceInfo(store, booking, trip);
    if (info.balance <= 0.005) continue;
    if (!info.dueDate) continue;

    const kinds: BalanceReminderKind[] = [];
    if (info.dueDate > today && info.dueDate <= in7Days) kinds.push("PRAZO_PROXIMO");
    if (info.dueDate === today) kinds.push("PRAZO_VENCIDO");
    if (info.dueDate < today) kinds.push("SALDO_VENCIDO");

    for (const kind of kinds) {
      if (kind === "SALDO_VENCIDO") {
        const last = await lastOverdueAt(booking.id);
        if (last && new Date(today).getTime() - new Date(last).getTime() < overdueIntervalMs) {
          continue;
        }
      }

      const skip = await alreadyExists(booking.id, kind, today);
      if (skip) continue;

      const content = buildReminderContent(
        booking.reference,
        info.balance,
        info.dueDate,
        trip.name,
      );
      const delivery = await sendReminderEmail({
        to: profile.email,
        subject: content.subject,
        text: content.text,
        html: content.html,
      });

      const row: BalanceReminderRow = {
        id: uuid(),
        bookingId: booking.id,
        kind,
        email: profile.email,
        reminderDate: today,
        status: delivery.delivered ? "ENVIADA" : "REGISTRADA",
        sentAt: delivery.delivered ? now.toISOString() : null,
        createdAt: now.toISOString(),
      };
      await recordReminder(row);
      created += 1;
      if (delivery.delivered) sent += 1;
      else registeredOnly += 1;

      // Notificação interna (visível mesmo sem entrega de e-mail).
      await getRepositoryRuntime().transaction((s) => {
        s.notifications.push({
          id: uuid(),
          userId: booking.customerId,
          title: `Lembrete de saldo — ${booking.reference}`,
          message: `${KIND_LABELS[kind]}. Saldo restante: ${(info.balance)
            .toFixed(2)
            .replace(".", ",")}${info.dueDate ? ` · Prazo: ${info.dueDate}` : ""}.`,
          type: "SALDO",
          read: false,
          createdAt: now.toISOString(),
        });
      });

      items.push({
        bookingId: booking.id,
        reference: booking.reference,
        kind,
        email: profile.email,
        status: row.status,
      });
    }
  }

  return { created, sent, registeredOnly, items };
}
function formatBrDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function getSiteUrl(): string | null {
  const fromConfig = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromConfig) return fromConfig;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
  }
  return null;
}

/** Já existe aviso inicial registrado para a reserva (independente do dia). */
async function hasInitialNoticeAlready(bookingId: string): Promise<boolean> {
  const db = getDbClient();
  if (!db) {
    const rows = await readLocalReminders();
    return rows.some((r) => r.bookingId === bookingId && r.kind === "AVISO_INICIAL");
  }
  try {
    const { data, error } = await db
      .from("balance_reminders")
      .select("id")
      .eq("booking_id", bookingId)
      .eq("kind", "AVISO_INICIAL")
      .maybeSingle();
    if (error) throw error;
    return Boolean(data);
  } catch (error) {
    if (isMissingTableError(error)) return false;
    throw error;
  }
}

export type InitialBalanceNoticeResult = {
  status: "SENT" | "REGISTERED_ONLY" | "SKIPPED_EMPTY" | "SKIPPED_ALREADY" | "ERROR";
  email?: string;
  error?: string;
};

/**
 * E-MAIL IMEDIATO do aviso inicial de saldo (executado no bootstrap de
 * produção, logo após criar/localizar a cobrança). Enviado UMA única vez por
 * reserva (registrado em `balance_reminders` com kind AVISO_INICIAL).
 */
export async function sendInitialBalanceNotice(input: {
  store: DataStore;
  booking: Booking;
  trip: Trip;
  now?: Date;
}): Promise<InitialBalanceNoticeResult> {
  const now = input.now ?? new Date();
  const today = now.toISOString().slice(0, 10);
  const { booking, trip } = input;
  const profile = input.store.profiles.find((p) => p.id === booking.customerId);
  if (!profile?.email) {
    return {
      status: "ERROR",
      error: "Cliente sem e-mail cadastrado.",
    };
  }

  const info = getBalanceInfo(input.store, booking, trip);
  if (info.balance <= 0.005) {
    return { status: "SKIPPED_EMPTY", email: profile.email };
  }
  if (await hasInitialNoticeAlready(booking.id)) {
    return { status: "SKIPPED_ALREADY", email: profile.email };
  }

  const tripDate = trip.departureDate ?? trip.date;
  const situation =
    info.dueDate && info.dueDate < today
      ? "saldo vencido"
      : info.dueDate === today
        ? "prazo vence hoje"
        : "saldo pendente";
  const siteUrl = getSiteUrl();
  const payUrl = siteUrl ? `${siteUrl}/minhas-viagens` : "/minhas-viagens";

  const subject = "Seu saldo da reserva está pendente";
  const total = `R$ ${info.total.toFixed(2).replace(".", ",")}`;
  const paid = `R$ ${info.paid.toFixed(2).replace(".", ",")}`;
  const balance = `R$ ${info.balance.toFixed(2).replace(".", ",")}`;
  const tripDateBr = formatBrDate(tripDate);
  const dueBr = info.dueDate ? formatBrDate(info.dueDate) : null;

  const text = [
    `Olá! O saldo da sua reserva ${booking.reference} ainda está pendente.`,
    "",
    `Viagem: ${trip.name}`,
    `Data: ${tripDateBr}`,
    `Valor total: ${total}`,
    `Valor já pago: ${paid}`,
    `Saldo restante: ${balance}`,
    dueBr ? `Prazo: ${dueBr}` : "",
    `Situação: ${situation}`,
    "",
    `Pagar saldo: ${payUrl}`,
    "",
    "Atenciosamente,\nPrado's Tour",
  ]
    .filter(Boolean)
    .join("\n");

  const html = [
    "<div style=\"font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1f2937\">",
    "<h2 style=\"color:#b91c1c;margin:0 0 16px\">Seu saldo da reserva está pendente</h2>",
    `<p>Olá! A reserva <strong>${booking.reference}</strong> ainda possui saldo restante.</p>`,
    "<table style=\"border-collapse:collapse;margin:0 0 16px;font-size:14px\">",
    `<tr><td style="padding:4px 12px 4px 0;color:#6b7280">Viagem</td><td style="padding:4px 0"><strong>${trip.name}</strong></td></tr>`,
    `<tr><td style="padding:4px 12px 4px 0;color:#6b7280">Data</td><td style="padding:4px 0"><strong>${tripDateBr}</strong></td></tr>`,
    `<tr><td style="padding:4px 12px 4px 0;color:#6b7280">Valor total</td><td style="padding:4px 0">${total}</td></tr>`,
    `<tr><td style="padding:4px 12px 4px 0;color:#6b7280">Valor já pago</td><td style="padding:4px 0">${paid}</td></tr>`,
    `<tr><td style="padding:4px 12px 4px 0;color:#6b7280">Saldo restante</td><td style="padding:4px 0"><strong>${balance}</strong></td></tr>`,
    dueBr
      ? `<tr><td style="padding:4px 12px 4px 0;color:#6b7280">Prazo</td><td style="padding:4px 0">${dueBr}</td></tr>`
      : "",
    `<tr><td style="padding:4px 12px 4px 0;color:#6b7280">Situação</td><td style="padding:4px 0"><strong>${situation}</strong></td></tr>`,
    "</table>",
    `<p style="margin:0 0 20px"><a href="${payUrl}" style="display:inline-block;background-color:#b91c1c;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold">Pagar saldo</a></p>`,
    "<p style=\"color:#6b7280;font-size:13px\">Atenciosamente,<br/>Prado's Tour</p>",
    "</div>",
  ]
    .filter(Boolean)
    .join("");

  const delivery = await sendReminderEmail({ to: profile.email, subject, text, html });

  const row: BalanceReminderRow = {
    id: uuid(),
    bookingId: booking.id,
    kind: "AVISO_INICIAL",
    email: profile.email,
    reminderDate: today,
    status: delivery.delivered ? "ENVIADA" : "REGISTRADA",
    sentAt: delivery.delivered ? now.toISOString() : null,
    createdAt: now.toISOString(),
  };
  await recordReminder(row);

  return {
    status: delivery.delivered ? "SENT" : "REGISTERED_ONLY",
    email: profile.email,
  };
}
