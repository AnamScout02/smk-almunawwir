import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { aksesSarpras } from "@/lib/sarpras-akses";
import { tangkapLayar } from "@/lib/layar-adb";
import { logActivity } from "@/lib/activity-log";
import sharp from "sharp";

export const dynamic = "force-dynamic";

/** MODE LANGSUNG (24 September 2026, dipilih user dari tiga pilihan: "yang tengah").
 *
 * Mengalirkan tangkapan layar beruntun sebagai **multipart/x-mixed-replace** — format lama yang justru ideal di
 * sini: browser menampilkannya sebagai gambar bergerak tanpa JavaScript, tanpa pemutar video, dan tanpa ffmpeg
 * (yang memang tidak terpasang di server ini).
 *
 * Bukan video sungguhan, dan itu disengaja. Video H.264 menuntut TV merekam layarnya terus-menerus, padahal
 * TCL P6L cuma punya RAM 2 GB; hasilnya ±1 gambar/detik sudah cukup untuk melihat apa yang sedang tampil.
 *
 * Tiga pembatas yang WAJIB dipertahankan:
 * - **Satu TV saja per aliran**, dipakai hanya di tampilan perbesar. Mengalirkan 12 TV sekaligus akan
 *   menghabiskan jaringan sekolah.
 * - **Berhenti otomatis setelah 2 menit** supaya tidak ada aliran yang lupa dimatikan seharian.
 * - **Gambar dikecilkan ke lebar 960 & JPEG mutu 70** (dari PNG ±800 KB jadi ±60 KB) sebelum dikirim.
 */
const DURASI_MAKS_MS = 2 * 60_000;
const JEDA_ANTAR_FRAME_MS = 700;
const BATAS = "bingkai";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    const akses = await aksesSarpras(session);
    if (!akses.masuk) return Response.json({ error: "Khusus pengelola sarana prasarana." }, { status: 403 });

    const { id } = await params;
    const layar = await prisma.layar.findUnique({ where: { id }, select: { nama: true, ruang: true, ipTerakhir: true, ipTetap: true } });
    if (!layar) return Response.json({ error: "Layar tidak ditemukan." }, { status: 404 });
    const ip = layar.ipTetap || layar.ipTerakhir;
    if (!ip) return Response.json({ error: "Alamat IP TV belum diketahui." }, { status: 409 });

    // Frame pertama diambil lebih dulu: kalau TV tidak menjawab, balas galat yang bisa dibaca petugas
    // alih-alih membuka aliran kosong yang membuatnya menunggu tanpa penjelasan.
    const awal = await tangkapLayar(ip);
    if ("galat" in awal) return Response.json({ error: awal.galat, status: awal.status }, { status: 503 });

    await logActivity(session, {
      action: "PANTAU_LANGSUNG_TV", entity: "Layar", entityId: id,
      description: `Membuka mode langsung layar "${layar.nama}" (${layar.ruang})`,
    });

    const kecilkan = (png: Buffer) => sharp(png).resize({ width: 960, withoutEnlargement: true }).jpeg({ quality: 70 }).toBuffer();

    const aliran = new ReadableStream<Uint8Array>({
      async start(pengendali) {
        const mulai = Date.now();
        const kirim = (jpeg: Buffer) => {
          pengendali.enqueue(new TextEncoder().encode(`--${BATAS}\r\nContent-Type: image/jpeg\r\nContent-Length: ${jpeg.length}\r\n\r\n`));
          pengendali.enqueue(new Uint8Array(jpeg));
          pengendali.enqueue(new TextEncoder().encode("\r\n"));
        };

        try {
          kirim(await kecilkan(awal.png));
          while (Date.now() - mulai < DURASI_MAKS_MS) {
            await new Promise(r => setTimeout(r, JEDA_ANTAR_FRAME_MS));
            const hasil = await tangkapLayar(ip);
            if ("galat" in hasil) break; // TV dimatikan / izin dicabut di tengah jalan — tutup aliran dengan rapi
            kirim(await kecilkan(hasil.png));
          }
        } catch {
          // Penonton menutup halaman: enqueue gagal. Bukan galat yang perlu dicatat.
        } finally {
          try { pengendali.close(); } catch { /* sudah tertutup */ }
        }
      },
    });

    return new Response(aliran, {
      headers: {
        "Content-Type": `multipart/x-mixed-replace; boundary=${BATAS}`,
        // no-transform WAJIB: kompresi di depan aplikasi menahan potongan aliran (pelajaran dari SSE papan
        // pantau ujian, CLAUDE.md #30).
        "Cache-Control": "no-cache, no-store, no-transform",
        "Connection": "keep-alive",
      },
    });
  } catch (galat) {
    lemparBilaPengalihan(galat);
    return Response.json({ error: "Gagal membuka mode langsung." }, { status: 500 });
  }
}
