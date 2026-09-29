import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { assertKurikulum } from "@/lib/kurikulum-guard";
import { logActivity } from "@/lib/activity-log";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

/** FORM SINGKATAN MAPEL (22 September 2026) — satu isian per NAMA mapel, disimpan ke semua baris Subject bernama sama
 * (tingkat/jurusan berbeda). Dipakai kepala kolom DKN & leger (src/lib/singkatan-mapel.ts). */
export async function GET() {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertKurikulum(session);
    const baris = await prisma.subject.findMany({ select: { name: true, category: true, singkatan: true, order: true }, orderBy: [{ order: "asc" }, { name: "asc" }] });
    const peta = new Map<string, { nama: string; kategori: string; singkatan: string; jumlah: number; urut: number }>();
    for (const b of baris) {
      const ada = peta.get(b.name);
      if (ada) { ada.jumlah++; if (!ada.singkatan && b.singkatan) ada.singkatan = b.singkatan; continue; }
      peta.set(b.name, { nama: b.name, kategori: b.category, singkatan: b.singkatan ?? "", jumlah: 1, urut: b.order });
    }
    return NextResponse.json({ mapel: [...peta.values()] });
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") return NextResponse.json({ error: "Khusus Wakil Kepala Kurikulum." }, { status: 403 });
    return NextResponse.json({ error: "Gagal memuat mapel." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertKurikulum(session);
    const b = await req.json().catch(() => ({})) as { daftar?: { nama?: unknown; singkatan?: unknown }[] };
    const daftar = (Array.isArray(b.daftar) ? b.daftar : [])
      .map(x => ({ nama: String(x.nama ?? "").trim(), singkatan: String(x.singkatan ?? "").trim().replace(/\s+/g, " ").slice(0, 16) }))
      .filter(x => x.nama);
    let n = 0;
    await prisma.$transaction(async tx => {
      for (const x of daftar) {
        const r = await tx.subject.updateMany({ where: { name: x.nama }, data: { singkatan: x.singkatan || null } });
        n += r.count;
      }
    });
    await logActivity(session, { action: "SINGKATAN_MAPEL", entity: "Subject", entityId: "-", description: `Menyimpan singkatan ${daftar.length} mapel (${n} baris)` }).catch(() => {});
    return NextResponse.json({ ok: true, mapel: daftar.length, baris: n });
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") return NextResponse.json({ error: "Khusus Wakil Kepala Kurikulum." }, { status: 403 });
    return NextResponse.json({ error: "Gagal menyimpan singkatan." }, { status: 500 });
  }
}
