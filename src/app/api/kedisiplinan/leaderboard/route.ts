import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getWeekTypeForDate } from "@/lib/schedule-week.server";
import { cakupanTingkat } from "@/lib/kehadiran-guru";
import { weekTypesOverlap } from "@/lib/schedule-week";
import { groupConsecutiveSchedules } from "@/lib/schedule-grouping";
import { getDisciplinePointConfig, pointsForStatus, getCalendarWeekWindow, getMonthWindow } from "@/lib/discipline-points";

export const dynamic = "force-dynamic";

const DAYS = ["MINGGU", "SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];

interface TeacherAgg {
  userId: string; teacherName: string; teacherNip: string;
  totalPoin: number; totalBlokSeharusnya: number; totalBlokTercatat: number;
  countHadir: number; countTerlambat: number; countIzin: number; countSakit: number; countAlpha: number;
}

// Papan peringkat kedisiplinan guru — siapapun yang login boleh lihat (memang untuk ditonton semua
// guru di ruang guru), tidak ada gating jabatan di sini. Defaultnya "minggu ini" (utk layar live di
// ruang guru), tapi bisa difilter ?period=week|month&date=YYYY-MM-DD utk lihat performa periode
// lain (mundur/maju per minggu atau per bulan) — dipakai halaman rekap performa, bukan cuma live.
export async function GET(req: NextRequest) {
  try {
    await verifyRole(["ADMIN", "TEACHER", "TAS"]);

    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") === "month" ? "month" : "week";
    const dateParam = searchParams.get("date");
    const refDate = dateParam ? new Date(dateParam) : new Date();

    const config = await getDisciplinePointConfig();
    const now = new Date();
    const nowHHMM = now.toTimeString().slice(0, 5);
    const todayStr = now.toISOString().slice(0, 10);

    const fullWindow = period === "month" ? getMonthWindow(refDate) : getCalendarWeekWindow(refDate);
    const windowDates = fullWindow.filter(d => d.toISOString().slice(0, 10) <= todayStr);

    // Key pakai User.id (BUKAN Teacher.id) — supaya absensi mengajar (guru, punya Teacher record)
    // dan absensi piket (bisa guru MAUPUN staf TAS tanpa Teacher record) ketemu di baris yang sama
    // kalau orangnya sama, dan tetap muncul sendiri kalau cuma piket tanpa jadwal mengajar.
    const agg = new Map<string, TeacherAgg>();
    const ensureTeacher = (id: string, name: string, nip: string) => {
      if (!agg.has(id)) {
        agg.set(id, { userId: id, teacherName: name, teacherNip: nip, totalPoin: 0, totalBlokSeharusnya: 0, totalBlokTercatat: 0, countHadir: 0, countTerlambat: 0, countIzin: 0, countSakit: 0, countAlpha: 0 });
      }
      return agg.get(id)!;
    };
    function applyStatus(t: TeacherAgg, status: string, hasTugas: boolean | null) {
      t.totalBlokTercatat += 1;
      t.totalPoin += pointsForStatus(config, status, hasTugas);
      if (status === "HADIR") t.countHadir += 1;
      else if (status === "TERLAMBAT") t.countTerlambat += 1;
      else if (status === "IZIN") t.countIzin += 1;
      else if (status === "SAKIT") t.countSakit += 1;
      else if (status === "ALPHA") t.countAlpha += 1;
    }

    const tingkat = await cakupanTingkat();
    for (const date of windowDates) {
      const dateStr = date.toISOString().slice(0, 10);
      const day = DAYS[date.getDay()];
      const weekType = await getWeekTypeForDate(date);
      const nextDay = new Date(date.getTime() + 86400000);

      // --- Absensi mengajar (blok jam pelajaran) ---
      const schedules = await prisma.schedule.findMany({
        where: { day, scheduleType: "BLOK", teacherId: { not: null }, class: { grade: { in: tingkat } } },
        include: { teacher: { select: { userId: true, nip: true, user: { select: { name: true } } } } },
        orderBy: { startTime: "asc" },
      });
      const relevant = schedules
        .filter(s => weekTypesOverlap(s.weekType, weekType))
        .filter(s => dateStr < todayStr || s.startTime <= nowHHMM); // jam yang belum mulai hari ini di-skip (belum bisa dinilai)

      if (relevant.length > 0) {
        const blocks = groupConsecutiveSchedules(relevant, s => `${s.teacherId}|${s.classId}|${s.subject}`);

        const attendance = await prisma.teacherScheduleAttendance.findMany({
          where: { scheduleId: { in: relevant.map(s => s.id) }, date: { gte: date, lt: nextDay } },
        });
        const attByScheduleId = new Map(attendance.map(a => [a.scheduleId, a]));

        for (const { items, first } of blocks) {
          if (!first.teacher) continue;
          const t = ensureTeacher(first.teacher.userId, first.teacher.user.name, first.teacher.nip);
          t.totalBlokSeharusnya += 1;

          // Semua scheduleId anggota blok seharusnya ditulis status yang sama sekali simpan (lihat
          // slots/route.ts POST) — ambil dari yang PERTAMA ketemu sebagai representasi blok.
          const recorded = items.map(i => attByScheduleId.get(i.id)).find(Boolean);
          if (!recorded) continue; // belum dicatat piket — netral, tidak ikut dihitung tercatat/poin
          applyStatus(t, recorded.status, recorded.hasTugas);
        }
      }

      // --- Absensi guru piket (petugas piket ITU SENDIRI, 1 "blok" per hari tugas — tidak ada
      // konsep "belum waktunya" seperti jam pelajaran, jadi langsung dihitung begitu tanggalnya
      // termasuk window minggu ini yang sudah/sedang berjalan) ---
      const duty = await prisma.dutyRoster.findMany({
        where: { day, OR: [{ weekType: "SEMUA" }, { weekType }] },
        include: { user: { select: { id: true, name: true, role: true, teacher: { select: { nip: true } } } } },
      });
      if (duty.length > 0) {
        const dutyAtt = await prisma.dutyAttendance.findMany({
          where: { userId: { in: duty.map(d => d.userId) }, date: { gte: date, lt: nextDay } },
        });
        const dutyAttByUserId = new Map(dutyAtt.map(a => [a.userId, a]));

        for (const d of duty) {
          const t = ensureTeacher(d.userId, d.user.name, d.user.teacher?.nip ?? d.user.role);
          t.totalBlokSeharusnya += 1;
          const recorded = dutyAttByUserId.get(d.userId);
          if (!recorded) continue;
          applyStatus(t, recorded.status, null);
        }
      }
    }

    // `skorRataRata` = totalPoin dibagi jumlah blok yang SUDAH TERCATAT (BUKAN yang seharusnya) —
    // dipakai utk RANKING. Sengaja bukan dibagi totalBlokSeharusnya: blok yang belum sempat
    // dicatat piket TIDAK BOLEH ikut menurunkan skor (itu bukan salah guru-nya, piket yang belum
    // sempat), padahal kalau dibagi totalBlokSeharusnya, guru yang catatannya baru separuh
    // (misal 1/2 blok, itu 1 blok Hadir penuh) jadi kelihatan skornya 2.5 — LEBIH RENDAH dari guru
    // lain yang jelas-jelas Izin (skor 3.5 dari 2/2 blok) — padahal yang belum lengkap catatannya
    // itu justru tidak ada catatan buruk sama sekali. `persentaseHadir` TETAP pakai
    // totalBlokSeharusnya (itu memang metrik "kelengkapan pencatatan", beda tujuan dari skor).
    const list = Array.from(agg.values()).map(t => ({
      ...t,
      persentaseHadir: t.totalBlokSeharusnya > 0 ? Math.round((t.countHadir / t.totalBlokSeharusnya) * 100) : 0,
      skorRataRata: t.totalBlokTercatat > 0 ? Math.round((t.totalPoin / t.totalBlokTercatat) * 100) / 100 : 0,
    }));

    const topDisiplin = [...list]
      // Sengaja TIDAK dipotong top-N — jumlah guru di satu sekolah cukup sedikit utk ditampilkan
      // semua, dan memotong bisa membuat guru yang skornya menengah (bukan Alpha/Terlambat, jadi
      // juga tidak masuk "Perlu Perhatian") jadi hilang sama sekali dari papan (pernah kejadian:
      // guru dg 1 Izin tersisih dari top-15 karena banyak guru lain kebetulan dapat skor sempurna).
      .sort((a, b) => b.skorRataRata - a.skorRataRata || b.totalPoin - a.totalPoin || b.totalBlokSeharusnya - a.totalBlokSeharusnya);
    const perluPerhatian = [...list]
      .filter(t => t.countAlpha > 0 || t.countTerlambat > 0)
      .sort((a, b) => (b.countAlpha * 2 + b.countTerlambat) - (a.countAlpha * 2 + a.countTerlambat));

    const periodStart = fullWindow[0] ?? now;
    const periodEndFull = fullWindow.slice(-1)[0] ?? now;
    const periodLabel = period === "month"
      ? periodStart.toLocaleDateString("id-ID", { month: "long", year: "numeric" })
      : `${periodStart.toLocaleDateString("id-ID", { day: "numeric", month: "short" })} – ${periodEndFull.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}`;

    return NextResponse.json({ topDisiplin, perluPerhatian, periodLabel, period, refDate: refDate.toISOString().slice(0, 10), config });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
