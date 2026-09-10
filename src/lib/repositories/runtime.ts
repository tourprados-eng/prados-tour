import "server-only";

import type { DataStore } from "@/types";
import { getDataBackend, getSupabaseEnvironment, type DataBackend } from "@/lib/supabase/config";
import { localStoreRepository, type StoreRepository } from "./local-store";
import { createSupabaseStoreRepository } from "./supabase-store";

export type CollectionKey = Exclude<keyof DataStore, "brand" | "paymentSettings">;

export type RepositoryRuntime = {
  backend: DataBackend;
  supabaseReady: boolean;
  repository: StoreRepository;
  read(): Promise<DataStore>;
  transaction<T>(mutator: (store: DataStore) => T | Promise<T>): Promise<T>;
  getCollection<K extends CollectionKey>(key: K): Promise<DataStore[K]>;
  getProfiles(): Promise<DataStore["profiles"]>;
  getTrips(): Promise<DataStore["trips"]>;
  getBoardingPoints(): Promise<DataStore["boardingPoints"]>;
  getTripBoardingPoints(): Promise<DataStore["tripBoardingPoints"]>;
  getSeats(): Promise<DataStore["seats"]>;
  getSellers(): Promise<DataStore["sellers"]>;
  getBookings(): Promise<DataStore["bookings"]>;
  getPassengers(): Promise<DataStore["passengers"]>;
  getPayments(): Promise<DataStore["payments"]>;
  getInstallments(): Promise<DataStore["installments"]>;
  getCoupons(): Promise<DataStore["coupons"]>;
  getCouponUsages(): Promise<DataStore["couponUsages"]>;
  getCommissions(): Promise<DataStore["commissions"]>;
  getExpenses(): Promise<DataStore["expenses"]>;
  getCheckins(): Promise<DataStore["checkins"]>;
  getNotifications(): Promise<DataStore["notifications"]>;
  getReviews(): Promise<DataStore["reviews"]>;
  getLoyaltyPoints(): Promise<DataStore["loyaltyPoints"]>;
  getReferrals(): Promise<DataStore["referrals"]>;
  getAuditLogs(): Promise<DataStore["auditLogs"]>;
  getBrand(): Promise<DataStore["brand"]>;
  getPaymentSettings(): Promise<DataStore["paymentSettings"]>;
};

/**
 * Ponto único para a migração gradual. Enquanto DATA_BACKEND não for alterado,
 * toda a aplicação continua usando a store local atual.
 */
export function getRepositoryRuntime(): RepositoryRuntime {
  const backend = getDataBackend();
  const supabase = getSupabaseEnvironment();

  if (backend === "supabase" && !supabase.hasServerCredentials) {
    throw new Error(
      "DATA_BACKEND=supabase exige SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no servidor.",
    );
  }

  const repository: StoreRepository =
    backend === "supabase" && supabase.hasServerCredentials
      ? createSupabaseStoreRepository()
      : localStoreRepository;

  return {
    backend,
    supabaseReady: supabase.hasBrowserCredentials && supabase.hasServerCredentials,
    repository,
    read: () => repository.read(),
    transaction: (mutator) => repository.transaction(mutator),
    getCollection: (key) => repository.read().then((store) => store[key]),
    getProfiles: () => repository.read().then((s) => s.profiles),
    getTrips: () => repository.read().then((s) => s.trips),
    getBoardingPoints: () => repository.read().then((s) => s.boardingPoints),
    getTripBoardingPoints: () => repository.read().then((s) => s.tripBoardingPoints),
    getSeats: () => repository.read().then((s) => s.seats),
    getSellers: () => repository.read().then((s) => s.sellers),
    getBookings: () => repository.read().then((s) => s.bookings),
    getPassengers: () => repository.read().then((s) => s.passengers),
    getPayments: () => repository.read().then((s) => s.payments),
    getInstallments: () => repository.read().then((s) => s.installments),
    getCoupons: () => repository.read().then((s) => s.coupons),
    getCouponUsages: () => repository.read().then((s) => s.couponUsages),
    getCommissions: () => repository.read().then((s) => s.commissions),
    getExpenses: () => repository.read().then((s) => s.expenses),
    getCheckins: () => repository.read().then((s) => s.checkins),
    getNotifications: () => repository.read().then((s) => s.notifications),
    getReviews: () => repository.read().then((s) => s.reviews),
    getLoyaltyPoints: () => repository.read().then((s) => s.loyaltyPoints),
    getReferrals: () => repository.read().then((s) => s.referrals),
    getAuditLogs: () => repository.read().then((s) => s.auditLogs),
    getBrand: () => repository.read().then((s) => s.brand),
    getPaymentSettings: () => repository.read().then((s) => s.paymentSettings),
  };
}
