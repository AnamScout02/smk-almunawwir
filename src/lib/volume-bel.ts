import "server-only";
import { bacaVolume, aturVolume } from "@/lib/layar-adb";

/** VOLUME TV SAAT BEL BERBUNYI (25 September 2026, permintaan user: "saat bel hidup otomatis volume 100 dan
 * ketika mati kembali volume sebelumnya").
 *
 * Papan memberi tahu server tepat sebelum bel berbunyi dan tepat setelah selesai; server yang menaikkan dan
 * mengembalikan volume TV lewat ADB. Halaman web tidak bisa melakukannya sendiri — `HTMLMediaElement.volume`
 * hanya meredam suara halaman, bukan volume perangkat.
 *
 * Yang dijaga di sini, semuanya karena akibat salahnya menetap di TV sampai ada yang sadar:
 * - **Volume semula disimpan SEKALI.** Bel yang beruntun (mis. dua bel berdekatan) tidak boleh menyimpan "100"
 *   sebagai nilai semula — kalau itu terjadi, TV tertinggal keras selamanya.
 * - **Selalu ada pengembalian cadangan.** Papan bisa mati, TV bisa lepas jaringan, tab bisa dimuat ulang persis
 *   saat bel berbunyi. Karena itu pengembalian juga dijadwalkan otomatis; tanpa itu satu gangguan kecil
 *   meninggalkan TV pada volume penuh.
 * - **Nilai semula 0 tetap dihormati** (TV yang sengaja dibisukan kembali dibisukan). Karena itu penanda
 *   "belum ada yang disimpan" memakai ketiadaan entri, bukan angka 0.
 *
 * Keadaan disimpan di memori proses: ini data sesaat berumur beberapa detik, tidak pantas menjadi baris basis
 * data yang ikut tercadangkan. Risikonya hanya bila aplikasi dipasang ulang PERSIS saat bel berbunyi. */

interface Tersimpan { nilai: number; waktu: number; pengembali: ReturnType<typeof setTimeout> }

const simpanan: Map<string, Tersimpan> = (globalThis as unknown as { __volumeBel?: Map<string, Tersimpan> }).__volumeBel
  ?? new Map<string, Tersimpan>();
(globalThis as unknown as { __volumeBel?: Map<string, Tersimpan> }).__volumeBel = simpanan;

/** Batas aman: bel sekolah tidak ada yang lebih panjang dari ini. Lewat batas, volume dikembalikan sendiri. */
const BATAS_MS = 3 * 60_000;

export async function mulaiBel(layarId: string, ip: string, volume: number): Promise<{ ok: boolean; pesan: string }> {
  const sebelumnya = simpanan.get(layarId);
  if (!sebelumnya) {
    const kini = await bacaVolume(ip);
    if (!kini) return { ok: false, pesan: "Volume TV tidak terbaca." };
    const pengembali = setTimeout(() => { void selesaiBel(layarId, ip); }, BATAS_MS);
    simpanan.set(layarId, { nilai: kini.nilai, waktu: Date.now(), pengembali });
    // Volume TV memakai skala perangkatnya sendiri (0–100 di TV sekolah); angka dari pengaturan adalah PERSEN.
    const sasaran = Math.round((Math.min(100, Math.max(0, volume)) / 100) * kini.maks);
    await aturVolume(ip, sasaran);
    return { ok: true, pesan: `Volume dinaikkan ke ${sasaran} (semula ${kini.nilai}).` };
  }
  // Bel beruntun: volume sasaran dipastikan lagi, tetapi nilai semula JANGAN ditimpa.
  clearTimeout(sebelumnya.pengembali);
  sebelumnya.pengembali = setTimeout(() => { void selesaiBel(layarId, ip); }, BATAS_MS);
  return { ok: true, pesan: "Bel beruntun — volume semula tetap yang pertama." };
}

export async function selesaiBel(layarId: string, ip: string): Promise<{ ok: boolean; pesan: string }> {
  const tersimpan = simpanan.get(layarId);
  if (!tersimpan) return { ok: true, pesan: "Tidak ada volume yang perlu dikembalikan." };
  clearTimeout(tersimpan.pengembali);
  simpanan.delete(layarId);
  const ok = await aturVolume(ip, tersimpan.nilai);
  return ok
    ? { ok: true, pesan: `Volume dikembalikan ke ${tersimpan.nilai}.` }
    : { ok: false, pesan: "Volume gagal dikembalikan — TV tidak menjawab." };
}
