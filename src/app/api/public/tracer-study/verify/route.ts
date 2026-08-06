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

  const body = await req.json();
  const { nis, birthDate } = body;
  if (!nis || !birthDate) {
    return NextResponse.json({ error: "NIS dan tanggal lahir wajib diisi" }, { status: 400 });
  }

  const student = await prisma.student.findFirst({
    where: { nis: String(nis).trim(), studentStatus: "LULUS" },
    select: {
      id: true, birthDate: true, enrollYear: true,
      user: { select: { name: true } },
      major: { select: { name: true } },
      alumniTracer: { select: { status: true, institutionName: true, position: true, contactPhone: true, contactEmail: true, notes: true } },
    },
  });

  if (!student || !student.birthDate || student.birthDate.toISOString().slice(0, 10) !== birthDate) {
    return NextResponse.json({ error: "Data tidak ditemukan. Periksa kembali NIS dan tanggal lahir." }, { status: 404 });
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
