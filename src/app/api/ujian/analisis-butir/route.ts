import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { NextRequest } from "next/server";
import { verifyRole } from "@/lib/dal";
import { daftarKegiatanRekap } from "@/lib/rekap-nilai-ujian";
import { rekapAnalisisKegiatan } from "@/lib/analisis-butir-server";

export const dynamic = "force-dynamic";

/** Rekap analisis butir per kegiatan ujian — cakupan mengikuti Daftar Ujian pemanggil (src/lib/analisis-butir-server.ts). */
export async function GET(req: NextRequest) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    const daftar = await daftarKegiatanRekap();
    const diminta = new URL(req.url).searchParams.get("kegiatanId");
    const id = daftar.find(k => k.id === diminta)?.id ?? daftar.find(k => k.aktif)?.id ?? daftar[0]?.id ?? "";
    const ujian = id ? await rekapAnalisisKegiatan(session, id) : [];
    return Response.json({ kegiatan: daftar, kegiatanId: id, ujian });
  } catch (galat) {
    lemparBilaPengalihan(galat);
    return Response.json({ error: "Gagal memuat analisis butir." }, { status: 500 });
  }
}
