import "server-only";

import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { assertSupabaseServerConfiguration } from "@/lib/supabase/config";
import type { DataStore } from "@/types";
import type { StoreRepository } from "./local-store";

type Row = Record<string, unknown>;

type SettingsRow = {
  key: string;
  value: Row;
};

/* ---------------------------------------------------------------------------
 * Conversão de chaves camelCase <-> snake_case (recursiva, tipada).
 * ------------------------------------------------------------------------- */

function toSnakeCaseKey(key: string): string {
  return key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function toCamelCaseKey(key: string): string {
  return key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

/**
 * Converte apenas as chaves de NÍVEL SUPERIOR de uma linha. Valores de colunas
 * jsonb (metadata, old_value/new_value etc.) são preservados integralmente,
 * pois são objetos opacos do domínio da aplicação e não devem ser remapeados.
 */
function rowToCamelCase(row: Row): Row {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [toCamelCaseKey(key), value]),
  );
}

function rowToSnakeCase(row: Row): Row {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [toSnakeCaseKey(key), value]),
  );
}

/**
 * Campos que existem APENAS no store local (e em tipos da aplicação) e NÃO têm
 * coluna correspondente no schema Supabase. São removidos antes de qualquer
 * escrita para evitar "column `x` does not exist".
 */
const APP_ONLY_SNAKE_KEYS = new Set(["password_hash", "images", "trip_ids"]);

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Converte uma linha do domínio para o payload PostgREST: snake_case, sem os
 * campos exclusivos do store e com datas inválidas normalizadas para NULL
 * (colunas `date` do Postgres rejeitam valores fora do formato real).
 */
function rowToSnakeForWrite(row: Row): Row {
  const out = rowToSnakeCase(row);
  for (const key of APP_ONLY_SNAKE_KEYS) delete out[key];
  for (const col of ["birth_date", "expense_date"]) {
    const value = out[col];
    if (typeof value === "string" && !ISO_DATE_RE.test(value)) out[col] = null;
  }
  return out;
}

/* ---------------------------------------------------------------------------
 * Comparação e diff de linhas (escritas diferenciais).
 * ------------------------------------------------------------------------- */

function comparableValue(value: unknown): unknown {
  if (value !== null && typeof value === "object") return JSON.stringify(value);
  return value;
}

function rowsEqual(a: Row, b: Row): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (comparableValue(a[key]) !== comparableValue(b[key])) return false;
  }
  return true;
}

