import "server-only";
import { prisma } from "@/lib/prisma";
import { getJournalGradeAggregates } from "@/lib/journal-grades";
import { petaKkm } from "@/lib/kkm";
import { deskripsiCapaian, predikat, type Predikat } from "@/lib/deskripsi-capaian";
import { rentangSemester } from "@/lib/rapor-verifikasi";

export interface BarisRapor {
  subject: string; pengetahuan: number | null; keterampilan: number | null; avg: number | null;
  kkm: number; predikat: Predikat | null; deskripsi: string | null;
}
export interface Kehadiran { HADIR: number; IZIN: number; SAKIT: number; ALPHA: number; total: number; persen: number | null }
export interface SemesterRapor {
  sem: string; disahkan: boolean; dikunci: boolean; rows: BarisRapor[]; semAvg: number | null; kehadiran: Kehadiran | null;
  catatanWali: string | null;
  /** Nilai ekstrakurikuler semester itu (17 Sep 2026) — diisi pembina di menu Nilai Ekstrakurikuler. */
  ekstra: { nama: string; predikat: string; keterangan: string | null }[];
}

const hitungKehadiran = (daftar: { status: string }[]): Kehadiran => {
  const n = (s: string) => daftar.filter(a => a.status === s).length;
  const total = daftar.length;
  return { HADIR: n("HADIR"), IZIN: n("IZIN"), SAKIT: n("SAKIT"), ALPHA: n("ALPHA"), total, persen: total ? Math.round((n("HADIR") / total) * 100) : null };
};

/** Isi rapor satu siswa per semester: nilai dari Jurnal Mengajar, KKM per mapel, predikat & deskripsi capaian otomatis,
 * status kunci/pengesahan, dan kehadiran resmi (tabel Attendance) dalam rentang semester itu. Dipakai rapor Siswa & Orang Tua. */
export async function susunRaporSiswa(s: { id: string; classId: string | null; majorId: string | null; grade: number | null }): Promise<SemesterRapor[]> {
  const [aggregates, kkm] = await Promise.all([
    getJournalGradeAggregates({ studentIds: [s.id] }),
    petaKkm({ grade: s.grade, majorId: s.majorId }),
  ]);
  const semesters = [...new Set(aggregates.map(g => g.semester))].sort();
  if (!semesters.length) return [];
  const [approvals, kunci, absensi, catatan, ekstra, ekskul] = await Promise.all([
    s.classId ? prisma.raporApproval.findMany({ where: { classId: s.classId, semester: { in: semesters } }, select: { semester: true } }) : [],
    s.classId ? prisma.raporKunci.findMany({ where: { classId: s.classId, semester: { in: semesters } }, select: { semester: true } }) : [],
    prisma.attendance.findMany({ where: { studentId: s.id }, select: { date: true, status: true } }),
    prisma.catatanWaliKelas.findMany({ where: { studentId: s.id, semester: { in: semesters } }, select: { semester: true, catatan: true } }),
    prisma.nilaiEkstra.findMany({ where: { studentId: s.id, semester: { in: semesters } }, select: { semester: true, predikat: true, keterangan: true, extracurricularId: true } }),
    prisma.extracurricular.findMany({ select: { id: true, name: true } }),
  ]);
  const namaEkskul = new Map(ekskul.map(e => [e.id, e.name]));
  const disahkan = new Set(approvals.map(a => a.semester));
  const dikunci = new Set(kunci.map(k => k.semester));

  return semesters.map(sem => {
    const rows: BarisRapor[] = aggregates.filter(g => g.semester === sem)
      .sort((a, b) => a.subject.localeCompare(b.subject))
      .map(g => {
        const k = kkm.kkmUntuk(g.subject);
        return {
          subject: g.subject, pengetahuan: g.avgPengetahuan, keterampilan: g.avgKeterampilan, avg: g.avg, kkm: k,
          predikat: g.avg === null ? null : predikat(g.avg, k),
          deskripsi: g.avg === null ? null : deskripsiCapaian({ mapel: g.subject, nilai: g.avg, kkm: k, materiTerbaik: g.materiTerbaik, materiTerendah: g.materiTerendah }),
        };
      });
    const bernilai = rows.filter(r => r.avg !== null);
    const r = rentangSemester(sem);
    return {
      sem, disahkan: disahkan.has(sem), dikunci: dikunci.has(sem), rows,
      semAvg: bernilai.length ? bernilai.reduce((a, x) => a + (x.avg ?? 0), 0) / bernilai.length : null,
      kehadiran: r ? hitungKehadiran(absensi.filter(a => a.date >= r.mulai && a.date < r.akhir)) : null,
      catatanWali: catatan.find(c => c.semester === sem)?.catatan ?? null,
      ekstra: ekstra.filter(e => e.semester === sem).map(e => ({ nama: namaEkskul.get(e.extracurricularId) ?? "Ekstrakurikuler", predikat: e.predikat, keterangan: e.keterangan })).sort((a, b) => a.nama.localeCompare(b.nama)),
    };
  });
}
