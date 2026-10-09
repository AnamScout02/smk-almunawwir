import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signTracerToken } from "@/lib/tracer-token";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!checkRateLimit(`tracer-verify:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: "Terlalu banyak percobaan. Coba lagi beberapa saat lagi." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const { nis, birthDate } = body;
  const nomor = String(nis ?? "").trim().slice(0, 40);
  if (!nomor || typeof birthDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
    return NextResponse.json({ error: "NISN/NIS dan tanggal lahir wajib diisi" }, { status: 400 });
  }

  // NISN ATAU NIS (8 Okt 2026): alumni jarang ingat NIS sekolah (`924/001.10.2.1`), sedangkan NISN tercetak di ijazah.
  // Nomor yang cocok dengan lebih dari satu alumni TIDAK ditebak — dijawab "tidak ditemukan".
  const calon = await prisma.student.findMany({
    where: { studentStatus: "LULUS", OR: [{ nis: nomor }, { nisn: nomor }] },
    take: 2,
    select: {
      id: true, birthDate: true, enrollYear: true,
      user: { select: { name: true } },
      major: { select: { name: true } },
      alumniTracer: { select: { status: true, institutionName: true, position: true, contactPhone: true, contactEmail: true, notes: true } },
    },
  });

  const student = calon.length === 1 ? calon[0] : null;
  if (!student || !student.birthDate || student.birthDate.toISOString().slice(0, 10) !== birthDate) {
    return NextResponse.json({ error: "Data tidak ditemukan. Periksa kembali NISN/NIS dan tanggal lahir." }, { status: 404 });
  }

  const token = await signTracerToken(student.id);
  return NextResponse.json({
    token,
    name: student.user.name,
    majorName: student.major.name,
    enrollYear: student.enrollYear,
    existing: student.alumniTracer,
  });
}
