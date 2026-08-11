import { NextRequest, NextResponse } from "next/server";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const DAYS = ["SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];

function fmt(totalMin: number) {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function defaultPeriodsForDay(day: string) {
  const isFriday = day === "JUMAT";
  const preLabel = day === "RABU" ? "Kegiatan Kajian Kitab" : "Kegiatan Sholat Duha Berjamaah";
  const PERIOD_LEN = 30;
  const slots: { day: string; order: number; startTime: string; endTime: string; isBreak: boolean; label: string | null }[] = [];
  let minutes = 6 * 60 + 45; // 06:45
  let order = 1;

  function addPeriod() {
    slots.push({ day, order: order++, startTime: fmt(minutes), endTime: fmt(minutes + PERIOD_LEN), isBreak: false, label: null });
    minutes += PERIOD_LEN;
  }
  function addBreak(len: number, label: string) {
    slots.push({ day, order: order++, startTime: fmt(minutes), endTime: fmt(minutes + len), isBreak: true, label });
    minutes += len;
  }

  // Blok kegiatan pagi (Kajian Kitab / Sholat Duha) — bukan jam pelajaran
  addBreak(PERIOD_LEN, preLabel);

  if (isFriday) {
    // Jumat: 6 jam berturut-turut tanpa istirahat, selesai 10:15
    for (let i = 0; i < 6; i++) addPeriod();
  } else {
    for (let i = 0; i < 4; i++) addPeriod();
    addBreak(PERIOD_LEN, "Istirahat");
    for (let i = 0; i < 4; i++) addPeriod();
    addBreak(PERIOD_LEN, "Kegiatan Sholat Duhur Berjamaah");
    for (let i = 0; i < 2; i++) addPeriod();
  }
  return slots;
}

export async function POST(req: NextRequest) {
  await verifyTasAccess();
  const body = await req.json().catch(() => ({}));
  const replace = !!body.replace;

  if (replace) {
    await prisma.schoolPeriod.deleteMany({});
  } else {
    const existing = await prisma.schoolPeriod.count();
    if (existing > 0) {
      return NextResponse.json({ error: "Sudah ada kerangka jam. Gunakan opsi ganti untuk menimpa." }, { status: 400 });
    }
  }

  const data = DAYS.flatMap(defaultPeriodsForDay);
  await prisma.schoolPeriod.createMany({ data });
  const periods = await prisma.schoolPeriod.findMany({ orderBy: [{ day: "asc" }, { order: "asc" }] });
  return NextResponse.json(periods, { status: 201 });
}
