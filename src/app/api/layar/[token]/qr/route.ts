import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";
import { tokenStasiun, menitDariJam } from "@/lib/absensi-qr";

export const dynamic = "force-dynamic";

/** QR PRESENSI DI PAPAN TV (25 September 2026) — supaya guru & siswa tinggal memindai dari layar terdekat.
 *
 * TANPA LOGIN, karena TV tidak bisa mengetik sandi: yang memberi izin adalah **token layar** (acak, dibuat
 * petugas per TV) dan mode QR layar itu. Rute ini SENGAJA ringan — hanya mengembalikan token stasiun, tanpa
 * rekap atau daftar pemindai — karena papan memanggilnya tiap 5 detik.
 *
 * Dua pagar yang disepakati bersama user:
 * 1. **Opt-in per TV** (`papanQr`): MATI (bawaan) · JAM_PRESENSI · SELALU.
 * 2. **JAM_PRESENSI mengikuti jam buka–tutup absen** — di luar jam itu QR tidak dilayani sama sekali, jadi
 *    kalaupun tautan layar bocor, tidak ada yang bisa ditampilkan. Untuk TV ruang guru dipakai SELALU, karena
 *    jadwal guru tidak semuanya pagi.
 *
 * Keamanan pindaiannya sendiri tetap seperti semula: token berganti tiap 5 detik, pemindai wajib login di akun
 * masing-masing, dan tiap pindaian tercatat di `AbsensiPindaiLog` lengkap dengan perangkatnya. */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const layar = await prisma.layar.findUnique({
      where: { token },
      select: { aktif: true, papanQr: true, papanJenis: true },
    }).catch(() => null);
    if (!layar || !layar.aktif) return Response.json({ error: "Layar tidak dikenal." }, { status: 404 });
    if (layar.papanQr === "MATI") return Response.json({ aktif: false });

    if (layar.papanQr === "JAM_PRESENSI") {
      const s = await getSettings(["absensiQr.jamBuka", "absensiQr.jamTutup"]).catch(() => ({}) as Record<string, string>);
      const buka = menitDariJam(s["absensiQr.jamBuka"] ?? "05:30");
      const tutup = menitDariJam(s["absensiQr.jamTutup"] ?? "12:00");
      const w = new Date(Date.now() + 7 * 3600_000);
      const menit = w.getUTCHours() * 60 + w.getUTCMinutes();
      if (menit < buka || menit >= tutup) {
        return Response.json({ aktif: false, alasan: "di luar jam presensi", jamBuka: s["absensiQr.jamBuka"], jamTutup: s["absensiQr.jamTutup"] });
      }
    }

    // Stasiun GERBANG = berlaku untuk semua kelas, sama dengan layar QR yang dipasang di gerbang.
    const t = tokenStasiun("GERBANG");

    /* SIAPA BARUSAN MEMINDAI (25 September 2026, permintaan user: "di bawahnya muncul nama dan waktu yang habis
       scan absen"). Dititipkan di respons QR yang MEMANG sudah dipanggil tiap 5 detik — membuat rute & polling
       baru hanya untuk daftar lima baris ini justru menggandakan beban tanpa menambah apa pun.
       Hanya papan ruang guru: di TV kelas, daftar nama pegawai tidak ada urusannya dengan yang menonton. */
    let terakhir: { nama: string; jam: string }[] = [];
    if (layar.papanJenis === "GURU") {
      const w = new Date(Date.now() + 7 * 3600_000);
      const hariIni = new Date(`${w.toISOString().slice(0, 10)}T00:00:00.000Z`);
      const baris = await prisma.staffAttendance.findMany({
        where: { tanggal: hariIni, jamMasuk: { not: null } },
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: { jamMasuk: true, user: { select: { name: true } } },
      }).catch(() => []);
      terakhir = baris.map(b => ({ nama: b.user.name, jam: b.jamMasuk! }));
    }

    return Response.json({ aktif: true, isi: t.isi, berlakuSampai: t.berlakuSampai, terakhir });
  } catch (galat) {
    lemparBilaPengalihan(galat);
    return Response.json({ error: "Gagal menyiapkan QR." }, { status: 500 });
  }
}
