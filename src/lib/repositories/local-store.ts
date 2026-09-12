import type { DataStore, PaymentPlan } from "@/types";
import { readStore, updateStore } from "@/lib/db/store";

/**
 * Adaptador temporário da persistência atual. Novos repositórios devem depender
 * desta interface, não de arquivos JSON, para permitir a troca gradual.
 */
export interface StoreRepository {
  read(): Promise<DataStore>;
  transaction<T>(mutator: (store: DataStore) => T | Promise<T>): Promise<T>;
  /**
   * Encontra uma reserva PENDENTE existente para o mesmo cliente/viagem/plano/
   * quantidade cujo conjunto de CPFs é IDÊNTICO ao informado (retomada segura
   * de um checkout interrompido, sem duplicar reserva nem cobrança).
   */
  findResumableBookingId(args: {
    customerId: string;
    tripId: string;
    paymentPlan: PaymentPlan;
    quantity: number;
    cpfMultiset: string;
  }): Promise<{ id: string; reference: string; clientRequestId: string | null } | null>;
}

export const localStoreRepository: StoreRepository = {
  read: readStore,
  transaction: updateStore,
  async findResumableBookingId({ customerId, tripId, paymentPlan, quantity, cpfMultiset }) {
    const store = await readStore();
    const candidate = store.bookings.find(
      (b) =>
        b.customerId === customerId &&
        b.tripId === tripId &&
        b.status === "PENDENTE" &&
        b.paymentPlan === paymentPlan &&
        b.quantity === quantity,
    );
    if (!candidate) return null;
    const existingSet = store.passengers
      .filter((p) => p.bookingId === candidate.id)
      .map((p) => (p.cpf ?? "").replace(/\D/g, ""))
      .sort()
      .join(",");
    if (existingSet !== cpfMultiset) return null;
    return {
      id: candidate.id,
      reference: candidate.reference,
      clientRequestId: candidate.clientRequestId ?? null,
    };
  },
};
