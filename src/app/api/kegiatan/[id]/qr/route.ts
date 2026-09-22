import { verifySession } from "@/lib/dal";
import { kegiatanMilik, tokenKegiatan } from "@/lib/kegiatan-qr";
import { generateQrDataUrl } from "@/lib/qrcode";
import { ALAMAT_APLIKASI } from "@/lib/alamat-aplikasi";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** QR presensi yang sedang berlaku (layar QR memanggil tiap ±25 detik) + jumlah hadir terbaru. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySession();
  const { id } = await params;
  const m = await kegiatanMilik(id, session);
  if (!m) return Response.json({ error: "Tidak berhak." }, { status: 403 });
  const { token, berlakuSampai } = tokenKegiatan(id);
  // Alamat mengikuti jalur yang sedang dipakai layar (HTTP lab atau HTTPS) supaya HP di jaringan sama bisa membuka.
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const dasar = host && !host.startsWith("localhost") && !host.startsWith("0.0.0.0") ? `${proto}://${host}` : ALAMAT_APLIKASI;
  const url = `${dasar}/hadir/${id}?t=${token}`;
  const [qr, hadir, terakhir] = await Promise.all([
    generateQrDataUrl(url),
    prisma.presensiKegiatan.count({ where: { kegiatanId: id } }),
    prisma.presensiKegiatan.findMany({ where: { kegiatanId: id }, orderBy: { waktu: "desc" }, take: 6, select: { nama: true, waktu: true } }),
  ]);
  return Response.json({ judul: m.k.judul, tempat: m.k.tempat, mulai: m.k.mulai, selesai: m.k.selesai, qr, berlakuSampai, hadir, terakhir });
}
