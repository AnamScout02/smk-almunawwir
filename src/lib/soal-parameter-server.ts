import "server-only";
import { prisma } from "@/lib/prisma";
import { varSiswa, type VarSiswa } from "@/lib/soal-parameter";

/** Nilai variabel SOAL BERPARAMETER untuk sejumlah siswa pada satu ujian (src/lib/soal-parameter.ts). {ABSEN} = urutan
 * nama siswa AKTIF di kelasnya — cara hitung yang sama dengan nomor peserta ujian (`pesertaKegiatan`), jadi angkanya cocok
 * dengan kartu peserta. Dipanggil HANYA bila ujian memang memuat parameter. */
export async function variabelSiswaUjian(examId: string, studentIds: string[]): Promise<Map<string, VarSiswa>> {
  const hasil = new Map<string, VarSiswa>();
  if (!studentIds.length) return hasil;
  const siswa = await prisma.student.findMany({ where: { id: { in: studentIds } }, select: { id: true, nis: true, classId: true } });
  const kelasIds = [...new Set(siswa.map(s => s.classId).filter((x): x is string => !!x))];
  const roster = await prisma.student.findMany({
    where: { classId: { in: kelasIds }, studentStatus: "AKTIF" },
    orderBy: { user: { name: "asc" } }, select: { id: true, classId: true },
  });
  const absen = new Map<string, number>();
  const hitung = new Map<string, number>();
  for (const r of roster) {
    const n = (hitung.get(r.classId ?? "") ?? 0) + 1;
    hitung.set(r.classId ?? "", n);
    absen.set(r.id, n);
  }
  for (const s of siswa) hasil.set(s.id, varSiswa({ absen: absen.get(s.id) ?? 0, nis: s.nis, benih: `${examId}:${s.id}` }));
  return hasil;
}