/** UUID determinístico (md5) — mesmo esquema usado na geração da Fase 6. */
export function stableUuid(ns: string, ...parts: string[]): string {
  const hex = createHash("md5").update([ns, ...parts].join("|")).digest("hex");
  const h = hex.slice(0, 32);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/* ---------------------------------------------------------------------------
 * Mapeamento store local <-> tabelas Supabase.
 * ------------------------------------------------------------------------- */

const COLLECTION_TABLE: Record<string, { table: string; conflictKey: string; deleteColumn: string }> = {
  profiles: { table: "profiles", conflictKey: "id", deleteColumn: "id" },
  trips: { table: "trips", conflictKey: "id", deleteColumn: "id" },
  boardingPoints: { table: "boarding_points", conflictKey: "id", deleteColumn: "id" },
  tripBoardingPoints: { table: "trip_boarding_points", conflictKey: "id", deleteColumn: "id" },
  seats: { table: "seats", conflictKey: "id", deleteColumn: "id" },
  sellers: { table: "sellers", conflictKey: "id", deleteColumn: "id" },
  bookings: { table: "bookings", conflictKey: "id", deleteColumn: "id" },
  passengers: { table: "booking_passengers", conflictKey: "id", deleteColumn: "id" },
  payments: { table: "payments", conflictKey: "id", deleteColumn: "id" },
  installments: { table: "payment_installments", conflictKey: "id", deleteColumn: "id" },
  coupons: { table: "coupons", conflictKey: "id", deleteColumn: "id" },
  couponUsages: { table: "coupon_usages", conflictKey: "id", deleteColumn: "id" },
  promotions: { table: "promotions", conflictKey: "id", deleteColumn: "id" },
  promotionUsages: { table: "promotion_usages", conflictKey: "id", deleteColumn: "id" },
  commissions: { table: "commissions", conflictKey: "id", deleteColumn: "id" },
  expenses: { table: "expenses", conflictKey: "id", deleteColumn: "id" },
  checkins: { table: "checkins", conflictKey: "id", deleteColumn: "id" },
  notifications: { table: "notifications", conflictKey: "id", deleteColumn: "id" },
  reviews: { table: "reviews", conflictKey: "id", deleteColumn: "id" },
  loyaltyPoints: { table: "loyalty_points", conflictKey: "id", deleteColumn: "id" },
  referrals: { table: "referrals", conflictKey: "id", deleteColumn: "id" },
  auditLogs: { table: "audit_logs", conflictKey: "id", deleteColumn: "id" },
};

const COLLECTION_KEYS = Object.keys(COLLECTION_TABLE);

/**
 * Ordem de escrita respeitando FKs.
 * DELETE: filhos antes dos pais (evita violação de FK ao remover).
 * UPSERT: pais antes dos filhos (evita violação de FK ao inserir).
 */
const DELETE_ORDER = [
  "auditLogs", "notifications", "referrals", "loyaltyPoints", "reviews",
  "expenses", "checkins", "couponUsages", "promotionUsages", "installments", "payments",
  "passengers", "seats", "commissions", "bookings", "sellers",
  "tripBoardingPoints", "boardingPoints", "trips", "promotions", "profiles",
];

const UPSERT_ORDER = [...DELETE_ORDER].reverse();

const SETTINGS_KEYS: { brand: { key: "brand" }; paymentSettings: { key: "payment" }; promoBanner: { key: "promo_banner" }; voucher: { key: "voucher" } } = {
  brand: { key: "brand" },
  paymentSettings: { key: "payment" },
  promoBanner: { key: "promo_banner" },
  voucher: { key: "voucher" },
};

const SETTINGS_KEY_NAMES = Object.values(SETTINGS_KEYS).map(({ key }) => key);

/** Valores padrão quando ainda não existem linhas em `settings`. */
function emptyBrand(): Row {
  return {
    companyName: "",
    primary: "",
    secondary: "",
    background: "",
    font: "",
    fontSize: "",
    whatsapp: "",
    instagram: "",
    email: "",
    phone: "",
    whatsappMessage: "",
    logoUrl: "",
    bannerUrl: "",
    faviconUrl: "",
    siteTagline: "",
    aboutText: "",
    footerText: "",
  };
}

function emptyPaymentSettings(): Row {
  return {
    pixKey: "",
    pixTotalDiscount: 0,
    cardWhatsapp: false,
    defaultCommission: 0.1,
  };
}

function emptyPromoBanner(): Row {
  return {
    title: "Ofertas e promoções",
    subtitle: "Condições especiais por tempo limitado",
    description: "",
    imageUrl: "",
    buttonText: "Ver ofertas",
    buttonLink: "/ofertas",
    active: false,
    sortOrder: 0,
  };
}

function emptyVoucher(): Row {
  return {
    showQr: true,
  };
}

/* ---------------------------------------------------------------------------
 * Repositório Supabase (service role, server-only).
 * ------------------------------------------------------------------------- */

const BATCH_SIZE = 1000;

type QueryResult<T> = { data: T | null; error: { message: string } | null };

const RETRY_BASE_DELAY_MS = 300;
const RETRY_ATTEMPTS = 5;

/**
 * O gateway do Supabase ocasionalmente devolve PGRST303 ("JWT issued at future")
 * em requisições autenticadas por chave sb_secret_/sb_publishable_ — bug
 * intermitente conhecido (clock skew interno gateway/PostgREST), não causado
 * pelo cliente. Nesses casos a requisição é rejeitada antes de qualquer efeito
 * no banco, então repeti-la com backoff é seguro e suficiente.
 */
async function withRetry<T>(
  run: () => PromiseLike<QueryResult<T>>,
): Promise<QueryResult<T>> {
  let last: QueryResult<T> = { data: null, error: null };
  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
    const result = await run();
    if (!result.error) return result;
    const message = result.error.message ?? "";
    const retryable =
      message.includes("JWT issued at future") || message.includes("PGRST303");
    last = result;
    if (retryable && attempt < RETRY_ATTEMPTS - 1) {
      const backoff = RETRY_BASE_DELAY_MS * 2 ** attempt;
      const jitter = Math.floor(Math.random() * RETRY_BASE_DELAY_MS);
      await new Promise((resolve) => setTimeout(resolve, backoff + jitter));
      continue;
    }
    return result;
  }
  return last;
}

