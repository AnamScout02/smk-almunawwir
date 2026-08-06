import "server-only";
import { prisma } from "@/lib/prisma";
import { getWeekTypeForDate } from "@/lib/schedule-week.server";
import { weekTypesOverlap } from "@/lib/schedule-week";
import { groupConsecutiveSchedules } from "@/lib/schedule-grouping";
import { getDisciplinePointConfig, computeDisciplineScoreForUser, getMonthWindow } from "@/lib/discipline-points";
import { getJabatanNames } from "@/lib/jabatan-guard";

// Jabatan struktural yang sudah py KPI sendiri — dicek LEBIH DULU daripada Wali Kelas/Guru, karena
// ini tanggung jawab lebih senior/berbeda. Kalau seseorang kebetulan pemegang 2 jabatan sekaligus,
// KPI yang match PERTAMA di map ini yang dipakai (bukan digabung — sama prinsipnya dgn Wali Kelas
// yang juga tidak digabung dgn Guru, supaya `computeFinalScore` tetap 1 jabatanName = 1 hasil).
// Key = nama jabatan PERSIS seperti di tabel Jabatan/assertJabatan, value = jabatanName KPI yang
// dipakai (beberapa nama jabatan asli dipetakan ke SATU KPI yang sama, mis. 3 varian Bendahara).
const STRUCTURAL_JABATAN_MAP: Record<string, string> = {
  "Wakil Kepala Kurikulum": "Wakil Kepala Kurikulum",
  "Wakil Kepala Kesiswaan": "Wakil Kepala Kesiswaan",
  "Wakil Kepala Humas": "Wakil Kepala Humas",
  "Wakil Kepala Sarana Prasarana": "Wakil Kepala Sarana Prasarana",
  "Guru BK": "Guru BK",
  "Koordinator Perpustakaan": "Pustakawan",
  "Tim Perpustakaan": "Pustakawan",
  "Kepala Laboratorium": "Laboran",
  "Kepala Kompetensi Keahlian AK": "Kaprogli",
  "Kepala Kompetensi Keahlian ATU": "Kaprogli",
  "Kepala Kompetensi Keahlian DKV": "Kaprogli",
  "Kepala Kompetensi Keahlian DPIB": "Kaprogli",
  "Kepala Kompetensi Keahlian TKJ": "Kaprogli",
  "Kepala UKS": "Kepala UKS",
  "Koordinator Ekstrakurikuler": "Koordinator Ekstrakurikuler",
  "Koordinator BKK": "Koordinator BKK",
  "Koordinator Business Center": "Koordinator Business Center",
  "Koordinator Tim Branding & Publikasi": "Koordinator Branding & Publikasi",
  "Tim Branding & Publikasi": "Koordinator Branding & Publikasi",
  "Pembina OSIS": "Pembina OSIS",
  "Pembina Pramuka": "Pembina Pramuka",
  "Pengelola Jaringan Sekolah": "Pengelola Jaringan Sekolah",
  "Security": "Security",
  "Kebersihan": "Kebersihan",
  "Tenaga Administrasi Sekolah": "Tenaga Administrasi Sekolah",
  "Kepala Tenaga Administrasi Sekolah": "Tenaga Administrasi Sekolah",
  "Operator Sekolah": "Operator Sekolah",
  "Bendahara Sekolah": "Bendahara",
  "Bendahara BOS": "Bendahara",
  "Bendahara BPOPP": "Bendahara",
};

