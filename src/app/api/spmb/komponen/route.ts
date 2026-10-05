import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { assertSpmb } from "@/lib/spmb";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

/** Komponen penilaian SPMB — DITENTUKAN PANITIA, bukan ditanam di kode (keputusan user
 *  1 Oktober 2026: "bisa disesuaikan dari semuanya pilihan"). Sekolah boleh memakai nilai rapor
 *  saja, atau menambah tes tulis, baca Qur'an, wawancara, dan kesehatan dengan bobotnya sendiri. */
export async function GET() {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertSpmb(session);
    const komponen = await prisma.komponenNilaiSpmb.findMany({
      orderBy: [{ urutan: "asc" }, { nama: "asc" }],
      include: { _count: { select: { nilai: true } } },
    });
    return NextResponse.json(komponen);
  } catch (e) {
    lemparBilaPengalihan(e);
    return NextResponse.json({ error: "Tidak berwenang" }, { status: 403 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertSpmb(session);
    const b = await req.json();
    const nama = String(b?.nama ?? "").trim();
    if (!nama) return NextResponse.json({ error: "Nama komponen wajib diisi" }, { status: 400 });
    const jenis = ["LULUS_TIDAK", "PRESTASI"].includes(b?.jenis) ? b.jenis : "ANGKA";
    const terakhir = await prisma.komponenNilaiSpmb.findFirst({ orderBy: { urutan: "desc" }, select: { urutan: true } });
    const k = await prisma.komponenNilaiSpmb.create({
      data: {
        nama, jenis,
        bobot: jenis === "LULUS_TIDAK" ? 0 : Math.max(1, Number(b?.bobot) || 1),
        nilaiMaks: jenis === "LULUS_TIDAK" ? 100 : Math.max(1, Number(b?.nilaiMaks) || 100),
        urutan: (terakhir?.urutan ?? 0) + 1,
        aktif: b?.aktif !== false,
      },
    });
    await logActivity(session, { action: "CREATE", entity: "KomponenNilaiSpmb", entityId: k.id, description: `Menambah komponen nilai SPMB "${nama}"` });
    return NextResponse.json({ ok: true, id: k.id });
  } catch (e) {
    lemparBilaPengalihan(e);
    return NextResponse.json({ error: "Gagal menyimpan" }, { status: 500 });
  }
}
