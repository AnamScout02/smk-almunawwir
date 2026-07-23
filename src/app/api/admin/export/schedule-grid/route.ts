import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { weekTypesOverlap } from "@/lib/schedule-week";
import { colorForTeacherCode } from "@/lib/teacher-colors";

export const dynamic = "force-dynamic";

const DAYS = ["SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];
const DAY_LABEL: Record<string, string> = { SENIN: "Senin", SELASA: "Selasa", RABU: "Rabu", KAMIS: "Kamis", JUMAT: "Jumat", SABTU: "Sabtu" };

// exceljs pakai format ARGB (8 karakter, ada prefix alpha "FF"), bukan "#RRGGBB" biasa.
function toArgb(hex: string): string {
  return "FF" + hex.replace("#", "").toUpperCase();
}

export async function GET() {
  await verifyRole(["ADMIN", "TAS"]);

  const [periods, classes, schedules, assignments] = await Promise.all([
    prisma.schoolPeriod.findMany({ orderBy: [{ day: "asc" }, { order: "asc" }] }),
    prisma.class.findMany({ where: { grade: { in: [10, 11, 12] } }, orderBy: [{ grade: "asc" }, { name: "asc" }] }),
    prisma.schedule.findMany({ where: { scheduleType: "BLOK" }, select: { classId: true, teacherId: true, subject: true, day: true, startTime: true, weekType: true } }),
    prisma.teachingAssignment.findMany({
      include: { subject: { select: { name: true, code: true } }, teacher: { select: { shortCode: true } } },
    }),
  ]);

  const codeIndex = new Map<string, { teacherCode: string; subjectCode: number }>();
  for (const a of assignments) {
    codeIndex.set(`${a.classId}|${a.subject.name}`, { teacherCode: a.teacher.shortCode ?? "?", subjectCode: a.subject.code });
  }

  const periodsByDay = new Map<string, typeof periods>();
  for (const day of DAYS) {
    const seen = new Set<string>();
    periodsByDay.set(day, periods.filter(p => p.day === day && (seen.has(p.startTime) ? false : (seen.add(p.startTime), true))));
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SMK Al-Munawwir IIBS";
  workbook.created = new Date();

  for (const weekType of ["A", "B"] as const) {
    const sheet = workbook.addWorksheet(`Minggu ${weekType === "A" ? "1" : "2"}`, {
      views: [{ state: "frozen", xSplit: 2, ySplit: 1 }],
    });

    const scheduleIndex = new Map<string, (typeof schedules)[number]>();
    for (const s of schedules) {
      if (!weekTypesOverlap(s.weekType, weekType)) continue;
      scheduleIndex.set(`${s.classId}|${s.day}|${s.startTime}`, s);
    }

    const headerRow = sheet.addRow(["Hari", "Waktu", ...classes.map(c => c.name)]);
    headerRow.eachCell(cell => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });
    sheet.getColumn(1).width = 10;
    sheet.getColumn(2).width = 10;
    for (let i = 0; i < classes.length; i++) sheet.getColumn(i + 3).width = 12;

    for (const day of DAYS) {
      const dayPeriods = periodsByDay.get(day) ?? [];
      const startRowIndex = sheet.rowCount + 1;
      for (const period of dayPeriods) {
        if (period.isBreak) {
          const row = sheet.addRow([day === dayPeriods[0]?.day ? "" : "", period.startTime, period.label ?? "Istirahat"]);
          const lastCol = 2 + classes.length;
          sheet.mergeCells(row.number, 3, row.number, lastCol);
          const cell = row.getCell(3);
          cell.alignment = { horizontal: "center", vertical: "middle" };
          cell.font = { italic: true, color: { argb: "FF6D28D9" } };
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F3FF" } };
          continue;
        }
        const rowValues: (string | number)[] = ["", period.startTime];
        for (const c of classes) {
          const sched = scheduleIndex.get(`${c.id}|${day}|${period.startTime}`);
          if (!sched) { rowValues.push(""); continue; }
          const info = codeIndex.get(`${c.id}|${sched.subject}`);
          rowValues.push(info ? `${info.teacherCode} ${info.subjectCode}` : "?");
        }
        const row = sheet.addRow(rowValues);
        for (let i = 0; i < classes.length; i++) {
          const sched = scheduleIndex.get(`${classes[i].id}|${day}|${period.startTime}`);
          if (!sched) continue;
          const info = codeIndex.get(`${classes[i].id}|${sched.subject}`);
          const color = colorForTeacherCode(info?.teacherCode ?? "?");
          const cell = row.getCell(3 + i);
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: toArgb(color.bg) } };
          cell.font = { color: { argb: toArgb(color.text) }, bold: true, size: 9 };
          cell.alignment = { horizontal: "center", vertical: "middle" };
          cell.note = sched.subject;
        }
      }
      const endRowIndex = sheet.rowCount;
      if (endRowIndex >= startRowIndex) {
        sheet.mergeCells(startRowIndex, 1, endRowIndex, 1);
        const dayCell = sheet.getCell(startRowIndex, 1);
        dayCell.value = DAY_LABEL[day];
        dayCell.alignment = { horizontal: "center", vertical: "middle" };
        dayCell.font = { bold: true, color: { argb: "FF1E3A5F" } };
        dayCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF6FF" } };
      }
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `jadwal-referensi-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
