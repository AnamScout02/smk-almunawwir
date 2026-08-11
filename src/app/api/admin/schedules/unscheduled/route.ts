import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { weekTypesOverlap } from "@/lib/schedule-week";

export const dynamic = "force-dynamic";

const DAYS = ["SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];
const DAY_LABEL: Record<string, string> = { SENIN: "Senin", SELASA: "Selasa", RABU: "Rabu", KAMIS: "Kamis", JUMAT: "Jumat", SABTU: "Sabtu" };
const MAX_WEEKLY_HOURS = 56;

// Hitung LANGSUNG dari data saat ini (bukan snapshot hasil Generate terakhir) — bandingkan
// kebutuhan jam per Penugasan Mengajar (dikali 2 utk kelas rotasi X/XI) dengan jam yang
// benar-benar sudah ada di Jadwal Pelajaran, supaya selalu akurat walau ada yang diedit manual.
//
// Untuk tiap baris yang kurang, juga dicari SARAN solusi konkret (bukan cuma laporan angka):
// 1. Kalau guru itu sendiri sudah di/atas batas 56 jam/minggu (gabungan semua kelas) — itu
//    mustahil ditutup lewat pengaturan jadwal, saran-nya jelas: kurangi beban / tambah guru.
// 2. Kalau guru masih ada slack, dicari slot kosong di KELAS itu, lalu dicek apa guru sedang
//    mengajar kelas/mapel lain di jam yang sama — kalau iya, itu jadi saran "geser mapel X ke
//    hari lain" (persis pola manual yang dipakai investigasi kelas XII sebelumnya).
// 3. Kalau kelasnya sendiri sudah penuh total (tidak ada slot kosong sama sekali) — saran-nya
//    kelas itu perlu dikosongkan mapel lain dulu.
export async function GET(req: NextRequest) {
  await verifyRole(["ADMIN", "TAS", "TEACHER"]);
  const classId = req.nextUrl.searchParams.get("classId");

  const [assignments, schedules, periods, allAssignmentsForLoad] = await Promise.all([
    prisma.teachingAssignment.findMany({
      where: classId ? { classId } : undefined,
      include: {
        subject: true,
        teacher: { include: { user: { select: { name: true } } } },
        class: { select: { id: true, name: true, grade: true } },
      },
    }),
    prisma.schedule.findMany({
      where: { scheduleType: "BLOK" },
      select: { classId: true, subject: true, teacherId: true, day: true, startTime: true, endTime: true, weekType: true },
    }),
    prisma.schoolPeriod.findMany({ where: { isBreak: false }, orderBy: [{ day: "asc" }, { order: "asc" }] }),
    prisma.teachingAssignment.findMany({ include: { subject: { select: { hoursPerWeek: true } }, class: { select: { grade: true } } } }),
  ]);

  // PERBAIKAN 2026-08-11 (temuan user, verifikasi ulang jadwal terhadap PDF resmi): dulu tiap
  // baris Schedule dihitung sbg TEPAT 1 jam, padahal Schedule row BISA menyentuh BEBERAPA periode
  // sekaligus (block-merge, mis. 1 baris "07:15–09:15" mewakili 4 periode 30 menit) — pola yg
  // sudah dipakai sejak impor Jadwal Ganjil 2026/2027. Akibatnya baris ter-merge dihitung SANGAT
  // kurang dari jam sebenarnya, bikin banyak "Belum Sepenuhnya Terjadwal" palsu. Sekarang dihitung
  // dari BERAPA SLOT PERIODE (SchoolPeriod, bukan-istirahat) yg startTime-nya jatuh di rentang
  // [s.startTime, s.endTime) hari itu — cocok utk baris 1-periode MAUPUN yg sudah di-block-merge.
  const periodStartsByDay = new Map<string, string[]>();
  for (const p of periods) {
    if (!periodStartsByDay.has(p.day)) periodStartsByDay.set(p.day, []);
    periodStartsByDay.get(p.day)!.push(p.startTime);
  }
  const actualCount = new Map<string, number>();
  for (const s of schedules) {
    const key = `${s.classId}|${s.subject}`;
    const dayStarts = periodStartsByDay.get(s.day) ?? [];
    const periodsInRow = dayStarts.filter(t => t >= s.startTime && t < s.endTime).length;
    actualCount.set(key, (actualCount.get(key) ?? 0) + Math.max(periodsInRow, 1));
  }

  // Beban total per guru (semua kelas, dobel utk kelas rotasi X/XI) — dipakai utk cek batas 56 jam.
  const teacherLoad = new Map<string, number>();
  for (const a of allAssignmentsForLoad) {
    const rotating = a.class.grade === 10 || a.class.grade === 11;
    const hrs = a.subject.hoursPerWeek * (rotating ? 2 : 1);
    teacherLoad.set(a.teacherId, (teacherLoad.get(a.teacherId) ?? 0) + hrs);
  }

  const periodsByDay = new Map<string, typeof periods>();
  for (const day of DAYS) {
    const seen = new Set<string>();
    periodsByDay.set(day, periods.filter(p => p.day === day && (seen.has(p.startTime) ? false : (seen.add(p.startTime), true))));
  }

  // classId|day|startTime -> daftar weekType yang mengisi slot itu (biasanya cuma 1, tapi
  // kelas rotasi bisa punya beda mapel di minggu A vs B di jam yang sama).
  const classBusy = new Map<string, string[]>();
  // teacherId|day|startTime -> daftar {weekType, classId, subject} yang mengisi guru itu di jam itu.
  const teacherBusy = new Map<string, { weekType: string; classId: string; subject: string }[]>();
  // PERBAIKAN 2026-08-11 (sama akar masalah dgn actualCount di atas): baris yg block-merge
  // (mencakup beberapa periode) dulu cuma "menandai sibuk" di startTime-nya sendiri — periode
  // TENGAH yg ikut tercakup blok itu dikira masih kosong, bikin saran salah ("ada slot kosong"
  // padahal sebenarnya sudah terisi blok itu). Sekarang ditandai sibuk di SEMUA periode yg
  // startTime-nya jatuh dalam rentang [s.startTime, s.endTime) hari itu.
  for (const s of schedules) {
    const dayStarts = periodStartsByDay.get(s.day) ?? [];
    const coveredStarts = dayStarts.filter(t => t >= s.startTime && t < s.endTime);
    if (coveredStarts.length === 0) coveredStarts.push(s.startTime); // fallback kalau tidak ketemu di tabel periode
    for (const st of coveredStarts) {
      const classKey = `${s.classId}|${s.day}|${st}`;
      if (!classBusy.has(classKey)) classBusy.set(classKey, []);
      classBusy.get(classKey)!.push(s.weekType);
      if (s.teacherId) {
        const teacherKey = `${s.teacherId}|${s.day}|${st}`;
        if (!teacherBusy.has(teacherKey)) teacherBusy.set(teacherKey, []);
        teacherBusy.get(teacherKey)!.push({ weekType: s.weekType, classId: s.classId, subject: s.subject });
      }
    }
  }
  // "target" minggu SEMUA (kelas non-rotasi) bentrok dengan APAPUN yang mengisi guru itu di
  // hari+jam yang sama, baik itu terkunci ke Minggu A, B, atau SEMUA juga — karena kelas SEMUA
  // berjalan tiap minggu kalender, jadi komitmen guru di salah satu minggu saja tetap menghalangi.
  function isClassSlotBusy(classId: string, day: string, startTime: string, targetWeek: string): boolean {
    const entries = classBusy.get(`${classId}|${day}|${startTime}`) ?? [];
    return entries.some(w => weekTypesOverlap(w, targetWeek));
  }
  function findTeacherBlocker(teacherId: string, day: string, startTime: string, targetWeek: string) {
    const entries = teacherBusy.get(`${teacherId}|${day}|${startTime}`) ?? [];
    return entries.find(e => weekTypesOverlap(e.weekType, targetWeek));
  }
  // classNameById perlu mencakup SEMUA kelas (bukan cuma yang lolos filter classId) supaya
  // label kelas lain di pesan saran ("guru sedang mengajar X di jam itu") tetap terbaca.
  const classNameById = new Map(assignments.map(a => [a.class.id, a.class.name] as const));
  const allClasses = await prisma.class.findMany({ select: { id: true, name: true } });
  for (const c of allClasses) if (!classNameById.has(c.id)) classNameById.set(c.id, c.name);

  function findSuggestion(a: (typeof assignments)[number]): string | null {
    const rotating = a.class.grade === 10 || a.class.grade === 11;
    const load = teacherLoad.get(a.teacherId) ?? 0;
    if (load >= MAX_WEEKLY_HOURS) {
      return `Guru ${a.teacher.user.name} sudah di batas kapasitas (${load}/${MAX_WEEKLY_HOURS} jam/minggu, gabungan semua kelas) — tidak bisa ditambah jam lagi lewat pengaturan jadwal. Perlu kurangi jumlah kelas yang dipegang guru ini atau alihkan sebagian ke guru lain.`;
    }
    const weeksToCheck = rotating ? ["A", "B"] : ["SEMUA"];
    for (const day of DAYS) {
      const dayPeriods = periodsByDay.get(day) ?? [];
      for (const p of dayPeriods) {
        for (const week of weeksToCheck) {
          if (isClassSlotBusy(a.classId, day, p.startTime, week)) continue; // kelas sudah terisi di slot ini
          const blocking = findTeacherBlocker(a.teacherId, day, p.startTime, week);
          if (!blocking) {
            return `Ada slot kosong yang cocok: ${DAY_LABEL[day]} ${p.startTime} (Minggu ${week === "A" ? "1" : week === "B" ? "2" : "manapun"}) — guru dan kelas sama-sama bebas. Coba generate ulang atau tambahkan preferensi manual di jam ini.`;
          }
          if (blocking.classId !== a.classId) {
            const otherClassName = classNameById.get(blocking.classId) ?? "kelas lain";
            return `Kelas ${a.class.name} kosong di ${DAY_LABEL[day]} ${p.startTime}, tapi guru ${a.teacher.user.name} sedang mengajar ${otherClassName} — ${blocking.subject} di jam itu. Coba geser mapel itu ke hari/jam lain untuk membuka ruang di sini.`;
          }
        }
      }
    }
    return `Kelas ${a.class.name} sudah penuh jamnya minggu ini — tidak ada slot kosong sama sekali untuk ${a.subject.name}. Perlu kosongkan/pindahkan mapel lain di kelas ini dulu.`;
  }

  const unscheduled = assignments
    .map(a => {
      const rotating = a.class.grade === 10 || a.class.grade === 11;
      const expected = rotating ? a.subject.hoursPerWeek * 2 : a.subject.hoursPerWeek;
      const actual = actualCount.get(`${a.classId}|${a.subject.name}`) ?? 0;
      const missingHours = expected - actual;
      return {
        className: a.class.name,
        subjectName: a.subject.name,
        teacherName: a.teacher.user.name,
        expectedHours: expected,
        actualHours: actual,
        missingHours,
        suggestion: missingHours > 0 ? findSuggestion(a) : null,
      };
    })
    .filter(u => u.missingHours > 0)
    .sort((a, b) => b.missingHours - a.missingHours);

  return NextResponse.json(unscheduled);
}
