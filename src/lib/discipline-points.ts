import "server-only";
import { prisma } from "@/lib/prisma";
import { getWeekTypeForDate } from "@/lib/schedule-week.server";
import { weekTypesOverlap } from "@/lib/schedule-week";
import { groupConsecutiveSchedules } from "@/lib/schedule-grouping";
import { cakupanTingkat } from "@/lib/kehadiran-guru";

const DAYS = ["MINGGU", "SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];

export interface DisciplinePoints {
  pointHadir: number;
  pointTerlambat: number;
  pointIzinAdaTugas: number;
  pointIzinTanpaTugas: number;
  pointSakitAdaTugas: number;
  pointSakitTanpaTugas: number;
  pointAlpha: number;
}

const DEFAULT_POINTS: Omit<DisciplinePoints, never> = {
  pointHadir: 5,
  pointTerlambat: 3,
  pointIzinAdaTugas: 2,
  pointIzinTanpaTugas: 1,
  pointSakitAdaTugas: 2,
  pointSakitTanpaTugas: 1,
  pointAlpha: -1,
};

/** Konfigurasi poin selalu SATU baris (singleton) — dibuat otomatis dengan nilai default kalau
 * belum pernah diisi (baru pertama kali fitur ini dipakai). */
export async function getDisciplinePointConfig() {
  const existing = await prisma.disciplinePointConfig.findFirst();
  if (existing) return existing;
  return prisma.disciplinePointConfig.create({ data: DEFAULT_POINTS });
}

/** Poin utk 1 blok kehadiran. `status` null/undefined = blok belum tercatat sama sekali (piket
 * belum sempat isi) — sengaja dikembalikan 0 (netral), BUKAN disamakan dengan Alpha, supaya guru
 * tidak dirugikan gara-gara piket yang telat mencatat. */
export function pointsForStatus(config: DisciplinePoints, status: string | null | undefined, hasTugas: boolean | null | undefined): number {
  switch (status) {
    case "HADIR": return config.pointHadir;
    case "TERLAMBAT": return config.pointTerlambat;
    case "IZIN": return hasTugas ? config.pointIzinAdaTugas : config.pointIzinTanpaTugas;
    case "SAKIT": return hasTugas ? config.pointSakitAdaTugas : config.pointSakitTanpaTugas;
    case "ALPHA": return config.pointAlpha;
    default: return 0;
  }
}

/** Kembalikan tanggal Senin s/d Sabtu di MINGGU KALENDER yang memuat `date` — dipakai sebagai
 * periode pelaporan leaderboard ("minggu ini" versi awam: mulai Senin, bukan lanjutan siklus A/B
 * dari anchor). Ini SENGAJA independen dari rotasi A/B (`getWeekTypeForDate`) — keduanya beda
 * kepentingan: A/B menentukan JADWAL MANA yang berlaku di suatu hari (tetap dihitung per-tanggal,
 * benar di semua kasus), sedangkan window ini cuma menentukan RENTANG TANGGAL yang diakumulasi ke
 * leaderboard minggu ini. Dulu sempat dibuat ikut window anchor (Rabu-Selasa) supaya "konsisten",
 * tapi itu malah bikin leaderboard menghitung mundur ke hari Rabu MINGGU LALU sebagai "seharusnya"
 * meski fiturnya baru dipakai hari itu — guru jadi terlihat "kurang disiplin" padahal cuma belum
 * sempat dicatat utk hari-hari sebelum fitur ini ada. */
export function getCalendarWeekWindow(date: Date): Date[] {
  const dayMs = 86400000;
  // WAJIB dibulatkan ke tengah malam UTC dulu — Schedule/TeacherScheduleAttendance.date semua
  // disimpan sbg midnight UTC (pola `new Date("YYYY-MM-DD")` di seluruh app). Kalau `date` (=`now`)
  // dipakai apa adanya, jam:menit ikut waktu saat ini, jadi filter `date: { gte, lt }` di query
  // Prisma meleset (row jam 00:00 tidak akan pernah >= today jam 11:35, dst) — semua "tercatat"
  // jadi 0 padahal datanya ada.
  const midnightToday = new Date(date.toISOString().slice(0, 10));
  const dow = midnightToday.getUTCDay(); // 0=Minggu, 1=Senin, ..., 6=Sabtu
  const diffToMonday = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(midnightToday.getTime() + diffToMonday * dayMs);

  const dates: Date[] = [];
  for (let i = 0; i < 6; i++) dates.push(new Date(monday.getTime() + i * dayMs)); // Senin s/d Sabtu
  return dates;
}

/** Kembalikan semua tanggal (kecuali Minggu) di BULAN KALENDER yang memuat `date` — dipakai utk
 * filter leaderboard "bulan ini" (rekap performa bulanan, bukan cuma minggu berjalan). */
export function getMonthWindow(date: Date): Date[] {
  const midnightToday = new Date(date.toISOString().slice(0, 10));
  const year = midnightToday.getUTCFullYear();
  const month = midnightToday.getUTCMonth();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  const dates: Date[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(Date.UTC(year, month, d));
    if (dt.getUTCDay() !== 0) dates.push(dt); // skip Minggu
  }
  return dates;
}

/** Versi SATU-USER dari perhitungan skor kedisiplinan (`kedisiplinan/leaderboard/route.ts`) —
 * dipakai SMKP (`kpi-engine.ts`) utk indikator AUTO_KEHADIRAN, tanpa perlu query semua guru
 * sekaligus seperti leaderboard (di sini di-filter langsung by teacherId/userId, jauh lebih murah
 * utk 1 orang). Logikanya SENGAJA diduplikasi dari leaderboard (bukan saling memanggil) supaya
 * leaderboard yang sudah stabil tidak ikut ter-refactor/berisiko regresi cuma gara-gara SMKP. */
export async function computeDisciplineScoreForUser(userId: string, dates: Date[]): Promise<{ totalPoin: number; totalBlokSeharusnya: number; totalBlokTercatat: number; skorRataRata: number }> {
  const config = await getDisciplinePointConfig();
  const now = new Date();
  const nowHHMM = now.toTimeString().slice(0, 5);
  const todayStr = now.toISOString().slice(0, 10);

  const teacher = await prisma.teacher.findUnique({ where: { userId }, select: { id: true } });

  const tingkat = await cakupanTingkat();
  let totalPoin = 0;
  let totalBlokSeharusnya = 0;
  let totalBlokTercatat = 0;

  for (const date of dates) {
    const dateStr = date.toISOString().slice(0, 10);
    if (dateStr > todayStr) continue;
    const day = DAYS[date.getDay()];
    const weekType = await getWeekTypeForDate(date);
    const nextDay = new Date(date.getTime() + 86400000);

    if (teacher) {
      const schedules = await prisma.schedule.findMany({
        where: { day, scheduleType: "BLOK", teacherId: teacher.id, class: { grade: { in: tingkat } } },
        orderBy: { startTime: "asc" },
      });
      const relevant = schedules
        .filter(s => weekTypesOverlap(s.weekType, weekType))
        .filter(s => dateStr < todayStr || s.startTime <= nowHHMM);

      if (relevant.length > 0) {
        const blocks = groupConsecutiveSchedules(relevant, s => `${s.classId}|${s.subject}`);
        const attendance = await prisma.teacherScheduleAttendance.findMany({
          where: { scheduleId: { in: relevant.map(s => s.id) }, date: { gte: date, lt: nextDay } },
        });
        const attByScheduleId = new Map(attendance.map(a => [a.scheduleId, a]));

        for (const { items } of blocks) {
          totalBlokSeharusnya += 1;
          const recorded = items.map(i => attByScheduleId.get(i.id)).find(Boolean);
          if (recorded) { totalBlokTercatat += 1; totalPoin += pointsForStatus(config, recorded.status, recorded.hasTugas); }
        }
      }
    }

    const duty = await prisma.dutyRoster.findFirst({ where: { userId, day, OR: [{ weekType: "SEMUA" }, { weekType }] } });
    if (duty) {
      totalBlokSeharusnya += 1;
      const recorded = await prisma.dutyAttendance.findFirst({ where: { userId, date: { gte: date, lt: nextDay } } });
      if (recorded) { totalBlokTercatat += 1; totalPoin += pointsForStatus(config, recorded.status, null); }
    }
  }

  // skorRataRata dibagi totalBlokTercatat (BUKAN totalBlokSeharusnya) — blok yang belum sempat
  // dicatat piket tidak boleh ikut menurunkan skor, itu bukan salah guru-nya. Lihat penjelasan
  // lebih lengkap di komentar sepadan pada `kedisiplinan/leaderboard/route.ts`.
  return { totalPoin, totalBlokSeharusnya, totalBlokTercatat, skorRataRata: totalBlokTercatat > 0 ? totalPoin / totalBlokTercatat : 0 };
}
