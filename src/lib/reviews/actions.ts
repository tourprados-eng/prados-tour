"use server";

import { v4 as uuid } from "uuid";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import type { Review, ReviewStatus } from "@/types";

const createReviewSchema = z.object({
  tripId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z
    .string()
    .trim()
    .min(5, "O comentário deve ter ao menos 5 caracteres.")
    .max(500, "O comentário deve ter no máximo 500 caracteres.")
    .optional()
    .or(z.literal("")),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;

/**
 * Permite que um cliente autenticado avalie uma viagem em que possui
 * reserva confirmada ou concluída. Uma avaliação por cliente e viagem.
 */
export async function createReviewAction(input: CreateReviewInput) {
  const session = await getSession();
  if (!session) return { error: "Você precisa estar logado para avaliar." };

  const parsed = createReviewSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const { tripId, rating, comment } = parsed.data;

  const repo = getRepositoryRuntime();
  const store = await repo.read();

  const booking = store.bookings.find(
    (b) =>
      b.customerId === session.id &&
      b.tripId === tripId &&
      (b.status === "CONFIRMADA" || b.status === "CONCLUIDA"),
  );
  if (!booking) {
    return {
      error: "Você só pode avaliar viagens em que tem reserva confirmada.",
    };
  }

  const already = store.reviews.find(
    (r) => r.customerId === session.id && r.tripId === tripId,
  );
  if (already) return { error: "Você já avaliou esta viagem." };

  const now = new Date().toISOString();
  const review: Review = {
    id: uuid(),
    tripId,
    customerId: session.id,
    rating,
    comment: comment || "",
    status: "PENDENTE",
    reviewedBy: null,
    reviewedAt: null,
    createdAt: now,
  };

  await getRepositoryRuntime().transaction((store) => {
    store.reviews.unshift(review);
  });

  revalidatePath("/excursoes");
  return { success: true };
}

/**
 * Moderação (aprovar/rejeitar/excluir) — exclusivo do SUPER_ADMIN.
 */
export async function moderateReviewAction(
  reviewId: string,
  status: ReviewStatus,
) {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") {
    return { error: "Apenas o administrador geral pode moderar avaliações." };
  }
  if (status !== "APROVADO" && status !== "REJEITADO") {
    return { error: "Status inválido." };
  }

  await getRepositoryRuntime().transaction((draft) => {
    const review = draft.reviews.find((r) => r.id === reviewId);
    if (!review) return;
    const now = new Date().toISOString();
    review.status = status;
    review.reviewedAt = now;
    review.reviewedBy = session.id;
    draft.auditLogs.push({
      id: uuid(),
      userId: session.id,
      action: "MODERATE_REVIEW",
      entity: "review",
      entityId: reviewId,
      oldValue: null,
      newValue: { status },
      ip: null,
      createdAt: now,
    });
  });

  revalidatePath("/admin/avaliacoes");
  return { success: true };
}

export async function deleteReviewAction(reviewId: string) {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") {
    return { error: "Apenas o administrador geral pode excluir avaliações." };
  }

  await getRepositoryRuntime().transaction((draft) => {
    const review = draft.reviews.find((r) => r.id === reviewId);
    if (!review) return;
    const now = new Date().toISOString();
    draft.reviews = draft.reviews.filter((r) => r.id !== reviewId);
    draft.auditLogs.push({
      id: uuid(),
      userId: session.id,
      action: "DELETE_REVIEW",
      entity: "review",
      entityId: reviewId,
      oldValue: { rating: review.rating, status: review.status },
      newValue: null,
      ip: null,
      createdAt: now,
    });
  });

  revalidatePath("/admin/avaliacoes");
  return { success: true };
}