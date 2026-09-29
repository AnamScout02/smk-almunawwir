import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { assertKurikulum } from "@/lib/kurikulum-guard";
import { logActivity } from "@/lib/activity-log";
import { KUNCI_KKM_BAWAAN, kkmBawaan } from "@/lib/kkm";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

/** KKM BAWAAN SEKOLAH — dipakai mapel yang KKM-nya dikosongkan (Subject.kkm = null). Pengatur sama dengan Data Mapel. */
export async function GET() {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertKurikulum(session);
    return NextResponse.json({ kkm: await kkmBawaan() });
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") return NextResponse.json({ error: "Khusus Wakil Kepala Kurikulum." }, { status: 403 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertKurikulum(session);
    const body = await req.json().catch(() => null) as { kkm?: unknown } | null;
    const n = Number(typeof body?.kkm === "string" ? body.kkm.trim() : body?.kkm);
    if (!Number.isInteger(n) || n < 1 || n > 100) {
      return NextResponse.json({ error: "KKM bawaan harus bilangan bulat 1–100." }, { status: 400 });
    }
    const lama = await kkmBawaan();
    await prisma.siteSetting.upsert({ where: { key: KUNCI_KKM_BAWAAN }, update: { value: String(n) }, create: { key: KUNCI_KKM_BAWAAN, value: String(n) } });
    if (lama !== n) {
      await logActivity(session, { action: "UBAH_KKM_BAWAAN", entity: "Subject", entityId: KUNCI_KKM_BAWAAN, description: `KKM bawaan sekolah diubah: ${lama} → ${n}` }).catch(() => {});
    }
    return NextResponse.json({ kkm: n });
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") return NextResponse.json({ error: "Khusus Wakil Kepala Kurikulum." }, { status: 403 });
    return NextResponse.json({ error: "Gagal menyimpan KKM bawaan." }, { status: 500 });
  }
}
