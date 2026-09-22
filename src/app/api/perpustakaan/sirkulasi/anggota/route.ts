import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { assertPerpustakaan } from "@/lib/perpustakaan-guard";
import { anggotaDariUserId, cariAnggota, ringkasanAnggota } from "@/lib/perpustakaan-server";

export const dynamic = "force-dynamic";

/** MEJA SIRKULASI — langkah 1: kenali anggota dari kartu (`{ kode }`) atau muat ulang (`{ id }`), lalu tampilkan
 * pinjaman aktif, keterlambatan, tunggakan denda, dan reservasi. Khusus Koordinator/Tim Perpustakaan & admin. */
export async function POST(req: NextRequest) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertPerpustakaan(session);
    const { kode, id } = (await req.json().catch(() => ({}))) as { kode?: string; id?: string };
    const anggota = id ? await anggotaDariUserId(id) : await cariAnggota(kode ?? "");
    if (!anggota) return NextResponse.json({ error: `Kartu "${(kode ?? "").trim()}" tidak dikenali sebagai anggota perpustakaan.` }, { status: 404 });
    return NextResponse.json({ anggota, ...(await ringkasanAnggota(anggota.id)) });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return NextResponse.json({ error: "Khusus Koordinator/Tim Perpustakaan." }, { status: 403 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
