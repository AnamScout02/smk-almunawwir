import "server-only";
import { prisma } from "@/lib/prisma";
import { filterDaftarUjian, kelasPeserta } from "@/lib/ujian-server";
import { hitungAnalisisButir } from "@/lib/analisis-butir";

/** REKAP ANALISIS BUTIR satu kegiatan ujian (5 Oktober 2026) — untuk Kurikulum & guru: daftar ujian beserta
 *  reliabilitasnya dan SEMUA butir bertanda "perlu revisi" dalam satu layar, supaya tidak perlu membuka
 *  tab Hasil ujian satu per satu. Hitungan dari `hitungAnalisisButir` — sama persis dengan tab Hasil.
 *  Cakupan = Daftar Ujian (`filterDaftarUjian`): guru hanya ujian yang ia buat/ampu, Admin/TAS/Wakakur semua. */
export type RingkasUjian = {
  id: string; judul: string; mapel: string; jenis: string; kelas: string;
  peserta: number; butir: number; perluRevisi: number;
  reliabilitas: { alpha: number; kategori: string } | null; alasanReliabilitas: string | null;
  rerata: number | null;
  revisi: { nomor: number; tipe: string; kesukaran: number | null; dayaBeda: number | null; alasan: string[]; cuplikan: string }[];
};

const polos = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim().slice(0, 140);

export async function rekapAnalisisKegiatan(session: { role: string; email: string }, kegiatanId: string): Promise<RingkasUjian[]> {
  const cakupan = await filterDaftarUjian(session);
  const exams = await prisma.exam.findMany({
    where: cakupan ? { kegiatanId, AND: [cakupan] } : { kegiatanId },
    orderBy: [{ subject: "asc" }, { title: "asc" }],
    select: { id: true, title: true, subject: true, jenis: true, classId: true, kelasIds: true },
  });
  const namaKelas = new Map((await prisma.class.findMany({
    where: { id: { in: [...new Set(exams.flatMap(e => kelasPeserta(e)))] } }, select: { id: true, name: true },
  })).map(k => [k.id, k.name]));

  const hasil: RingkasUjian[] = [];
  // Satu ujian satu kali muat — pengerjaan satu ujian bisa ratusan baris berisi jawaban; jangan dimuat sekaligus.
  for (const e of exams) {
    const [soal, attempts] = await Promise.all([
      prisma.examQuestion.findMany({ where: { examId: e.id }, orderBy: { order: "asc" },
        select: { id: true, order: true, tipe: true, kd: true, skor: true, opsi: true, kunci: true, pertanyaan: true } }),
      prisma.examAttempt.findMany({ where: { examId: e.id, submittedAt: { not: null } },
        select: { score: true, submittedAt: true, startedAt: true, pelanggaran: true, skorButir: true, answers: true, urutan: true, waktuSoal: true, ubahJawaban: true,
          student: { select: { id: true, nis: true, user: { select: { name: true } }, class: { select: { name: true } } } } } }),
    ]);
    const { analisis, statistik } = hitungAnalisisButir(soal, attempts);
    const teks = new Map(soal.map(q => [q.id, q.pertanyaan]));
    const revisi = analisis.filter(a => a.perluRevisi).map(a => ({
      nomor: a.nomor, tipe: a.tipe,
      kesukaran: a.kesukaran === null ? null : Math.round(a.kesukaran * 100) / 100,
      dayaBeda: a.dayaBeda === null ? null : Math.round(a.dayaBeda * 100) / 100,
      alasan: a.alasanRevisi, cuplikan: polos(teks.get(a.questionId) ?? ""),
    }));
    hasil.push({
      id: e.id, judul: e.title, mapel: e.subject, jenis: e.jenis,
      kelas: kelasPeserta(e).map(k => namaKelas.get(k) ?? "").filter(Boolean).sort().join(", "),
      peserta: statistik.selesai, butir: analisis.length, perluRevisi: revisi.length,
      reliabilitas: statistik.reliabilitas ? { alpha: statistik.reliabilitas.alpha, kategori: statistik.reliabilitas.kategori } : null,
      alasanReliabilitas: statistik.reliabilitasAlasan, rerata: statistik.rerata, revisi,
    });
  }
  return hasil;
}
