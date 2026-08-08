import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { assertKedisiplinan } from "@/lib/kedisiplinan-guard";
import { getWeekTypeForDate } from "@/lib/schedule-week.server";
import { weekTypesOverlap } from "@/lib/schedule-week";
import { groupConsecutiveSchedules } from "@/lib/schedule-grouping";

export const dynamic = "force-dynamic";

const DAYS = ["MINGGU", "SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];

interface FlatSlot {
  id: string; classId: string; className: string; subject: string; startTime: string; endTime: string; room: string | null;
  teacherId: string | null; teacherName: string; teacherNip: string;
  status: string; hasTugas: boolean | null; notes: string;
}

// Nilai status/hasTugas/notes blok diambil dari slot PERTAMA yang sudah tersimpan (kalau ada) —
// saat disimpan, nilai yang sama diterapkan ke SEMUA scheduleId anggota blok (lihat POST).
// `periodMap` = startTime -> "Jam ke-N" (nomor urut jam pelajaran BUKAN istirahat, sesuai format
// "Daftar Kehadiran Guru" manual yang sudah dipakai sekolah — lihat SchoolPeriod, isBreak diskip).
function groupConsecutive(slots: FlatSlot[], periodMap: Map<string, number>) {
  const blocks = groupConsecutiveSchedules(slots, s => `${s.teacherId ?? "-"}|${s.classId}|${s.subject}`)
    .map(({ items, first, last }) => ({
      scheduleIds: items.map(s => s.id),
      className: first.className, subject: first.subject,
      startTime: first.startTime, endTime: last.endTime, room: first.room,
      startPeriod: periodMap.get(first.startTime) ?? null,
      endPeriod: periodMap.get(last.startTime) ?? null,
      teacherId: first.teacherId, teacherName: first.teacherName, teacherNip: first.teacherNip,
      status: first.status, hasTugas: first.hasTugas, notes: first.notes,
      periodCount: items.length,
    }));

  blocks.sort((a, b) => a.startTime.localeCompare(b.startTime) || a.className.localeCompare(b.className));
  return blocks;
}

// Absensi guru PER BLOK JAM PELAJARAN (jam berurutan di kelas+mapel yang sama digabung jadi 1
// baris) — GET mengembalikan blok pada tanggal itu digabung dengan catatan
// TeacherScheduleAttendance yang sudah tersimpan (kalau ada). `teacherId` OPSIONAL: dikosongkan =
// mode "sepanjang hari" (buku piket) menampilkan SEMUA kelas+guru pada tanggal itu sekaligus;
// diisi = filter cuma jadwal guru tsb (dipakai tombol "+ Tambah Manual" untuk kasus guru tanpa
// jadwal sama sekali di tanggal itu).
export async function GET(req: NextRequest) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    await assertKedisiplinan(session);

    const { searchParams } = new URL(req.url);
    const teacherId = searchParams.get("teacherId");
    const dateStr = searchParams.get("date");
    if (!dateStr) {
      return NextResponse.json({ error: "Tanggal wajib diisi" }, { status: 400 });
    }

    const date = new Date(dateStr);
    const nextDay = new Date(date.getTime() + 86400000);
    const day = DAYS[date.getDay()];
    const weekType = await getWeekTypeForDate(date);

    const [schedules, periods] = await Promise.all([
      prisma.schedule.findMany({
        // Kelas XII tidak ikut dipantau piket (kebijakan sekolah) — cuma kelas X & XI.
        // scheduleType: "BLOK" wajib — "NONBLOK" itu dataset TERPISAH khusus upload Dapodik
        // (lihat CLAUDE.md), bukan jadwal rotasi 2-minggu asli. Tanpa filter ini, dua dataset
        // independen ketimpa jadi 1 tampilan (efeknya kelihatan seperti "guru minggu 1 & minggu 2
        // ketuker/campur" padahal sebenarnya itu jadwal Dapodik yang numpuk di jam yang sama).
        where: { day, scheduleType: "BLOK", teacherId: teacherId ? teacherId : { not: null }, class: { grade: { in: [10, 11] } } },
        include: { class: { select: { id: true, name: true } }, teacher: { select: { id: true, nip: true, user: { select: { name: true } } } } },
        orderBy: [{ startTime: "asc" }, { class: { name: "asc" } }],
      }),
      prisma.schoolPeriod.findMany({ where: { day, isBreak: false }, orderBy: { order: "asc" } }),
    ]);
    const relevant = schedules.filter(s => weekTypesOverlap(s.weekType, weekType));
    const periodMap = new Map(periods.map((p, i) => [p.startTime, i + 1]));

    const existing = relevant.length
      ? await prisma.teacherScheduleAttendance.findMany({
          where: { scheduleId: { in: relevant.map(s => s.id) }, date: { gte: date, lt: nextDay } },
        })
      : [];
    const existingMap = new Map(existing.map(e => [e.scheduleId, e]));

    const flat: FlatSlot[] = relevant.map(s => {
      const e = existingMap.get(s.id);
      return {
        id: s.id, classId: s.class.id, className: s.class.name, subject: s.subject,
        startTime: s.startTime, endTime: s.endTime, room: s.room,
        teacherId: s.teacher?.id ?? null, teacherName: s.teacher?.user.name ?? "-", teacherNip: s.teacher?.nip ?? "-",
        // "" (bukan "HADIR") kalau belum pernah dicatat — supaya Wakasek/Guru Piket TERPAKSA
        // memilih status secara sadar, bukan diam2 dianggap sudah "Hadir" tanpa dicek.
        status: e?.status ?? "", hasTugas: e?.hasTugas ?? null, notes: e?.notes ?? "",
      };
    });

    return NextResponse.json(groupConsecutive(flat, periodMap));
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
    const { date, records } = body as {
      date: string;
      records: { scheduleIds: string[]; status: string; hasTugas?: boolean | null; checkInTime?: string; notes?: string }[];
    };
    if (!date || !Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ error: "Data tidak lengkap" }, { status: 400 });
    }

    // Pastikan semua scheduleId yang dikirim memang ada (guard role sudah membatasi siapa yang
    // boleh memanggil endpoint ini — bukan per-guru, karena guru piket/waka mutu mencatat SEMUA
    // guru dalam satu tabel, bukan cuma dirinya sendiri).
    const allScheduleIds = records.flatMap(r => r.scheduleIds);
    const validCount = await prisma.schedule.count({ where: { id: { in: allScheduleIds } } });
    if (validCount !== allScheduleIds.length) {
      return NextResponse.json({ error: "Sebagian jadwal tidak valid" }, { status: 400 });
    }

    const dateObj = new Date(date);
    // Satu blok (beberapa JP berurutan) menulis status yang SAMA ke tiap scheduleId anggotanya.
    await prisma.$transaction(
      records.flatMap(r => r.scheduleIds.map(scheduleId => prisma.teacherScheduleAttendance.upsert({
        where: { scheduleId_date: { scheduleId, date: dateObj } },
        update: { status: r.status, hasTugas: r.hasTugas ?? null, checkInTime: r.checkInTime || null, notes: r.notes || null },
        create: { scheduleId, date: dateObj, status: r.status, hasTugas: r.hasTugas ?? null, checkInTime: r.checkInTime || null, notes: r.notes || null },
      })))
    );

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Wakil Kepala Penjamin Mutu / Guru Piket." }, { status: 403 });
    }
    console.error("[penjamin-mutu kedisiplinan slots POST]", e);
    return NextResponse.json({ error: "Gagal menyimpan" }, { status: 500 });
  }
}
