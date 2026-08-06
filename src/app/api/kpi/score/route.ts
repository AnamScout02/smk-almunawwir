import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { computeFinalScore, resolveJabatanName } from "@/lib/kpi-engine";

export const dynamic = "force-dynamic";

function defaultPeriod() {
  return new Date().toISOString().slice(0, 7); // "2026-08"
}

export async function GET(req: NextRequest) {
  try {
    const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") || defaultPeriod();
    const targetUserId = searchParams.get("userId");

    // Siapapun boleh lihat skor SENDIRI; lihat punya orang lain harus ADMIN.
    let userId = session.userId;
    if (targetUserId && targetUserId !== session.userId) {
      if (session.role !== "ADMIN") return NextResponse.json({ error: "Tidak berwenang melihat skor pegawai lain" }, { status: 403 });
      userId = targetUserId;
    }

    const jabatanName = await resolveJabatanName(userId);
    if (!jabatanName) return NextResponse.json({ error: "Belum ada KPI untuk jabatan/role ini" }, { status: 404 });

    const result = await computeFinalScore(userId, jabatanName, period);
    return NextResponse.json({ ...result, period, jabatanName });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
