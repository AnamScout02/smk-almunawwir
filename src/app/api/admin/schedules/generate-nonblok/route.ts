import { NextRequest, NextResponse } from "next/server";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const DAYS = ["SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];
// Kelas XII pakai kuota jam/hari yang lebih pendek (sama seperti jadwal BLOK-nya), kelas X/XI
// pakai kapasitas penuh (semua periode non-istirahat tersedia) karena tanpa kali 2, totalnya
// pas 56 jam = 1 minggu penuh.
const XII_QUOTA: Record<string, number> = { SENIN: 9, SELASA: 9, RABU: 8, KAMIS: 8, JUMAT: 6, SABTU: 8 };

interface Slot { day: string; startTime: string; endTime: string }

export async function POST(req: NextRequest) {
  await verifyTasAccess();
  const body = await req.json().catch(() => ({}));
  const classIds: string[] | undefined = Array.isArray(body.classIds) && body.classIds.length > 0 ? body.classIds : undefined;

  const periods = await prisma.schoolPeriod.findMany({ where: { isBreak: false }, orderBy: [{ day: "asc" }, { order: "asc" }] });
  if (periods.length === 0) {
    return NextResponse.json({ error: "Kerangka jam pelajaran belum diatur." }, { status: 400 });
  }
  const periodsByDay = new Map<string, Slot[]>();
  for (const day of DAYS) {
    const seen = new Set<string>();
    const list = periods.filter(p => p.day === day && (seen.has(p.startTime) ? false : (seen.add(p.startTime), true)));
    periodsByDay.set(day, list.map(p => ({ day, startTime: p.startTime, endTime: p.endTime })));
  }

  const targetClasses = await prisma.class.findMany({
    where: classIds ? { id: { in: classIds } } : undefined,
    include: { major: true },
  });
  if (targetClasses.length === 0) {
    return NextResponse.json({ error: "Tidak ada kelas yang dipilih" }, { status: 400 });
  }
  const targetClassIds = targetClasses.map(c => c.id);
  const majorById = new Map(targetClasses.map(c => [c.id, c.majorId] as const));

  function slotsFor(cls: (typeof targetClasses)[number]): Record<string, Slot[]> {
    const out: Record<string, Slot[]> = {};
    for (const day of DAYS) {
      const all = periodsByDay.get(day) ?? [];
      const quota = cls.grade === 12 ? XII_QUOTA[day] : all.length;
      out[day] = all.slice(0, quota);
    }
    return out;
  }
  const classSlots = new Map<string, Record<string, Slot[]>>();
  for (const c of targetClasses) classSlots.set(c.id, slotsFor(c));

  await prisma.schedule.deleteMany({ where: { classId: { in: targetClassIds }, scheduleType: "NONBLOK" } });

  const assignments = await prisma.teachingAssignment.findMany({
    where: { classId: { in: targetClassIds } },
    include: { subject: true, teacher: { include: { user: { select: { name: true } } } }, class: true },
  });
  type Assignment = (typeof assignments)[number];

  const classUsedSlots = new Map<string, Set<number>>();
  function isClassSlotFree(classId: string, day: string, idx: number) { return !(classUsedSlots.get(`${classId}|${day}`)?.has(idx)); }
  function markClassSlot(classId: string, day: string, idx: number) {
    const key = `${classId}|${day}`;
    if (!classUsedSlots.has(key)) classUsedSlots.set(key, new Set());
    classUsedSlots.get(key)!.add(idx);
  }

  const teacherBusy = new Map<string, { majorId: string | null; subjectName: string }>();
  function isSlotOkForTeacher(teacherId: string, day: string, idx: number, majorId: string | null, subjectName: string) {
    const existing = teacherBusy.get(`${teacherId}|${day}|${idx}`);
    if (!existing) return true;
    return existing.majorId === majorId && existing.subjectName === subjectName;
  }
  function markTeacherSlot(teacherId: string, day: string, idx: number, majorId: string | null, subjectName: string) {
    teacherBusy.set(`${teacherId}|${day}|${idx}`, { majorId, subjectName });
  }
  const groupPlacedSlots = new Map<string, { day: string; idx: number }[]>();
  function groupKey(teacherId: string, subjectName: string, majorId: string | null) { return `${teacherId}|${subjectName}|${majorId}`; }

  // Guru yang mengajar mapel yang sama ke lebih banyak jurusan berbeda diprioritaskan duluan
  // (paling terikat), supaya tidak kehabisan slot yang cocok di akhir.
  const teacherMajorCount = new Map<string, Set<string | null>>();
  for (const a of assignments) {
    if (!teacherMajorCount.has(a.teacherId)) teacherMajorCount.set(a.teacherId, new Set());
    teacherMajorCount.get(a.teacherId)!.add(majorById.get(a.classId) ?? null);
  }
  const tasks = assignments.map(a => ({ a, need: a.subject.hoursPerWeek, spread: teacherMajorCount.get(a.teacherId)!.size }));
  tasks.sort((x, y) => y.spread - x.spread || y.need - x.need);

  const allToCreate: { classId: string; teacherId: string; subject: string; day: string; startTime: string; endTime: string; weekType: string; scheduleType: string; generated: boolean }[] = [];
  const unplaced: { className: string; subjectName: string; teacherName: string; missingHours: number }[] = [];
  let dayRotation = 0;

  for (const task of tasks) {
    const { a } = task;
    const cls = a.class;
    const majorId = majorById.get(cls.id) ?? null;
    const gKey = groupKey(a.teacherId, a.subject.name, majorId);
    const daySlotsForClass = classSlots.get(cls.id)!;
    let need = task.need;

    const twinSlots = groupPlacedSlots.get(gKey) ?? [];
    for (const { day, idx } of twinSlots) {
      if (need <= 0) break;
      if (idx >= daySlotsForClass[day].length) continue;
      if (!isClassSlotFree(cls.id, day, idx)) continue;
      const slot = daySlotsForClass[day][idx];
      allToCreate.push({ classId: cls.id, teacherId: a.teacherId, subject: a.subject.name, day, startTime: slot.startTime, endTime: slot.endTime, weekType: "SEMUA", scheduleType: "NONBLOK", generated: true });
      markClassSlot(cls.id, day, idx);
      need--;
    }

    while (need > 0) {
      const dayOrder = [...DAYS].sort((d1, d2) => {
        const r1 = (DAYS.indexOf(d1) - dayRotation + DAYS.length) % DAYS.length;
        const r2 = (DAYS.indexOf(d2) - dayRotation + DAYS.length) % DAYS.length;
        return r1 - r2;
      });
      dayRotation++;
      let placedAny = false;
      for (const day of dayOrder) {
        const daySlots = daySlotsForClass[day];
        for (let idx = 0; idx < daySlots.length && need > 0; idx++) {
          if (!isClassSlotFree(cls.id, day, idx)) continue;
          if (!isSlotOkForTeacher(a.teacherId, day, idx, majorId, a.subject.name)) continue;
          const slot = daySlots[idx];
          allToCreate.push({ classId: cls.id, teacherId: a.teacherId, subject: a.subject.name, day, startTime: slot.startTime, endTime: slot.endTime, weekType: "SEMUA", scheduleType: "NONBLOK", generated: true });
          markTeacherSlot(a.teacherId, day, idx, majorId, a.subject.name);
          markClassSlot(cls.id, day, idx);
          if (!groupPlacedSlots.has(gKey)) groupPlacedSlots.set(gKey, []);
          groupPlacedSlots.get(gKey)!.push({ day, idx });
          need--; placedAny = true;
        }
        if (need <= 0) break;
      }
      if (!placedAny) {
        unplaced.push({ className: cls.name, subjectName: a.subject.name, teacherName: a.teacher.user.name, missingHours: need });
        break;
      }
    }
  }

  if (allToCreate.length > 0) {
    await prisma.schedule.createMany({ data: allToCreate });
  }

  return NextResponse.json({
    created: allToCreate.length,
    classesProcessed: targetClasses.length,
    unscheduled: unplaced,
  });
}
