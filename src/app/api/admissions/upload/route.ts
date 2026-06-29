import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { NextRequest } from "next/server";

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const type = (formData.get("type") as string) || "misc";

    if (!file) return Response.json({ error: "Tidak ada file" }, { status: 400 });
    if (!ALLOWED_TYPES.includes(file.type)) {
      return Response.json({ error: "Format tidak didukung. Gunakan JPG, PNG, atau PDF." }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return Response.json({ error: "Ukuran file maksimal 5MB" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const uploadDir = join(process.cwd(), "public", "uploads", "admissions", type);

    await mkdir(uploadDir, { recursive: true });
    await writeFile(join(uploadDir, filename), buffer);

    return Response.json({ url: `/uploads/admissions/${type}/${filename}` });
  } catch (err) {
    console.error("Upload error:", err);
    return Response.json({ error: "Gagal mengupload file" }, { status: 500 });
  }
}
