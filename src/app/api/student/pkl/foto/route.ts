import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { tandaFoto } from "@/lib/pkl-foto";

export const dynamic = "force-dynamic";

/** Unggah foto jurnal yang diambil dari KAMERA di halaman. Waktu yang dicatat adalah waktu SERVER, bukan jam HP. */
export async function POST(req: Request) {
  try {
    const session = await verifyRole(["STUDENT"]);
    const siswa = await prisma.student.findFirst({ where: { user: { email: session.email } }, select: { id: true, internship: { select: { id: true } } } });
    if (!siswa?.internship) return Response.json({ error: "Anda belum terdaftar sebagai peserta PKL." }, { status: 404 });
    const fd = await req.formData();
    const file = fd.get("file");
    if (!(file instanceof File)) return Response.json({ error: "Tidak ada foto." }, { status: 400 });
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return Response.json({ error: "Foto harus JPG, PNG, atau WEBP." }, { status: 400 });
    if (file.size > 4 * 1024 * 1024) return Response.json({ error: "Foto lebih dari 4 MB." }, { status: 400 });
    const buf = Buffer.from(await file.arrayBuffer());
    // Tanda tangan berkas: JPEG (FF D8), PNG (89 50), WEBP (RIFF) — jenis dari browser saja tidak dipercaya.
    const sah = (buf[0] === 0xff && buf[1] === 0xd8) || (buf[0] === 0x89 && buf[1] === 0x50) || buf.subarray(0, 4).toString() === "RIFF";
    if (!sah) return Response.json({ error: "Berkas bukan gambar." }, { status: 400 });
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const nama = `${Date.now()}-${randomBytes(6).toString("hex")}.${ext}`;
    const dir = join(process.cwd(), "public", "uploads", "pkl-jurnal", "kamera");
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, nama), buf);
    const url = `/api/uploads/pkl-jurnal/kamera/${nama}`, waktu = Date.now();
    return Response.json({ url, waktu, tanda: tandaFoto(url, waktu, siswa.id) });
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal mengunggah foto." }, { status: 500 });
  }
}
