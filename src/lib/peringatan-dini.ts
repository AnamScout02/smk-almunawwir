import "server-only";
import { prisma } from "@/lib/prisma";
import { kelasPeserta } from "@/lib/ujian-server";
import { bagianWib } from "@/lib/waktu-wib";

/** PERINGATAN DINI SISWA BERISIKO — skor gabungan dari data yang sudah ada di sistem. Dipakai Dashboard BK,
 * halaman Peringatan Dini wali kelas & admin, notifikasi alpha beruntun, dan ringkasan mingguan.
 *
 * Sinyal (jendela 30 hari kecuali poin = semester berjalan):
 *   alpha beruntun ≥3 hari tercatat (+3) · alpha ≥5 (+3) / ≥3 (+2) · kehadiran <75% (+2)
 *   Surat Peringatan 2+ (+3) / SP1 (+2) · ≥2 pelanggaran 30 hari (+1)
 *   nilai turun ≥10 poin (+2) · rata-rata nilai semester <75 (+1)
 *   ≥2 tugas bertenggat tidak dikumpulkan (+1) · ujian online berakhir tidak dikerjakan (+2)
 * Tingkat: skor ≥5 TINGGI, 3–4 SEDANG, 1–2 PANTAU. Ambang poin mengikuti Tata Tertib (lihat student-points.ts). */

export type TingkatRisiko = "TINGGI" | "SEDANG" | "PANTAU";

export interface BarisRisiko {
  studentId: string; userId: string; nis: string; nama: string; classId: string | null; kelas: string;
  skor: number; tingkat: TingkatRisiko; alasan: string[];
  alpha30: number; alphaBeruntun: number; persenHadir: number | null;
  poinBersih: number; levelPoin: string; pelanggaran30: number;
  rataNilai: number | null; nilaiTurun: number | null;
  tugasTerlewat: number; ujianTerlewat: number;
}

export interface CakupanData { hariAbsensi: number; nilai: number; tugasBertenggat: number; ujianBerakhir: number }

const HARI_MS = 86400_000;
const AMBANG_HADIR = 75;
const AMBANG_NILAI = 75;

export function semesterBerjalan(now = new Date()) {
  const { tahun: y, bulan } = bagianWib(now); // WIB, bukan jam server (UTC)
  return bulan >= 7 ? `Ganjil ${y}/${y + 1}` : `Genap ${y - 1}/${y}`;
}

/** Tingkat sanksi dari poin bersih semester berjalan — SATU sumber (dipakai juga panggilan orang tua otomatis). */
export function levelPoin(bersih: number) {
  if (bersih < 25) return "Aman";
  if (bersih <= 50) return "SP 1";
  if (bersih <= 75) return "SP 2";
  if (bersih <= 99) return "SP 3";
  return "Dikembalikan ke Orang Tua";
}

