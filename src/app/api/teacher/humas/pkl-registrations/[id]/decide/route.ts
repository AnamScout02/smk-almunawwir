import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { assertHumas } from "@/lib/humas-guard";
import { prisma } from "@/lib/prisma";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertHumas(session);

    const { id } = await params;
    const { decision, reviewNote } = await req.json() as { decision: "APPROVED" | "REJECTED"; reviewNote?: string };
    if (decision !== "APPROVED" && decision !== "REJECTED") {
      return NextResponse.json({ error: "Keputusan tidak valid" }, { status: 400 });
    }

    const registration = await prisma.pklRegistration.findUnique({ where: { id } });
    if (!registration) return NextResponse.json({ error: "Pendaftaran tidak ditemukan" }, { status: 404 });
    if (registration.status !== "PENDING") {
      return NextResponse.json({ error: "Pendaftaran ini sudah diputuskan sebelumnya" }, { status: 400 });
    }

    const updated = await prisma.pklRegistration.update({
      where: { id },
      data: { status: decision, reviewNote: reviewNote || null, reviewedByName: session.name, reviewedAt: new Date() },
    });
    return NextResponse.json(updated);
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Admin/TAS atau Wakil Kepala Humas." }, { status: 403 });
    }
    return NextResponse.json({ error: "Gagal memproses keputusan." }, { status: 500 });
  }
}
