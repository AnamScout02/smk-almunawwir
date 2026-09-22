import "server-only";
import { prisma } from "@/lib/prisma";

export interface NominatifRosterRow {
  id: string; name: string; className: string; majorName: string; gender: string; nis: string;
  enrollYear: number | null;
  birthPlace: string; birthDate: Date | null; address: string; parentName: string;
  previousSchool: string; ijazahNo: string; ijazahYear: string;
}

function bukuInduk(data: unknown, key: string): string {
  const v = (data as Record<string, unknown> | null)?.[key];
  return v === undefined || v === null || v === "" ? "" : String(v);
}
function ijazahYearOf(data: unknown): string {
  const raw = bukuInduk(data, "ijazahDate");
  if (!raw) return "";
  const d = new Date(raw);
  return isNaN(d.getTime()) ? "" : String(d.getFullYear());
}

/** Roster Kelas XII lengkap (semua field yang dipakai dokumen Nominatif) — SATU sumber dipakai
 * baik oleh halaman cetak Nominatif per jurusan (majorId diisi) MAUPUN tabel "Data Siswa Kelas
 * XII" di NominatifManager.tsx (majorId kosong = semua jurusan) — supaya keduanya konsisten,
 * termasuk field-field yang sering kosong (No Ijazah, dst) yang perlu kelihatan di tabel biar
 * bendahara/TU tahu data siapa yang perlu dilengkapi dulu sebelum dicetak resmi. Tahun aktif dari
 * Student live, tahun lampau dari StudentClassHistory (sama pola dgn nominatif-pagu.ts). */
export async function getNominatifRoster(year: { id: string; isActive: boolean }, majorId?: string): Promise<NominatifRosterRow[]> {
  if (year.isActive) {
    const students = await prisma.student.findMany({
      where: { studentStatus: "AKTIF", class: { grade: 12 }, ...(majorId ? { majorId } : {}) },
      include: { user: { select: { name: true } }, class: { select: { name: true } }, major: { select: { name: true } } },
      orderBy: { user: { name: "asc" } },
    });
    return students.map(s => ({
      id: s.id, name: s.user.name, className: s.class?.name ?? "—", majorName: s.major.name, gender: s.gender ?? "", nis: s.nis,
      enrollYear: s.enrollYear,
      birthPlace: s.birthPlace ?? "", birthDate: s.birthDate, address: s.address ?? "", parentName: s.parentName ?? "",
      previousSchool: s.previousSchool ?? "", ijazahNo: bukuInduk(s.bukuIndukData, "ijazahNo"), ijazahYear: ijazahYearOf(s.bukuIndukData),
    }));
  }

  const history = await prisma.studentClassHistory.findMany({
    where: { academicYearId: year.id, grade: 12, status: { in: ["AKTIF", "LULUS"] }, ...(majorId ? { student: { majorId } } : {}) },
    include: { student: { include: { user: { select: { name: true } } } } },
  });
  return history
    .map(h => ({
      id: h.student.id, name: h.student.user.name, className: h.className ?? "—", majorName: h.majorName ?? "—",
      gender: h.student.gender ?? "", nis: h.student.nis, enrollYear: h.student.enrollYear,
      birthPlace: h.student.birthPlace ?? "", birthDate: h.student.birthDate, address: h.student.address ?? "", parentName: h.student.parentName ?? "",
      previousSchool: h.student.previousSchool ?? "", ijazahNo: bukuInduk(h.student.bukuIndukData, "ijazahNo"), ijazahYear: ijazahYearOf(h.student.bukuIndukData),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "id"));
}
