import "server-only";
import { getSettings } from "./site-settings";

export { TEMPAT_BELUM_DITENTUKAN, penempatanBelumPasti } from "./pkl-tempat";

export const KUNCI_TINGKAT_PENDAFTAR = "pkl.tingkatPendaftar";
export const KUNCI_PENDAFTARAN_DIBUKA = "pkl.pendaftaranDibuka";

/** Semester berjalan menurut WIB: tahun ajaran dimulai Juli, jadi Juli–Desember = ganjil,
 *  Januari–Juni = genap (server berjalan di UTC — lihat DESIGN_SYSTEM §17.4 butir 3). */
export function semesterBerjalan(now = new Date()): "ganjil" | "genap" {
  const wib = new Date(now.getTime() + 7 * 3600_000);
  return wib.getUTCMonth() + 1 >= 7 ? "ganjil" : "genap";
}

export interface IzinDaftarPkl {
  boleh: boolean;
  /** Alasan yang boleh ditampilkan ke siswa saat pendaftaran tertutup. */
  alasan?: string;
  tingkat: number[];
  semester: "ganjil" | "genap";
}

/**
 * Siapa boleh mengajukan Pendaftaran PKL: **siswa kelas XI pada semester genap** — yaitu sebelum
 * naik ke kelas XII, tahun PKL-nya (aturan sekolah, ditegaskan user 29 September 2026).
 *
 * Dua hal dibuat dapat diatur, bukan tertulis mati:
 * - `pkl.tingkatPendaftar` (bawaan "11") — tingkat kelas yang boleh mendaftar.
 * - `pkl.pendaftaranDibuka` — "auto" (bawaan; ikut semester genap), "buka" (paksa buka, mis. ada
 *   gelombang tambahan di semester ganjil), atau "tutup" (paksa tutup).
 *
 * Kelas XII TIDAK mendaftar lagi: mereka sudah menjadi peserta, penempatannya dicatat admin di
 * `Internship`. Halaman siswa memakai `alasan` supaya pendaftaran yang sedang tertutup terbaca
 * sebagai keterangan, bukan sebagai halaman kosong tanpa penjelasan.
 */
export async function izinDaftarPkl(grade?: number | null, now = new Date()): Promise<IzinDaftarPkl> {
  const s = await getSettings([KUNCI_TINGKAT_PENDAFTAR, KUNCI_PENDAFTARAN_DIBUKA]);
  const tingkat = (s[KUNCI_TINGKAT_PENDAFTAR] || "")
    .split(",")
    .map(x => Number(x.trim()))
    .filter(n => Number.isInteger(n) && n >= 10 && n <= 12);
  const daftarTingkat = tingkat.length > 0 ? tingkat : [11];
  const semester = semesterBerjalan(now);
  const sakelar = (s[KUNCI_PENDAFTARAN_DIBUKA] || "auto").trim().toLowerCase();

  const dasar = { tingkat: daftarTingkat, semester } as const;
  if (sakelar === "tutup") {
    return { ...dasar, boleh: false, alasan: "Pendaftaran PKL sedang ditutup sekolah." };
  }
  if (typeof grade !== "number") {
    return { ...dasar, boleh: false, alasan: "Kelasmu belum terdata, hubungi wali kelas." };
  }
  if (!daftarTingkat.includes(grade)) {
    const nama = daftarTingkat.map(g => ({ 10: "X", 11: "XI", 12: "XII" }[g] ?? String(g))).join(" & ");
    return { ...dasar, boleh: false, alasan: `Pendaftaran PKL untuk siswa kelas ${nama}.` };
  }
  if (sakelar !== "buka" && semester !== "genap") {
    return {
      ...dasar,
      boleh: false,
      alasan: "Pendaftaran PKL dibuka pada semester genap, sebelum naik ke kelas XII.",
    };
  }
  return { ...dasar, boleh: true };
}
