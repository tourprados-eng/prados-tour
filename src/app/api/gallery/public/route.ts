import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { getRepositoryRuntime } from "@/lib/repositories/runtime";
import { getDataBackend } from "@/lib/supabase/config";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const photoId = url.searchParams.get("id");

  if (!photoId) {
    return new NextResponse("Foto não informada.", { status: 400 });
  }

  const store = await getRepositoryRuntime().read();
  const photo = store.galleryPhotos.find((item) => item.id === photoId);

  if (
    !photo ||
    photo.status !== "APROVADO" ||
    !photo.showOnHome
  ) {
    return new NextResponse("Foto não encontrada.", { status: 404 });
  }

  const filename = path.basename(photo.url);

  if (filename !== photo.url) {
    return new NextResponse("Arquivo inválido.", { status: 400 });
  }

  if (getDataBackend() === "supabase") {
    try {
      const supabase = createSupabaseAdminClient();

      const { data, error } = await supabase.storage
        .from("gallery-photos")
        .download(filename);

      if (error || !data) {
        return new NextResponse(
          "Arquivo da foto não encontrado.",
          { status: 404 },
        );
      }

      return new NextResponse(data, {
        status: 200,
        headers: {
          "Content-Type": "image/jpeg",
          "Cache-Control": "public, max-age=3600",
        },
      });
    } catch {
      return new NextResponse(
        "Arquivo da foto não encontrado.",
        { status: 404 },
      );
    }
  }

  // Fallback local.
  const filepath = path.join(
    process.cwd(),
    ".data",
    "gallery",
    photo.status === "APROVADO" ? "approved" : "pending",
    filename,
  );

  try {
    const buffer = await readFile(filepath);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    // Compatibilidade com fotos aprovadas que ainda estejam em pending.
    if (photo.status === "APROVADO") {
      try {
        const pendingPath = path.join(
          process.cwd(),
          ".data",
          "gallery",
          "pending",
          filename,
        );

        const buffer = await readFile(pendingPath);

        return new NextResponse(buffer, {
          status: 200,
          headers: {
            "Content-Type": "image/jpeg",
            "Cache-Control": "public, max-age=3600",
          },
        });
      } catch {
        // continua para 404
      }
    }

    return new NextResponse(
      "Arquivo da foto não encontrado.",
      { status: 404 },
    );
  }
}
