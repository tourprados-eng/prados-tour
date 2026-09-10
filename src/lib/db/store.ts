import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { createSeedStore } from "./seed";
import type { DataStore } from "@/types";

const DATA_DIR = path.join(process.cwd(), ".data");
const STORE_PATH = path.join(DATA_DIR, "store.json");
const BACKUP_DIR = process.env.LOCAL_STORE_BACKUP_DIR?.trim();

let memoryStore: DataStore | null = null;
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
  if (memoryStore) return memoryStore;
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    memoryStore = JSON.parse(raw) as DataStore;
    return memoryStore;
  } catch {
    memoryStore = await createSeedStore();
    await persistStore(memoryStore);
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
