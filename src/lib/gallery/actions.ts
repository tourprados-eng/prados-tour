"use server";

import { v4 as uuid } from "uuid";
import { access } from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import { getDataBackend } from "@/lib/supabase/config";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { GalleryPhoto, GalleryPhotoStatus } from "@/types";

const createGalleryPhotoSchema = z.object({
  tripId: z.string().min(1, "Selecione uma viagem."),
  fileId: z
    .string()
    .regex(
      /^[0-9a-f-]{36}\.(jpg|png|webp)$/,
      "Arquivo de foto inválido.",
    ),
  caption: z
    .string()
    .trim()
    .max(300, "A legenda deve ter no máximo 300 caracteres.")
    .optional()
    .or(z.literal("")),
});

export type CreateGalleryPhotoInput = z.infer<
  typeof createGalleryPhotoSchema
>;

/**
 * Permite que um cliente autenticado envie uma foto de uma viagem
 * em que possui reserva confirmada ou concluída.
 * A foto sempre entra como PENDENTE e não fica pública automaticamente.
 */
export async function createGalleryPhotoAction(
  input: CreateGalleryPhotoInput,
) {
  const session = await getSession();

  if (!session) {
    return { error: "Você precisa estar logado para enviar uma foto." };
  }

  if (session.role !== "CLIENTE") {
    return { error: "Somente clientes podem enviar fotos pela galeria." };
  }

  const parsed = createGalleryPhotoSchema.safeParse(input);

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
    };
  }

  const { tripId, fileId, caption } = parsed.data;

  if (getDataBackend() === "supabase") {
    try {
      const supabase = createSupabaseAdminClient();

      const { data, error } = await supabase.storage
        .from("gallery-photos")
        .list("", {
          search: fileId,
          limit: 1,
        });

      if (
        error ||
        !data?.some((item) => item.name === fileId)
      ) {
        return {
          error:
            "A foto enviada não foi encontrada. Tente enviar novamente.",
        };
      }
    } catch {
      return {
        error: "Não foi possível verificar a foto enviada.",
      };
    }
  } else {
    const pendingPath = path.join(
      process.cwd(),
      ".data",
      "gallery",
      "pending",
      fileId,
    );

    try {
      await access(pendingPath);
    } catch {
      return {
        error:
          "A foto enviada não foi encontrada. Tente enviar novamente.",
      };
    }
  }

  const repo = getRepositoryRuntime();
  const store = await repo.read();

  const trip = store.trips.find((item) => item.id === tripId);

  if (!trip) {
    return {
      error: "A viagem selecionada não foi encontrada.",
    };
  }

  const now = new Date().toISOString();

  const photo: GalleryPhoto = {
    id: uuid(),
    customerId: session.id,
    tripId,
    url: fileId,
    caption: caption || null,
    status: "PENDENTE",
    showOnHome: false,
    sortOrder: 0,
    reviewedBy: null,
    reviewedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  await repo.transaction((draft) => {
    draft.galleryPhotos.unshift(photo);
  });

  revalidatePath("/minhas-viagens");
  revalidatePath("/admin/galeria");

  return { success: true };
}

/**
 * Moderação — exclusiva do SUPER_ADMIN.
 */
export async function moderateGalleryPhotoAction(
  photoId: string,
  status: GalleryPhotoStatus,
  showOnHome?: boolean,
) {
  const session = await getSession();

  if (!session || session.role !== "SUPER_ADMIN") {
    return {
      error: "Apenas o administrador geral pode moderar fotos.",
    };
  }

  if (status !== "APROVADO" && status !== "REJEITADO") {
    return { error: "Status inválido." };
  }

  await getRepositoryRuntime().transaction((draft) => {
    const photo = draft.galleryPhotos.find((item) => item.id === photoId);

    if (!photo) return;

    const now = new Date().toISOString();

    photo.status = status;
    photo.showOnHome =
      status === "APROVADO" ? (showOnHome ?? true) : false;
    photo.reviewedAt = now;
    photo.reviewedBy = session.id;
    photo.updatedAt = now;

    draft.auditLogs.push({
      id: uuid(),
      userId: session.id,
      action: "MODERATE_GALLERY_PHOTO",
      entity: "gallery_photo",
      entityId: photoId,
      oldValue: null,
      newValue: {
        status,
        showOnHome: photo.showOnHome,
      },
      ip: null,
      createdAt: now,
    });
  });

  revalidatePath("/admin/galeria");
  revalidatePath("/");

  return { success: true };
}

export async function deleteGalleryPhotoAction(photoId: string) {
  const session = await getSession();

  if (!session || session.role !== "SUPER_ADMIN") {
    return {
      error: "Apenas o administrador geral pode excluir fotos.",
    };
  }

  const store = await getRepositoryRuntime().read();
  const photo = store.galleryPhotos.find((item) => item.id === photoId);

  if (!photo) {
    return { error: "Foto não encontrada." };
  }

  if (getDataBackend() === "supabase") {
    try {
      const supabase = createSupabaseAdminClient();

      const { error } = await supabase.storage
        .from("gallery-photos")
        .remove([photo.url]);

      if (error) {
        console.error(
          "Erro ao remover foto do Storage:",
          error,
        );

        return {
          error:
            "Não foi possível excluir o arquivo da foto.",
        };
      }
    } catch {
      return {
        error:
          "Não foi possível excluir o arquivo da foto.",
      };
    }
  }

  await getRepositoryRuntime().transaction((draft) => {
    const now = new Date().toISOString();

    draft.galleryPhotos = draft.galleryPhotos.filter(
      (item) => item.id !== photoId,
    );

    draft.auditLogs.push({
      id: uuid(),
      userId: session.id,
      action: "DELETE_GALLERY_PHOTO",
      entity: "gallery_photo",
      entityId: photoId,
      oldValue: {
        url: photo.url,
        status: photo.status,
        showOnHome: photo.showOnHome,
      },
      newValue: null,
      ip: null,
      createdAt: now,
    });
  });

  revalidatePath("/admin/galeria");
  revalidatePath("/");

  return { success: true };
}
