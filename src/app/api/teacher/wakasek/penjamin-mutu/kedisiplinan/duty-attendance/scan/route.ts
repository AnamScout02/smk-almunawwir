import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { assertKedisiplinan } from "@/lib/kedisiplinan-guard";
import { getWeekTypeForDate } from "@/lib/schedule-week.server";

export const dynamic = "force-dynamic";

const DAYS = ["MINGGU", "SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];

/** Scan Kartu Tanda utk auto-catat kehadiran petugas piket — identifier yg dibaca SAMA PERSIS
 * dgn Kartu Tanda/Perpustakaan (NIP guru, potongan email sebelum "@" utk staf/admin), jadi kartu
 * yang sama bisa dipakai lintas modul tanpa kartu terpisah. Kalau orangnya TIDAK terjadwal piket
 * HARI INI (bukan di Jadwal Piket/DutyRoster), scan ditolak dgn pesan jelas — supaya
 * DutyAttendance tetap konsisten cuma mencatat orang yang memang terjadwal, sama seperti alur
 * manual yang sudah ada (GET duty-attendance juga sumbernya dari DutyRoster hari itu). */
export async function POST(req: NextRequest) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    await assertKedisiplinan(session);

    const body = await req.json();
    const code = typeof body.code === "string" ? body.code.trim() : "";
    if (!code) return NextResponse.json({ error: "Kode wajib diisi" }, { status: 400 });

    const teacher = await prisma.teacher.findFirst({ where: { nip: code }, select: { userId: true, user: { select: { name: true } } } });
    const staff = teacher ? null : await prisma.user.findFirst({
      where: { email: { startsWith: `${code}@` }, role: { in: ["TAS", "ADMIN"] } },
      select: { id: true, name: true },
    });
    const userId = teacher?.userId ?? staff?.id;
    const userName = teacher?.user.name ?? staff?.name;
    if (!userId || !userName) return NextResponse.json({ error: `Kartu "${code}" tidak dikenali.` }, { status: 404 });

    // "Hari ini" dihitung dgn cara yang SAMA persis dgn default viewDate di halaman ini
    // (new Date().toISOString().slice(0,10)) supaya hasil scan langsung nongol di tampilan
    // default tanpa perlu ganti tanggal dulu.
    const todayStr = new Date().toISOString().slice(0, 10);
    const today = new Date(todayStr);
    const day = DAYS[today.getDay()];
    const weekType = await getWeekTypeForDate(today);

    const duty = await prisma.dutyRoster.findFirst({
      where: { userId, day, OR: [{ weekType: "SEMUA" }, { weekType }] },
    });
    if (!duty) return NextResponse.json({ error: `${userName} tidak terjadwal piket hari ini.` }, { status: 404 });

    await prisma.dutyAttendance.upsert({
      where: { userId_date: { userId, date: today } },
      update: { status: "HADIR" },
      create: { userId, date: today, status: "HADIR" },
    });

    return NextResponse.json({ success: true, name: userName });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Wakil Kepala Penjamin Mutu / Guru Piket." }, { status: 403 });
    }
    console.error("[duty-attendance scan]", e);
    return NextResponse.json({ error: "Gagal mencatat kehadiran" }, { status: 500 });
  }
}
