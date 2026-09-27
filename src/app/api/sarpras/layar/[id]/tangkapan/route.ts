import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { aksesSarpras } from "@/lib/sarpras-akses";
import { tangkapLayar } from "@/lib/layar-adb";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

/** Tangkapan layar TV (PNG). SETIAP pengambilan dicatat di Log Aktivitas — fitur ini untuk menindak laporan,
 * bukan mengintip diam-diam, jadi harus selalu jelas siapa yang mengambil dan kapan. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    const akses = await aksesSarpras(session);
    if (!akses.masuk) return Response.json({ error: "Khusus pengelola sarana prasarana." }, { status: 403 });

    const { id } = await params;
    const layar = await prisma.layar.findUnique({ where: { id }, select: { nama: true, ruang: true, ipTerakhir: true, ipTetap: true } });
    if (!layar) return Response.json({ error: "Layar tidak ditemukan." }, { status: 404 });
    const ip = layar.ipTetap || layar.ipTerakhir;
    if (!ip) return Response.json({ error: "Alamat IP TV belum diketahui — nyalakan TV lalu muat ulang halaman." }, { status: 409 });

    const hasil = await tangkapLayar(ip);
    if ("galat" in hasil) return Response.json({ error: hasil.galat, status: hasil.status }, { status: 503 });

    await logActivity(session, {
      action: "TANGKAP_LAYAR_TV", entity: "Layar", entityId: id,
      description: `Mengambil tangkapan layar "${layar.nama}" (${layar.ruang})`,
    });
    return new Response(new Uint8Array(hasil.png), {
      headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
    });
  } catch (galat) {
    lemparBilaPengalihan(galat);
    return Response.json({ error: "Gagal mengambil tangkapan layar." }, { status: 500 });
  }
}
