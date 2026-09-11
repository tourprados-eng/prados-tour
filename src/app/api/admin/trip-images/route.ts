import { NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/auth/session";
import {
  getDataBackend,
  getSupabaseEnvironment,
} from "@/lib/supabase/config";

const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

function extensionFromType(type: string) {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

export async function POST(request: Request) {
  const session = await getSession();

  if (!session || !["SUPER_ADMIN", "ADMIN"].includes(session.role)) {
    return NextResponse.json(
      { error: "Sem permissão." },
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
      { error: "Formato de imagem inválido." },
      { status: 400 },
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "A imagem deve ter no máximo 5 MB." },
      { status: 400 },
    );
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const filename = `${randomUUID()}.${extensionFromType(file.type)}`;

  const env = getSupabaseEnvironment();

  if (getDataBackend() === "supabase" && env.url && env.serviceRoleKey) {
    try {
      const supabase = createClient(env.url, env.serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const { data, error } = await supabase.storage
        .from("trip-images")
        .upload(filename, buffer, {
          contentType: file.type,
          cacheControl: "3600",
        });

      if (error) {
        return NextResponse.json(
          { error: "Não foi possível salvar a imagem." },
          { status: 500 },
        );
      }

      const publicUrl = supabase.storage
        .from("trip-images")
        .getPublicUrl(data.path).data.publicUrl;

      return NextResponse.json({ url: publicUrl });
    } catch {
      return NextResponse.json(
        { error: "Não foi possível salvar a imagem." },
        { status: 500 },
      );
    }
  }

  // Fallback: armazenamento local do servidor (desenvolvimento / sem credenciais).
  const directory = path.join(process.cwd(), "public", "uploads", "trips");
  await mkdir(directory, { recursive: true });
  const filepath = path.join(directory, filename);
  await writeFile(filepath, buffer);

  return NextResponse.json({ url: `/uploads/trips/${filename}` });
}