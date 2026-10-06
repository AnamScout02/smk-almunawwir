import "server-only";
import { prisma } from "@/lib/prisma";

/** MODE PEMELIHARAAN (5 Oktober 2026) — permintaan user: "halaman maintenance, bisa dimatikan hidupkan, kecuali saat
 *  login dengan superadmin tidak ada dampak".
 *
 *  - Satu sumber status: SiteSetting `sistem.pemeliharaan` ("1"/"0") + pesan & perkiraan selesai. Dibaca `proxy.ts`
 *    untuk SETIAP permintaan, jadi disinggahkan di memori 10 detik (satu proses Node); menyimpan dari halaman pengaturan
 *    langsung membuang singgahan (`lupakanPemeliharaan`) sehingga terasa seketika.
 *  - Yang TIDAK pernah terdampak: Superadmin (peran ADMIN) dan admin yang sedang "Masuk Sebagai" (token membawa `imp`) —
 *    justru merekalah yang memeriksa situs selama pemeliharaan.
 *  - Jalur yang tetap terbuka bagi semua (`jalurBebas`): halaman login (supaya Superadmin bisa masuk), halaman pemeliharaan
 *    itu sendiri, berkas statis & ikon, dan papan TV `/layar` (bel sekolah di TV tidak boleh ikut mati).
 *  - Gagal membaca database = dianggap TIDAK pemeliharaan: menutup seluruh sekolah karena DB tersendat lebih buruk
 *    daripada membiarkan situs tetap jalan. */
export const KUNCI_PEMELIHARAAN = {
  aktif: "sistem.pemeliharaan",
  pesan: "sistem.pemeliharaanPesan",
  sampai: "sistem.pemeliharaanSampai",
  mulai: "sistem.pemeliharaanMulai",
} as const;

export interface KeadaanPemeliharaan { aktif: boolean; pesan: string; sampai: string; mulai: string | null }

const g = globalThis as unknown as { __pemeliharaan?: { nilai: KeadaanPemeliharaan; kapan: number } };

export async function bacaPemeliharaan(): Promise<KeadaanPemeliharaan> {
  const sekarang = Date.now();
  if (g.__pemeliharaan && sekarang - g.__pemeliharaan.kapan < 10_000) return g.__pemeliharaan.nilai;
  try {
    const baris = await prisma.siteSetting.findMany({ where: { key: { in: Object.values(KUNCI_PEMELIHARAAN) } } });
    const peta = new Map(baris.map(b => [b.key, b.value]));
    const nilai: KeadaanPemeliharaan = {
      aktif: peta.get(KUNCI_PEMELIHARAAN.aktif) === "1",
      pesan: peta.get(KUNCI_PEMELIHARAAN.pesan) ?? "",
      sampai: peta.get(KUNCI_PEMELIHARAAN.sampai) ?? "",
      mulai: peta.get(KUNCI_PEMELIHARAAN.mulai) || null,
    };
    g.__pemeliharaan = { nilai, kapan: sekarang };
    return nilai;
  } catch {
    return g.__pemeliharaan?.nilai ?? { aktif: false, pesan: "", sampai: "", mulai: null };
  }
}

export function lupakanPemeliharaan() { delete g.__pemeliharaan; }

const AWALAN_BEBAS = [
  "/login", "/pemeliharaan", "/api/passkey", "/_next/", "/images/", "/icons/", "/ikon-aplikasi/", "/uploads/", "/fonts/",
  "/layar/", "/api/layar/",
];
const BERKAS_BEBAS = ["/favicon.ico", "/manifest.webmanifest", "/sw.js", "/robots.txt", "/apple-icon.png", "/icon.png"];

export function jalurBebas(path: string) {
  return BERKAS_BEBAS.includes(path) || AWALAN_BEBAS.some(a => path === a.replace(/\/$/, "") || path.startsWith(a));
}
