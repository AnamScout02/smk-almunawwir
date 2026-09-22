import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { getSettings } from "@/lib/site-settings";
import { cekLibur } from "@/lib/hari-libur";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { hariIniWib, menitDariJam, periksaToken } from "@/lib/absensi-qr";

export const dynamic = "force-dynamic";

/** ABSEN MANDIRI — siswa memindai QR absensi yang berganti tiap 30 detik (src/lib/absensi-qr.ts).
 * Aturan sama dengan scan kartu: hanya MENGISI HADIR bila hari itu belum ada catatan absensi — tidak pernah
 * menimpa status yang sudah diisi wali kelas/ketua kelas. Setiap percobaan dicatat di AbsensiPindaiLog. */
export async function POST(req: NextRequest) {
  let session: Awaited<ReturnType<typeof verifyRole>>;
  try {
    session = await verifyRole(["STUDENT"]);
  } catch {
    return Response.json({ error: "Silakan masuk dengan akun siswa." }, { status: 401 });
  }
  if (!checkRateLimit(`absen-mandiri:${session.userId}`, 12, 60_000)) {
    return Response.json({ error: "Terlalu banyak percobaan. Tunggu sebentar." }, { status: 429 });
  }
  const { kode, perangkatId } = (await req.json().catch(() => ({}))) as { kode?: string; perangkatId?: string };
  const siswa = await prisma.student.findFirst({
    where: { userId: session.userId },
    select: { id: true, nis: true, classId: true, studentStatus: true, user: { select: { name: true } }, class: { select: { name: true } } },
  });
  if (!siswa || !siswa.classId) return Response.json({ error: "Data kelas Anda belum lengkap. Hubungi wali kelas." }, { status: 409 });
  if (siswa.studentStatus && siswa.studentStatus !== "AKTIF") return Response.json({ error: "Akun Anda bukan siswa aktif." }, { status: 409 });

  const h = hariIniWib();
  const perangkat = typeof perangkatId === "string" && /^[\w-]{8,64}$/.test(perangkatId) ? perangkatId : null;
  const ip = getClientIp(req);
  const userAgent = req.headers.get("user-agent")?.slice(0, 300) ?? null;
  const catat = (hasil: string, stasiun: string | null, catatan?: string) => prisma.absensiPindaiLog.create({
    data: { studentId: siswa.id, tanggal: h.awal, metode: "QR_MANDIRI", stasiun, hasil, perangkatId: perangkat, ip, userAgent, catatan: catatan ?? null },
  }).catch(() => null);

  const token = periksaToken(kode ?? "");
  if (!token.ok) { await catat("DITOLAK", null, token.alasan); return Response.json({ error: token.alasan }, { status: 400 }); }
  if (token.stasiun !== "GERBANG" && token.stasiun !== siswa.classId) {
    await catat("DITOLAK", token.stasiun, "QR kelas lain");
    return Response.json({ error: "QR ini untuk kelas lain. Pindai QR di kelas Anda sendiri atau di gerbang." }, { status: 403 });
  }

  const s = await getSettings(["absensiQr.jamBuka", "absensiQr.jamTutup", "notifikasi.tanggalLibur"]);
  const buka = menitDariJam(s["absensiQr.jamBuka"]);
  const tutup = menitDariJam(s["absensiQr.jamTutup"]);
  const libur = h.hariKe === 0 || !!(await cekLibur(h.tanggal));
  if (libur || (Number.isFinite(buka) && h.menit < buka) || (Number.isFinite(tutup) && h.menit > tutup)) {
    await catat("DITOLAK", token.stasiun, "di luar jam absensi");
    return Response.json({ error: `Absen mandiri hanya dibuka pukul ${s["absensiQr.jamBuka"]}–${s["absensiQr.jamTutup"]} WIB pada hari sekolah.` }, { status: 409 });
  }

  const ada = await prisma.attendance.findFirst({ where: { studentId: siswa.id, date: { gte: h.awal, lt: h.akhir } }, select: { status: true } });
  const profil = { nama: siswa.user.name, kelas: siswa.class?.name ?? "-", nis: siswa.nis };
  if (ada) {
    await catat("SUDAH_ADA", token.stasiun);
    return Response.json({ hasil: "SUDAH_ADA", status: ada.status, siswa: profil });
  }

  // Perangkat yang sama sudah dipakai siswa lain hari ini → tetap dicatat, tapi ditandai untuk diperiksa.
  const lain = perangkat ? await prisma.absensiPindaiLog.findFirst({
    where: { tanggal: h.awal, perangkatId: perangkat, hasil: "DIBUAT", studentId: { not: siswa.id } },
    select: { student: { select: { nis: true } } },
  }) : null;

  await prisma.attendance.create({ data: { studentId: siswa.id, date: h.awal, status: "HADIR" } });
  await catat("DIBUAT", token.stasiun, lain ? `perangkat juga dipakai NIS ${lain.student.nis}` : undefined);
  return Response.json({ hasil: "DIBUAT", status: "HADIR", siswa: profil, jam: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) }, { status: 201 });
}
