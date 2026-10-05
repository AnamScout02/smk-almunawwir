import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { prisma } from "@/lib/prisma";
import { modeBelBerlaku } from "@/lib/bel-profil";

export const dynamic = "force-dynamic";

/** KABAR PAPAN (25 September 2026) — pengumuman kantor yang sedang berlaku untuk satu layar.
 *
 * Dibuat setelah pertanyaan user: "cabut pengumuman dan kirim pengumuman apa langsung tampil?" Jawabannya dulu
 * TIDAK: pengumuman hanya terbaca saat papan memuat ulang halaman, yaitu tiap 10 menit. Pengumuman "rapat pukul
 * 13.00" yang dikirim 12.55 baru muncul 13.05 — persis saat sudah tidak berguna, dan pencabutan pun menggantung
 * selama itu.
 *
 * Rute ini SENGAJA seringan mungkin (satu baris, dicari lewat kolom token yang berindeks unik) karena papan
 * memanggilnya tiap 10 detik. Ia tidak mengirim apa pun selain pengumuman — jadwal, agenda, dan bel tetap ikut
 * muatan halaman yang memang jarang berubah.
 *
 * Tanpa login, seperti rute papan lainnya: izinnya dari token layar, dan isinya persis yang memang ditayangkan
 * di dinding. */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const layar = await prisma.layar.findUnique({
      where: { token },
      select: { aktif: true, papanJudul: true, papanIsi: true, papanManualSaja: true, papanCara: true, belMode: true, belModeSampai: true },
    }).catch(() => null);
    if (!layar || !layar.aktif) return Response.json({ error: "Layar tidak dikenal." }, { status: 404 });

    return Response.json({
      judul: layar.papanJudul,
      isi: layar.papanIsi,
      manualSaja: layar.papanManualSaja,
      cara: layar.papanCara,
      // Mode Hening ikut denyut 10 detik supaya menyala/padam tanpa memuat ulang papan (ruang ANBK/TKA).
      hening: modeBelBerlaku(layar) === "HENING",
    });
  } catch (galat) {
    lemparBilaPengalihan(galat);
    return Response.json({ error: "Gagal membaca kabar papan." }, { status: 500 });
  }
}
