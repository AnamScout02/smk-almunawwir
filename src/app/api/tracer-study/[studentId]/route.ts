import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { assertJabatan } from "@/lib/jabatan-guard";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ studentId: string }> }) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    if (session.role === "TEACHER") await assertJabatan(session, ["Koordinator BKK", "Wakil Kepala Humas"]);

    const { studentId } = await params;
    const body = await req.json();
    const { status, institutionName, position, contactPhone, contactEmail, surveyDate, notes } = body;

    if (!status || !surveyDate) {
      return NextResponse.json({ error: "Status dan tanggal survei wajib diisi" }, { status: 400 });
    }

    const data = {
      status,
      institutionName: institutionName || null,
      position: position || null,
      contactPhone: contactPhone || null,
      contactEmail: contactEmail || null,
      surveyDate: new Date(surveyDate),
      notes: notes || null,
    };

    const tracer = await prisma.alumniTracer.upsert({
      where: { studentId },
      create: { studentId, ...data },
      update: data,
    });
    return NextResponse.json(tracer);
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Koordinator BKK." }, { status: 403 });
    }
    console.error("[tracer-study PUT]", e);
    return NextResponse.json({ error: "Gagal menyimpan data tracer" }, { status: 500 });
  }
}
