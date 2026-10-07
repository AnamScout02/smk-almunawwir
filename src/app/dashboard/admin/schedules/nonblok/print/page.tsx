export const dynamic = "force-dynamic";

import { verifyTasAccess } from "@/lib/tas-access-guard";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import PrintButton from "@/components/shared/PrintButton";
import PrintKop from "@/components/shared/PrintKop";
import { colorForTeacherCode } from "@/lib/teacher-colors";
import { buildPrintFilename } from "@/lib/print-filename";

export function generateMetadata() {
  return { title: { absolute: buildPrintFilename("Jadwal-NonBlok", "Gabungan") } };
}

const DAYS = ["SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];
const DAY_LABEL: Record<string, string> = {
  SENIN: "SENIN", SELASA: "SELASA", RABU: "RABU", KAMIS: "KAMIS", JUMAT: "JUMAT", SABTU: "SABTU",
};

export default async function NonBlokMasterPrintPage() {
  await verifyTasAccess();

  const [periods, classes, schedules, subjects, settings] = await Promise.all([
    prisma.schoolPeriod.findMany({ orderBy: [{ day: "asc" }, { order: "asc" }] }),
    prisma.class.findMany({ include: { major: { select: { code: true } } }, orderBy: [{ grade: "asc" }, { major: { code: "asc" } }, { name: "asc" }] }),
    prisma.schedule.findMany({
      where: { scheduleType: "NONBLOK" },
      include: { teacher: { select: { shortCode: true } }, class: { select: { id: true, grade: true } } },
    }),
    prisma.subject.findMany({ select: { name: true, grade: true, code: true, maxSharedTeacher: true } }),
    getSettings(["logo.full_white"]),
  ]);
  const logoUrl = settings["logo.full_white"];

  const subjectInfo = new Map<string, { code: number; maxShared: number }>();
  for (const s of subjects) subjectInfo.set(`${s.grade}|${s.name}`, { code: s.code, maxShared: s.maxSharedTeacher });

  const periodsByDay = new Map<string, typeof periods>();
  for (const day of DAYS) periodsByDay.set(day, periods.filter(p => p.day === day));
  const periodStartsByDay = new Map<string, string[]>();
  for (const day of DAYS) periodStartsByDay.set(day, (periodsByDay.get(day) ?? []).filter(p => !p.isBreak).map(p => p.startTime));

  // PERBAIKAN 2026-08-11 (akar masalah sama dgn tabel gabungan BLOK) — sebar tiap baris ke SEMUA
  // periode yg tercakup rentang [startTime,endTime)-nya, bukan cuma exact-match startTime|endTime.
  function periodsCoveredByRow(day: string, startTime: string, endTime: string): string[] {
    const starts = (periodStartsByDay.get(day) ?? []).filter(t => t >= startTime && t < endTime);
    return starts.length > 0 ? starts : [startTime];
  }

  const cellMap = new Map<string, { subjectCode: string; teacherCode: string }>();
  for (const s of schedules) {
    const info = subjectInfo.get(`${s.class.grade}|${s.subject}`);
    const cellValue = { subjectCode: info ? String(info.code) : s.subject.slice(0, 3), teacherCode: s.teacher?.shortCode ?? "-" };
    for (const pStart of periodsCoveredByRow(s.day, s.startTime, s.endTime)) {
      cellMap.set(`${s.classId}|${s.day}|${pStart}`, cellValue);
    }
  }

  // Tandai sel bentrok: guru sama muncul di >1 kelas pada jam yang sama, di luar batas
  // maxSharedTeacher DAN bukan sesama jurusan+mapel sama (sesi gabung yang sah).
  const classMajorId = new Map<string, string | null>();
  const classesWithMajor = await prisma.class.findMany({ select: { id: true, majorId: true } });
  for (const c of classesWithMajor) classMajorId.set(c.id, c.majorId);

  const conflictCells = new Set<string>();
  const bySlot = new Map<string, typeof schedules>();
  for (const s of schedules) {
    for (const pStart of periodsCoveredByRow(s.day, s.startTime, s.endTime)) {
      const key = `${s.day}|${pStart}`;
      if (!bySlot.has(key)) bySlot.set(key, []);
      bySlot.get(key)!.push(s);
    }
  }
  for (const group of bySlot.values()) {
    const byTeacher = new Map<string, typeof schedules>();
    for (const s of group) {
      if (!s.teacherId) continue;
      if (!byTeacher.has(s.teacherId)) byTeacher.set(s.teacherId, []);
      byTeacher.get(s.teacherId)!.push(s);
    }
    for (const entries of byTeacher.values()) {
      if (entries.length <= 1) continue;
      const majors = new Set(entries.map(e => classMajorId.get(e.classId)));
      const subjectNames = new Set(entries.map(e => e.subject));
      const maxShared = subjectInfo.get(`${entries[0].class.grade}|${entries[0].subject}`)?.maxShared ?? 1;
      const allowed = (majors.size === 1 && subjectNames.size === 1) || (subjectNames.size === 1 && entries.length <= maxShared);
      if (!allowed) {
        for (const e of entries) {
          for (const pStart of periodsCoveredByRow(e.day, e.startTime, e.endTime)) conflictCells.add(`${e.classId}|${e.day}|${pStart}`);
        }
      }
    }
  }

  const today = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

  return (
    <>
      <div className="print:hidden sticky top-0 z-30 relative overflow-hidden text-white px-6 py-4 flex items-center justify-between"
        style={{ background: "linear-gradient(135deg, #0A1030 0%, #0F1A45 40%, #1B2B6B 100%)" }}>
        <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{ backgroundImage: "url('/images/pattern-smk-miring.png')", backgroundSize: "197.99px 197.99px", backgroundRepeat: "repeat", filter: "invert(1)" }} />
        <div className="relative flex items-center gap-3">
          <Link href="/dashboard/admin/schedules/nonblok" className="flex items-center gap-1.5 h-8 px-3 rounded-full bg-white/10 hover:bg-white/20 text-xs font-semibold transition shrink-0">
            <ArrowLeft size={16} /> Kembali
          </Link>
          <h1 className="font-heading font-bold">Cetak Tabel Jadwal Non-Blok Gabungan</h1>
        </div>
        <div className="relative"><PrintButton /></div>
      </div>

      <div className="print-doc bg-white relative p-4 print:p-2">
        <div className="absolute inset-0 opacity-[0.05] pointer-events-none -z-10"
          style={{ backgroundImage: "url('/images/pattern-smk-miring.png')", backgroundSize: "127.28px 127.28px", backgroundRepeat: "repeat" }} />
        <PrintKop title="Tabel Jadwal Pelajaran Non-Blok Gabungan" subtitle="SMK Al Munawwir IIBS" logoUrl={logoUrl} />
        <div className="text-center mb-3 print:mb-2">
          <h3 className="font-heading text-sm font-bold text-primary-900">1 MINGGU (KHUSUS DAPODIK)</h3>
          <p className="text-[10px] text-gray-400">
            Tanpa bergantian minggu, tanpa kali 2 — Dicetak {today} — kode sel: <strong>kode guru</strong> / kode mapel ·
            {" "}<span className="bg-red-200 text-red-800 px-1 rounded">merah</span> = guru bentrok jadwal
          </p>
        </div>

        <div className="overflow-x-auto print:overflow-visible">
          <table className="border-collapse w-full text-[9px] print:text-[7px]">
            <thead>
              <tr className="bg-primary-900 text-white">
                <th className="border border-gray-300 px-1 py-1 w-16">Hari</th>
                <th className="border border-gray-300 px-1 py-1 w-16">Waktu</th>
                {classes.map(c => (
                  <th key={c.id} className="border border-gray-300 px-0.5 py-1 whitespace-nowrap">
                    {c.name.replace(/^(X|XI|XII)\s/, "")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map(day => {
                const dayPeriods = periodsByDay.get(day) ?? [];
                return dayPeriods.map((p, idx) => (
                    <tr key={p.id}>
                      {idx === 0 && (
                        <td rowSpan={dayPeriods.length} className="border border-gray-300 px-1 py-1 text-center font-bold align-middle bg-primary-50">
                          {DAY_LABEL[day]}
                        </td>
                      )}
                      <td className="border border-gray-300 px-1 py-0.5 text-center font-mono whitespace-nowrap text-gray-400">{p.startTime}</td>
                      {p.isBreak ? (
                        <td colSpan={classes.length} className="border border-gray-300 px-1 py-0.5 text-center font-bold text-violet-700 bg-violet-50">
                          {p.label ?? "Istirahat"}
                        </td>
                      ) : (
                        classes.map(c => {
                          const cell = cellMap.get(`${c.id}|${day}|${p.startTime}`);
                          const isConflict = conflictCells.has(`${c.id}|${day}|${p.startTime}`);
                          if (isConflict) {
                            return (
                              <td key={c.id} className="border border-gray-300 px-0.5 py-0.5 text-center bg-red-200 text-red-900 font-bold">!</td>
                            );
                          }
                          if (!cell) {
                            return <td key={c.id} className="border border-gray-300 px-0.5 py-0.5 text-center text-gray-300">·</td>;
                          }
                          const color = colorForTeacherCode(cell.teacherCode);
                          return (
                            <td key={c.id} className="border border-gray-300 px-0 py-0.5 text-center font-bold"
                              style={{ background: color.bg, color: color.text }}>
                              {cell.teacherCode} {cell.subjectCode}
                            </td>
                          );
                        })
                      )}
                    </tr>
                  ));
              })}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        @page { size: A4 landscape; margin: 8mm 2cm; }
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
      `}</style>
    </>
  );
}
