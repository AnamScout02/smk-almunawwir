/** Label & daftar bersama modul Lomba & Event — NETRAL (bukan `server-only`) supaya formulir
 *  pengelola, halaman publik, dan sidebar memakai daftar yang sama dengan penjaga server. */

/** Jabatan guru yang boleh MENGELOLA event (Admin & staf TU otomatis). Disebut juga di
 *  TeacherSidebar — dengan mengimpor dari sini, keduanya tidak bisa berbeda. */
export const JABATAN_EVENT = [
  "Wakil Kepala Humas",
  "Koordinator Tim Branding & Publikasi",
  "Tim Branding & Publikasi",
  "Wakil Kepala Kesiswaan",
  "Pembina OSIS",
  "Kepala Sekolah",
];

export const JENIS_EVENT = ["LOMBA", "SEMINAR", "PELATIHAN", "FESTIVAL", "LAINNYA"];
export const TINGKAT_EVENT = ["SEKOLAH", "KECAMATAN", "KABUPATEN", "PROVINSI", "NASIONAL", "INTERNASIONAL"];
export const STATUS_DAFTAR = ["DIAJUKAN", "DIVERIFIKASI", "DITOLAK", "JUARA", "TIDAK_LOLOS"];

export const LABEL_JENIS: Record<"id" | "en", Record<string, string>> = {
  id: { LOMBA: "Lomba", SEMINAR: "Seminar", PELATIHAN: "Pelatihan", FESTIVAL: "Festival", LAINNYA: "Lainnya" },
  en: { LOMBA: "Competition", SEMINAR: "Seminar", PELATIHAN: "Workshop", FESTIVAL: "Festival", LAINNYA: "Other" },
};
export const LABEL_TINGKAT: Record<"id" | "en", Record<string, string>> = {
  id: { SEKOLAH: "Sekolah", KECAMATAN: "Kecamatan", KABUPATEN: "Kabupaten/Kota", PROVINSI: "Provinsi", NASIONAL: "Nasional", INTERNASIONAL: "Internasional" },
  en: { SEKOLAH: "School", KECAMATAN: "District", KABUPATEN: "Regency/City", PROVINSI: "Province", NASIONAL: "National", INTERNASIONAL: "International" },
};

/** Status pendaftaran — pasangan warna semantik DESIGN_SYSTEM §2. */
export const STATUS_DAFTAR_INFO: Record<string, { label: string; gaya: string }> = {
  DIAJUKAN: { label: "Diajukan", gaya: "bg-blue-50 text-blue-700 border-blue-200" },
  DIVERIFIKASI: { label: "Diverifikasi", gaya: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  DITOLAK: { label: "Ditolak", gaya: "bg-red-50 text-red-700 border-red-200" },
  JUARA: { label: "Juara", gaya: "bg-amber-50 text-amber-700 border-amber-200" },
  TIDAK_LOLOS: { label: "Tidak Lolos", gaya: "bg-gray-50 text-gray-600 border-gray-200" },
};

/** Tanggal event disimpan sebagai tengah malam UTC tanggal itu (isian "YYYY-MM-DD"), jadi DITAMPILKAN
 *  dengan zona UTC — memakai zona WIB justru tetap aman, tetapi UTC membuatnya tidak bergantung jam. */
export function tglEvent(d: Date | string | null | undefined, locale = "id-ID", panjang = true): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString(locale, { day: "numeric", month: panjang ? "long" : "short", year: "numeric", timeZone: "UTC" });
}

/** Batas akhir pendaftaran = akhir hari `tutupDaftar` WAKTU WIB (23.59 WIB = 16.59 UTC). */
export function batasDaftar(tutupDaftar: Date | string | null | undefined): Date | null {
  if (!tutupDaftar) return null;
  return new Date(new Date(tutupDaftar).getTime() + 17 * 3600_000 - 1);
}

export function pendaftaranTerbuka(e: { aktif: boolean; tutupDaftar: Date | string | null }, kini = new Date()): boolean {
  if (!e.aktif) return false;
  const b = batasDaftar(e.tutupDaftar);
  return !b || kini <= b;
}

export const rupiah = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;
