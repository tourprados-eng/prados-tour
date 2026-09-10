
import { NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { getSession } from "@/lib/auth/session";

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

  const allowed = ["image/jpeg", "image/png", "image/webp"];

  if (!allowed.includes(file.type)) {
    return NextResponse.json(
      { error: "Formato de imagem inválido." },
      { status: 400 },
    );
  }

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json(
      { error: "A imagem deve ter no máximo 5 MB." },
      { status: 400 },
    );
  }

  const extension =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : "jpg";

  const directory = path.join(
    process.cwd(),
    "public",
    "uploads",
    "trips",
  );

  await mkdir(directory, { recursive: true });

  const filename = `${randomUUID()}.${extension}`;
  const filepath = path.join(directory, filename);

  const bytes = await file.arrayBuffer();

  await writeFile(filepath, Buffer.from(bytes));

  return NextResponse.json({
    url: `/uploads/trips/${filename}`,
  });
}
