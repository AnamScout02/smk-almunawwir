import { mkdir, writeFile, unlink } from "fs/promises";
import { join } from "path";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { kompresGambar } from "@/lib/kompres-gambar";
import { FOLDER_BUKTI, JAM_BATAS_BUKTI, bolehUnggahBukti } from "@/lib/izin-keluar";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

/** Siswa mengunggah bukti foto dari tempat tujuan. Hanya untuk izin MILIKNYA SENDIRI yang memang
 *  ditandai `perluFoto` oleh guru piket, dan hanya selama masih dalam batas waktu. Berkas masuk
 *  folder RAHASIA — bisa memuat informasi kesehatan (mis. izin ke klinik). */
export async function POST(req: Request) {
  try {
    const session = await verifyRole(["STUDENT"]);
    const form = await req.formData().catch(() => null);
    const izinId = String(form?.get("izinId") ?? "");
    const file = form?.get("file");
    if (!izinId) return Response.json({ error: "Izin tidak dikenali." }, { status: 400 });
    if (!(file instanceof File) || !file.size) return Response.json({ error: "Pilih atau ambil foto dulu." }, { status: 400 });

    const tipe: Record<string, string> = { "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png", "image/webp": "webp" };
    let ext = tipe[file.type];
    if (!ext) return Response.json({ error: "Gunakan foto JPG, PNG, atau WEBP." }, { status: 400 });
    if (file.size > 8 * 1024 * 1024) return Response.json({ error: "Ukuran foto maksimal 8 MB." }, { status: 400 });

    const izin = await prisma.izinKeluarSiswa.findFirst({
      where: { id: izinId, student: { user: { email: session.email } } },
      select: { id: true, perluFoto: true, keluarPada: true, buktiFoto: true },
    });
    if (!izin) return Response.json({ error: "Izin keluar tidak ditemukan." }, { status: 404 });
    if (!izin.perluFoto) return Response.json({ error: "Izin keluar ini tidak memerlukan bukti foto." }, { status: 400 });
    if (!bolehUnggahBukti(izin)) {
      return Response.json({ error: `Batas unggah bukti foto ${JAM_BATAS_BUKTI} jam sejak keluar sudah lewat. Lapor ke guru piket.` }, { status: 409 });
    }

    let isi = Buffer.from(await file.arrayBuffer());
    const kecil = await kompresGambar(isi);
    if (kecil) { isi = Buffer.from(kecil.buffer); ext = kecil.ext; }

    const nama = `${Date.now()}-${randomBytes(12).toString("hex")}.${ext}`;
    await mkdir(FOLDER_BUKTI, { recursive: true });
    await writeFile(join(FOLDER_BUKTI, nama), isi);
    const lama = izin.buktiFoto;
    await prisma.izinKeluarSiswa.update({
      where: { id: izin.id }, data: { buktiFoto: nama, buktiPada: new Date() },
    });
    // Foto lama dibuang SETELAH baris menunjuk ke yang baru, supaya gagal-hapus tidak membuat
    // baris menunjuk berkas yang sudah hilang.
    if (lama && lama !== nama) await unlink(join(FOLDER_BUKTI, lama)).catch(() => {});
    return Response.json({ ok: true });
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal mengunggah bukti foto" }, { status: 500 });
  }
}
