import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";

export async function GET(req: NextRequest) {
  await verifyRole(["ADMIN", "TEACHER"]);
  const classId = req.nextUrl.searchParams.get("classId");
  const weekType = req.nextUrl.searchParams.get("weekType");
  // Default BLOK — jadwal blok (2 minggu bergantian) dan non-blok (1 minggu utk Dapodik) sekarang
  // hidup di tabel yang sama, wajib dipisah lewat scheduleType supaya keduanya tidak numpuk
  // jadi kelihatan "bentrok" satu sama lain padahal beda sistem.
  const scheduleType = req.nextUrl.searchParams.get("scheduleType") ?? "BLOK";
  const items = await prisma.schedule.findMany({
    where: { scheduleType, ...(classId ? { classId } : {}), ...(weekType ? { weekType } : {}) },
    include: {
      class: { include: { major: true } },
      teacher: { include: { user: { select: { name: true } } } },
    },
    orderBy: [{ day: "asc" }, { startTime: "asc" }],
  });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  await verifyRole(["ADMIN", "TAS"]);
  const body = await req.json();
  const { classId, teacherId, subject, day, startTime, endTime, room, weekType, scheduleType } = body;
  if (!classId || !subject || !day || !startTime || !endTime) {
    return NextResponse.json({ error: "Data tidak lengkap" }, { status: 400 });
  }
  const item = await prisma.schedule.create({
    data: { classId, teacherId: teacherId || null, subject, day, startTime, endTime, room: room || null, weekType: weekType || "SEMUA", scheduleType: scheduleType || "BLOK" },
    include: {
      class: { include: { major: true } },
      teacher: { include: { user: { select: { name: true } } } },
    },
  });
  return NextResponse.json(item, { status: 201 });
}

// Hapus massal hasil Generate Otomatis (generated=true) — opsional discope ke 1 kelas via
// ?classId=. Jadwal yang ditambah/diedit manual (generated=false) TIDAK ikut terhapus.
export async function DELETE(req: NextRequest) {
  await verifyRole(["ADMIN", "TAS"]);
  const { "schedule.locked": locked } = await getSettings(["schedule.locked"]);
  if (locked === "1") {
    return NextResponse.json({ error: "Jadwal sedang dikunci — buka kunci dulu di halaman Jadwal Pelajaran sebelum menghapus hasil generate." }, { status: 423 });
  }
  const classId = req.nextUrl.searchParams.get("classId");
  const scheduleType = req.nextUrl.searchParams.get("scheduleType") ?? "BLOK";
  const result = await prisma.schedule.deleteMany({
    where: { generated: true, scheduleType, ...(classId ? { classId } : {}) },
  });
  return NextResponse.json({ deleted: result.count });
}
