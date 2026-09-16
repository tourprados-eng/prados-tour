import { NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { getSession } from "@/lib/auth/session";
import {
  getDataBackend,
  getSupabaseEnvironment,
} from "@/lib/supabase/config";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request) {
  const session = await getSession();

  if (!session || session.role !== "CLIENTE") {
    return NextResponse.json(
      { error: "Apenas clientes autenticados podem enviar fotos." },
      { status: 403 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Arquivo não enviado." },
      { status: 400 },
    );
  }

  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json(
      { error: "Formato de imagem inválido. Use JPG, PNG ou WebP." },
      { status: 400 },
    );
  }

  if (file.size <= 0 || file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "A imagem deve ter entre 1 byte e 5 MB." },
      { status: 400 },
    );
  }

  try {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const processedBuffer = await sharp(buffer)
      .autoOrient()
      .resize(1600, 900, {
        fit: "cover",
        position: "attention",
      })
      .jpeg({
        quality: 88,
        mozjpeg: true,
      })
      .toBuffer();

    const filename = `${randomUUID()}.jpg`;

    if (getDataBackend() === "supabase") {
      const env = getSupabaseEnvironment();

      if (!env.hasServerCredentials) {
        return NextResponse.json(
          { error: "Storage da galeria não está configurado." },
          { status: 500 },
        );
      }

      const supabase = createSupabaseAdminClient();

      const { error } = await supabase.storage
        .from("gallery-photos")
        .upload(filename, processedBuffer, {
          contentType: "image/jpeg",
          cacheControl: "3600",
          upsert: false,
        });

      if (error) {
        console.error(
          "Erro ao salvar foto no Supabase Storage:",
          error,
        );

        return NextResponse.json(
          { error: "Não foi possível salvar a imagem." },
          { status: 500 },
        );
      }

      return NextResponse.json({
        success: true,
        fileId: filename,
      });
    }

    // Fallback local para desenvolvimento.
    const directory = path.join(
      process.cwd(),
      ".data",
      "gallery",
      "pending",
    );

    await mkdir(directory, { recursive: true });

    const filepath = path.join(directory, filename);
    await writeFile(filepath, processedBuffer);

    return NextResponse.json({
      success: true,
      fileId: filename,
    });
  } catch (error) {
    console.error("Erro ao processar foto da galeria:", error);

    return NextResponse.json(
      { error: "Não foi possível processar a imagem. Tente outra foto." },
      { status: 500 },
    );
  }
}
