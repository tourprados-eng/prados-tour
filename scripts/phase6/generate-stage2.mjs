/**
 * FASE 6 — Etapa 2 (dados de negócio): gerador de SQL idempotente para o Supabase.
 *
 * ESCOPO:
 * - Migra bookings/passengers/payments/installments/coupon_usages/commissions/
 *   expenses/notifications/reviews/loyalty_points/referrals/audit_logs e o
 *   vínculo de assentos com booking (Etapa 1 só migrou assentos sem booking).
 * - Duas decisões de NÃO-GERAÇÃO:
 *     a) linhas cujo perfil local não tem authUserId no .data/phase6.auth-map.json
 *        são REPORTADAS e não geradas (sem e-mail/NENHUMA criação neste script);
 *     b) dados associados a trips excluídas no phase6.config.json NÃO são
 *        gerados (mesma política da Etapa 1).
 * - Idempotente: INSERT ... ON CONFLICT (id) DO NOTHING/UPDATE. Preserva ids.
 * - Não cria auth.users, não envia e-mail, não contata o Supabase.
 *
 * Uso:
 *   node scripts/phase6/generate-stage2.mjs           -> modo validação
 *   node scripts/phase6/generate-stage2.mjs --write   -> grava 007_phase6_stage2_business.sql
 *
 * PRÉ-REQUISITO: Etapa 1 (006_phase6_stage1_catalog.sql) aplicada.
 */

import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const ROOT = process.cwd();
const STORE = path.join(ROOT, ".data", "store.json");
const CONFIG = path.join(ROOT, ".data", "phase6.config.json");
const AUTH_MAP = path.join(ROOT, ".data", "phase6.auth-map.json");
const OUT_DIR = path.join(ROOT, "database", "migrations", "phase6");
const OUT_FILE = path.join(OUT_DIR, "007_phase6_stage2_business.sql");

const store = JSON.parse(fs.readFileSync(STORE, "utf8"));
const config = JSON.parse(fs.readFileSync(CONFIG, "utf8"));
const authMap = JSON.parse(fs.readFileSync(AUTH_MAP, "utf8"));

const excludedTripIds = new Set(config.excludedTripIds ?? []);
const fictitiousProfileIds = new Set(config.fictitiousProfileIds ?? []);
const byLocalId = new Map((authMap.map ?? []).map((e) => [e.localId, e]));

