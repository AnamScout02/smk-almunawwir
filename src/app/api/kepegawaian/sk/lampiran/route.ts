import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { randomBytes } from "crypto";
import { verifyRole } from "@/lib/dal";
import { kompresGambar } from "@/lib/kompres-gambar";
import { FOLDER_SK, kelolaKepegawaian } from "@/lib/arsip-sk";

export const dynamic = "force-dynamic";

/** Unggah berkas SK/sertifikat ke folder RAHASIA (diblokir proxy; dibuka lewat /api/kepegawaian/sk/[id]/berkas). */
export async function POST(req: Request) {
  const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
  if (!(await kelolaKepegawaian(session))) return Response.json({ error: "Khusus TU & Operator Sekolah." }, { status: 403 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || !file.size) return Response.json({ error: "Pilih berkas dulu." }, { status: 400 });
  const tipe: Record<string, string> = { "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };
  let ext = tipe[file.type];
  if (!ext) return Response.json({ error: "Gunakan PDF atau foto (JPG/PNG/WEBP)." }, { status: 400 });
  if (file.size > 8 * 1024 * 1024) return Response.json({ error: "Ukuran berkas maksimal 8 MB." }, { status: 400 });
  let isi = Buffer.from(await file.arrayBuffer());
  if (ext !== "pdf") {
    const kecil = await kompresGambar(isi);
    if (kecil) { isi = Buffer.from(kecil.buffer); ext = kecil.ext; }
  }
  const nama = `${Date.now()}-${randomBytes(12).toString("hex")}.${ext}`;
  await mkdir(FOLDER_SK, { recursive: true });
  await writeFile(join(FOLDER_SK, nama), isi);
  return Response.json({ berkas: nama });
}
