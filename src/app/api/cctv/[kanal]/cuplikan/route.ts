import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { verifyRole } from "@/lib/dal";
import { assertCctv } from "@/lib/cctv-guard";
import { cuplikanKamera } from "@/lib/cctv";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

/** Catatan pembukaan CCTV DIBATASI satu kali per pengguna tiap 10 menit.
 *
 * Layar CCTV menyegarkan gambar tiap belasan detik untuk banyak kamera sekaligus; kalau tiap gambar dicatat,
 * Log Aktivitas akan tenggelam oleh ratusan baris identik dan justru menyulitkan penelusuran. Yang penting
 * tercatat adalah SIAPA membuka CCTV dan KAPAN — itu yang dijaga di sini. */
const catatanTerakhir = new Map<string, number>();
const JEDA_CATAT_MS = 10 * 60_000;

export async function GET(_req: Request, { params }: { params: Promise<{ kanal: string }> }) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertCctv(session);

    const { kanal } = await params;
    const nomor = Math.max(1, Math.min(64, Number(kanal) || 1));

    const hasil = await cuplikanKamera(nomor);
    if ("galat" in hasil) return Response.json({ error: hasil.galat }, { status: 503 });

    const sebelumnya = catatanTerakhir.get(session.userId) ?? 0;
    if (Date.now() - sebelumnya > JEDA_CATAT_MS) {
      catatanTerakhir.set(session.userId, Date.now());
      await logActivity(session, {
        action: "LIHAT_CCTV", entity: "SiteSetting", entityId: "cctv",
        description: "Membuka layar CCTV sekolah",
      });
    }

    return new Response(new Uint8Array(hasil.jpeg), {
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "no-store" },
    });
  } catch (galat) {
    lemparBilaPengalihan(galat);
    if (galat instanceof Error && galat.message === "FORBIDDEN") {
      return Response.json({ error: "Tidak berhak melihat CCTV." }, { status: 403 });
    }
    return Response.json({ error: "Gagal mengambil gambar kamera." }, { status: 500 });
  }
}
