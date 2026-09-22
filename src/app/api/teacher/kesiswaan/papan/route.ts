import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { getJabatanNames } from "@/lib/jabatan-guard";
import { KESISWAAN_BK_JABATAN } from "@/lib/kesiswaan-guard";
import { bagianWib } from "@/lib/waktu-wib";
import { cekLibur } from "@/lib/hari-libur";
import { hitungRisikoSiswa, semesterBerjalan } from "@/lib/peringatan-dini";

export const dynamic = "force-dynamic";

/** PAPAN KESISWAAN (17 Sep 2026) — ?bagian=hari (kehadiran hari ini per kelas) | kerawanan (peta per kelas 30 hari) | prestasi.
 * Wakasek Kesiswaan, Guru BK, Kepala Sekolah, Admin. */
export async function GET(req: Request) {
  const session = await verifyRole(["ADMIN", "TEACHER"]);
  if (session.role !== "ADMIN") {
    const j = await getJabatanNames(session.email);
    if (!j.some(x => KESISWAAN_BK_JABATAN.includes(x) || x === "Kepala Sekolah")) return Response.json({ error: "Khusus Kesiswaan, BK, dan Kepala Sekolah." }, { status: 403 });
  }
  const bagian = new URL(req.url).searchParams.get("bagian") ?? "hari";
  const w = bagianWib();

  if (bagian === "hari") {
    const awal = new Date(`${w.iso}T00:00:00Z`), akhir = new Date(awal.getTime() + 86400000);
    const [kelas, hadir, libur, terlambat, diLuar] = await Promise.all([
      prisma.class.findMany({ select: { id: true, name: true, grade: true, _count: { select: { students: { where: { studentStatus: "AKTIF" } } } } }, orderBy: [{ grade: "asc" }, { name: "asc" }] }),
      prisma.attendance.groupBy({ by: ["status"], where: { date: { gte: awal, lt: akhir }, student: { studentStatus: "AKTIF" } }, _count: { _all: true } }),
      cekLibur(w.iso).catch(() => null),
      prisma.studentPointRecord.count({ where: { kind: "PELANGGARAN", date: { gte: new Date(awal.getTime() - 7 * 3600_000), lt: new Date(akhir.getTime() - 7 * 3600_000) }, violationType: { name: { contains: "Terlambat", mode: "insensitive" } } } }),
      prisma.izinKeluarSiswa.count({ where: { kembaliPada: null, keluarPada: { gte: new Date(awal.getTime() - 7 * 3600_000) } } }),
    ]);
    const perKelasRaw = await prisma.attendance.findMany({ where: { date: { gte: awal, lt: akhir }, student: { studentStatus: "AKTIF" } }, select: { status: true, student: { select: { classId: true } } } });
    const peta = new Map<string, Record<string, number>>();
    for (const a of perKelasRaw) {
      const k = a.student.classId ?? "";
      const r = peta.get(k) ?? { HADIR: 0, IZIN: 0, SAKIT: 0, ALPHA: 0 };
      r[a.status] = (r[a.status] ?? 0) + 1;
      peta.set(k, r);
    }
    const total = Object.fromEntries(hadir.map(h => [h.status, h._count._all]));
    return Response.json({
      tanggal: w.iso, libur: libur ? (libur as { nama?: string }).nama ?? "Hari libur" : null, terlambat, diLuar, total,
      kelas: kelas.map(k => {
        const r = peta.get(k.id) ?? { HADIR: 0, IZIN: 0, SAKIT: 0, ALPHA: 0 };
        const tercatat = r.HADIR + r.IZIN + r.SAKIT + r.ALPHA;
        return { id: k.id, nama: k.name, siswa: k._count.students, ...r, tercatat, persen: tercatat ? Math.round((r.HADIR / tercatat) * 100) : null };
      }),
    });
  }

  if (bagian === "kerawanan") {
    const sejak = new Date(Date.now() - 30 * 86400000);
    const semester = semesterBerjalan();
    const [risiko, kasus, pelanggaran, konseling] = await Promise.all([
      hitungRisikoSiswa(),
      prisma.studentCaseNote.findMany({ where: { status: "BERJALAN" }, select: { student: { select: { classId: true } } } }),
      prisma.studentPointRecord.findMany({ where: { kind: "PELANGGARAN", semester }, select: { points: true, date: true, student: { select: { classId: true } } } }),
      prisma.janjiKonseling.findMany({ where: { createdAt: { gte: sejak } }, select: { student: { select: { classId: true } } } }),
    ]);
    const kelas = await prisma.class.findMany({ select: { id: true, name: true }, orderBy: [{ grade: "asc" }, { name: "asc" }] });
    const baris = kelas.map(k => {
      const r = risiko.baris.filter(b => b.classId === k.id);
      const siswa = r.length;
      const alpha = r.reduce((a, b) => a + b.alpha30, 0);
      const poin = pelanggaran.filter(p => p.student.classId === k.id).reduce((a, b) => a + b.points, 0);
      const pelanggaran30 = pelanggaran.filter(p => p.student.classId === k.id && p.date >= sejak).length;
      const tinggi = r.filter(b => b.tingkat === "TINGGI").length;
      const sedang = r.filter(b => b.tingkat === "SEDANG").length;
      const kasusAktif = kasus.filter(c => c.student.classId === k.id).length;
      const konsel = konseling.filter(c => c.student.classId === k.id).length;
      // Skor kerawanan 0–100: bobot sederhana per siswa supaya kelas besar tidak otomatis tampak rawan.
      const perSiswa = (x: number) => (siswa ? x / siswa : 0);
      const skor = Math.min(100, Math.round(perSiswa(alpha) * 12 + perSiswa(pelanggaran30) * 15 + perSiswa(tinggi) * 120 + perSiswa(sedang) * 40 + perSiswa(kasusAktif) * 60));
      return { id: k.id, nama: k.name, siswa, alpha, poin, pelanggaran30, tinggi, sedang, kasusAktif, konseling: konsel, skor };
    }).filter(b => b.siswa > 0).sort((a, b) => b.skor - a.skor);
    return Response.json({ semester, baris, ringkas: risiko.ringkas });
  }

  // prestasi
  const semester = semesterBerjalan();
  const rekaman = await prisma.studentPointRecord.findMany({
    where: { kind: "PRESTASI" }, orderBy: { date: "desc" }, take: 200,
    select: { id: true, points: true, note: true, date: true, semester: true, sertifikatToken: true, achievementType: { select: { name: true } }, student: { select: { id: true, nis: true, user: { select: { name: true } }, class: { select: { name: true } } } } },
  });
  const perSiswa = new Map<string, { nama: string; kelas: string; poin: number; jumlah: number }>();
  for (const r of rekaman.filter(x => x.semester === semester)) {
    const a = perSiswa.get(r.student.id) ?? { nama: r.student.user.name, kelas: r.student.class?.name ?? "-", poin: 0, jumlah: 0 };
    a.poin += r.points; a.jumlah += 1;
    perSiswa.set(r.student.id, a);
  }
  return Response.json({
    semester,
    teratas: [...perSiswa.values()].sort((a, b) => b.poin - a.poin).slice(0, 10),
    daftar: rekaman.map(r => ({ id: r.id, jenis: r.achievementType?.name ?? "Prestasi", catatan: r.note, poin: r.points, tanggal: r.date, bersertifikat: !!r.sertifikatToken, nama: r.student.user.name, nis: r.student.nis, kelas: r.student.class?.name ?? "-" })),
  });
}