const q = (v) => (v === null || v === undefined ? "NULL" : `'${String(v).replace(/'/g, "''")}'`);
const money = (v) => (v === null || v === undefined ? "NULL" : String(v));
const ts = (v) => (v ? `'${String(v).replace(/'/g, "''")}'::timestamptz` : "NULL");
const date = (v) =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? `'${v}'` : "NULL";
const jb = (v) =>
  v === null || v === undefined ? "NULL" : `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;

const warnings = [];
const blocked = [];
const degraded = [];
const discarded = [];

/** Perfil fictício (placeholder/teste): nunca requer auth e nunca é migrado. */
function isFictitious(localId) {
  return localId != null && fictitiousProfileIds.has(localId);
}

/** Resolve um id de perfil local para auth id; null se não mapeado. */
function resolveAuth(localId, label) {
  if (localId === null || localId === undefined || localId === "") return null;
  if (isFictitious(localId)) {
    discarded.push(`${label} -> perfil fictício ${localId}`);
    return null;
  }
  const entry = byLocalId.get(localId);
  if (entry) {
    if (!entry.authUserId) {
      blocked.push(`${label} -> perfil local ${localId} (authUserId pendente em phase6.auth-map.json)`);
      return null;
    }
    return entry.authUserId;
  }
  // Sem entrada no auth-map: assume que já é um auth.users válido (ex.: 973fa250...).
  return localId;
}

function hasAuth(localId) {
  if (localId === null || localId === undefined || localId === "") return true;
  const entry = byLocalId.get(localId);
  if (entry) return Boolean(entry.authUserId) || fictitiousProfileIds.has(localId);
  return true;
}

/** Monta um INSERT multi-row com join por vírgula. */
function insertSql(table, columns, rows) {
  if (!rows.length) return [];
  const out = [];
  out.push("");
  out.push(`insert into public.${table} (${columns.join(", ")}) values`);
  out.push(rows.join(",\n"));
  out.push("on conflict (id) do nothing;");
  return out;
}

/* ---------------------------------------------------------------------------
 * 1) PROFILES (apenas com authUserId resolvido)
 * ------------------------------------------------------------------------- */
const profileRows = [];
for (const p of store.profiles) {
  if (isFictitious(p.id)) {
    discarded.push(`PROFILE ${p.email} -> perfil fictício, não migrado`);
    continue;
  }
  const entry = byLocalId.get(p.id);
  if (!entry || !entry.authUserId) {
    if (!entry) blocked.push(`PROFILE ${p.id} não está no auth-map`);
    continue;
  }
  if (/^PENDING-/.test(p.cpf || "")) {
    warnings.push(`PROFILE ${p.email} cpf "PENDING-..." será mantido como está no banco.`);
  }
  const role = entry.forceRole ?? p.role;
  profileRows.push(
    `  (${q(entry.authUserId)}, ${q(p.fullName)}, ${q(p.cpf)}, ${date(p.birthDate)}, ${q(p.email)}, ${q(p.phone ?? null)}, ${q(p.whatsapp ?? null)}, ${q(role)}, ${q(p.customerClass ?? "NOVO")}, ${q(p.referralCode ?? null)}, ${ts(p.createdAt)}, ${ts(p.updatedAt)})`,
  );
}

/* ---------------------------------------------------------------------------
 * 2) SELLERS (perfil do vendedor resolvido)
 * ------------------------------------------------------------------------- */
const sellerRows = [];
for (const s of store.sellers) {
  if (isFictitious(s.id)) {
    discarded.push(`SELLER ${s.code} -> perfil fictício, não migrado`);
    continue;
  }
  const authId = resolveAuth(s.id, `SELLER ${s.code}`);
  if (!authId) continue;
  sellerRows.push(
    `  (${q(authId)}, ${q(s.code)}, ${money(s.commissionRate)})`,
  );
}

/* ---------------------------------------------------------------------------
 * 3-8) BOOKINGS e dependentes (só trips migradas + perfis resolvidos)
 * ------------------------------------------------------------------------- */
const keptBookings = store.bookings.filter((b) => {
  if (excludedTripIds.has(b.tripId)) {
    blocked.push(`BOOKING ${b.reference} -> trip excluída da Etapa 1`);
    return false;
  }
  if (b.customerId && isFictitious(b.customerId)) {
    discarded.push(`BOOKING ${b.reference} -> customer fictício, não migrado`);
    return false;
  }
  if (b.sellerId && isFictitious(b.sellerId)) {
    discarded.push(`BOOKING ${b.reference} -> seller fictício, não migrado`);
    return false;
  }
  if (!hasAuth(b.customerId)) {
    blocked.push(`BOOKING ${b.reference} -> customer ${b.customerId} sem authUserId`);
    return false;
  }
  if (b.sellerId && !hasAuth(b.sellerId)) {
    blocked.push(`BOOKING ${b.reference} -> seller ${b.sellerId} sem authUserId`);
    return false;
  }
  return true;
});
const keptBookingIds = new Set(keptBookings.map((b) => b.id));

const bookingRows = [];
for (const b of keptBookings) {
  const sellerId = b.sellerId ? resolveAuth(b.sellerId, `BOOKING ${b.reference}`) : null;
  bookingRows.push(
    `  (${q(b.id)}, ${q(b.reference)}, ${q(resolveAuth(b.customerId, "customer"))}, ${q(b.tripId)}, ${q(sellerId)}, ${money(b.quantity)}, ${q(b.boardingPointId ?? null)}, ${q(b.boardingPoint ?? null)}, ${money(b.totalAmount)}, ${money(b.baseAmount)}, ${money(b.discountAmount ?? 0)}, ${q(b.couponCode ?? null)}, ${q(b.paymentPlan)}, ${q(b.status)}, ${q(b.notes ?? null)}, ${ts(b.createdAt)}, ${ts(b.updatedAt)})`,
  );
}

const seatRows = [];
for (const s of store.seats) {
  if (!s.bookingId || !keptBookingIds.has(s.bookingId)) continue;
  seatRows.push(
    `  (${q(s.id)}, ${q(s.tripId)}, ${q(s.seatNumber)}, ${q(s.state)}, ${q(s.bookingId)})`,
  );
}

const passengerRows = [];
for (const p of store.passengers) {
  if (!keptBookingIds.has(p.bookingId)) continue;
  const birth = p.birthDate;
  if (birth && !/^\d{4}-\d{2}-\d{2}$/.test(birth)) {
    const norm = (config.birthDateNormalizeToNull ?? []).includes(p.id);
    if (!norm) warnings.push(`PASSENGER ${p.id} birthDate inválida "${birth}" -> NULL (adicione em birthDateNormalizeToNull se desejar silenciar)`);
  }
  passengerRows.push(
    `  (${q(p.id)}, ${q(p.bookingId)}, ${q(p.name)}, ${q(p.cpf ?? null)}, ${date(birth)}, ${q(p.phone ?? null)}, ${q(p.seatId ?? null)}, ${q(p.boardingPointId ?? null)}, ${q(p.seatGroup ?? null)}, ${q(p.seatAssignmentStatus ?? "PENDENTE")}, ${p.travelTogether === undefined ? "true" : p.travelTogether ? "true" : "false"}, ${q(p.groupId ?? null)}, ${q(p.groupName ?? null)}, ${q(p.observations ?? null)})`,
  );
}

const paymentRows = [];
for (const p of store.payments) {
  if (!keptBookingIds.has(p.bookingId)) continue;
  if (p.customerId && isFictitious(p.customerId)) {
    discarded.push(`PAYMENT ${p.id} -> customer fictício, não migrado`);
    continue;
  }
  paymentRows.push(
    `  (${q(p.id)}, ${q(p.bookingId)}, ${q(resolveAuth(p.customerId, "payment customer") ?? null)}, ${q(p.method)}, ${q(p.plan)}, ${money(p.amount)}, ${q(p.status)}, ${q(p.gateway ?? null)}, ${q(p.gatewayPaymentId ?? null)}, ${money(p.feeAmount ?? 0)}, ${money(p.netAmount ?? null)}, ${ts(p.paidAt)}, ${q(p.pixCopyPaste ?? null)}, ${jb(p.metadata ?? {})}, ${ts(p.createdAt)})`,
  );
}

const installmentRows = [];
for (const i of store.installments) {
  if (!keptBookingIds.has(i.bookingId)) continue;
  installmentRows.push(
    `  (${q(i.id)}, ${q(i.bookingId)}, ${money(i.number)}, ${money(i.value)}, ${date(i.dueDate)}, ${q(i.status)}, ${ts(i.paidAt)}, ${q(i.method)})`,
  );
}

const couponUsageRows = [];
for (const c of store.couponUsages) {
  if (!keptBookingIds.has(c.bookingId)) {
    blocked.push(`COUPON_USAGE ${c.id} -> booking não mantida`);
    continue;
  }
  const userId = resolveAuth(c.userId, `COUPON_USAGE ${c.id}`);
  if (!userId) continue;
  couponUsageRows.push(
    `  (${q(c.id)}, ${q(c.couponId)}, ${q(userId)}, ${q(c.bookingId)}, ${ts(c.createdAt)})`,
  );
}

const commissionRows = [];
for (const c of store.commissions) {
  if (!keptBookingIds.has(c.bookingId)) {
    blocked.push(`COMMISSION ${c.id} -> booking não mantida`);
    continue;
  }
  const sellerId = resolveAuth(c.sellerId, `COMMISSION ${c.id}`);
  if (!sellerId) continue;
  commissionRows.push(
    `  (${q(c.id)}, ${q(sellerId)}, ${q(c.bookingId)}, ${money(c.rate)}, ${money(c.amount)}, ${q(c.status)}, ${ts(c.paidAt)})`,
  );
}

const expenseRows = [];
for (const e of store.expenses) {
  const tripKept = !excludedTripIds.has(e.tripId);
  if (e.tripId && !tripKept) {
    blocked.push(`EXPENSE ${e.id} -> trip excluída`);
    continue;
  }
  if (e.description && /fg|test|teste|asd|qwe/i.test(e.description) && typeof e.description === "string") {
    warnings.push(`EXPENSE ${e.id} descrição "…${e.description.slice(0, 20)}" parece dado de teste (mantida)`);
  }
  let createdBy = null;
  if (e.createdBy != null) {
    if (hasAuth(e.createdBy)) {
      createdBy = resolveAuth(e.createdBy, `EXPENSE ${e.id}`);
    } else {
      degraded.push(`EXPENSE ${e.id} created_by -> NULL (perfil ${e.createdBy} sem authUserId)`);
    }
  }
  expenseRows.push(
    `  (${q(e.id)}, ${q(e.category)}, ${money(e.amount)}, ${date(e.expenseDate)}, ${q(e.description ?? null)}, ${q(e.tripId ?? null)}, ${q(createdBy)}, ${ts(e.createdAt)})`,
  );
}

const notificationRows = [];
for (const n of store.notifications) {
  const userId = resolveAuth(n.userId, `NOTIFICATION ${n.id}`);
  if (!userId) continue;
  notificationRows.push(
    `  (${q(n.id)}, ${q(userId)}, ${q(n.title)}, ${q(n.message)}, ${q(n.type ?? null)}, ${n.read ? "true" : "false"}, ${ts(n.createdAt)})`,
  );
}

const loyaltyRows = [];
for (const l of store.loyaltyPoints) {
  if (l.bookingId != null && !keptBookingIds.has(l.bookingId)) {
    discarded.push(`LOYALTY ${l.id} -> booking não mantida, não migrado`);
    continue;
  }
  const customerId = resolveAuth(l.customerId, `LOYALTY ${l.id}`);
  if (!customerId) continue;
  loyaltyRows.push(
    `  (${q(l.id)}, ${q(customerId)}, ${money(l.points)}, ${q(l.source ?? null)}, ${q(l.bookingId ?? null)}, ${ts(l.createdAt)})`,
  );
}

const referralRows = [];
for (const r of store.referrals) {
  const referrer = resolveAuth(r.referrerId, `REFERRAL ${r.id}`);
  const referred = resolveAuth(r.referredId, `REFERRAL ${r.id}`);
  if (!referrer || !referred) continue;
  referralRows.push(
    `  (${q(r.id)}, ${q(referrer)}, ${q(referred)}, ${q(r.code)}, ${ts(r.createdAt)})`,
  );
}

const excludedBookingIds = new Set(
  store.bookings.filter((b) => excludedTripIds.has(b.tripId)).map((b) => b.id),
);
const auditRows = [];
for (const a of store.auditLogs) {
  if (a.userId && isFictitious(a.userId)) {
    discarded.push(`AUDIT ${a.id} -> user fictício, não migrado`);
    continue;
  }
  if (a.entity === "bookings" && a.entityId && excludedBookingIds.has(a.entityId)) {
    discarded.push(`AUDIT ${a.id} -> booking excluída, não migrado`);
    continue;
  }
  let userId = null;
  if (a.userId != null) {
    if (hasAuth(a.userId)) {
      userId = resolveAuth(a.userId, `AUDIT ${a.id}`);
    } else {
      degraded.push(`AUDIT ${a.id} user_id -> NULL (perfil ${a.userId} sem authUserId)`);
    }
  }
  auditRows.push(
    `  (${q(a.id)}, ${q(userId)}, ${q(a.action)}, ${q(a.entity ?? null)}, ${q(a.entityId ?? null)}, ${jb(a.oldValue ?? null)}, ${jb(a.newValue ?? null)}, ${q(a.ip ?? null)}, ${ts(a.createdAt)})`,
  );
}

/* ---------------------------------------------------------------------------
 * Montagem final
 * ------------------------------------------------------------------------- */
const md5 = createHash("md5").update(fs.readFileSync(STORE)).digest("hex");
const lines = [];
lines.push("-- Prado's Tour / FASE 6 - ETAPA 2 (dados de negócio) - gerado automaticamente");
lines.push(`-- store.json md5: ${md5}`);
lines.push("-- Idempotente: INSERT ... ON CONFLICT (id) DO NOTHING. Preserva ids. Sem DELETE.");
lines.push(`-- bloqueio de geração (auth-map/trips excluídas): ${blocked.length}`);
lines.push("-- PRÉ-REQUISITO: Etapa 1 (006_phase6_stage1_catalog.sql) e profiles/perfis de auth (Etapa 0).");
lines.push("");
lines.push("begin;");

lines.push("");
lines.push("-- 1) profiles (apenas mapeados; role do banco preservada em UPDATE)");
if (profileRows.length) {
  lines.push("insert into public.profiles (id, full_name, cpf, birth_date, email, phone, whatsapp, role, customer_class, referral_code, created_at, updated_at) values");
  lines.push(profileRows.join(",\n"));
  lines.push(`on conflict (id) do update set full_name = excluded.full_name, cpf = excluded.cpf, birth_date = excluded.birth_date, phone = excluded.phone, whatsapp = excluded.whatsapp, referral_code = excluded.referral_code, customer_class = excluded.customer_class, updated_at = excluded.updated_at;`);
} else {
  lines.push("select 1; -- nenhum profile pendente");
}

lines.push("-- 2) sellers");
lines.push(...insertSql("sellers", ["id", "code", "commission_rate"], sellerRows));

lines.push("-- 3) bookings");
lines.push(...insertSql("bookings", ["id", "reference", "customer_id", "trip_id", "seller_id", "quantity", "boarding_point_id", "boarding_point", "total_amount", "base_amount", "discount_amount", "coupon_code", "payment_plan", "status", "notes", "created_at", "updated_at"], bookingRows));

lines.push("-- 4) seats com booking (ocultados na Etapa 1)");
lines.push(...insertSql("seats", ["id", "trip_id", "seat_number", "state", "booking_id"], seatRows));

lines.push("-- 5) booking_passengers");
lines.push(...insertSql("booking_passengers", ["id", "booking_id", "name", "cpf", "birth_date", "phone", "seat_id", "boarding_point_id", "seat_group", "seat_assignment_status", "travel_together", "group_id", "group_name", "observations"], passengerRows));

lines.push("-- 6) payments");
lines.push(...insertSql("payments", ["id", "booking_id", "customer_id", "method", "plan", "amount", "status", "gateway", "gateway_payment_id", "fee_amount", "net_amount", "paid_at", "pix_copy_paste", "metadata", "created_at"], paymentRows));

lines.push("-- 7) payment_installments");
lines.push(...insertSql("payment_installments", ["id", "booking_id", "number", "value", "due_date", "status", "paid_at", "method"], installmentRows));

lines.push("-- 8) coupon_usages");
lines.push(...insertSql("coupon_usages", ["id", "coupon_id", "user_id", "booking_id", "created_at"], couponUsageRows));

lines.push("-- 9) commissions");
lines.push(...insertSql("commissions", ["id", "seller_id", "booking_id", "rate", "amount", "status", "paid_at"], commissionRows));

lines.push("-- 10) expenses");
lines.push(...insertSql("expenses", ["id", "category", "amount", "expense_date", "description", "trip_id", "created_by", "created_at"], expenseRows));

lines.push("-- 11) notifications");
lines.push(...insertSql("notifications", ["id", "user_id", "title", "message", "type", "read", "created_at"], notificationRows));

lines.push("-- 12) reviews");
lines.push(`select 1; -- nenhum review (${store.reviews.length} no store)`);

lines.push("-- 13) loyalty_points");
lines.push(...insertSql("loyalty_points", ["id", "customer_id", "points", "source", "booking_id", "created_at"], loyaltyRows));

lines.push("-- 14) referrals");
lines.push(referralRows.length ? insertSql("referrals", ["id", "referrer_id", "referred_id", "code", "created_at"], referralRows) : `select 1; -- nenhum referral (${store.referrals.length} no store)`);
lines.push("");
lines.push("-- 15) audit_logs");
lines.push(...insertSql("audit_logs", ["id", "user_id", "action", "entity", "entity_id", "old_value", "new_value", "ip", "created_at"], auditRows));

lines.push("");
lines.push("commit;");

const sql = lines.join("\n");

/* ------------------------------- Relatório -------------------------------- */
const counts = {
  profilesMapped: store.profiles.filter((p) => byLocalId.get(p.id)?.authUserId && !isFictitious(p.id)).length,
  profilesInStore: store.profiles.length,
  profilesFictitious: store.profiles.filter((p) => isFictitious(p.id)).length,
  sellers: sellerRows.length,
  bookingsKept: keptBookings.length,
  bookingsTotal: store.bookings.length,
  seatsWithBookingKept: seatRows.length,
  passengers: passengerRows.length,
  payments: paymentRows.length,
  installments: installmentRows.length,
  couponUsages: couponUsageRows.length,
  commissions: commissionRows.length,
  expenses: expenseRows.length,
  notifications: notificationRows.length,
  reviews: 0,
  loyaltyPoints: loyaltyRows.length,
  referrals: referralRows.length,
  auditLogs: auditRows.length,
};
console.log("FASE 6 ETAPA 2 — RELATÓRIO");
console.log(JSON.stringify(counts, null, 1));
console.log("bloqueadas (auth pendente ou trip excluída):", blocked.length);
for (const b of blocked) console.log("  BLOQUEADA:", b);
console.log("descartadas (perfil fictício):", discarded.length);
for (const d of discarded) console.log("  DESCARTADA:", d);
console.log("degradadas (FK anulável -> NULL):", degraded.length);
for (const d of degraded) console.log("  DEGRADADA:", d);
for (const w of warnings) console.log("AVISO:", w);

const write = process.argv.includes("--write");
if (!write) {
  console.log("\nmodo validação — nenhum arquivo alterado. Use --write para gerar o SQL.");
} else {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, sql, { mode: 0o600 });
  console.log("\nSQL gerado:", OUT_FILE);
  console.log("Recomendado: preencher phase6.auth-map.json com os authUserId reais dos invites e re-gerar se a execução ainda não aconteceu.");
}