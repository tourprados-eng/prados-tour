/**
 * FASE 6 — Etapa 1 (catálogo): gerador de SQL idempotente para o Supabase.
 *
 * ESCLARECIMENTOS:
 * - Este script NÃO contacta o Supabase. Ele apenas lê .data/store.json
 *   (e .data/phase6.config.json) e gera o arquivo SQL da Etapa 1.
 * - A execução é MANUAL pelo usuário no SQL Editor (canal já validado nas
 *   etapas 002-005), porque o caminho PostgREST (service role) retornou
 *   "permission denied for table ..." nas tabelas public.
 * - Booking/payments/instalações/perfis NON são migrados aqui: dependem de
 *   auth.users/profiles (Etapa 2, bloqueada).
 *
 * Uso:
 *   node scripts/phase6/generate-stage1.mjs              -> modo validação (nada escreve)
 *   node scripts/phase6/generate-stage1.mjs --write      -> grava 006_phase6_stage1_catalog.sql
 */

import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const ROOT = process.cwd();
const STORE = path.join(ROOT, ".data", "store.json");
const CONFIG = path.join(ROOT, ".data", "phase6.config.json");
const OUT_DIR = path.join(ROOT, "database", "migrations", "phase6");
const OUT_FILE = path.join(OUT_DIR, "006_phase6_stage1_catalog.sql");

const store = JSON.parse(fs.readFileSync(STORE, "utf8"));

let config = { excludedTripIds: [], slugRenames: {}, birthDateNormalizeToNull: [] };
if (fs.existsSync(CONFIG)) {
  config = JSON.parse(fs.readFileSync(CONFIG, "utf8"));
  if (!Array.isArray(config.excludedTripIds)) config.excludedTripIds = [];
  if (!config.slugRenames || typeof config.slugRenames !== "object") config.slugRenames = {};
  if (!Array.isArray(config.birthDateNormalizeToNull)) config.birthDateNormalizeToNull = [];
}

const slugRenames = config.slugRenames || {};

const q = (v) => (v === null || v === undefined ? "NULL" : `'${String(v).replace(/'/g, "''")}'`);
const money = (v) => (v === null || v === undefined ? "NULL" : String(v));
const ts = (v) => (v ? `'${String(v).replace(/'/g, "''")}'::timestamptz` : "NULL");

