import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyTracerToken } from "@/lib/tracer-token";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!checkRateLimit(`tracer-submit:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: "Terlalu banyak percobaan. Coba lagi beberapa saat lagi." }, { status: 429 });
  }

  const body = await req.json();
  const { token, status, institutionName, position, contactPhone, contactEmail, notes } = body;

  const studentId = await verifyTracerToken(token);
  if (!studentId) {
    return NextResponse.json({ error: "Sesi verifikasi sudah kedaluwarsa. Silakan verifikasi ulang." }, { status: 401 });
  }
  if (!status) {
    return NextResponse.json({ error: "Status wajib diisi" }, { status: 400 });
  }

  await prisma.alumniTracer.upsert({
    where: { studentId },
    update: {
      status, institutionName: institutionName || null, position: position || null,
      contactPhone: contactPhone || null, contactEmail: contactEmail || null, notes: notes || null,
      surveyDate: new Date(),
    },
    create: {
      studentId, status, institutionName: institutionName || null, position: position || null,
      contactPhone: contactPhone || null, contactEmail: contactEmail || null, notes: notes || null,
      surveyDate: new Date(),
    },
  });

  return NextResponse.json({ success: true });
}
