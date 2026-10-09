import { NextRequest, NextResponse } from "next/server";
import { verifySpmbAccess } from "@/lib/spmb";
import { keadaanPotensi, mulaiSegarkanPotensi } from "@/lib/potensi-smp";
import { logActivity } from "@/lib/activity-log";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await verifySpmbAccess();
    return NextResponse.json(keadaanPotensi());
  } catch (e) { lemparBilaPengalihan(e); return NextResponse.json({ error: "Tidak berwenang." }, { status: 403 }); }
}

/** Mulai menyalin data satu kabupaten dari Sekolah Kita (berjalan di latar; kemajuan lewat GET). */
export async function POST(req: NextRequest) {
  try {
    const session = await verifySpmbAccess();
    const { kab, jenis: jenisMinta } = await req.json().catch(() => ({}));
    const jenis = jenisMinta === "lanjutan" ? "lanjutan" : "smp";
    if (typeof kab !== "string" || !kab) return NextResponse.json({ error: "Kabupaten wajib dipilih." }, { status: 400 });
    if (keadaanPotensi().berjalan) return NextResponse.json({ error: "Pengambilan data masih berjalan." }, { status: 409 });
    if (!(await mulaiSegarkanPotensi(kab, jenis))) return NextResponse.json({ error: "Kabupaten itu bukan asal siswa kita." }, { status: 400 });
    await logActivity(session, { action: "PERBARUI", entity: "PotensiSekolah", description: `Memperbarui data ${jenis === "lanjutan" ? "sekolah lanjutan (SMK/SMA/MA)" : "Potensi Lulusan SMP/MTs"} — ${kab}` }).catch(() => {});
    return NextResponse.json(keadaanPotensi());
  } catch (e) { lemparBilaPengalihan(e); return NextResponse.json({ error: "Gagal memulai." }, { status: 500 }); }
}
