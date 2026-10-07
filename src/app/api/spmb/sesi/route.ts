import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { assertSpmb } from "@/lib/spmb";
import { logActivity } from "@/lib/activity-log";
import { daftarSesi } from "@/lib/spmb-tahapan-server";
import { rapikanSesi } from "@/lib/spmb-sesi";

export const dynamic = "force-dynamic";

/** Sesi kedatangan hari tes per gelombang (6 Okt 2026). */
export async function GET(req: NextRequest) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertSpmb(session);
    const gelombangId = req.nextUrl.searchParams.get("gelombangId") ?? "";
    return NextResponse.json(gelombangId ? await daftarSesi(gelombangId) : []);
  } catch (e) {
    lemparBilaPengalihan(e);
    return NextResponse.json({ error: "Tidak berwenang" }, { status: 403 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertSpmb(session);
    const b = await req.json().catch(() => ({}));
    const gelombangId = String(b?.gelombangId ?? "");
    if (!(await prisma.gelombangSpmb.findUnique({ where: { id: gelombangId }, select: { id: true } }))) {
      return NextResponse.json({ error: "Pilih gelombang dulu." }, { status: 400 });
    }
    const r = rapikanSesi(b);
    if (!r.data) return NextResponse.json({ error: r.galat }, { status: 400 });
    const x = await prisma.sesiSpmb.create({ data: { gelombangId, ...r.data } });
    await logActivity(session, { action: "CREATE", entity: "SesiSpmb", entityId: x.id, description: `Menambah sesi kedatangan SPMB ${r.data.tanggal} ${r.data.jamMulai}` }).catch(() => null);
    return NextResponse.json({ ok: true, id: x.id });
  } catch (e) {
    lemparBilaPengalihan(e);
    return NextResponse.json({ error: "Gagal menyimpan" }, { status: 500 });
  }
}
