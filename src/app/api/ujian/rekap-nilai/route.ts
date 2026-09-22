import { NextRequest } from "next/server";
import { verifyRole } from "@/lib/dal";
import { daftarKegiatanRekap, muatRekapNilai } from "@/lib/rekap-nilai-ujian";

export const dynamic = "force-dynamic";

/** REKAP NILAI UJIAN per kegiatan (leger per kelas, per mapel, ringkasan) — cakupan mengikuti pemanggil, lihat
 * src/lib/rekap-nilai-ujian.ts. Hitungannya di klien lewat src/lib/rekap-nilai-hitung.ts (sama dengan berkas Excel). */
export async function GET(req: NextRequest) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    const daftar = await daftarKegiatanRekap();
    const diminta = new URL(req.url).searchParams.get("kegiatanId");
    const id = daftar.find(k => k.id === diminta)?.id ?? daftar.find(k => k.aktif)?.id ?? daftar[0]?.id ?? "";
    const data = id ? await muatRekapNilai(session, id) : null;
    return Response.json({ kegiatan: daftar, kegiatanId: id, data });
  } catch {
    return Response.json({ error: "Gagal memuat rekap nilai." }, { status: 500 });
  }
}