const DAYS = ["MINGGU", "SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];

export interface KpiBreakdownItem {
  indicatorId: string;
  name: string;
  weight: number;
  source: string;
  score: number; // 0-100, pencapaian indikator itu sendiri (belum dikali bobot)
}

/** Indikator AUTO_JURNAL — expected = jumlah blok jam mengajar (semua kelas/tingkat, TIDAK
 * dibatasi X/XI seperti Kedisiplinan, karena jurnal berlaku utk semua jenjang yang diampu guru
 * itu) dalam periode; actual = ada/tidaknya baris TeachingJournal utk kombinasi kelas+mapel+
 * tanggal blok itu. */
async function computeJurnalScore(teacherId: string, dates: Date[]): Promise<number> {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const nowHHMM = now.toTimeString().slice(0, 5);

  let expected = 0, actual = 0;
  for (const date of dates) {
    const dateStr = date.toISOString().slice(0, 10);
    if (dateStr > todayStr) continue;
    const day = DAYS[date.getDay()];
    const weekType = await getWeekTypeForDate(date);
    const nextDay = new Date(date.getTime() + 86400000);

    const schedules = await prisma.schedule.findMany({
      where: { day, scheduleType: "BLOK", teacherId },
      orderBy: { startTime: "asc" },
    });
    const relevant = schedules
      .filter(s => weekTypesOverlap(s.weekType, weekType))
      .filter(s => dateStr < todayStr || s.startTime <= nowHHMM);
    if (relevant.length === 0) continue;

    const blocks = groupConsecutiveSchedules(relevant, s => `${s.classId}|${s.subject}`);
    for (const { first } of blocks) {
      expected += 1;
      const exists = await prisma.teachingJournal.findFirst({
        where: { teacherId, classId: first.classId, subject: first.subject, date: { gte: date, lt: nextDay } },
        select: { id: true },
      });
      if (exists) actual += 1;
    }
  }
  return expected > 0 ? Math.min(100, (actual / expected) * 100) : 0;
}

/** Indikator AUTO_RPP — expected = jumlah mapel BERBEDA yang diampu guru itu (dari
 * TeachingAssignment); actual = jumlah mapel yang sudah punya minimal 1 RPP di Bank RPP
 * (LessonPlan). Fase 1 SENGAJA belum difilter per-semester (RPP biasa disiapkan sekali per
 * semester, bukan bulanan) — disederhanakan dulu, bisa diperhalus di fase berikutnya. */
async function computeRppScore(teacherId: string): Promise<number> {
  const assignments = await prisma.teachingAssignment.findMany({
    where: { teacherId }, select: { subjectId: true }, distinct: ["subjectId"],
  });
  if (assignments.length === 0) return 0;
  const lessonPlans = await prisma.lessonPlan.findMany({
    where: { teacherId, subjectId: { in: assignments.map(a => a.subjectId) } },
    select: { subjectId: true }, distinct: ["subjectId"],
  });
  return Math.min(100, (lessonPlans.length / assignments.length) * 100);
}

/** Daftar indikator KPI aktif utk suatu jabatan (urut sesuai `order`). */
export async function getIndicatorsForJabatan(jabatanName: string) {
  return prisma.kpiIndicator.findMany({ where: { jabatanName, active: true }, orderBy: { order: "asc" } });
}

/** Kebalikan `STRUCTURAL_JABATAN_MAP` — nama jabatan ASLI (persis di tabel Jabatan) mana saja yang
 * mengarah ke satu jabatanName KPI (bisa lebih dari 1, mis. "Bendahara" ← 3 varian Bendahara).
 * Dipakai `/api/kpi/leaderboard` utk query User yang benar (via TeacherJabatan/StaffJabatan). */
export function getRawJabatanNamesFor(mappedName: string): string[] {
  return Object.entries(STRUCTURAL_JABATAN_MAP).filter(([, v]) => v === mappedName).map(([k]) => k);
}

// Rute antrean verifikasi KpiSubmission — jabatanName KPI si PENGAJU dipetakan ke SATU Wakasek yang
// berwenang meninjau (bukan keenam-enamnya sekaligus). Kepala Sekolah & ADMIN SENGAJA tidak masuk
// peta ini — mereka selalu lolos lihat/approve SEMUA jabatan (pengawasan penuh), diperlakukan
// terpisah di `getKpiReviewScope`, bukan lewat peta ini. Dikonfirmasi user (Agustus 2026): Koord.
// BKK → Humas (bukan Kesiswaan), Laboran → Sarpras (bukan Kurikulum) — beda dari asumsi awal.
const KPI_SUPERVISOR_MAP: Record<string, string> = {
  "GURU": "Wakil Kepala Kurikulum",
  "WALI KELAS": "Wakil Kepala Kurikulum",
  "Pustakawan": "Wakil Kepala Kurikulum",
  "Kaprogli": "Wakil Kepala Kurikulum",
  "Guru BK": "Wakil Kepala Kesiswaan",
  "Kepala UKS": "Wakil Kepala Kesiswaan",
  "Koordinator Ekstrakurikuler": "Wakil Kepala Kesiswaan",
  "Pembina OSIS": "Wakil Kepala Kesiswaan",
  "Pembina Pramuka": "Wakil Kepala Kesiswaan",
  "Koordinator Branding & Publikasi": "Wakil Kepala Humas",
  "Koordinator Business Center": "Wakil Kepala Humas",
  "Koordinator BKK": "Wakil Kepala Humas",
  "Laboran": "Wakil Kepala Sarana Prasarana",
  "Pengelola Jaringan Sekolah": "Wakil Kepala Sarana Prasarana",
  "Security": "Wakil Kepala Sarana Prasarana",
  "Kebersihan": "Wakil Kepala Sarana Prasarana",
  "Tenaga Administrasi Sekolah": "Wakil Kepala Bidang Penjamin Mutu",
  "Operator Sekolah": "Wakil Kepala Bidang Penjamin Mutu",
  "Bendahara": "Wakil Kepala Bidang Penjamin Mutu",
};

/** jabatanName KPI apa saja yang jadi tanggung jawab review satu Wakasek tertentu. */
export function getKpiJabatanNamesSupervisedBy(supervisorJabatan: string): string[] {
  return Object.entries(KPI_SUPERVISOR_MAP).filter(([, v]) => v === supervisorJabatan).map(([k]) => k);
}

/** Tentukan jabatanName KPI seorang User — dipakai `/api/kpi/score` & `/api/kpi/leaderboard` biar
 * konsisten. Urutan prioritas: (1) jabatan struktural yang py KPI sendiri (Wakasek/TU/Operator/
 * Bendahara, berlaku utk GURU MAUPUN staf TAS via `getJabatanNames` yang otomatis baca
 * TeacherJabatan/StaffJabatan sesuai jenis akunnya), (2) Wali Kelas (`Teacher.homeroomOf`) — BUKAN
 * gabungan dgn KPI Guru, sengaja 1 jabatanName = 1 hasil akhir biar `computeFinalScore` simpel,
 * (3) Guru biasa (fallback default kalau py Teacher record tapi tidak ada jabatan struktural
 * lain), (4) null kalau staf TAS tanpa jabatan struktural yang dikenali (belum ada KPI utk dia). */
export async function resolveJabatanName(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, teacher: { select: { id: true, homeroomOf: { select: { id: true } } } } },
  });
  if (!user) return null;

  const names = await getJabatanNames(user.email);
  for (const [raw, mapped] of Object.entries(STRUCTURAL_JABATAN_MAP)) {
    if (names.includes(raw)) return mapped;
  }

  if (!user.teacher) return null;
  if (user.teacher.homeroomOf.length > 0) return "WALI KELAS";
  return "GURU";
}