const rata = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Hitung risiko siswa AKTIF. `classIds` membatasi cakupan (wali kelas); kosong/undefined = semua kelas. */
export async function hitungRisikoSiswa(opsi: { classIds?: string[]; now?: Date } = {}) {
  const now = opsi.now ?? new Date();
  const sejak = new Date(now.getTime() - 30 * HARI_MS);
  const semester = semesterBerjalan(now);
  const filterKelas = opsi.classIds ? { classId: { in: opsi.classIds } } : { classId: { not: null } };

  const siswa = await prisma.student.findMany({
    where: { studentStatus: "AKTIF", ...filterKelas },
    select: {
      id: true, userId: true, nis: true, classId: true,
      user: { select: { name: true } },
      class: { select: { name: true } },
      attendance: { where: { date: { gte: sejak } }, select: { date: true, status: true }, orderBy: { date: "desc" } },
      pointRecords: { where: { semester }, select: { kind: true, points: true, date: true } },
      grades: { where: { semester }, select: { score: true, createdAt: true } },
      assignmentSubmissions: { select: { assignmentId: true } },
      examAttempts: { where: { submittedAt: { not: null } }, select: { examId: true } },
    },
  });
  const classIds = [...new Set(siswa.map(s => s.classId).filter((x): x is string => !!x))];

  const [tugas, ujian] = await Promise.all([
    prisma.assignment.findMany({
      where: { classId: { in: classIds }, dueDate: { gte: sejak, lt: now } },
      select: { id: true, classId: true },
    }),
    prisma.exam.findMany({
      // Hanya ujian REGULER — susulan/remedial pesertanya terbatas, bukan kewajiban seluruh kelas.
      where: { isPublished: true, jenis: "REGULER", endTime: { gte: sejak, lt: now }, title: { not: { startsWith: "UJI SISTEM" } } },
      select: { id: true, classId: true, kelasIds: true },
    }),
  ]);
  const tugasPerKelas = new Map<string, string[]>();
  for (const t of tugas) tugasPerKelas.set(t.classId, [...(tugasPerKelas.get(t.classId) ?? []), t.id]);
  const ujianPerKelas = new Map<string, string[]>();
  for (const e of ujian) for (const k of kelasPeserta(e)) ujianPerKelas.set(k, [...(ujianPerKelas.get(k) ?? []), e.id]);

  const baris: BarisRisiko[] = [];
  let hariAbsensi = 0, jumlahNilai = 0;
  const tanggalAbsensi = new Set<string>();

  for (const s of siswa) {
    const alasan: string[] = [];
    let skor = 0;

    // Kehadiran
    for (const a of s.attendance) tanggalAbsensi.add(a.date.toISOString().slice(0, 10));
    const alpha30 = s.attendance.filter(a => a.status === "ALPHA").length;
    let alphaBeruntun = 0;
    for (const a of s.attendance) { if (a.status === "ALPHA") alphaBeruntun++; else break; }
    const hadir = s.attendance.filter(a => a.status === "HADIR").length;
    const persenHadir = s.attendance.length ? Math.round((hadir / s.attendance.length) * 100) : null;
    if (alphaBeruntun >= 3) { skor += 3; alasan.push(`Alpha ${alphaBeruntun} hari berturut-turut`); }
    if (alpha30 >= 5) { skor += 3; alasan.push(`Alpha ${alpha30}× dalam 30 hari`); }
    else if (alpha30 >= 3) { skor += 2; alasan.push(`Alpha ${alpha30}× dalam 30 hari`); }
    if (persenHadir !== null && persenHadir < AMBANG_HADIR) { skor += 2; alasan.push(`Kehadiran ${persenHadir}%`); }

    // Kedisiplinan (poin semester berjalan)
    const total = (k: string) => s.pointRecords.filter(p => p.kind === k).reduce((a, p) => a + p.points, 0);
    const poinBersih = Math.max(0, total("PELANGGARAN") - total("PRESTASI") - total("REMISI"));
    const level = levelPoin(poinBersih);
    const pelanggaran30 = s.pointRecords.filter(p => p.kind === "PELANGGARAN" && p.date >= sejak).length;
    if (poinBersih > 50) { skor += 3; alasan.push(`${level} (${poinBersih} poin)`); }
    else if (poinBersih >= 25) { skor += 2; alasan.push(`${level} (${poinBersih} poin)`); }
    if (pelanggaran30 >= 2) { skor += 1; alasan.push(`${pelanggaran30} pelanggaran dalam 30 hari`); }

    // Nilai
    jumlahNilai += s.grades.length;
    const rataNilai = rata(s.grades.map(g => g.score));
    const baru = s.grades.filter(g => g.createdAt >= sejak).map(g => g.score);
    const lama = s.grades.filter(g => g.createdAt < sejak).map(g => g.score);
    const nilaiTurun = baru.length >= 3 && lama.length >= 3 ? Math.round(((rata(lama) ?? 0) - (rata(baru) ?? 0)) * 10) / 10 : null;
    if (nilaiTurun !== null && nilaiTurun >= 10) { skor += 2; alasan.push(`Nilai turun ${nilaiTurun} poin`); }
    if (rataNilai !== null && rataNilai < AMBANG_NILAI) { skor += 1; alasan.push(`Rata-rata nilai ${Math.round(rataNilai * 10) / 10}`); }

    // Tugas & ujian online
    const dikumpulkan = new Set(s.assignmentSubmissions.map(x => x.assignmentId));
    const tugasTerlewat = (s.classId ? tugasPerKelas.get(s.classId) ?? [] : []).filter(id => !dikumpulkan.has(id)).length;
    if (tugasTerlewat >= 2) { skor += 1; alasan.push(`${tugasTerlewat} tugas tidak dikumpulkan`); }
    const dikerjakan = new Set(s.examAttempts.map(x => x.examId));
    const ujianTerlewat = (s.classId ? ujianPerKelas.get(s.classId) ?? [] : []).filter(id => !dikerjakan.has(id)).length;
    if (ujianTerlewat >= 1) { skor += 2; alasan.push(`${ujianTerlewat} ujian online tidak dikerjakan`); }

    if (skor === 0) continue;
    baris.push({
      studentId: s.id, userId: s.userId, nis: s.nis, nama: s.user.name, classId: s.classId, kelas: s.class?.name ?? "—",
      skor, tingkat: skor >= 5 ? "TINGGI" : skor >= 3 ? "SEDANG" : "PANTAU", alasan,
      alpha30, alphaBeruntun, persenHadir, poinBersih, levelPoin: level, pelanggaran30,
      rataNilai: rataNilai === null ? null : Math.round(rataNilai * 10) / 10, nilaiTurun, tugasTerlewat, ujianTerlewat,
    });
  }
  hariAbsensi = tanggalAbsensi.size;

  baris.sort((a, b) => b.skor - a.skor || a.kelas.localeCompare(b.kelas) || a.nama.localeCompare(b.nama));
  const cakupan: CakupanData = { hariAbsensi, nilai: jumlahNilai, tugasBertenggat: tugas.length, ujianBerakhir: ujian.length };
  return {
    semester, baris, cakupan, jumlahSiswa: siswa.length,
    ringkas: {
      tinggi: baris.filter(b => b.tingkat === "TINGGI").length,
      sedang: baris.filter(b => b.tingkat === "SEDANG").length,
      pantau: baris.filter(b => b.tingkat === "PANTAU").length,
    },
  };
}

