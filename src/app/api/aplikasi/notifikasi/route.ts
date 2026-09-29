import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

/** KABAR UNTUK APLIKASI ANDROID (MyAlwis Mobile, 23 September 2026) — notifikasi push web TIDAK berjalan di WebView,
 * jadi aplikasi menanyakan kotak notifikasi sendiri tiap ±15 menit lewat JobScheduler (LayananKabar.java) dan
 * memunculkannya sebagai notifikasi Android biasa.
 *
 * Sengaja SANGAT ringan (dua kueri berindeks, maksimal 5 butir) karena dipanggil semua HP berkala, dan sengaja
 * TIDAK menandai apa pun sebagai dibaca — itu hanya terjadi saat pengguna benar-benar membuka kotak notifikasi
 * (/api/notifikasi). Aplikasi mengingat sendiri id yang sudah pernah ditampilkan supaya tidak berulang. */
export async function GET() {
  let session: Awaited<ReturnType<typeof verifySession>>;
  try {
    session = await verifySession();
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const [belumDibaca, baris] = await Promise.all([
    prisma.notifikasiPengguna.count({ where: { userId: session.userId, dibacaAt: null } }),
    prisma.notifikasiPengguna.findMany({
      where: { userId: session.userId, dibacaAt: null },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, createdAt: true, notifikasi: { select: { jenis: true, judul: true, isi: true, url: true } } },
    }),
  ]);
  return Response.json({
    belumDibaca,
    item: baris.map(b => ({
      id: b.id,
      waktu: b.createdAt,
      jenis: b.notifikasi.jenis,
      judul: b.notifikasi.judul,
      isi: b.notifikasi.isi,
      url: b.notifikasi.url ?? "/notifikasi",
    })),
  });
}
