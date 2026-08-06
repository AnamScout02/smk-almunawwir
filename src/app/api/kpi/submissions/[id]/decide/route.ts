import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getKpiReviewScope } from "@/lib/kpi-review-scope";

// Approve/reject SATU LEVEL — pola atomik sama seperti profile-edit-requests/[id]/decide: kalau
// APPROVED, penerapan skor (upsert KpiPeriodScore) & penutupan status submission terjadi dalam
// SATU transaksi, supaya tidak ada state "disetujui tapi skornya belum ke-apply".
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
    const reviewScope = await getKpiReviewScope(session);

    const { id } = await params;
    const body = await req.json();
    const { decision, reviewNote } = body as { decision: "APPROVED" | "REJECTED"; reviewNote?: string };
    if (decision !== "APPROVED" && decision !== "REJECTED") {
      return NextResponse.json({ error: "Keputusan tidak valid" }, { status: 400 });
    }

    const submission = await prisma.kpiSubmission.findUnique({ where: { id }, include: { indicator: { select: { jabatanName: true } } } });
    if (!submission) return NextResponse.json({ error: "Pengajuan tidak ditemukan" }, { status: 404 });
    if (submission.status !== "PENDING") return NextResponse.json({ error: "Pengajuan ini sudah diputuskan sebelumnya" }, { status: 400 });
    // Wakasek non-Kepsek/ADMIN cuma boleh putuskan pengajuan dari jabatan yang jadi tanggung
    // jawabnya (lihat KPI_SUPERVISOR_MAP) — bukan sekadar terdaftar sbg "pimpinan" secara umum.
    if (reviewScope && !reviewScope.includes(submission.indicator.jabatanName)) {
      return NextResponse.json({ error: "Pengajuan ini di luar cakupan bidang Anda." }, { status: 403 });
    }

    if (decision === "REJECTED") {
      const updated = await prisma.kpiSubmission.update({
        where: { id },
        data: { status: "REJECTED", reviewNote: reviewNote || null, reviewedByName: session.name, reviewedAt: new Date() },
      });
      return NextResponse.json(updated);
    }

    const [updated] = await prisma.$transaction([
      prisma.kpiSubmission.update({
        where: { id },
        data: { status: "APPROVED", reviewNote: reviewNote || null, reviewedByName: session.name, reviewedAt: new Date() },
      }),
      prisma.kpiPeriodScore.upsert({
        where: { userId_indicatorId_period: { userId: submission.userId, indicatorId: submission.indicatorId, period: submission.period } },
        update: { score: submission.scoreIfApproved },
        create: { userId: submission.userId, indicatorId: submission.indicatorId, period: submission.period, score: submission.scoreIfApproved },
      }),
    ]);

    return NextResponse.json(updated);
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus pimpinan/wakasek." }, { status: 403 });
    }
    console.error("[kpi submissions decide]", e);
    return NextResponse.json({ error: "Gagal memproses keputusan" }, { status: 500 });
  }
}
