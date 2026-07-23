import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { weekGroupForClass } from "@/lib/schedule-week";
import { getSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

const DAYS = ["SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && bStart < aEnd;
}

interface Slot { day: string; order: number; startTime: string; endTime: string }

interface UnscheduledEntry {
  className: string;
  subjectName: string;
  teacherName: string;
  missingHours: number;
}

// Mapel dengan jam/minggu >= ambang ini diusahakan menumpuk dalam 1 hari
// (atau beberapa hari berdekatan) — bukan disebar 1 jam per hari. Ambang ini sengaja
// diset 2 (bukan hanya mapel jam banyak) supaya mapel jam sedikit (mis. 2 jp, atau sisa
// "pengisi" jam kosong) tidak ikut dipecah jadi 1 jam per hari yang tersebar — minimal
// tetap 2 jam berdekatan dalam 1 hari kalau memungkinkan. Hanya sisa 1 jam (yang memang
// tidak bisa dipecah lagi) yang lewat jalur sebar biasa.
const BLOCK_HOURS_THRESHOLD = 2;

export async function POST(req: NextRequest) {
  await verifyRole(["ADMIN", "TAS"]);
  const { "schedule.locked": locked } = await getSettings(["schedule.locked"]);
  if (locked === "1") {
    return NextResponse.json({ error: "Jadwal sedang dikunci — buka kunci dulu di halaman Jadwal Pelajaran sebelum generate ulang." }, { status: 423 });
  }
  const body = await req.json().catch(() => ({}));
  const classIds: string[] | undefined = Array.isArray(body.classIds) && body.classIds.length > 0 ? body.classIds : undefined;

  const periods = await prisma.schoolPeriod.findMany({
    where: { isBreak: false },
    orderBy: [{ day: "asc" }, { order: "asc" }],
  });
  if (periods.length === 0) {
    return NextResponse.json({ error: "Kerangka jam pelajaran belum diatur. Buka menu Kerangka Jam Pelajaran terlebih dahulu." }, { status: 400 });
  }
  const slotsByDay = new Map<string, Slot[]>();
  for (const day of DAYS) {
    slotsByDay.set(day, periods.filter(p => p.day === day).map(p => ({ day, order: p.order, startTime: p.startTime, endTime: p.endTime })));
  }

  const targetClasses = await prisma.class.findMany({
    where: classIds ? { id: { in: classIds } } : undefined,
    include: { major: true },
  });
  if (targetClasses.length === 0) {
    return NextResponse.json({ error: "Tidak ada kelas yang dipilih" }, { status: 400 });
  }
  const targetClassIds = targetClasses.map(c => c.id);
  const gradeByClassId = new Map(targetClasses.map(c => [c.id, c.grade]));

  // Hapus jadwal lama milik kelas target (semua minggu) — akan digantikan hasil generate baru.
  // Hanya jadwal BLOK yang disentuh — jadwal NONBLOK (khusus Dapodik) punya siklusnya sendiri,
  // tidak boleh ikut terhapus oleh generate blok ini.
  await prisma.schedule.deleteMany({ where: { classId: { in: targetClassIds }, scheduleType: "BLOK" } });

  const assignments = await prisma.teachingAssignment.findMany({
    where: { classId: { in: targetClassIds } },
    include: {
      subject: true,
      teacher: { include: { user: { select: { name: true } } } },
      class: true,
      preferences: { orderBy: { createdAt: "asc" } },
    },
  });

  type Assignment = (typeof assignments)[number];

  // Kelas dipisah: grade 10/11 ikut rotasi 2 minggu (produktif <-> umum, X & XI dibalik),
  // grade lain (mis. XII) jadwal tetap tiap minggu ("SEMUA").
  const rotatingClassIds = new Set(targetClasses.filter(c => c.grade === 10 || c.grade === 11).map(c => c.id));
  const fixedClassIds = new Set(targetClasses.filter(c => !rotatingClassIds.has(c.id)).map(c => c.id));

  function entryFor(a: Assignment, missing: number): UnscheduledEntry {
    return { className: a.class.name, subjectName: a.subject.name, teacherName: a.teacher.user.name, missingHours: missing };
  }

  // Satu "state" mewakili 1 minggu kalender (SEMUA / A / B) — dipakai untuk beberapa kali
  // pemanggilan place() secara berurutan (mapel utama minggu ini dulu, baru mapel "pengisi"
  // dari kelebihan minggu pasangannya) supaya slot kosong & bentrok guru tetap konsisten
  // dalam satu minggu yang sama.
  function createWeekState(weekType: string, existingSchedulesForPass: { classId: string; teacherId: string | null; day: string; startTime: string; endTime: string; subject: string }[]) {
    const toCreate: { classId: string; teacherId: string; subject: string; day: string; startTime: string; endTime: string; weekType: string }[] = [];

    const classSlotUsed = new Map<string, Set<number>>();
    const teacherTimeUsed = new Map<string, { start: string; end: string; subject: string }[]>();

    function markClassSlot(classId: string, day: string, order: number) {
      const key = `${classId}|${day}`;
      if (!classSlotUsed.has(key)) classSlotUsed.set(key, new Set());
      classSlotUsed.get(key)!.add(order);
    }
    function isClassSlotFree(classId: string, day: string, order: number) {
      return !classSlotUsed.get(`${classId}|${day}`)?.has(order);
    }
    function markTeacherTime(teacherId: string, day: string, start: string, end: string, subject: string) {
      const key = `${teacherId}|${day}`;
      if (!teacherTimeUsed.has(key)) teacherTimeUsed.set(key, []);
      teacherTimeUsed.get(key)!.push({ start, end, subject });
    }

    // Slot yang sudah DIMINTA lewat Preferensi Hari/Jam siapa pun — dicatat TERLEPAS dari
    // berhasil/tidaknya preferensi itu ditempatkan, supaya mapel LAIN yang sama sekali tidak
    // meminta jam ini tidak bisa menyerobotnya lewat penempatan otomatis (Tahap 2). Kalau
    // preferensi pemiliknya sendiri gagal (mis. guru bentrok), slot itu tetap dibiarkan kosong
    // (masuk daftar "belum terjadwal") daripada diisi mapel lain yang tidak memintanya.
    const requestedSlotOwners = new Map<string, Set<string>>();
    function reserveSlot(classId: string, day: string, order: number, assignmentId: string) {
      const key = `${classId}|${day}|${order}`;
      if (!requestedSlotOwners.has(key)) requestedSlotOwners.set(key, new Set());
      requestedSlotOwners.get(key)!.add(assignmentId);
    }
    function isReservedByOther(classId: string, day: string, order: number, assignmentId: string) {
      const owners = requestedSlotOwners.get(`${classId}|${day}|${order}`);
      if (!owners) return false;
      for (const id of owners) if (id !== assignmentId) return true;
      return false;
    }
    // Guru boleh bentrok jam dengan DIRINYA SENDIRI hanya kalau mapelnya SAMA dan masih di
    // bawah batas `maxSharedTeacher` mapel itu (mis. Penjasorkes maksimal 2 kelas bareng).
    // Bentrok dengan mapel BEDA tetap selalu ditolak.
    function isTeacherFree(teacherId: string, day: string, start: string, end: string, subject: string, maxShared: number) {
      const used = teacherTimeUsed.get(`${teacherId}|${day}`) ?? [];
      const overlapping = used.filter(u => overlaps(start, end, u.start, u.end));
      if (overlapping.length === 0) return true;
      return overlapping.every(u => u.subject === subject) && overlapping.length < maxShared;
    }

    for (const s of existingSchedulesForPass) {
      const period = periods.find(p => p.day === s.day && p.startTime === s.startTime && p.endTime === s.endTime);
      if (period) markClassSlot(s.classId, s.day, period.order);
      if (s.teacherId) markTeacherTime(s.teacherId, s.day, s.startTime, s.endTime, s.subject);
    }

    // Penghitung beban per-hari, dilacak GLOBAL sepanjang minggu ini (lintas beberapa
    // panggilan place()) — supaya jadwal seorang guru (dan sebuah kelas) tersebar merata.
    const teacherDayCount = new Map<string, Map<string, number>>();
    const classDayCount = new Map<string, Map<string, number>>();
    function bump(map: Map<string, Map<string, number>>, key: string, day: string) {
      if (!map.has(key)) map.set(key, new Map(DAYS.map(d => [d, 0])));
      const m = map.get(key)!;
      m.set(day, (m.get(day) ?? 0) + 1);
    }
    function count(map: Map<string, Map<string, number>>, key: string, day: string) {
      return map.get(key)?.get(day) ?? 0;
    }

    // Dipakai supaya kalau beberapa hari beban-nya SAMA PERSIS, hari yang "menang" tiap kali
    // beda-beda (diputar), bukan selalu Senin duluan — tanpa ini Senin/Rabu selalu menang saat
    // seri dan Sabtu (paling belakang di daftar DAYS) jadi konsisten kalah, sampai akhirnya
    // Sabtu ketinggalan kosong dibanding hari lain padahal kapasitasnya sama. SENGAJA
    // deterministik (selalu mulai dari 0, bukan diacak) — dicoba diacak sempat menurunkan
    // total jam yang berhasil dijadwalkan (rata-rata lebih buruk dari versi tetap), jadi
    // dibalik lagi supaya hasil generate konsisten dan bisa diandalkan.
    let dayRotation = 0;
    function bestDayOrder(teacherId: string, classId: string, avoid: Set<string>) {
      const r = dayRotation++ % DAYS.length;
      const rotatedDays = [...DAYS.slice(r), ...DAYS.slice(0, r)];
      return rotatedDays.sort((d1, d2) => {
        const avoidDiff = Number(avoid.has(d1)) - Number(avoid.has(d2));
        if (avoidDiff !== 0) return avoidDiff;
        const load1 = count(teacherDayCount, teacherId, d1) + count(classDayCount, classId, d1);
        const load2 = count(teacherDayCount, teacherId, d2) + count(classDayCount, classId, d2);
        return load1 - load2;
      });
    }

    function placeSlot(a: Assignment, day: string, slot: Slot) {
      markClassSlot(a.classId, day, slot.order);
      markTeacherTime(a.teacherId, day, slot.startTime, slot.endTime, a.subject.name);
      toCreate.push({
        classId: a.classId, teacherId: a.teacherId, subject: a.subject.name,
        day, startTime: slot.startTime, endTime: slot.endTime, weekType,
      });
      bump(teacherDayCount, a.teacherId, day);
      bump(classDayCount, a.classId, day);
    }

    // Cari `length` slot BERURUTAN (bersebelahan) dalam satu hari yang kosong untuk kelas & guru ini
    function findContiguousRun(day: string, length: number, a: Assignment): Slot[] | null {
      const daySlots = slotsByDay.get(day) ?? [];
      for (let start = 0; start + length <= daySlots.length; start++) {
        const run = daySlots.slice(start, start + length);
        const ok = run.every(slot =>
          isClassSlotFree(a.classId, day, slot.order) &&
          !isReservedByOther(a.classId, day, slot.order, a.id) &&
          isTeacherFree(a.teacherId, day, slot.startTime, slot.endTime, a.subject.name, a.subject.maxSharedTeacher)
        );
        if (ok) return run;
      }
      return null;
    }

    // Cari `length` slot berurutan PERSIS mulai dari hari+jam preferensi (dipakai untuk
    // preferensi hari/jam per Penugasan Mengajar) — beda dari findContiguousRun yang mencari
    // di posisi manapun dalam hari itu, ini harus mulai tepat di jam yang diminta.
    function findRunStartingAt(day: string, startTime: string, length: number, a: Assignment): Slot[] | null {
      const daySlots = slotsByDay.get(day) ?? [];
      const startIdx = daySlots.findIndex(s => s.startTime === startTime);
      if (startIdx === -1 || startIdx + length > daySlots.length) return null;
      const run = daySlots.slice(startIdx, startIdx + length);
      const ok = run.every(slot => isClassSlotFree(a.classId, day, slot.order) && isTeacherFree(a.teacherId, day, slot.startTime, slot.endTime, a.subject.name, a.subject.maxSharedTeacher));
      return ok ? run : null;
    }

    // Urutan panjang blok yang dicoba untuk sejumlah `need` jam: utamakan pas penuh, lalu
    // panjang-panjang yang TIDAK menyisakan pas 1 jam (supaya sisa di hari lain minimal 2 jam
    // juga, bukan berkeping-keping 1 jam kalau masih ada pilihan lebih baik). Panjang 1 tetap
    // ditawarkan sebagai UPAYA TERAKHIR (paling belakang) — supaya kalau slot yang tersisa
    // memang sudah terserak (tidak ada 2 jam berdekatan sama sekali), mapel tetap kebagian
    // sebanyak mungkin daripada gagal total. Prioritas: selesai terjadwal > rapi tidak
    // berkeping.
    function lengthCandidates(need: number): number[] {
      const order: number[] = [need];
      for (let len = need - 2; len >= 2; len--) order.push(len);
      if (need - 1 >= 2) order.push(need - 1);
      order.push(1);
      return [...new Set(order)].filter(l => l >= 1 && l <= need);
    }

    // Tempatkan `need` jam sebagai blok, sebisa mungkin bersebelahan dalam 1 hari;
    // kalau tidak muat penuh, ambil potongan bersebelahan terbesar yang tersedia di hari terbaik
    // (minimal 2 jam sekaligus selama masih ada sisa >1, supaya tidak berkeping 1 jam saat
    // kebutuhan masih besar) lalu lanjutkan mencari sisanya di hari lain — pembagian antar-hari
    // jadi fleksibel mengikuti kapasitas nyata (bisa 6+6, 10+2, 8+4, dst), bukan dipaksa
    // setengah-setengah. Jam terakhir (sisa tinggal 1) tetap diusahakan masuk supaya mapel
    // yang totalnya pas kapasitas benar-benar selesai 100%, bukan sengaja disisakan.
    function placeBlock(a: Assignment, need: number, avoidDays: Set<string>): number {
      while (need > 0) {
        const dayOrder = bestDayOrder(a.teacherId, a.classId, avoidDays);
        let placedLen = 0;
        for (const day of dayOrder) {
          for (const len of lengthCandidates(need)) {
            const run = findContiguousRun(day, len, a);
            if (run) {
              for (const slot of run) placeSlot(a, day, slot);
              placedLen = len;
              break;
            }
          }
          if (placedLen > 0) break;
        }
        if (placedLen === 0) break; // benar-benar tidak ada slot kosong tersisa
        need -= placedLen;
      }
      return need; // sisa yang gagal ditempatkan (0 kalau sukses semua)
    }

    // Blok preferensi hari/jam dari Penugasan Mengajar — coba tempatkan tiap blok persis
    // di hari+jam yang diminta (urut sesuai dibuat). Kalau sebuah blok tidak muat/bentrok,
    // blok itu dilewati (tidak membatalkan blok lain). Mengembalikan sisa jam yang belum
    // kebagian dari semua blok preferensi (0 kalau semua kebagian).
    // Reservasi SEMUA slot preferensi (untuk minggu ini) milik SEKUMPULAN assignment SEKALIGUS —
    // dipanggil SEKALI di awal, sebelum SATU PUN penempatan (preferensi maupun otomatis) berjalan
    // di minggu ini. Ini WAJIB mencakup assignment yang preferensinya baru "aktif" belakangan
    // lewat jalur pengisi (mis. mapel yang minggu utamanya A tapi punya blok preferensi dipatok
    // ke Minggu B khusus buat jaga-jaga kalau kelebihan) — kalau reservasi cuma jalan pas
    // applyPreferences masing-masing giliran, mapel LAIN yang primer di minggu ini bisa keburu
    // menempati slot itu duluan lewat otomatis SEBELUM giliran pengisi itu tiba.
    function reserveAllPreferences(assignmentsList: Assignment[]) {
      for (const a of assignmentsList) {
        const applicablePrefs = a.preferences.filter(p => p.weekType === "SEMUA" || p.weekType === weekType);
        for (const pref of applicablePrefs) {
          const daySlots = slotsByDay.get(pref.day) ?? [];
          const startIdx = daySlots.findIndex(s => s.startTime === pref.startTime);
          if (startIdx === -1) continue;
          for (let i = startIdx; i < Math.min(startIdx + pref.hours, daySlots.length); i++) {
            reserveSlot(a.classId, pref.day, daySlots[i].order, a.id);
          }
        }
      }
    }

    function applyPreferences(a: Assignment, hours: number): number {
      let hoursLeft = hours;
      // Blok "SEMUA" boleh dicoba di minggu manapun (A/B/SEMUA); blok yang sudah dipatok ke
      // Minggu A atau B hanya dicoba di pass minggu yang sama — supaya request "Senin jam 1-4
      // khusus Minggu A" tidak ikut kepasang juga di Minggu B.
      const applicablePrefs = a.preferences.filter(p => p.weekType === "SEMUA" || p.weekType === weekType);
      for (const pref of applicablePrefs) {
        if (hoursLeft <= 0) break;
        const want = Math.min(pref.hours, hoursLeft);
        const run = findRunStartingAt(pref.day, pref.startTime, want, a);
        if (run) {
          for (const slot of run) placeSlot(a, pref.day, slot);
          hoursLeft -= want;
        }
      }
      return hoursLeft;
    }

    function placeAutomatic(a: Assignment, hours: number): number {
      if (hours <= 0) return 0;
      return placeBlock(a, hours, new Set());
    }

    // Tempatkan sekumpulan assignment, kembalikan sisa jam yang tidak kebagian slot per
    // assignment — bisa dipanggil beberapa kali berurutan (mis. mapel utama minggu ini
    // dulu, lalu mapel "pengisi" dari kelebihan minggu pasangan). Default jam terbanyak
    // dulu (supaya mapel besar dapat blok utuh); untuk pass "pengisi" dibalik jam
    // TERSEDIKIT dulu — karena di situ cuma sisa ruang kosong yang terserak, dan mapel
    // kecil lebih mudah masuk ke potongan kecil sebelum keduluan mapel besar yang
    // menghabiskan ruang secara tidak efisien.
    function place(list: { a: Assignment; hours: number }[], order: "desc" | "asc" = "desc"): { a: Assignment; missing: number }[] {
      const sorted = [...list].sort((x, y) => order === "desc" ? y.hours - x.hours : x.hours - y.hours);
      // Tahap 1: preferensi hari/jam adalah PRIORITAS UTAMA — proses SEMUA mapel dulu di
      // tahap ini sebelum satu pun penempatan otomatis berjalan, supaya slot yang diminta
      // tidak keburu diambil mapel lain yang kebetulan diproses lebih dulu.
      const afterPreferences = sorted.map(({ a, hours }) => ({ a, hours: applyPreferences(a, hours) }));
      // Tahap 2: sisa jam yang tidak kebagian preferensi (atau memang tidak punya preferensi)
      // baru ditempatkan otomatis seperti biasa.
      return afterPreferences.map(({ a, hours }) => ({ a, missing: placeAutomatic(a, hours) }));
    }

    return { place, toCreate, reserveAllPreferences };
  }

  const allToCreate: { classId: string; teacherId: string; subject: string; day: string; startTime: string; endTime: string; weekType: string }[] = [];
  const allUnscheduled: UnscheduledEntry[] = [];

  // Ambil dulu SEMUA komitmen existing milik kelas LAIN (bukan yang sedang di-generate ulang).
  // Kelas X & XI (rotasi) diproses LEBIH DULU dan PRIORITAS UTAMA — termasuk preferensi hari/jam
  // mereka wajib terpenuhi kalau memungkinkan — dan sengaja TIDAK dibatasi oleh jadwal kelas XII
  // ("SEMUA") sama sekali, baik yang lama maupun yang baru. Kelas XII sifatnya formalitas dan
  // boleh bentrok / menyesuaikan belakangan — jadi kelas XII yang mengalah ke X/XI, bukan
  // sebaliknya.
  const scheduleSelect = { classId: true, teacherId: true, day: true, startTime: true, endTime: true, subject: true } as const;
  const [otherSemuaSchedules, otherASchedules, otherBSchedules] = await Promise.all([
    prisma.schedule.findMany({ where: { classId: { notIn: targetClassIds }, weekType: "SEMUA", scheduleType: "BLOK" }, select: scheduleSelect }),
    prisma.schedule.findMany({ where: { classId: { notIn: targetClassIds }, weekType: "A", scheduleType: "BLOK" }, select: scheduleSelect }),
    prisma.schedule.findMany({ where: { classId: { notIn: targetClassIds }, weekType: "B", scheduleType: "BLOK" }, select: scheduleSelect }),
  ]);

  // Minggu "A" & "B" — kelas rotasi (X & XI, dibalik satu sama lain), jam digandakan 2x.
  // Diproses DULUAN, hanya dibatasi guru yang sama sedang mengajar kelas rotasi LAIN (bukan XII).
  let freshASchedules: { classId: string; teacherId: string | null; day: string; startTime: string; endTime: string; subject: string }[] = [];
  let freshBSchedules: { classId: string; teacherId: string | null; day: string; startTime: string; endTime: string; subject: string }[] = [];
  if (rotatingClassIds.size > 0) {
    const stateA = createWeekState("A", otherASchedules);
    const stateB = createWeekState("B", otherBSchedules);

    const rotAssignments = assignments.filter(a => rotatingClassIds.has(a.classId));
    const primaryA = rotAssignments
      .filter(a => a.subject.weekGroup === weekGroupForClass(gradeByClassId.get(a.classId)!, "A"))
      .map(a => ({ a, hours: a.subject.hoursPerWeek * 2 }));
    const primaryB = rotAssignments
      .filter(a => a.subject.weekGroup === weekGroupForClass(gradeByClassId.get(a.classId)!, "B"))
      .map(a => ({ a, hours: a.subject.hoursPerWeek * 2 }));

    // Reservasi SEMUA preferensi rotAssignments dulu di kedua minggu — termasuk yang minggu
    // utamanya BUKAN minggu ini (baru "aktif" belakangan lewat jalur pengisi) — supaya tidak ada
    // penempatan otomatis apa pun yang keburu menyerobot slot itu duluan.
    stateA.reserveAllPreferences(rotAssignments);
    stateB.reserveAllPreferences(rotAssignments);

    const resultsA1 = stateA.place(primaryA);
    const resultsB1 = stateB.place(primaryB);

    // Pengisi: kelebihan jam yang tidak muat di minggu utamanya dicoba masuk mengisi
    // slot kosong di minggu pasangannya (bukan langsung dilaporkan "belum terjadwal").
    const fillerForA = resultsB1.filter(r => r.missing > 0).map(r => ({ a: r.a, hours: r.missing }));
    const fillerForB = resultsA1.filter(r => r.missing > 0).map(r => ({ a: r.a, hours: r.missing }));

    const resultsA2 = stateA.place(fillerForA, "asc");
    const resultsB2 = stateB.place(fillerForB, "asc");

    allToCreate.push(...stateA.toCreate, ...stateB.toCreate);
    freshASchedules = stateA.toCreate;
    freshBSchedules = stateB.toCreate;
    for (const r of resultsA2) if (r.missing > 0) allUnscheduled.push(entryFor(r.a, r.missing));
    for (const r of resultsB2) if (r.missing > 0) allUnscheduled.push(entryFor(r.a, r.missing));
  }

  // Pass "SEMUA" — kelas non-rotasi (mis. XII), jam normal, jadwal sama tiap minggu. Diproses
  // BELAKANGAN, mengalah ke guru yang sudah dipakai kelas X/XI (baik minggu lama milik kelas lain
  // maupun yang baru saja digenerate di atas) — kalau tidak kebagian slot, cukup masuk daftar
  // "belum terjadwal" seperti biasa, tidak mengganggu X/XI.
  if (fixedClassIds.size > 0) {
    const passAssignments = assignments.filter(a => fixedClassIds.has(a.classId));
    const state = createWeekState("SEMUA", [...otherSemuaSchedules, ...otherASchedules, ...otherBSchedules, ...freshASchedules, ...freshBSchedules]);
    state.reserveAllPreferences(passAssignments);
    const results = state.place(passAssignments.map(a => ({ a, hours: a.subject.hoursPerWeek })));
    allToCreate.push(...state.toCreate);
    for (const r of results) if (r.missing > 0) allUnscheduled.push(entryFor(r.a, r.missing));
  }

  // Kelas target yang belum punya penugasan mengajar sama sekali
  const classesWithAssignment = new Set(assignments.map(a => a.classId));
  for (const c of targetClasses) {
    if (!classesWithAssignment.has(c.id)) {
      allUnscheduled.push({ className: c.name, subjectName: "(semua mapel)", teacherName: "-", missingHours: 0 });
    }
  }

  if (allToCreate.length > 0) {
    await prisma.schedule.createMany({
      data: allToCreate.map(t => ({ ...t, generated: true, scheduleType: "BLOK" })),
    });
  }

  return NextResponse.json({
    created: allToCreate.length,
    classesProcessed: targetClasses.length,
    unscheduled: allUnscheduled,
  });
}
