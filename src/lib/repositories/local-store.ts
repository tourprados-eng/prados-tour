import type { DataStore } from "@/types";
import { readStore, updateStore } from "@/lib/db/store";

/**
 * Adaptador temporário da persistência atual. Novos repositórios devem depender
 * desta interface, não de arquivos JSON, para permitir a troca gradual.
 */
export interface StoreRepository {
  read(): Promise<DataStore>;
  transaction<T>(mutator: (store: DataStore) => T | Promise<T>): Promise<T>;
}

export const localStoreRepository: StoreRepository = {
  read: readStore,
  transaction: updateStore,
};
