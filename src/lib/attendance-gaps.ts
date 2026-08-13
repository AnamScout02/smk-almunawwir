import "server-only";
import { prisma } from "@/lib/prisma";

/** Hari sekolah = Senin–Sabtu (jadwal sekolah ini pakai 6 hari, lihat SchoolPeriod). Tidak ada
 * kalender hari libur nasional/cuti bersama di data (belum ada model utk itu), jadi ini
 * penyederhanaan yg disengaja — Minggu selalu dianggap bukan hari sekolah, hari lain dianggap
 * hari sekolah walau sebenarnya tanggal merah. */
export function isSchoolDay(date: Date): boolean {
  return date.getUTCDay() !== 0;
}

export interface MissingAttendanceClass {
  id: string;
  name: string;
  major: { name: string };
  homeroom: { user: { name: string } } | null;
}

/** Kelas (yang sudah py wali kelas & siswa aktif) yang BELUM ADA satupun data Attendance utk
 * tanggal tertentu — dipakai utk banner pengingat wali kelas & badge notifikasi admin/TAS "Kelas
 * Belum Absen". `classIds` opsional utk scope (wali kelas → kelas walinya sendiri saja; kosong =
 * cek semua kelas, dipakai admin/TAS). Kalau `date` bukan hari sekolah (Minggu), selalu balikin
 * array kosong — tidak ada yg perlu "belum absen" di hari libur. */
export async function getClassesMissingAttendance(date: Date, classIds?: string[]): Promise<MissingAttendanceClass[]> {
  if (!isSchoolDay(date)) return [];
  const dateFilter = { gte: date, lt: new Date(date.getTime() + 86400000) };

  const classes = await prisma.class.findMany({
    where: {
      ...(classIds ? { id: { in: classIds } } : {}),
      homeroomId: { not: null },
      students: { some: { studentStatus: "AKTIF" } },
    },
    select: {
      id: true, name: true,
      major: { select: { name: true } },
      homeroom: { select: { user: { select: { name: true } } } },
    },
    orderBy: [{ grade: "asc" }, { name: "asc" }],
  });

  const missing: MissingAttendanceClass[] = [];
  for (const c of classes) {
    const count = await prisma.attendance.count({
      where: { date: dateFilter, student: { classId: c.id, studentStatus: "AKTIF" } },
    });
    if (count === 0) missing.push(c);
  }
  return missing;
}
