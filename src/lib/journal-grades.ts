import "server-only";
import { prisma } from "@/lib/prisma";

export interface JournalGradeAgg {
  studentId: string;
  subject: string;
  semester: string;
  avgPengetahuan: number | null;
  avgKeterampilan: number | null;
  avg: number | null;
  /** Materi jurnal dengan nilai (rata P/K) tertinggi & terendah siswa itu — bahan deskripsi capaian rapor. */
  materiTerbaik: string | null;
  materiTerendah: string | null;
}

/** Nilai "resmi" mapel sekarang dihitung dari rata-rata skor Pengetahuan/Keterampilan yang guru
 * mapel isi di Jurnal Mengajar tiap pertemuan (JournalEntry) — BUKAN lagi dari kategori
 * Tugas/Ulangan Harian/UTS/UAS yang dulu diinput terpisah lewat halaman "Input Nilai" (dihapus
 * total per keputusan user 2026-08-08: dianggap kerja dobel dgn Jurnal Mengajar, guru cukup isi
 * sekali di Jurnal). Fungsi ini dipakai bareng oleh Rapor Nilai siswa, Ekspor Nilai, dan
 * dashboard ringkasan Wakasek/Kepala Sekolah — SATU sumber kebenaran, bukan hitung ulang
 * masing2. TIDAK menyentuh Grade.type="DKN" (tetap manual, lihat /api/teacher/dkn) ataupun
 * Grade.type="Nilai PKL" (modul PKL tersendiri) — dua itu di luar cakupan perubahan ini sama
 * sekali, tetap pakai tabel Grade seperti biasa. */
export async function getJournalGradeAggregates(opts: {
  studentIds?: string[];
  classId?: string;
  teacherId?: string;
  semester?: string;
}): Promise<JournalGradeAgg[]> {
  const entries = await prisma.journalEntry.findMany({
    where: {
      ...(opts.studentIds ? { studentId: { in: opts.studentIds } } : {}),
      journal: {
        ...(opts.teacherId ? { teacherId: opts.teacherId } : {}),
        ...(opts.classId ? { classId: opts.classId } : {}),
        ...(opts.semester ? { semester: opts.semester } : {}),
      },
    },
    select: {
      studentId: true,
      scorePengetahuan: true,
      scoreKeterampilan: true,
      journal: { select: { subject: true, semester: true, materi: true } },
    },
  });

  const bucketKey = (studentId: string, subject: string, semester: string) => `${studentId}::${subject}::${semester}`;
  type Bucket = { studentId: string; subject: string; semester: string; p: number[]; k: number[]; materi: Map<string, number[]> };
  const buckets = new Map<string, Bucket>();
  for (const e of entries) {
    const k = bucketKey(e.studentId, e.journal.subject, e.journal.semester);
    const b: Bucket = buckets.get(k) ?? { studentId: e.studentId, subject: e.journal.subject, semester: e.journal.semester, p: [], k: [], materi: new Map() };
    if (e.scorePengetahuan !== null) b.p.push(e.scorePengetahuan);
    if (e.scoreKeterampilan !== null) b.k.push(e.scoreKeterampilan);
    const nilaiPertemuan = [e.scorePengetahuan, e.scoreKeterampilan].filter((v): v is number => v !== null);
    const materi = e.journal.materi?.trim();
    if (materi && nilaiPertemuan.length) {
      const daftar = b.materi.get(materi) ?? [];
      daftar.push(nilaiPertemuan.reduce((a, c) => a + c, 0) / nilaiPertemuan.length);
      b.materi.set(materi, daftar);
    }
    buckets.set(k, b);
  }

  const avg = (arr: number[]) => arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) / 100 : null;
  return [...buckets.values()].map(b => {
    const avgPengetahuan = avg(b.p);
    const avgKeterampilan = avg(b.k);
    const combined = [avgPengetahuan, avgKeterampilan].filter((v): v is number => v !== null);
    const perMateri = [...b.materi.entries()].map(([m, v]) => ({ m, n: v.reduce((a, c) => a + c, 0) / v.length }))
      .sort((x, y) => y.n - x.n);
    return {
      studentId: b.studentId, subject: b.subject, semester: b.semester,
      avgPengetahuan, avgKeterampilan,
      materiTerbaik: perMateri[0]?.m ?? null,
      materiTerendah: perMateri.length > 1 ? perMateri[perMateri.length - 1].m : null,
      avg: combined.length ? Math.round((combined.reduce((a, c) => a + c, 0) / combined.length) * 100) / 100 : null,
    };
  });
}
