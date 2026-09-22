import "server-only";
import { prisma } from "@/lib/prisma";

export interface YearRef { id: string; isActive: boolean }

/** enrollYear semua siswa Kelas XII (jurusan+tahun ajaran tertentu) — tahun aktif dari Student
 * live, tahun lampau dari StudentClassHistory (join balik ke Student.enrollYear, field ini
 * stabil/tidak berubah walau siswa pindah kelas). Dipakai computeAutoPagu di bawah. */
export async function getKelasXIIEnrollYears(majorId: string, majorName: string, year: YearRef): Promise<(number | null)[]> {
  if (year.isActive) {
    const rows = await prisma.student.findMany({
      where: { majorId, studentStatus: "AKTIF", class: { grade: 12 } }, select: { enrollYear: true },
    });
    return rows.map(r => r.enrollYear);
  }
  const rows = await prisma.studentClassHistory.findMany({
    where: { academicYearId: year.id, grade: 12, majorName, status: { in: ["AKTIF", "LULUS"] } },
    select: { student: { select: { enrollYear: true } } },
  });
  return rows.map(r => r.student.enrollYear);
}

/** Pagu OTOMATIS (keputusan eksplisit user 2026-09-11, MEMBALIK desain awal yang manual murni):
 * "jumlah seluruh siswa di jurusan tersebut di angkatan tersebut, beserta yang mutasi" — bukan
 * target PPDB sebelum pendaftaran seperti arti "pagu" biasanya. Caranya: cari tahun masuk
 * (enrollYear) yang PALING SERING muncul di antara siswa Kelas XII jurusan ini sekarang (itulah
 * "angkatan"-nya), lalu hitung SEMUA siswa jurusan itu dengan enrollYear yang sama — SENGAJA
 * TIDAK memfilter studentStatus (AKTIF saja) supaya yang sudah KELUAR/PINDAH (mutasi) tetap
 * terhitung, sesuai definisi user. Override manual tetap didukung (nominatif.pagu setting) untuk
 * kasus data enrollYear siswa lama belum lengkap — dipakai sbg pengganti, bukan tambahan.
 *
 * Hasil dibulatkan KE ATAS ke kelipatan 10 (keputusan eksplisit user 2026-09-12: "karena itu
 * ukuran tertinggi buat otomatis saja jadi pembulatan nilai terbesar ... misal 94 jadi 100") —
 * Pagu dimaksudkan sbg angka kuota yang rapi (selalu >= jumlah siswa sungguhan), bukan angka
 * mentah apa adanya. Dibulatkan di SINI (satu tempat) supaya konsisten di mana pun dipakai
 * (panel Ringkasan per Jurusan di NominatifManager MAUPUN cetak Rekap Peserta Didik). */
export async function computeAutoPagu(majorId: string, kelasXIIEnrollYears: (number | null)[]): Promise<number> {
  const known = kelasXIIEnrollYears.filter((y): y is number => y !== null);
  if (known.length === 0) return 0;
  const freq = new Map<number, number>();
  for (const y of known) freq.set(y, (freq.get(y) ?? 0) + 1);
  const modalYear = [...freq.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const actual = await prisma.student.count({ where: { majorId, enrollYear: modalYear } });
  return Math.ceil(actual / 10) * 10;
}
