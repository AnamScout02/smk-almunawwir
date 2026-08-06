import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!checkRateLimit(`cek-kelulusan:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: "Terlalu banyak percobaan. Coba lagi beberapa saat lagi." }, { status: 429 });
  }

  const settings = await getSettings(["kelulusan.tanggalBuka", "kelulusan.tanggalTutup"]);
  const now = new Date();
  const buka = settings["kelulusan.tanggalBuka"] ? new Date(settings["kelulusan.tanggalBuka"]) : null;
  const tutup = settings["kelulusan.tanggalTutup"] ? new Date(settings["kelulusan.tanggalTutup"]) : null;
  if (buka && now < buka) {
    return NextResponse.json({ error: "Pengumuman kelulusan belum dibuka." }, { status: 403 });
  }
  if (tutup && now > tutup) {
    return NextResponse.json({ error: "Pengumuman kelulusan sudah ditutup." }, { status: 403 });
  }

  const body = await req.json();
  const { nis, birthDate } = body;
  if (!nis || !birthDate) {
    return NextResponse.json({ error: "NIS dan tanggal lahir wajib diisi" }, { status: 400 });
  }

  const student = await prisma.student.findFirst({
    where: { nis: String(nis).trim() },
    select: {
      birthDate: true, studentStatus: true,
      user: { select: { name: true } },
      class: { select: { name: true } },
      major: { select: { name: true } },
    },
  });

  if (!student || !student.birthDate || student.birthDate.toISOString().slice(0, 10) !== birthDate) {
    return NextResponse.json({ error: "Data tidak ditemukan. Periksa kembali NIS dan tanggal lahir." }, { status: 404 });
  }

  return NextResponse.json({
    name: student.user.name,
    className: student.class?.name ?? "—",
    majorName: student.major.name,
    lulus: student.studentStatus === "LULUS",
  });
}
