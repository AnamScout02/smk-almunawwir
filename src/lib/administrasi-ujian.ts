import "server-only";
import { prisma } from "@/lib/prisma";
import { bolehAturUjian } from "@/lib/kegiatan-ujian-server";
import { teacherIdDariSesi, kelasPeserta } from "@/lib/ujian-server";

/** Pekerjaan bersama halaman cetak Administrasi Ujian (kartu peserta, daftar hadir, berita acara). */

export const ZONA = "Asia/Jakarta";

/** Kelas yang boleh dicetak kartunya: Admin/TAS/Wakil Kepala Kurikulum semua kelas; guru hanya
 * kelas yang ia ampu (Penugasan Mengajar) atau walikan. */
export async function bolehCetakKelas(session: { role: string; email: string }, classId: string): Promise<boolean> {
  if (session.role === "ADMIN" || session.role === "TAS" || (await bolehAturUjian(session))) return true;
  const teacherId = await teacherIdDariSesi(session);
  if (!teacherId) return false;
  const [ampu, wali] = await Promise.all([
    prisma.teachingAssignment.count({ where: { teacherId, classId } }),
    prisma.class.count({ where: { id: classId, homeroomId: teacherId } }),
  ]);
  return ampu + wali > 0;
}

/** Siswa aktif per kelas peserta sebuah ujian (urut nama), plus pengerjaannya kalau ada. */
export async function pesertaPerKelas(exam: { id: string; classId: string; kelasIds?: string[] | null }, hanyaKelas?: string | null) {
  const ids = kelasPeserta(exam).filter(k => !hanyaKelas || k === hanyaKelas);
  const [kelas, siswa, attempts] = await Promise.all([
    prisma.class.findMany({ where: { id: { in: ids } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.student.findMany({
      where: { classId: { in: ids }, studentStatus: "AKTIF" },
      select: { id: true, nis: true, classId: true, user: { select: { name: true } } },
      orderBy: { user: { name: "asc" } },
    }),
    prisma.examAttempt.findMany({
      where: { examId: exam.id },
      select: { studentId: true, startedAt: true, submittedAt: true, pelanggaran: true, terkunci: true },
    }),
  ]);
  const perSiswa = new Map(attempts.map(a => [a.studentId, a]));
  return kelas.map(k => ({
    kelas: k,
    siswa: siswa.filter(s => s.classId === k.id).map(s => {
      const a = perSiswa.get(s.id);
      return {
        id: s.id, nis: s.nis, nama: s.user.name,
        hadir: !!a, mulai: a?.startedAt ?? null, selesai: a?.submittedAt ?? null,
        pelanggaran: Array.isArray(a?.pelanggaran) ? (a!.pelanggaran as unknown[]).length : 0,
      };
    }),
  }));
}

const SATUAN = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh", "sebelas"];
/** Terbilang bahasa Indonesia untuk 0–9999 (cukup untuk tanggal & tahun di berita acara). */
export function terbilang(n: number): string {
  if (n < 12) return SATUAN[n] || "nol";
  if (n < 20) return `${terbilang(n - 10)} belas`;
  if (n < 100) return `${terbilang(Math.floor(n / 10))} puluh${n % 10 ? " " + terbilang(n % 10) : ""}`;
  if (n < 200) return `seratus${n % 100 ? " " + terbilang(n % 100) : ""}`;
  if (n < 1000) return `${terbilang(Math.floor(n / 100))} ratus${n % 100 ? " " + terbilang(n % 100) : ""}`;
  if (n < 2000) return `seribu${n % 1000 ? " " + terbilang(n % 1000) : ""}`;
  return `${terbilang(Math.floor(n / 1000))} ribu${n % 1000 ? " " + terbilang(n % 1000) : ""}`;
}

export const jam = (d: Date) => d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: ZONA });
export const hariTanggal = (d: Date) => d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: ZONA });
const tanggalWib = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: ZONA });
const tanggalPendek = (d: Date) => d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: ZONA });
/** "07.30 – 09.00", atau "15 Sep 2026 07.30 – 16 Sep 2026 21.00" bila ujian dibuka lintas hari (jam tutup saja
 * di hari lain terlihat seperti ujian 2 jam, padahal jendelanya berhari-hari). */
export function rentangWaktu(mulai: Date, selesai: Date): { teks: string; lintasHari: boolean } {
  if (tanggalWib(mulai) === tanggalWib(selesai)) return { teks: `${jam(mulai)} – ${jam(selesai)}`, lintasHari: false };
  return { teks: `${tanggalPendek(mulai)} ${jam(mulai)} – ${tanggalPendek(selesai)} ${jam(selesai)}`, lintasHari: true };
}
