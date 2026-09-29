import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { assertDutyRosterAccess } from "@/lib/kedisiplinan-guard";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

const DAYS = ["SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];

// Jadwal Piket Guru & Staff — mingguan berulang, ikut rotasi 2 minggu (weekType A/B) sama seperti
// Schedule pelajaran. GET mengembalikan semua entri + daftar guru/staff yang bisa dipilih (guru
// aktif + pegawai TAS/Admin, BUKAN siswa).
export async function GET() {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    await assertDutyRosterAccess(session);

    const [roster, users] = await Promise.all([
      prisma.dutyRoster.findMany({
        include: { user: { select: { id: true, name: true, role: true, teacher: { select: { nip: true } } } } },
        orderBy: [{ day: "asc" }],
      }),
      prisma.user.findMany({
        where: { role: { in: ["TEACHER", "TAS"] } },
        select: { id: true, name: true, role: true, teacher: { select: { nip: true, teacherStatus: true } } },
        orderBy: { name: "asc" },
      }),
    ]);

    const eligible = users.filter(u => u.role !== "TEACHER" || u.teacher?.teacherStatus === "AKTIF");

    return NextResponse.json({
      roster: roster.map(r => ({
        id: r.id, day: r.day, weekType: r.weekType, notes: r.notes,
        userId: r.userId, userName: r.user.name, userRole: r.user.role, userNip: r.user.teacher?.nip ?? null,
      })),
      users: eligible.map(u => ({ id: u.id, name: u.name, role: u.role, nip: u.teacher?.nip ?? null })),
    });
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Wakil Kepala Penjamin Mutu / Guru Piket." }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    await assertDutyRosterAccess(session);

    const body = await req.json();
    const { day, weekType, userId, notes } = body as { day: string; weekType?: string; userId: string; notes?: string };
    if (!day || !DAYS.includes(day) || !userId) {
      return NextResponse.json({ error: "Hari dan orang wajib diisi" }, { status: 400 });
    }

    const record = await prisma.dutyRoster.upsert({
      where: { day_weekType_userId: { day, weekType: weekType || "SEMUA", userId } },
      update: { notes: notes || null },
      create: { day, weekType: weekType || "SEMUA", userId, notes: notes || null },
      include: { user: { select: { id: true, name: true, role: true, teacher: { select: { nip: true } } } } },
    });
    return NextResponse.json({
      id: record.id, day: record.day, weekType: record.weekType, notes: record.notes,
      userId: record.userId, userName: record.user.name, userRole: record.user.role, userNip: record.user.teacher?.nip ?? null,
    }, { status: 201 });
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Wakil Kepala Penjamin Mutu / Guru Piket." }, { status: 403 });
    }
    console.error("[duty-roster POST]", e);
    return NextResponse.json({ error: "Gagal menyimpan" }, { status: 500 });
  }
}