/** UUID determinístico (md5) para linhas sem id no store (ex.: trip_images). */
function stableUuid(ns, ...parts) {
  const hex = createHash("md5").update([ns, ...parts].join("|")).digest("hex");
  const h = hex.slice(0, 32);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

const warnings = [];
const errors = [];

// --- Trips: aplica exclusões/renames, depois detecta slug duplicado --------
const excluded = new Set(config.excludedTripIds);
const trips = store.trips
  .filter((t) => !excluded.has(t.id))
  .map((t) => (slugRenames[t.id] ? { ...t, slug: slugRenames[t.id] } : t));
const slugCount = {};
for (const t of trips) slugCount[t.slug] = (slugCount[t.slug] || 0) + 1;
for (const [slug, n] of Object.entries(slugCount)) {
  if (n > 1) errors.push(`trips.slug duplicado: "${slug}" (${n}x) — unique(trips.slug) será violado`);
}

// --- Assentos: só os sem booking (Etapa 2) --------------------------------
const seats = store.seats.filter(
  (s) => s.bookingId === null && !excluded.has(s.tripId),
);
const seatedTripIds = new Set(trips.map((t) => t.id));
const seatsBlocked = store.seats.filter((s) => s.bookingId !== null);

// --- Trip boarding points: apenas p/ trips migradas ------------------------
const tbPoints = store.tripBoardingPoints.filter(
  (x) => seatedTripIds.has(x.tripId) && !excluded.has(x.boardingPointId),
);

// --- Verificações de datas -------------------------------------------------
const badDates = [];
for (const p of store.passengers) {
  const v = p.birthDate;
  if (v) {
    const ok = /^\d{4}-\d{2}-\d{2}$/.test(v);
    if (!ok) badDates.push({ entity: "passengers", id: p.id, field: "birthDate", value: v });
  }
}
for (const d of badDates) {
  // Etapa 1 não migra passengers; só bloqueia/decide na Etapa 2 (futura).
  if (!config.birthDateNormalizeToNull.includes(d.id)) {
    warnings.push(`data inválida em passengers.${d.field} ${d.id}: "${d.value}" (Etapa 2 — decidir normalizar p/ NULL)`);
  }
}

/* ---------------------------------------------------------------------------
 * SQL de settings (brand/payment) — convenção snake_case usada em 005 e pelo
 * repositório (supabase-store lê com rowToCamelCase).
 * ------------------------------------------------------------------------- */
const brand = {
  company_name: store.brand.companyName,
  primary: store.brand.primary,
  secondary: store.brand.secondary,
  background: store.brand.background,
  font: store.brand.font,
  font_size: store.brand.fontSize,
  whatsapp: store.brand.whatsapp,
  instagram: store.brand.instagram,
  email: store.brand.email,
  logo_url: store.brand.logoUrl,
  banner_url: store.brand.bannerUrl,
  favicon_url: store.brand.faviconUrl,
};
const payment = {
  pix_key: store.paymentSettings.pixKey,
  pix_total_discount: store.paymentSettings.pixTotalDiscount,
  card_whatsapp: store.paymentSettings.cardWhatsapp,
  default_commission: store.paymentSettings.defaultCommission,
};
const brandJson = JSON.stringify(brand).replace(/'/g, "''");
const paymentJson = JSON.stringify(payment).replace(/'/g, "''");

// --- Montagem do SQL -------------------------------------------------------
const lines = [];
lines.push("-- Prado's Tour / FASE 6 - ETAPA 1 (catálogo) - gerado automaticamente");
lines.push(`-- store.json md5: ${createHash("md5").update(fs.readFileSync(STORE)).digest("hex")}`);
lines.push("-- Idempotente: INSERT ... ON CONFLICT (id) DO NOTHING/UPDATE. Sem DELETE. Sem auth.");
lines.push(`-- bloqueio: trips excluídas=${[...excluded].join(",")} | seats com booking=${seatsBlocked.length}`);
lines.push("");
lines.push("begin;");

lines.push("");
lines.push("-- 1) settings (brand / payment) — upsert por PK (key)");
lines.push(`insert into public.settings (key, value, updated_at) values ('brand', '${brandJson}'::jsonb, now()) on conflict (key) do update set value = excluded.value, updated_at = now();`);
lines.push(`insert into public.settings (key, value, updated_at) values ('payment', '${paymentJson}'::jsonb, now()) on conflict (key) do update set value = excluded.value, updated_at = now();`);

lines.push("");
lines.push("-- 2) trips");
lines.push("insert into public.trips (id, name, slug, destination, category, date, departure_time, return_time, price_person, price_couple, total_seats, description, itinerary, included, not_included, rules, cancellation_policy, status, created_at, updated_at) values");
lines.push(trips.map((t) => `  (${q(t.id)}, ${q(t.name)}, ${q(t.slug)}, ${q(t.destination)}, ${q(t.category)}, ${q(t.date)}, ${q(t.departureTime || null)}, ${q(t.returnTime || null)}, ${money(t.pricePerson)}, ${money(t.priceCouple)}, ${money(t.totalSeats)}, ${q(t.description || null)}, ${q(t.itinerary || null)}, ${q(t.included || null)}, ${q(t.notIncluded || null)}, ${q(t.rules || null)}, ${q(t.cancellationPolicy || null)}, ${q(t.status)}, ${ts(t.createdAt)}, ${ts(t.updatedAt)})`).join(",\n"));
lines.push("on conflict (id) do nothing;");

lines.push("");
lines.push("-- 3) trip_images (ids determinísticos p/ idempotência)");
const imgs = [];
for (const t of trips) {
  for (const [i, url] of (t.images || []).entries()) {
    imgs.push([stableUuid("trip_image", t.id, url, String(i)), t.id, url, i]);
  }
}
if (imgs.length) {
  lines.push("insert into public.trip_images (id, trip_id, url, sort_order) values");
  lines.push(imgs.map(([id, tripId, url, i]) => `  (${q(id)}, ${q(tripId)}, ${q(url)}, ${i})`).join(",\n"));
  lines.push("on conflict (id) do nothing;");
} else {
  lines.push("select 1; -- nenhuma imagem");
}

lines.push("");
lines.push("-- 4) boarding_points");
lines.push("insert into public.boarding_points (id, name, address, latitude, longitude, observations, active) values");
lines.push(store.boardingPoints.map((b) => `  (${q(b.id)}, ${q(b.name)}, ${q(b.address || null)}, ${money(b.latitude)}, ${money(b.longitude)}, ${q(b.observations || null)}, ${b.active ? "true" : "false"})`).join(",\n"));
lines.push("on conflict (id) do nothing;");

lines.push("");
lines.push("-- 5) trip_boarding_points");
lines.push("insert into public.trip_boarding_points (id, trip_id, boarding_point_id, time) values");
lines.push(tbPoints.map((x) => `  (${q(x.id)}, ${q(x.tripId)}, ${q(x.boardingPointId)}, ${q(x.time || null)})`).join(",\n"));
lines.push("on conflict (id) do nothing;");

lines.push("");
lines.push("-- 6) coupons");
lines.push("insert into public.coupons (id, code, type, value, usage_limit, valid_until, active) values");
lines.push(store.coupons.map((c) => `  (${q(c.id)}, ${q(c.code)}, ${q(c.type)}, ${money(c.value)}, ${money(c.usageLimit ?? null)}, ${ts(c.validUntil)}, ${c.active ? "true" : "false"})`).join(",\n"));
lines.push("on conflict (id) do nothing;");

lines.push("");
lines.push("-- 7) coupon_trips (0 no store atual)");
lines.push("select 1; -- nenhum vínculo coupon_trips");

if (!seats.length) {
  lines.push("-- 8) seats (0 sem booking)");
} else {
  lines.push("");
  lines.push("-- 8) seats (somente sem booking; 3 OCUPADOS vão na Etapa 2)");
  lines.push("insert into public.seats (id, trip_id, seat_number, state, booking_id) values");
  lines.push(seats.map((s) => `  (${q(s.id)}, ${q(s.tripId)}, ${q(s.seatNumber)}, ${q(s.state)}, NULL)`).join(",\n"));
  lines.push("on conflict (id) do nothing;");
}

lines.push("");
lines.push("commit;");

const sql = lines.join("\n") + "\n";

/* ------------------------------- Relatório -------------------------------- */
const counts = {
  profiles: store.profiles.length,
  trips: trips.length,
  tripsExcluded: excluded.size,
  tripImages: imgs.length,
  boardingPoints: store.boardingPoints.length,
  tripBoardingPoints: tbPoints.length,
  seats: seats.length,
  seatsBlocked: seatsBlocked.length,
  sellers: store.sellers.length,
  bookings: store.bookings.length,
  passengers: store.passengers.length,
  payments: store.payments.length,
  installments: store.installments.length,
  coupons: store.coupons.length,
  couponsUsages: store.couponUsages.length,
  commissions: store.commissions.length,
  expenses: store.expenses.length,
  checkins: store.checkins.length,
  notifications: store.notifications.length,
  reviews: store.reviews.length,
  loyaltyPoints: store.loyaltyPoints.length,
  referrals: store.referrals.length,
  auditLogs: store.auditLogs.length,
  brand: 1,
  paymentSettings: 1,
};
console.log("FASE 6 ETAPA 1 — RELATÓRIO");
console.log(JSON.stringify(counts, null, 1));
console.log("tripBoardingPoints ignorados (trip excluída):", store.tripBoardingPoints.length - tbPoints.length);
console.log("seats com booking (Etapa 2):", seatsBlocked.length, seatsBlocked.map((s) => s.seatNumber).join(","));
for (const w of warnings) console.log("AVISO:", w);
for (const e of errors) console.error("ERRO:", e);

const write = process.argv.includes("--write");
if (errors.length) {
  console.error("\nBLOQUEADO: resolva os conflitos acima em .data/phase6.config.json.");
  if (write) console.error("Nada foi escrito.");
  process.exit(2);
}

if (!write) {
  console.log("\nmodo validação — nenhum arquivo alterado. Use --write para gerar o SQL.");
} else {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, sql, { mode: 0o600 });
  console.log("\nSQL gerado:", OUT_FILE);
  console.log("Próximo passo (execução manual, SEMPRE após autorização): colar no SQL Editor do Supabase.");
}