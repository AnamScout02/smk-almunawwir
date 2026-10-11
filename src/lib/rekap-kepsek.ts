import "server-only";
import { prisma } from "@/lib/prisma";
import { susunLaporanBulanan } from "@/lib/laporan-bulanan-tu";
import { SUMBER_TURUNAN } from "@/lib/presensi-sumber";

/** REKAP BULANAN KEPALA SEKOLAH (11 Okt 2026) — satu lembar per bulan dari data yang SUDAH ADA, tanpa isian baru:
 *   - kehadiran pegawai  ← Presensi Pegawai (`StaffAttendance`);
 *   - masuk kelas        ← catatan guru piket per jam (`TeacherScheduleAttendance`);
 *   - jurnal mengajar    ← `TeachingJournal`, dihitung per PERTEMUAN (tanggal × kelas × mapel), bukan per baris materi (#160);
 *   - kehadiran siswa    ← absensi resmi (`Attendance`);
 *   - surat              ← angka yang SAMA dengan Laporan Bulanan TU (`susunLaporanBulanan`) — bukan hitungan kedua.
 *  Bulan dihitung menurut tanggal kalender (kolom tanggal disimpan tengah malam UTC dari tanggal WIB). */
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : null);

export async function susunRekapKepsek(bulan: string) {
  const [th, bl] = bulan.split("-").map(Number);
  const dari = new Date(Date.UTC(th, bl - 1, 1)), sampai = new Date(Date.UTC(th, bl, 1));
  const rentang = { gte: dari, lt: sampai };
  const [presensi, piket, jurnal, guruBerjadwal, absensi, izin, poin, tu] = await Promise.all([
    prisma.staffAttendance.findMany({ where: { tanggal: rentang, user: { role: { in: ["TEACHER", "TAS"] } } }, select: { userId: true, status: true, sumber: true, user: { select: { name: true } } } }).catch(() => []),
    prisma.teacherScheduleAttendance.findMany({ where: { date: rentang }, select: { status: true, hasTugas: true, schedule: { select: { teacher: { select: { user: { select: { name: true } } } } } } } }).catch(() => []),
    prisma.teachingJournal.findMany({ where: { date: rentang }, select: { teacherId: true, classId: true, subject: true, date: true } }).catch(() => []),
    prisma.teacher.findMany({ where: { schedules: { some: { scheduleType: "BLOK" } } }, select: { id: true, user: { select: { name: true } } } }).catch(() => []),
    prisma.attendance.findMany({ where: { date: rentang, student: { studentStatus: "AKTIF" } }, select: { status: true, student: { select: { class: { select: { name: true, grade: true } } } } } }).catch(() => []),
    prisma.izinSiswa.groupBy({ by: ["status"], where: { tanggalMulai: rentang }, _count: { _all: true } }).catch(() => []),
    prisma.studentPointRecord.groupBy({ by: ["kind"], where: { date: rentang }, _count: { _all: true }, _sum: { points: true } }).catch(() => []),
    susunLaporanBulanan(bulan).catch(() => null),
  ]);

  // Kehadiran pegawai
  const n = (s: string) => presensi.filter(p => p.status === s).length;
  const perOrang = new Map<string, { nama: string; alpha: number; izin: number; hadir: number }>();
  for (const p of presensi) {
    const x = perOrang.get(p.userId) ?? { nama: p.user.name, alpha: 0, izin: 0, hadir: 0 };
    if (p.status === "ALPHA") x.alpha++; else if (p.status === "HADIR") x.hadir++; else x.izin++;
    perOrang.set(p.userId, x);
  }
  // Masuk kelas (piket)
  const k = (s: string) => piket.filter(p => p.status === s).length;
  const tidakMasuk = piket.filter(p => ["IZIN", "SAKIT", "ALPHA"].includes(p.status));
  const kosongPerGuru = new Map<string, number>();
  for (const p of tidakMasuk) { const nm = p.schedule.teacher?.user.name ?? "—"; kosongPerGuru.set(nm, (kosongPerGuru.get(nm) ?? 0) + 1); }
  // Jurnal per pertemuan
  const pertemuan = new Set(jurnal.map(j => `${j.teacherId}|${j.classId}|${j.subject}|${j.date.toISOString().slice(0, 10)}`));
  const pengisi = new Set(jurnal.map(j => j.teacherId));
  // Kehadiran siswa
  const a = (s: string) => absensi.filter(x => x.status === s).length;
  const perTingkat = [10, 11, 12].map(g => {
    const d = absensi.filter(x => x.student.class?.grade === g);
    return { tingkat: g === 10 ? "X" : g === 11 ? "XI" : "XII", catatan: d.length, persen: pct(d.filter(x => x.status === "HADIR").length, d.length), alpha: d.filter(x => x.status === "ALPHA").length };
  });
  const alphaKelas = new Map<string, number>();
  for (const x of absensi) if (x.status === "ALPHA") { const nm = x.student.class?.name ?? "—"; alphaKelas.set(nm, (alphaKelas.get(nm) ?? 0) + 1); }
  const urut = (m: Map<string, number>, maks: number) => [...m.entries()].sort((x, y) => y[1] - x[1]).slice(0, maks);

  return {
    bulan,
    pegawai: {
      catatan: presensi.length, orang: perOrang.size, hadir: n("HADIR"), izin: n("IZIN"), sakit: n("SAKIT"), dinas: n("DINAS_LUAR"), cuti: n("CUTI"), alpha: n("ALPHA"),
      persen: pct(n("HADIR"), presensi.length), turunan: presensi.filter(p => p.status === "HADIR" && SUMBER_TURUNAN.includes(p.sumber ?? "")).length,
      alphaTerbanyak: [...perOrang.values()].filter(x => x.alpha > 0).sort((x, y) => y.alpha - x.alpha).slice(0, 8).map(x => [x.nama, x.alpha] as [string, number]),
    },
    kelas: {
      dicatat: piket.length, hadir: k("HADIR"), terlambat: k("TERLAMBAT"), tidakMasuk: tidakMasuk.length, persen: pct(k("HADIR") + k("TERLAMBAT"), piket.length),
      adaTugas: tidakMasuk.filter(p => p.hasTugas === true).length, tanpaTugas: tidakMasuk.filter(p => p.hasTugas !== true).length,
      kosongTerbanyak: urut(kosongPerGuru, 8),
    },
    jurnal: {
      pertemuan: pertemuan.size, guruMengisi: pengisi.size, guruBerjadwal: guruBerjadwal.length,
      belumMengisi: guruBerjadwal.filter(g => !pengisi.has(g.id)).map(g => g.user.name).sort(),
    },
    siswa: {
      catatan: absensi.length, hadir: a("HADIR"), izin: a("IZIN"), sakit: a("SAKIT"), alpha: a("ALPHA"), persen: pct(a("HADIR"), absensi.length),
      perTingkat, alphaKelas: urut(alphaKelas, 8),
      izinDiajukan: izin.reduce((s, x) => s + x._count._all, 0), izinMenunggu: izin.find(x => x.status === "MENUNGGU")?._count._all ?? 0,
      pelanggaran: poin.find(x => x.kind === "PELANGGARAN")?._count._all ?? 0, prestasi: poin.find(x => x.kind === "PRESTASI")?._count._all ?? 0,
    },
    surat: tu?.surat ?? null,
  };
}
export type RekapKepsek = Awaited<ReturnType<typeof susunRekapKepsek>>;
