import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { assertKedisiplinan } from "@/lib/kedisiplinan-guard";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    await assertKedisiplinan(session);

    const [records, scheduleAttendance, dutyAttendance, teachers] = await Promise.all([
      prisma.teacherDiscipline.findMany({
        orderBy: { date: "desc" },
        include: { teacher: { select: { nip: true, user: { select: { name: true } } } } },
      }),
      // Rekap absensi per jam pelajaran (TeacherScheduleAttendance) — ditampilkan digabung dengan
      // `records` di atas pada tabel yang sama, dibedakan lewat field kelas/mapel/jam.
      prisma.teacherScheduleAttendance.findMany({
        orderBy: { date: "desc" },
        include: {
          schedule: {
            include: {
              class: { select: { name: true } },
              teacher: { select: { nip: true, user: { select: { name: true } } } },
            },
          },
        },
      }),
      // Rekap kehadiran PETUGAS PIKET itu sendiri — ikut digabung ke tabel rekap yang sama supaya
      // riwayatnya lengkap satu tempat (poinnya sudah ikut dihitung di leaderboard sejak awal).
      prisma.dutyAttendance.findMany({
        orderBy: { date: "desc" },
        include: { user: { select: { name: true, role: true, teacher: { select: { nip: true } } } } },
      }),
      prisma.teacher.findMany({
        where: { teacherStatus: "AKTIF" },
        select: { id: true, nip: true, user: { select: { name: true } } },
        orderBy: { user: { name: "asc" } },
      }),
    ]);
    return NextResponse.json({ records, scheduleAttendance, dutyAttendance, teachers });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Wakil Kepala Penjamin Mutu / Guru Piket." }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    await assertKedisiplinan(session);

    const body = await req.json();
    const { teacherId, date, status, checkInTime, notes } = body;
    if (!teacherId || !date || !status) {
      return NextResponse.json({ error: "Guru, tanggal, dan status wajib diisi" }, { status: 400 });
    }

    const record = await prisma.teacherDiscipline.upsert({
      where: { teacherId_date: { teacherId, date: new Date(date) } },
      update: { status, checkInTime: checkInTime || null, notes: notes || null },
      create: { teacherId, date: new Date(date), status, checkInTime: checkInTime || null, notes: notes || null },
      include: { teacher: { select: { nip: true, user: { select: { name: true } } } } },
    });
    return NextResponse.json(record, { status: 201 });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Wakil Kepala Penjamin Mutu / Guru Piket." }, { status: 403 });
    }
    console.error("[penjamin-mutu kedisiplinan POST]", e);
    return NextResponse.json({ error: "Gagal menyimpan catatan" }, { status: 500 });
  }
}
