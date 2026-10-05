import { unlink } from "fs/promises";
import { join } from "path";
import { prisma } from "@/lib/prisma";
import { sesiOpsional, simpanBerkasEvent, FOLDER_EVENT } from "@/lib/event-server";
import { pendaftaranTerbuka } from "@/lib/event-label";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

const galat = (error: string, status = 400) => Response.json({ error }, { status });

/** Pendaftaran event / lomba (multipart).
 *
 *  - Siswa yang sedang MASUK terdaftar sebagai dirinya sendiri (`studentId` dari sesi, bukan isian),
 *    satu pendaftaran per event (unik di DB).
 *  - Event milik sekolah juga menerima peserta LUAR tanpa akun; dibatasi 5 kiriman/IP/10 menit.
 *  - Lomba pihak luar (milikSekolah = false) HANYA untuk siswa — sekolah yang meneruskan pesertanya.
 *  - Bila event punya `tautanLuar`, pendaftaran dilakukan di situs penyelenggara, bukan di sini.
 *  Batas berkas 6 + 3 MB karena proxy Next memotong badan permintaan di atas 10 MB. */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const e = await prisma.event.findUnique({
    where: { slug },
    select: { id: true, judul: true, aktif: true, tampilPublik: true, milikSekolah: true, tutupDaftar: true, tautanLuar: true, berbayar: true, biaya: true, jurusanIds: true },
  });
  if (!e || !e.aktif) return galat("Event tidak ditemukan.", 404);
  if (e.tautanLuar) return galat("Pendaftaran event ini dilakukan di situs penyelenggara.");
  if (!pendaftaranTerbuka(e)) return galat("Pendaftaran sudah ditutup.");

  const sesi = await sesiOpsional();
  const siswa = sesi?.role === "STUDENT"
    ? await prisma.student.findUnique({ where: { userId: sesi.userId }, select: { id: true, majorId: true, user: { select: { name: true } } } }).catch(() => null)
    : null;
  if (!siswa && !e.milikSekolah) return galat("Lomba ini didaftarkan lewat sekolah — masuk dengan akun siswa untuk mendaftar.", 401);
  if (!siswa && !e.tampilPublik) return galat("Event tidak ditemukan.", 404);
  if (siswa && e.jurusanIds.length && (!siswa.majorId || !e.jurusanIds.includes(siswa.majorId)))
    return galat("Event ini khusus jurusan tertentu dan jurusanmu tidak termasuk.", 403);
  if (!siswa && !checkRateLimit(`event-daftar:${getClientIp(req)}`, 5, 10 * 60_000))
    return galat("Terlalu banyak pendaftaran dari jaringan ini. Coba lagi 10 menit lagi.", 429);

  const form = await req.formData().catch(() => null);
  if (!form) return galat("Formulir tidak terbaca. Ukuran berkas total maksimal 9 MB.");
  const teks = (k: string, maks: number) => String(form.get(k) ?? "").trim().slice(0, maks);

  const namaPeserta = siswa ? (teks("namaPeserta", 200) || siswa.user.name) : teks("namaPeserta", 200);
  const asalSekolah = siswa ? null : teks("asalSekolah", 200);
  const kontak = teks("kontak", 100);
  const catatan = teks("catatan", 1000) || null;
  let karyaTautan: string | null = teks("karyaTautan", 500) || null;
  const kolom: Record<string, string> = {};
  if (!namaPeserta) kolom.namaPeserta = "Nama peserta / tim wajib diisi.";
  if (!siswa && !asalSekolah) kolom.asalSekolah = "Asal sekolah / instansi wajib diisi.";
  if (!/^[0-9+\-\s()]{8,20}$/.test(kontak) && !/^\S+@\S+\.\S+$/.test(kontak)) kolom.kontak = "Isi nomor WhatsApp atau e-mail yang bisa dihubungi.";
  if (karyaTautan && !/^https?:\/\/\S+$/i.test(karyaTautan)) kolom.karyaTautan = "Tautan karya harus diawali http:// atau https://";
  const perluBukti = e.berbayar && (e.biaya ?? 0) > 0;
  const fileBukti = form.get("buktiBayar");
  if (perluBukti && !(fileBukti instanceof File && fileBukti.size)) kolom.buktiBayar = "Unggah bukti pembayaran.";
  if (Object.keys(kolom).length) return Response.json({ error: Object.values(kolom)[0], kolom }, { status: 400 });

  if (siswa) {
    const ada = await prisma.pendaftaranEvent.findUnique({ where: { eventId_studentId: { eventId: e.id, studentId: siswa.id } }, select: { id: true } });
    if (ada) return galat("Kamu sudah terdaftar di event ini. Lihat statusnya di menu Lomba & Event.", 409);
  } else {
    const ada = await prisma.pendaftaranEvent.findFirst({ where: { eventId: e.id, studentId: null, kontak, namaPeserta: { equals: namaPeserta, mode: "insensitive" } }, select: { id: true } });
    if (ada) return galat("Peserta dengan nama & kontak ini sudah terdaftar.", 409);
  }

  const karya = await simpanBerkasEvent(form.get("karya"), 6, "Berkas karya");
  if (karya && typeof karya === "object") return galat(karya.galat);
  const bukti = await simpanBerkasEvent(fileBukti, 3, "Bukti bayar");
  if (bukti && typeof bukti === "object") {
    if (karya) await unlink(join(FOLDER_EVENT, karya)).catch(() => {});
    return galat(bukti.galat);
  }
  if (karyaTautan === "") karyaTautan = null;

  try {
    const p = await prisma.pendaftaranEvent.create({
      data: { eventId: e.id, studentId: siswa?.id ?? null, namaPeserta, asalSekolah, kontak, catatan, karyaBerkas: karya, karyaTautan, buktiBayar: bukti },
      select: { id: true },
    });
    if (sesi) await logActivity(sesi, { action: "CREATE", entity: "PendaftaranEvent", entityId: p.id, description: `Mendaftar ${e.judul}` }).catch(() => {});
    return Response.json({ ok: true, id: p.id }, { status: 201 });
  } catch {
    // Dua kiriman serentak dari siswa yang sama: baris kedua ditolak indeks unik — buang berkasnya.
    for (const b of [karya, bukti]) if (b) await unlink(join(FOLDER_EVENT, b)).catch(() => {});
    return galat("Pendaftaran gagal disimpan. Mungkin kamu sudah terdaftar.", 409);
  }
}
