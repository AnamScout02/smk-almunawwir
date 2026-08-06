import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getKpiReviewScope } from "@/lib/kpi-review-scope";

export const dynamic = "force-dynamic";

function defaultPeriod() {
  return new Date().toISOString().slice(0, 7);
}

// GET ?scope=review => submission PENDING dlm cakupan pimpinan itu (lihat getKpiReviewScope —
// ADMIN/Kepsek lihat semua, Wakasek lain cuma jabatan yg jadi tanggung jawabnya).
// GET tanpa scope => submission milik SESSION SENDIRI (guru pantau status ajuannya sendiri).
export async function GET(req: NextRequest) {
  try {
    const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
    const { searchParams } = new URL(req.url);
    const scope = searchParams.get("scope");

    if (scope === "review") {
      const reviewScope = await getKpiReviewScope(session);
      const submissions = await prisma.kpiSubmission.findMany({
        where: { status: "PENDING", ...(reviewScope ? { indicator: { jabatanName: { in: reviewScope } } } : {}) },
        include: { indicator: true, user: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      });
      return NextResponse.json(submissions);
    }

    const submissions = await prisma.kpiSubmission.findMany({
      where: { userId: session.userId },
      include: { indicator: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(submissions);
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus pimpinan/wakasek." }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
    const body = await req.json();
    const { indicatorId, description, fileUrl, period } = body;
    if (!indicatorId || !description) {
      return NextResponse.json({ error: "Indikator dan deskripsi wajib diisi" }, { status: 400 });
    }
    const indicator = await prisma.kpiIndicator.findUnique({ where: { id: indicatorId } });
    if (!indicator || indicator.source !== "MANUAL") {
      return NextResponse.json({ error: "Indikator ini tidak menerima pengajuan manual" }, { status: 400 });
    }

    const submission = await prisma.kpiSubmission.create({
      data: {
        userId: session.userId, indicatorId,
        period: period || defaultPeriod(),
        description, fileUrl: fileUrl || null,
      },
      include: { indicator: true },
    });
    return NextResponse.json(submission, { status: 201 });
  } catch (e) {
    console.error("[kpi submissions POST]", e);
    return NextResponse.json({ error: "Gagal mengajukan bukti" }, { status: 500 });
  }
}
