import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySpmbAccess } from "@/lib/spmb";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

/** Isian PANITIA per sekolah sasaran: nama kepala sekolah, nomor yang bisa dihubungi, catatan, tanggal dikunjungi.
 *  Sumber terbuka tidak memuat nama kepala sekolah maupun nomor HP, jadi ini diisi tangan dan tidak ikut "Perbarui". */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ npsn: string }> }) {
  try {
    await verifySpmbAccess();
    const { npsn } = await params;
    const b = await req.json().catch(() => ({}));
    const t = (v: unknown, maks: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, maks) : null);
    const tgl = typeof b.dikunjungi === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.dikunjungi) ? new Date(`${b.dikunjungi}T00:00:00Z`) : null;
    const r = await prisma.potensiSekolah.updateMany({
      where: { npsn }, data: { kepala: t(b.kepala, 120), kontak: t(b.kontak, 60), catatan: t(b.catatan, 600), dikunjungi: tgl },
    });
    if (!r.count) return NextResponse.json({ error: "Sekolah tidak ditemukan." }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (e) { lemparBilaPengalihan(e); return NextResponse.json({ error: "Gagal menyimpan." }, { status: 500 }); }
}