export function createSupabaseStoreRepository(): StoreRepository {
  const { url, serviceRoleKey } = assertSupabaseServerConfiguration();

  const supabase = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  async function readSettings(): Promise<{ brand: Row; paymentSettings: Row; promoBanner: Row; voucher: Row }> {
    const { data, error } = await withRetry(() =>
      supabase
        .from("settings")
        .select("key, value")
        .in("key", SETTINGS_KEY_NAMES)
        .then((result) => result),
    );

    if (error) throw new Error(`Falha ao ler settings: ${error.message}`);

    const found: Record<string, Row> = {};
    for (const row of (data ?? []) as SettingsRow[]) {
      found[row.key] = rowToCamelCase(row.value);
    }

    return {
      brand: found.brand ?? emptyBrand(),
      paymentSettings: found.paymentSettings ?? emptyPaymentSettings(),
      promoBanner: found.promoBanner ?? emptyPromoBanner(),
      voucher: found.voucher ?? emptyVoucher(),
    };
  }

  async function readCollection(collectionKey: string): Promise<Row[]> {
    const config = COLLECTION_TABLE[collectionKey];
    if (!config) throw new Error(`Coleção desconhecida: ${collectionKey}`);

    const { data, error } = await withRetry(() =>
      supabase
        .from(config.table)
        .select("*")
        .then((result) => result),
    );
    if (error) throw new Error(`Falha ao ler ${collectionKey}: ${error.message}`);

    const rows = (data ?? []).map((row) => rowToCamelCase(row as Row));

    // Interliga trip_images ao contracto do store (trip.images: string[]).
    if (collectionKey === "trips" && rows.length > 0) {
      const tripIds = rows.map((row) => row.id as string);
      const { data: images, error: imagesError } = await withRetry(() =>
        supabase
          .from("trip_images")
          .select("trip_id, url, sort_order")
          .in("trip_id", tripIds)
          .order("sort_order", { ascending: true })
          .then((result) => result),
      );
      if (imagesError) throw new Error(`Falha ao ler trip_images: ${imagesError.message}`);

      const byTrip: Record<string, string[]> = {};
      for (const img of images ?? []) {
        (byTrip[img.trip_id] ??= []).push(img.url as string);
      }
      for (const row of rows) {
        row.images = byTrip[row.id as string] ?? [];
      }
    }

    // Interliga coupon_trips ao contrato do store (coupon.tripIds: string[]).
    if (collectionKey === "coupons" && rows.length > 0) {
      const couponIds = rows.map((row) => row.id as string);
      const { data: links, error: linksError } = await withRetry(() =>
        supabase
          .from("coupon_trips")
          .select("coupon_id, trip_id")
          .in("coupon_id", couponIds)
          .then((result) => result),
      );
      if (linksError) throw new Error(`Falha ao ler coupon_trips: ${linksError.message}`);

      const byCoupon: Record<string, string[]> = {};
      for (const link of links ?? []) {
        (byCoupon[link.coupon_id] ??= []).push(link.trip_id as string);
      }
      for (const row of rows) {
        row.tripIds = byCoupon[row.id as string] ?? [];
      }
    }

    // Interliga promotion_trips ao contrato do store (promotion.tripIds: string[]).
    if (collectionKey === "promotions" && rows.length > 0) {
      const promotionIds = rows.map((row) => row.id as string);
      const { data: links, error: linksError } = await withRetry(() =>
        supabase
          .from("promotion_trips")
          .select("promotion_id, trip_id")
          .in("promotion_id", promotionIds)
          .then((result) => result),
      );
      if (linksError) throw new Error(`Falha ao ler promotion_trips: ${linksError.message}`);

      const byPromotion: Record<string, string[]> = {};
      for (const link of links ?? []) {
        (byPromotion[link.promotion_id] ??= []).push(link.trip_id as string);
      }
      for (const row of rows) {
        row.tripIds = byPromotion[row.id as string] ?? [];
      }
    }

    return rows;
  }

  async function deleteRowsById(collectionKey: string, ids: string[]): Promise<void> {
    const config = COLLECTION_TABLE[collectionKey];
    if (!config || ids.length === 0) return;

    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from(config.table)
        .delete()
        .in(config.deleteColumn, batch);
      if (error) throw new Error(`Falha ao remover ${collectionKey}: ${error.message}`);
    }
  }

  /** Sincroniza trip_images a partir de trip.images (upsert determinístico). */
  async function syncTripImages(tripRows: Row[]): Promise<void> {
    const tripIds = tripRows.map((row) => row.id as string);
    if (tripIds.length === 0) return;

    const { data: existing, error: readError } = await supabase
      .from("trip_images")
      .select("id, trip_id, url, sort_order")
      .in("trip_id", tripIds);
    if (readError) throw new Error(`Falha ao ler trip_images: ${readError.message}`);

    const existingById: Record<string, Row> = {};
    for (const row of existing ?? []) existingById[row.id as string] = row as Row;

    const desired: Row[] = [];
    const keepIds = new Set<string>();
    for (const trip of tripRows) {
      const urls = (trip.images as unknown as string[] | undefined) ?? [];
      urls.forEach((url, index) => {
        const id = stableUuid("trip_image", trip.id as string, url, String(index));
        keepIds.add(id);
        desired.push({ id, trip_id: trip.id, url, sort_order: index });
      });
    }

    const toDelete = Object.keys(existingById).filter((id) => !keepIds.has(id));
    if (toDelete.length > 0) {
      for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
        const { error } = await supabase
          .from("trip_images")
          .delete()
          .in("id", toDelete.slice(i, i + BATCH_SIZE));
        if (error) throw new Error(`Falha ao remover trip_images: ${error.message}`);
      }
    }

    if (desired.length > 0) {
      const { error } = await supabase
        .from("trip_images")
        .upsert(desired, { onConflict: "id" });
      if (error) throw new Error(`Falha ao gravar trip_images: ${error.message}`);
    }
  }

  /** Sincroniza coupon_trips a partir de coupon.tripIds (substituição completa). */
  async function syncCouponTrips(couponRows: Row[]): Promise<void> {
    const couponIds = couponRows.map((row) => row.id as string);
    if (couponIds.length === 0) return;

    for (let i = 0; i < couponIds.length; i += BATCH_SIZE) {
      const batchIds = couponIds.slice(i, i + BATCH_SIZE);
      const { error: deleteError } = await supabase
        .from("coupon_trips")
        .delete()
        .in("coupon_id", batchIds);
      if (deleteError) throw new Error(`Falha ao remover coupon_trips: ${deleteError.message}`);

      const desired: Row[] = [];
      for (const coupon of couponRows.filter((r) => batchIds.includes(r.id as string))) {
        const tripIds = (coupon.tripIds as unknown as string[] | undefined) ?? [];
        for (const tripId of tripIds) {
          desired.push({ coupon_id: coupon.id, trip_id: tripId });
        }
      }

      if (desired.length > 0) {
        const { error } = await supabase.from("coupon_trips").insert(desired);
        if (error) throw new Error(`Falha ao gravar coupon_trips: ${error.message}`);
      }
    }
  }

  /** Sincroniza promotion_trips a partir de promotion.tripIds (substituição completa). */
  async function syncPromotionTrips(promotionRows: Row[]): Promise<void> {
    const promotionIds = promotionRows.map((row) => row.id as string);
    if (promotionIds.length === 0) return;

    for (let i = 0; i < promotionIds.length; i += BATCH_SIZE) {
      const batchIds = promotionIds.slice(i, i + BATCH_SIZE);
      const { error: deleteError } = await supabase
        .from("promotion_trips")
        .delete()
        .in("promotion_id", batchIds);
      if (deleteError) throw new Error(`Falha ao remover promotion_trips: ${deleteError.message}`);

      const desired: Row[] = [];
      for (const promotion of promotionRows.filter((r) => batchIds.includes(r.id as string))) {
        const tripIds = (promotion.tripIds as unknown as string[] | undefined) ?? [];
        for (const tripId of tripIds) {
          desired.push({ promotion_id: promotion.id, trip_id: tripId });
        }
      }

      if (desired.length > 0) {
        const { error } = await supabase.from("promotion_trips").insert(desired);
        if (error) throw new Error(`Falha ao gravar promotion_trips: ${error.message}`);
      }
    }
  }

  async function writeCollection(collectionKey: string, items: Row[]): Promise<void> {
    const config = COLLECTION_TABLE[collectionKey];
    if (!config) throw new Error(`Coleção desconhecida: ${collectionKey}`);

    const rows = items.map(rowToSnakeForWrite);
    if (rows.length === 0) return;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from(config.table)
        .upsert(batch, { onConflict: config.conflictKey });
      if (error) throw new Error(`Falha ao gravar ${collectionKey}: ${error.message}`);
    }

    if (collectionKey === "trips") {
      await syncTripImages(items);
    }

    if (collectionKey === "coupons") {
      await syncCouponTrips(items);
    }

    if (collectionKey === "promotions") {
      await syncPromotionTrips(items);
    }
  }

  return {
    async read(): Promise<DataStore> {
      const { brand, paymentSettings, promoBanner, voucher } = await readSettings();

      const chunks = await Promise.all(
        COLLECTION_KEYS.map((key) => readCollection(key).then((rows) => [key, rows] as const)),
      );

      const store: Row = {
        brand,
        paymentSettings,
        promoBanner,
        voucher,
      };
      for (const [key, rows] of chunks) {
        store[key] = rows;
      }

      return store as unknown as DataStore;
    },

    async transaction<T>(mutator: (store: DataStore) => T | Promise<T>): Promise<T> {
      const current = await this.read();
      const original = structuredClone(current) as unknown as DataStore;
      const result = await mutator(current);

      // Atualiza somente os settings alterados.
      const settingsWrites: SettingsRow[] = [];
      const now = new Date().toISOString();
      if (!rowsEqual(original.brand as unknown as Row, current.brand as unknown as Row)) {
        settingsWrites.push({
          key: "brand",
          value: rowToSnakeCase(current.brand as unknown as Row),
          updated_at: now,
        } as SettingsRow);
      }
      if (!rowsEqual(
        original.paymentSettings as unknown as Row,
        current.paymentSettings as unknown as Row,
      )) {
        settingsWrites.push({
          key: "payment",
          value: rowToSnakeCase(current.paymentSettings as unknown as Row),
          updated_at: now,
        } as SettingsRow);
      }
      if (!rowsEqual(
        original.promoBanner as unknown as Row,
        current.promoBanner as unknown as Row,
      )) {
        settingsWrites.push({
          key: "promo_banner",
          value: rowToSnakeCase(current.promoBanner as unknown as Row),
          updated_at: now,
        } as SettingsRow);
      }
      if (!rowsEqual(
        original.voucher as unknown as Row,
        current.voucher as unknown as Row,
      )) {
        settingsWrites.push({
          key: "voucher",
          value: rowToSnakeCase(current.voucher as unknown as Row),
          updated_at: now,
        } as SettingsRow);
      }
      if (settingsWrites.length > 0) {
        const { error } = await supabase.from("settings").upsert(settingsWrites as Row[], {
          onConflict: "key",
        });
        if (error) throw new Error(`Falha ao gravar settings: ${error.message}`);
      }

      // Diff por coleção: INSERTS/UPDATEs apenas nas linhas novas/alteradas e
      // DELETEs apenas nas linhas explicitamente removidas pelo mutator.
      const deletes: { collectionKey: string; ids: string[] }[] = [];
      const writes: { collectionKey: string; rows: Row[] }[] = [];

      for (const key of COLLECTION_KEYS) {
        const before = (original[key as keyof DataStore] as unknown as Row[] | undefined) ?? [];
        const after = (current[key as keyof DataStore] as unknown as Row[] | undefined) ?? [];

        const afterById = new Map<string, Row>(after.map((row) => [row.id as string, row]));
        const gone = before.filter((row) => !afterById.has(row.id as string));
        if (gone.length > 0) {
          deletes.push({ collectionKey: key, ids: gone.map((row) => row.id as string) });
        }

        const beforeById = new Map<string, Row>(before.map((row) => [row.id as string, row]));
        const changed = after.filter((row) => {
          const prior = beforeById.get(row.id as string);
          return !prior || !rowsEqual(row, prior);
        });
        if (changed.length > 0) {
          writes.push({ collectionKey: key, rows: changed });
        }
      }

      // DELETEs em ordem filhos->pais.
      for (const key of DELETE_ORDER) {
        const op = deletes.find((d) => d.collectionKey === key);
        if (op) await deleteRowsById(key, op.ids);
      }

      // UPSERTs em ordem pais->filhos.
      for (const key of UPSERT_ORDER) {
        const op = writes.find((w) => w.collectionKey === key);
        if (op) await writeCollection(key, op.rows);
      }

      return result;
    },
  };
}