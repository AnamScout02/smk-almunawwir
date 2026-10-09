import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { assertSpmb } from "@/lib/spmb";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertSpmb(session);
    const [gelombang, jurusan, tahun] = await Promise.all([
      prisma.gelombangSpmb.findMany({
        orderBy: { urutan: "asc" },
        include: { kuota: { include: { major: { select: { id: true, name: true, code: true } } } }, _count: { select: { pendaftar: true, sesi: true } } },
      }),
      prisma.major.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, code: true } }),
      prisma.academicYear.findMany({ orderBy: { name: "desc" }, select: { id: true, name: true, isActive: true } }),
    ]);
    return NextResponse.json({ gelombang, jurusan, tahun });
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
    if (!nama) return NextResponse.json({ error: "Nama gelombang wajib diisi" }, { status: 400 });
    const buka = new Date(String(b?.buka ?? "") + "T00:00:00+07:00");
    const tutup = new Date(String(b?.tutup ?? "") + "T23:59:59+07:00");
    if (isNaN(buka.getTime()) || isNaN(tutup.getTime())) return NextResponse.json({ error: "Tanggal buka & tutup wajib diisi" }, { status: 400 });
    if (tutup < buka) return NextResponse.json({ error: "Tanggal tutup lebih awal dari tanggal buka" }, { status: 400 });
    const terakhir = await prisma.gelombangSpmb.findFirst({ orderBy: { urutan: "desc" }, select: { urutan: true } });
    const g = await prisma.gelombangSpmb.create({
      data: {
        nama, buka, tutup,
        urutan: (terakhir?.urutan ?? 0) + 1,
        biayaDaftar: Math.max(0, Number(b?.biayaDaftar) || 0),
        catatan: String(b?.catatan ?? "").trim() || null,
        tahunAjaranId: String(b?.tahunAjaranId ?? "").trim() || null,
        aktif: b?.aktif !== false,
      },
    });
    await logActivity(session, { action: "CREATE", entity: "GelombangSpmb", entityId: g.id, description: `Menambah gelombang SPMB "${nama}"` });
    return NextResponse.json({ ok: true, id: g.id });
  } catch (e) {
    lemparBilaPengalihan(e);
    return NextResponse.json({ error: "Gagal menyimpan gelombang" }, { status: 500 });
  }
}
