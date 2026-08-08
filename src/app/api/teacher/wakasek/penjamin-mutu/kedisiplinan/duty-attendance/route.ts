import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { assertKedisiplinan } from "@/lib/kedisiplinan-guard";
import { getWeekTypeForDate } from "@/lib/schedule-week.server";

export const dynamic = "force-dynamic";

const DAYS = ["MINGGU", "SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];

// Kehadiran petugas piket ITU SENDIRI (bukan absensi mengajar) — siapa yang terjadwal piket hari
// itu (dari Jadwal Piket/DutyRoster), digabung dengan status DutyAttendance kalau sudah tercatat.
export async function GET(req: NextRequest) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    await assertKedisiplinan(session);

    const { searchParams } = new URL(req.url);
    const dateStr = searchParams.get("date");
    if (!dateStr) return NextResponse.json({ error: "Tanggal wajib diisi" }, { status: 400 });

    const date = new Date(dateStr);
    const nextDay = new Date(date.getTime() + 86400000);
    const day = DAYS[date.getDay()];
    const weekType = await getWeekTypeForDate(date);

    const roster = await prisma.dutyRoster.findMany({
      where: { day, OR: [{ weekType: "SEMUA" }, { weekType }] },
      include: { user: { select: { id: true, name: true, role: true, teacher: { select: { nip: true } } } } },
      orderBy: { user: { name: "asc" } },
    });

    const attendance = roster.length
      ? await prisma.dutyAttendance.findMany({
          where: { userId: { in: roster.map(r => r.userId) }, date: { gte: date, lt: nextDay } },
        })
      : [];
    const attByUserId = new Map(attendance.map(a => [a.userId, a]));

    return NextResponse.json(roster.map(r => {
      const a = attByUserId.get(r.userId);
      return {
        userId: r.userId, userName: r.user.name, userRole: r.user.role, userNip: r.user.teacher?.nip ?? null,
        // "" kalau belum pernah dicatat — jangan diam2 dianggap "Hadir" sebelum benar2 dicek/scan.
        status: a?.status ?? "", notes: a?.notes ?? "",
      };
    }));
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
    const { date, records } = body as { date: string; records: { userId: string; status: string; notes?: string }[] };
    if (!date || !Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ error: "Data tidak lengkap" }, { status: 400 });
    }

    const dateObj = new Date(date);
    await prisma.$transaction(
      records.map(r => prisma.dutyAttendance.upsert({
        where: { userId_date: { userId: r.userId, date: dateObj } },
        update: { status: r.status, notes: r.notes || null },
        create: { userId: r.userId, date: dateObj, status: r.status, notes: r.notes || null },
      })),
    );

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Wakil Kepala Penjamin Mutu / Guru Piket." }, { status: 403 });
    }
    console.error("[duty-attendance POST]", e);
    return NextResponse.json({ error: "Gagal menyimpan" }, { status: 500 });
  }
}