/** Hitung skor akhir 1 pegawai utk 1 periode ("2026-08") — breakdown per indikator + skor akhir
 * (0-100) hasil penjumlahan `score * weight / 100` semua indikator jabatannya. */
export async function computeFinalScore(userId: string, jabatanName: string, period: string) {
  const indicators = await getIndicatorsForJabatan(jabatanName);
  const [year, month] = period.split("-").map(Number);
  const refDate = new Date(Date.UTC(year, month - 1, 15)); // pertengahan bulan, aman dari edge-case akhir/awal bulan
  const dates = getMonthWindow(refDate);

  const teacher = await prisma.teacher.findUnique({ where: { userId }, select: { id: true } });

  const breakdown: KpiBreakdownItem[] = [];
  let finalScore = 0;

  for (const ind of indicators) {
    let score = 0;
    if (ind.source === "AUTO_KEHADIRAN") {
      const config = await getDisciplinePointConfig();
      const { skorRataRata } = await computeDisciplineScoreForUser(userId, dates);
      score = config.pointHadir > 0 ? Math.min(100, Math.max(0, (skorRataRata / config.pointHadir) * 100)) : 0;
    } else if (ind.source === "AUTO_JURNAL" && teacher) {
      score = await computeJurnalScore(teacher.id, dates);
    } else if (ind.source === "AUTO_RPP" && teacher) {
      score = await computeRppScore(teacher.id);
    } else {
      // MANUAL — ambil dari KpiPeriodScore tersimpan (hasil approval KpiSubmission), 0 kalau belum ada
      const saved = await prisma.kpiPeriodScore.findUnique({
        where: { userId_indicatorId_period: { userId, indicatorId: ind.id, period } },
      });
      score = saved?.score ?? 0;
    }
    breakdown.push({ indicatorId: ind.id, name: ind.name, weight: ind.weight, source: ind.source, score: Math.round(score * 100) / 100 });
    finalScore += (score * ind.weight) / 100;
  }

  return { finalScore: Math.round(finalScore * 100) / 100, breakdown };
}
