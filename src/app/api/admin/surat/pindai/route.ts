import { randomBytes } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { FOLDER_SURAT, MIME_SURAT, alamatBerkasSurat } from "@/lib/surat-berkas";

export const dynamic = "force-dynamic";

/** Simpan pindaian surat masuk (foto yang sudah diluruskan di peramban, atau PDF) ke folder rahasia. Maks 6 MB. */
export async function POST(req: Request) {
  try {
    await verifyTasAccess();
    const file = (await req.formData()).get("file");
    if (!(file instanceof File) || !file.size) return Response.json({ error: "Berkas tidak terbaca." }, { status: 400 });
    if (file.size > 6 * 1024 * 1024) return Response.json({ error: "Berkas lebih dari 6 MB." }, { status: 400 });
    const ext = Object.entries(MIME_SURAT).find(([, m]) => m === file.type)?.[0];
    if (!ext) return Response.json({ error: "Hanya foto (JPG/PNG/WebP) atau PDF." }, { status: 400 });
    const buf = Buffer.from(await file.arrayBuffer());
    // Periksa tanda tangan berkas — jenis yang diakui browser tidak dipercaya begitu saja.
    const sah = ext === "pdf" ? buf.subarray(0, 4).toString() === "%PDF" : ext === "png" ? buf[0] === 0x89 && buf[1] === 0x50
      : ext === "webp" ? buf.subarray(8, 12).toString() === "WEBP" : buf[0] === 0xff && buf[1] === 0xd8;
    if (!sah) return Response.json({ error: "Isi berkas tidak sesuai jenisnya." }, { status: 400 });
    const nama = `${Date.now()}-${randomBytes(9).toString("hex")}.${ext === "jpeg" ? "jpg" : ext}`;
    await mkdir(FOLDER_SURAT, { recursive: true });
    await writeFile(join(FOLDER_SURAT, nama), buf);
    return Response.json({ url: alamatBerkasSurat(nama) }, { status: 201 });
  } catch (e) { lemparBilaPengalihan(e); return Response.json({ error: "Gagal menyimpan pindaian." }, { status: 500 }); }
}
