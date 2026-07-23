export const dynamic = "force-dynamic";

import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import PrintButton from "@/components/shared/PrintButton";

export default async function TeachingLoadPrintPage() {
  await verifyRole(["ADMIN", "TAS"]);

  const [classes, assignments] = await Promise.all([
    prisma.class.findMany({ include: { major: { select: { code: true } } }, orderBy: [{ grade: "asc" }, { major: { code: "asc" } }, { name: "asc" }] }),
    prisma.teachingAssignment.findMany({
      include: {
        teacher: { include: { user: { select: { name: true } } } },
        subject: { select: { name: true, hoursPerWeek: true } },
        class: { select: { id: true } },
      },
    }),
  ]);

  const TARGET_JP: Record<number, number> = { 10: 56, 11: 56, 12: 48 };
  const classTotals = new Map<string, number>();
  for (const a of assignments) {
    classTotals.set(a.class.id, (classTotals.get(a.class.id) ?? 0) + a.subject.hoursPerWeek);
  }
  const grandTotal = [...classTotals.values()].reduce((sum, v) => sum + v, 0);

  // Kelompokkan: guru -> mapel -> { classId: jam }
  interface SubjectRow { subjectName: string; hoursByClass: Map<string, number> }
  interface TeacherGroup { teacherId: string; teacherName: string; nip: string; subjectRows: SubjectRow[]; jjm: number }

  const teacherMap = new Map<string, TeacherGroup>();
  for (const a of assignments) {
    if (!teacherMap.has(a.teacherId)) {
      teacherMap.set(a.teacherId, { teacherId: a.teacherId, teacherName: a.teacher.user.name, nip: a.teacher.nip, subjectRows: [], jjm: 0 });
    }
    const group = teacherMap.get(a.teacherId)!;
    let row = group.subjectRows.find(r => r.subjectName === a.subject.name);
    if (!row) {
      row = { subjectName: a.subject.name, hoursByClass: new Map() };
      group.subjectRows.push(row);
    }
    row.hoursByClass.set(a.class.id, a.subject.hoursPerWeek);
    group.jjm += a.subject.hoursPerWeek;
  }

  const teacherGroups = [...teacherMap.values()].sort((a, b) => a.teacherName.localeCompare(b.teacherName));

  const today = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

  return (
    <>
      <div className="print:hidden bg-primary-900 text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/admin/teaching-assignments" className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition">
            <ArrowLeft size={16} />
          </Link>
          <h1 className="font-heading font-bold">Cetak Pembagian Tugas Mengajar</h1>
        </div>
        <PrintButton />
      </div>

      <div className="p-4 print:p-2">
        <div className="text-center mb-3 print:mb-2">
          <h2 className="font-heading text-lg font-bold text-primary-900">SMK Al-Munawwir IIBS</h2>
          <h3 className="font-heading text-sm font-bold text-primary-900">PEMBAGIAN TUGAS MENGAJAR GURU — KURIKULUM MERDEKA</h3>
          <p className="text-[10px] text-gray-400">Dicetak {today} — JJM = Jumlah Jam Mengajar per minggu (total semua kelas &amp; mapel)</p>
        </div>

        <div className="overflow-x-auto print:overflow-visible">
          <table className="border-collapse w-full text-[9px] print:text-[7px]">
            <thead>
              <tr className="bg-primary-900 text-white">
                <th rowSpan={2} className="border border-gray-300 px-1 py-1 w-8">No</th>
                <th rowSpan={2} className="border border-gray-300 px-1 py-1 w-40">Nama Guru &amp; NIP</th>
                <th rowSpan={2} className="border border-gray-300 px-1 py-1 w-32">Jabatan / Tugas Mengajar</th>
                <th colSpan={classes.length} className="border border-gray-300 px-1 py-1">Jumlah Jam / Kelas</th>
                <th rowSpan={2} className="border border-gray-300 px-1 py-1 w-10">JJM</th>
              </tr>
              <tr className="bg-primary-800 text-white">
                {classes.map(c => (
                  <th key={c.id} className="border border-gray-300 px-1 py-1 whitespace-nowrap">{c.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {teacherGroups.map((g, gi) => (
                g.subjectRows.map((row, ri) => (
                  <tr key={`${g.teacherId}-${row.subjectName}`} className="even:bg-gray-50/50">
                    {ri === 0 && (
                      <>
                        <td rowSpan={g.subjectRows.length} className="border border-gray-300 px-1 py-0.5 text-center align-middle">{gi + 1}</td>
                        <td rowSpan={g.subjectRows.length} className="border border-gray-300 px-1 py-0.5 align-middle">
                          <div className="font-semibold">{g.teacherName}</div>
                          <div className="text-gray-400 font-mono">{g.nip}</div>
                        </td>
                      </>
                    )}
                    <td className="border border-gray-300 px-1 py-0.5">{row.subjectName}</td>
                    {classes.map(c => (
                      <td key={c.id} className="border border-gray-300 px-1 py-0.5 text-center">
                        {row.hoursByClass.get(c.id) ?? ""}
                      </td>
                    ))}
                    {ri === 0 && (
                      <td rowSpan={g.subjectRows.length} className="border border-gray-300 px-1 py-0.5 text-center align-middle font-bold">
                        {g.jjm}
                      </td>
                    )}
                  </tr>
                ))
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-primary-50 font-bold">
                <td colSpan={3} className="border border-gray-300 px-1 py-1 text-right">JUMLAH JP</td>
                {classes.map(c => {
                  const total = classTotals.get(c.id) ?? 0;
                  const target = TARGET_JP[c.grade];
                  const ok = total === target;
                  return (
                    <td key={c.id} className={`border border-gray-300 px-1 py-1 text-center ${ok ? "" : "bg-amber-100 text-amber-800"}`}>
                      {total}
                    </td>
                  );
                })}
                <td className="border border-gray-300 px-1 py-1 text-center">{grandTotal}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <style>{`@page { size: A4 landscape; margin: 6mm; }`}</style>
    </>
  );
}
