import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { kirimLatar } from "@/lib/push-server";
import { beritahuAlphaBeruntun, beritahuOrangTuaAlpha } from "@/lib/notifikasi-kejadian";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

async function getAuthorizedContext(email: string) {
  const student = await prisma.student.findFirst({
    where: { user: { email } },
    select: { id: true, classId: true },
  });
  if (!student || !student.classId) return null;
  const cls = await prisma.class.findUnique({
    where: { id: student.classId },
    select: { id: true, name: true, ketuaKelasId: true, sekretarisId: true },
  });
  if (!cls) return null;
  const isAuthorized = cls.ketuaKelasId === student.id || cls.sekretarisId === student.id;
  return { student, cls, isAuthorized };
}

export async function GET(req: NextRequest) {
  try {
    const session = await verifyRole(["STUDENT"]);
    const ctx = await getAuthorizedContext(session.email);
    if (!ctx || !ctx.isAuthorized) {
      return NextResponse.json({ error: "Khusus Ketua Kelas/Sekretaris yang bisa mengakses absensi ini." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const dateStr = searchParams.get("date") || new Date().toISOString().slice(0, 10);
    const date = new Date(dateStr);
    const nextDay = new Date(date.getTime() + 86400000);

    const students = await prisma.student.findMany({
      where: { classId: ctx.cls.id, studentStatus: "AKTIF" },
      select: { id: true, nis: true, user: { select: { name: true } } },
      orderBy: { user: { name: "asc" } },
    });
    const existing = await prisma.attendance.findMany({
      where: { studentId: { in: students.map(s => s.id) }, date: { gte: date, lt: nextDay } },
    });

    return NextResponse.json({ className: ctx.cls.name, students, existing });
  } catch (e) {
    lemparBilaPengalihan(e);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await verifyRole(["STUDENT"]);
    const ctx = await getAuthorizedContext(session.email);
    if (!ctx || !ctx.isAuthorized) {
      return NextResponse.json({ error: "Khusus Ketua Kelas/Sekretaris yang bisa mengakses absensi ini." }, { status: 403 });
    }

    const body = await req.json();
    const { date, records } = body as { date: string; records: { studentId: string; status: string }[] };
    if (!date || !Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ error: "Data tidak lengkap" }, { status: 400 });
    }

    const classStudents = await prisma.student.findMany({ where: { classId: ctx.cls.id }, select: { id: true } });
    const validIds = new Set(classStudents.map(s => s.id));
    for (const r of records) {
      if (!validIds.has(r.studentId)) {
        return NextResponse.json({ error: "Siswa di luar kelas Anda tidak dapat diabsen" }, { status: 400 });
      }
    }

    const d = new Date(date);
    const nextDay = new Date(d.getTime() + 86400000);
    await prisma.$transaction(async (tx) => {
      for (const r of records) {
        await tx.attendance.deleteMany({ where: { studentId: r.studentId, date: { gte: d, lt: nextDay } } });
        await tx.attendance.create({ data: { studentId: r.studentId, date: d, status: r.status } });
      }
    });

    // ALPHA → notifikasi orang tua; alpha ≥3 hari beruntun → wali kelas & BK. Tanpa menunggu, tidak menggagalkan simpan.
    const catatan = records.map(r => ({ studentId: r.studentId, date: d, status: r.status }));
    kirimLatar(async () => { await beritahuOrangTuaAlpha(catatan); await beritahuAlphaBeruntun(catatan); });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (e) {
    lemparBilaPengalihan(e);
    console.error("[student attendance POST]", e);
    return NextResponse.json({ error: "Gagal menyimpan absensi" }, { status: 500 });
  }
}