/** Alpha berturut-turut (hari tercatat terakhir) untuk beberapa siswa — dipakai kait notifikasi absensi. */
export async function alphaBeruntun(studentIds: string[]) {
  const catatan = await prisma.attendance.findMany({
    where: { studentId: { in: [...new Set(studentIds)] }, date: { gte: new Date(Date.now() - 30 * HARI_MS) } },
    select: { studentId: true, status: true, date: true },
    orderBy: { date: "desc" },
  });
  const hasil = new Map<string, number>();
  const selesai = new Set<string>();
  for (const c of catatan) {
    if (selesai.has(c.studentId)) continue;
    if (c.status === "ALPHA") hasil.set(c.studentId, (hasil.get(c.studentId) ?? 0) + 1);
    else selesai.add(c.studentId);
  }
  return hasil;
}

/** userId pemegang jabatan Guru BK / Wakil Kepala Kesiswaan — guru (TeacherJabatan) maupun staf (StaffJabatan). */
export async function userKesiswaanBk() {
  const jabatan = await prisma.jabatan.findMany({
    where: { name: { in: ["Guru BK", "Wakil Kepala Kesiswaan"] } },
    select: { teachers: { select: { teacher: { select: { userId: true } } } }, staff: { select: { userId: true } } },
  });
  return [...new Set(jabatan.flatMap(j => [...j.teachers.map(t => t.teacher.userId), ...j.staff.map(x => x.userId)]))];
}
