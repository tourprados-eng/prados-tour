import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { createSeedStore } from "./seed";
import { normalizeTripCategory } from "@/lib/constants";
import type { DataStore } from "@/types";

const DATA_DIR = path.join(process.cwd(), ".data");
const STORE_PATH = path.join(DATA_DIR, "store.json");
const BACKUP_DIR = process.env.LOCAL_STORE_BACKUP_DIR?.trim();

function normalizeStore(store: DataStore): DataStore {
  store.promotions ??= [];
  store.promotionUsages ??= [];
  store.galleryPhotos ??= [];

  // Normaliza viagens com campos novos (compatibilidade com store.json antigo).
  for (const trip of store.trips ?? []) {
    trip.category = normalizeTripCategory(trip.category);
    trip.childPrice ??= 0;
    trip.childMaxAge ??= 5;
    trip.childUnder5FreeWithTwoAdults ??= false;
    trip.insuranceEnabled ??= false;
    trip.insurancePrice ??= 20;
    trip.transportPolicy ??= null;
  }

  // Normaliza passageiros com campos novos.
  for (const passenger of store.passengers ?? []) {
    passenger.price ??= null;
    passenger.priceCategory ??= null;
    passenger.insurance ??= false;
  }

  // Normaliza reservas com campos novos.
  for (const booking of store.bookings ?? []) {
    booking.childCount ??= 0;
    booking.insuranceCount ??= 0;
    booking.insuranceAmount ??= 0;
  }

  store.promoBanner ??= {
    title: "Ofertas e promoções",
    subtitle: "Condições especiais por tempo limitado",
    description: "",
    imageUrl: "",
    buttonText: "Ver ofertas",
    buttonLink: "/ofertas",
    active: false,
    sortOrder: 0,
  };
  store.brand ??= {
    companyName: "Prado's Tour",
    primary: "#E84C91",
    secondary: "#F28C28",
    background: "#FFF9FC",
    font: "Arial",
    fontSize: "16",
    whatsapp: "",
    instagram: "",
    email: "",
    logoUrl: "/images/logo.png",
    bannerUrl: "/images/guaruja.png",
    faviconUrl: "/favicon.ico",
  };
  store.paymentSettings ??= {
    pixKey: "",
    pixTotalDiscount: 0,
    cardWhatsapp: false,
    defaultCommission: 0.1,
  };
  store.voucher ??= { showQr: true };
  return store;
}

let memoryStore: DataStore | null = null;
let memoryStoreMtime = 0;
let writeQueue: Promise<void> = Promise.resolve();

async function persistStore(store: DataStore) {
  await fs.mkdir(DATA_DIR, { recursive: true, mode: 0o700 });
  const temporaryPath = `${STORE_PATH}.${randomUUID()}.tmp`;
  const content = JSON.stringify(store, null, 2);

  await fs.writeFile(temporaryPath, content, { encoding: "utf8", mode: 0o600 });
  await fs.rename(temporaryPath, STORE_PATH);

  if (BACKUP_DIR) {
    const targetDirectory = path.resolve(process.cwd(), BACKUP_DIR);
    await fs.mkdir(targetDirectory, { recursive: true, mode: 0o700 });
    const backupPath = path.join(targetDirectory, `store-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    await fs.writeFile(backupPath, content, { encoding: "utf8", mode: 0o600 });
  }
}

async function ensureStore(): Promise<DataStore> {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    const stat = await fs.stat(STORE_PATH);
    const mtime = stat.mtimeMs;

    if (memoryStore && memoryStoreMtime === mtime) {
      return memoryStore;
    }

    const raw = await fs.readFile(STORE_PATH, "utf8");
    memoryStore = normalizeStore(JSON.parse(raw) as DataStore);
    memoryStoreMtime = mtime;

    return memoryStore;
  } catch {
    memoryStore = await createSeedStore();
    await persistStore(memoryStore);

    try {
      const stat = await fs.stat(STORE_PATH);
      memoryStoreMtime = stat.mtimeMs;
    } catch {
      memoryStoreMtime = 0;
    }

    return memoryStore;
  }
}

export async function readStore(): Promise<DataStore> {
  return ensureStore();
}

export async function updateStore<T>(
  mutator: (store: DataStore) => T | Promise<T>,
): Promise<T> {
  const run = async () => {
    const store = await ensureStore();
    const result = await mutator(store);
    memoryStore = store;
    await persistStore(store);

    try {
      const stat = await fs.stat(STORE_PATH);
      memoryStoreMtime = stat.mtimeMs;
    } catch {
      memoryStoreMtime = 0;
    }

    return result;
  };
  const next = writeQueue.then(run, run);
  writeQueue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

export async function resetStore() {
  memoryStore = await createSeedStore();
  await persistStore(memoryStore);
  return memoryStore;
}
