import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { assertJabatan } from "@/lib/jabatan-guard";

export const dynamic = "force-dynamic";

async function guard(session: { role: string; email: string }) {
  if (session.role === "TEACHER") await assertJabatan(session, ["Wakil Kepala Sarana Prasarana", "Kepala Laboratorium"]);
}

export async function GET() {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await guard(session);

    const reports = await prisma.assetDamageReport.findMany({
      orderBy: { reportDate: "desc" },
      include: { asset: { select: { name: true, category: true, location: true } } },
    });
    return NextResponse.json(reports);
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Wakil Kepala Sarana Prasarana." }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await guard(session);

    const body = await req.json();
    const { assetId, description, reportedBy } = body;
    if (!assetId || !description?.trim()) {
      return NextResponse.json({ error: "Barang dan deskripsi kerusakan wajib diisi" }, { status: 400 });
    }

    const report = await prisma.assetDamageReport.create({
      data: { assetId, description, reportedBy: reportedBy || null },
      include: { asset: { select: { name: true, category: true, location: true } } },
    });
    return NextResponse.json(report, { status: 201 });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Wakil Kepala Sarana Prasarana." }, { status: 403 });
    }
    console.error("[inventaris damage-reports POST]", e);
    return NextResponse.json({ error: "Gagal menyimpan laporan" }, { status: 500 });
  }
}
