// FASE 6 - Validação pós-execução da ETAPA 1 (catálogo).
// Lê apenas (SELECT) via service role e compara com o store local.
// Uso: node scripts/phase6/validate-catalog.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ENV_PATH = path.join(ROOT, ".env.local");
const DATA_PATH = path.join(ROOT, ".data/store.json");
const CONFIG_PATH = path.join(ROOT, ".data/phase6.config.json");

function loadEnv() {
  const env = {};
  if (!fs.existsSync(ENV_PATH)) throw new Error("Não encontrei .env.local");
  for (const raw of fs.readFileSync(ENV_PATH, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    if (!key) continue;
    const value = line.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (value) env[key] = value;
  }
  return env;
}

const env = loadEnv();
const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  throw new Error("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios.");
}

const { createClient } = await import("@supabase/supabase-js");
const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const store = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));

async function count(table) {
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true });
  if (error) throw new Error(`${table}: ${error.message}`);
  return count ?? 0;
}

async function rows(table, columns) {
  const { data, error } = await supabase.from(table).select(columns);
  if (error) throw new Error(`${table}: ${error.message}`);
  return data ?? [];
}

const EXPECTED = {
  settings: 2, // brand + payment
  trips: store.trips.filter((t) => !cfg.excludedTripIds.includes(t.id)).length,
  trip_images: store.trips
    .filter((t) => !cfg.excludedTripIds.includes(t.id))
    .reduce((acc, t) => acc + (t.images?.length ?? 0), 0),
  boarding_points: store.boardingPoints.length,
  trip_boarding_points: store.tripBoardingPoints.filter(
    (x) => !cfg.excludedTripIds.includes(x.tripId),
  ).length,
  coupons: 1,
  coupon_trips: 0,
};

const keptTrips = store.trips.filter((t) => !cfg.excludedTripIds.includes(t.id));
const keptTripIds = new Set(keptTrips.map((t) => t.id));
const keptSeatQty = store.seats.filter(
  (s) => keptTripIds.has(s.tripId) && !s.bookingId,
).length;

const CHECKER = {
  settings: () => count("settings"),
  trips: () => count("trips"),
  trip_images: () => count("trip_images"),
  boarding_points: () => count("boarding_points"),
  trip_boarding_points: () => count("trip_boarding_points"),
  coupons: () => count("coupons"),
  coupon_trips: () => count("coupon_trips"),
  seats: () => count("seats"),
};

let ok = true;
const results = {};
for (const [key, fn] of Object.entries(CHECKER)) {
  const actual = await fn();
  const expected = key === "seats" ? keptSeatQty : EXPECTED[key];
  results[key] = { expected, actual };
  const status = actual === expected ? "OK" : "DIVERGENCIA";
  if (actual !== expected) ok = false;
  console.log(`${key.padEnd(22)} esperado=${expected} real=${actual}  ${status}`);
}

console.log("\n--- trips mantidas ---");
const tripRows = await rows("trips", "id,name,slug,status");
for (const t of tripRows) console.log(`  ${t.slug} | ${t.name} | ${t.status} | id=${t.id}`);

console.log("\n--- trip_images ---");
const imgRows = await rows("trip_images", "id,trip_id,url,sort_order");
for (const i of imgRows) console.log(`  ${i.sort_order} ${i.url} -> trip ${i.trip_id}`);

console.log("\n--- boarding_points ---");
const bpRows = await rows("boarding_points", "id,name");
for (const b of bpRows) console.log(`  ${b.name} | ${b.id}`);

console.log("\n--- trip_boarding_points ---");
const tbpRows = await rows("trip_boarding_points", "trip_id,boarding_point_id,time");
for (const x of tbpRows) console.log(`  ${x.time} | trip ${x.trip_id} | ponto ${x.boarding_point_id}`);

console.log("\n--- coupons ---");
const couponRows = await rows("coupons", "id,code,type,value,usage_limit,valid_until,active");
for (const c of couponRows) console.log(`  ${c.code} | ${c.type} ${c.value} | limite ${c.usage_limit} | ativo ${c.active} | até ${c.valid_until}`);

console.log("\n--- seats (estado) ---");
const seatRows = await rows("seats", "state,booking_id");
const byState = {};
for (const s of seatRows) byState[s.state] = (byState[s.state] ?? 0) + 1;
console.log("  ", JSON.stringify(byState));
console.log("  com booking_id:", seatRows.filter((s) => s.booking_id).length);

console.log("\n--- settings ---");
for (const key of ["brand", "payment"]) {
  const { data, error } = await supabase.from("settings").select("key,value").eq("key", key);
  if (error) throw new Error(`settings ${key}: ${error.message}`);
  const row = data?.[0]?.value;
  if (key === "brand" && row) {
    console.log(`  brand.prymary=${row.primary} | secondary=${row.secondary} | background=${row.background}`);
    console.log(`  brand.whatsapp="${row.whatsapp}" | instagram="${row.instagram}" | favicon=${row.favicon_url ?? row.faviconUrl}`);
    const okColors =
      String(row.primary).toLowerCase() === "#e84c91" &&
      String(row.secondary).toLowerCase() === "#f28c28";
    console.log(`  cores rosa/laranja: ${okColors ? "OK" : "DIVERGENCIA"}`);
  } else if (row) {
    console.log(`  payment: pix_key=${row.pix_key} | pix_total_discount=${row.pix_total_discount} | card_whatsapp=${row.card_whatsapp}`);
  } else {
    console.log(`  ${key}: (ausente)`);
  }
}

console.log("\nRESULTADO GERAL:", ok ? "OK" : "HÁ DIVERGÊNCIAS");
process.exit(ok ? 0 : 1);