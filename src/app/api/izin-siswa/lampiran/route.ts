import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { randomBytes } from "crypto";
import { verifyRole } from "@/lib/dal";
import { kompresGambar } from "@/lib/kompres-gambar";
import { FOLDER_LAMPIRAN } from "@/lib/izin-siswa";

export const dynamic = "force-dynamic";

/** Unggah lampiran pengajuan izin (foto/PDF surat) — hanya orang tua. Berkas masuk folder rahasia (tidak bisa dibuka publik);
 * yang dikembalikan hanya nama berkas untuk dikirim bersama pengajuan. */
export async function POST(req: Request) {
  await verifyRole(["PARENT"]);
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || !file.size) return Response.json({ error: "Pilih foto atau PDF surat dulu." }, { status: 400 });
  const tipe: Record<string, string> = { "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };
  let ext = tipe[file.type];
  if (!ext) return Response.json({ error: "Gunakan foto (JPG/PNG/WEBP) atau PDF." }, { status: 400 });
  if (file.size > 8 * 1024 * 1024) return Response.json({ error: "Ukuran berkas maksimal 8 MB." }, { status: 400 });
  let isi = Buffer.from(await file.arrayBuffer());
  if (ext !== "pdf") {
    const kecil = await kompresGambar(isi);
    if (kecil) { isi = Buffer.from(kecil.buffer); ext = kecil.ext; }
  }
  const nama = `${Date.now()}-${randomBytes(12).toString("hex")}.${ext}`;
  await mkdir(FOLDER_LAMPIRAN, { recursive: true });
  await writeFile(join(FOLDER_LAMPIRAN, nama), isi);
  return Response.json({ berkas: nama });
}
