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
    .refine(reviewCommentSafe, "O comentário não pode conter HTML ou scripts.")
    .optional()
    .or(z.literal("")),
});

/**
 * Impede conteúdo com markup (tags HTML) dentro de comentários. Como o React
 * já escapa texto ao renderizar, isto é uma camada extra de defesa: o conteúdo
 * é armazenado apenas como texto simples.
 */
function reviewCommentSafe(value: string): boolean {
  return !/<[^>]*>/u.test(value);
}

export type CreateReviewInput = z.infer<typeof createReviewSchema>;

const publicReviewSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Informe seu nome.")
    .max(60, "Nome muito longo.")
    .refine((value) => /^[\p{L}\p{M}][\p{L}\p{M} .'’-]*$/u.test(value), {
      message: "Informe um nome válido.",
    }),
  tripId: z.string().min(1, "Selecione a viagem."),
  rating: z.number().int().min(1, "Selecione uma nota.").max(5),
  comment: z
    .string()
    .trim()
    .min(5, "Escreva um comentário de ao menos 5 caracteres.")
    .max(500, "O comentário deve ter no máximo 500 caracteres.")
    .refine(reviewCommentSafe, "O comentário não pode conter HTML ou scripts."),
  website: z.string().max(200).optional(),
});

export type PublicReviewInput = z.infer<typeof publicReviewSchema>;

/**
 * Envio público (sem login) da seção "Quem viaja, recomenda". Cria sempre uma
 * avaliação PENDENTE — nunca publicada automaticamente. Inclui honeypot de
 * anti-spam e guarda de duplicidade por nome + viagem.
 */
export async function submitPublicReviewAction(input: PublicReviewInput) {
  const parsed = publicReviewSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  // Honeypot anti-spam: campo oculto preenchido por bots → descarta.
  if (parsed.data.website) {
    return { error: "Não foi possível enviar sua avaliação. Tente novamente." };
  }

  const { name, tripId, rating, comment } = parsed.data;
  const trimmedName = name.trim();
  const normalizedName = trimmedName.toLocaleLowerCase("pt-BR");

  const repo = getRepositoryRuntime();

  let store;
  try {
    store = await repo.read();
  } catch (e) {
    console.error(
      "[submitPublicReview] falha ao ler o repositório:",
      e instanceof Error ? e.message : String(e),
    );
    return { error: "Não foi possível enviar sua avaliação. Tente novamente." };
  }

  const trip = store.trips.find((t) => t.id === tripId && !t.deletedAt);
  if (!trip) return { error: "Viagem inválida." };

  const already = store.reviews.some(
    (r) =>
      r.tripId === tripId &&
      r.authorName?.toLocaleLowerCase("pt-BR") === normalizedName &&
      (r.status === "PENDENTE" || r.status === "APROVADO"),
  );
  if (already) {
    return { error: "Você já enviou uma avaliação para esta viagem." };
  }

  const now = new Date().toISOString();
  const review: Review = {
    id: uuid(),
    customerId: null,
    authorName: trimmedName,
    tripId,
    rating,
    comment,
    status: "PENDENTE",
    showOnHome: false,
    reviewedBy: null,
    reviewedAt: null,
    createdAt: now,
  };

  try {
    await repo.transaction((draft) => {
      draft.reviews.unshift(review);
    });
  } catch (e) {
    console.error(
      "[submitPublicReview] falha ao salvar avaliação:",
      e instanceof Error ? e.message : String(e),
    );
    return { error: "Não foi possível enviar sua avaliação. Tente novamente." };
  }

  revalidatePath("/");
  return { success: true };
}

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
    authorName: null,
    rating,
    comment: comment || "",
    status: "PENDENTE",
    showOnHome: false,
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
    // Aprovar torna a avaliação visível na Home; rejeitar a oculta. A
    // visibilidade pode ser alternada depois sem mudar a aprovação.
    review.showOnHome = status === "APROVADO";
    draft.auditLogs.push({
      id: uuid(),
      userId: session.id,
      action: "MODERATE_REVIEW",
      entity: "review",
      entityId: reviewId,
      oldValue: null,
      newValue: { status, showOnHome: review.showOnHome },
      ip: null,
      createdAt: now,
    });
  });

  revalidatePath("/admin/avaliacoes");
  revalidatePath("/");
  return { success: true };
}

/**
 * Alterna a visibilidade da avaliação na Home (independente da aprovação).
 * Não altera `status` — uma avaliação pode continuar APROVADA e ficar
 * "Oculta da Home". Exclusivo do SUPER_ADMIN.
 */
export async function setReviewHomeVisibilityAction(
  reviewId: string,
  visible: boolean,
) {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") {
    return { error: "Apenas o administrador geral pode alterar a visibilidade." };
  }

  await getRepositoryRuntime().transaction((draft) => {
    const review = draft.reviews.find((r) => r.id === reviewId);
    if (!review) return;
    review.showOnHome = Boolean(visible);
    draft.auditLogs.push({
      id: uuid(),
      userId: session.id,
      action: "SET_REVIEW_HOME_VISIBILITY",
      entity: "review",
      entityId: reviewId,
      oldValue: null,
      newValue: { status: review.status, showOnHome: review.showOnHome },
      ip: null,
      createdAt: new Date().toISOString(),
    });
  });

  revalidatePath("/admin/avaliacoes");
  revalidatePath("/");
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
  revalidatePath("/");
  return { success: true };
}