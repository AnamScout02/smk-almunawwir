import "server-only";
import { assertJabatan, getJabatanNames } from "@/lib/jabatan-guard";

/** LOMBA & EVENT (1 Oktober 2026) — dua wujud dalam satu modul:
 *  event milik sekolah (pendaftaran terbuka untuk umum) dan lomba pihak luar yang diteruskan sekolah.
 *
 *  Yang boleh MENGELOLA: Admin & staf TU otomatis lolos (tidak masuk cabang `if`), guru wajib salah
 *  satu jabatan di bawah — pola standar CLAUDE.md #13. Humas & Publikasi karena merekalah yang
 *  mengumumkan ke luar; Kesiswaan & Pembina OSIS karena merekalah yang mengirim peserta. */
export const JABATAN_EVENT = [
  "Wakil Kepala Humas",
  "Koordinator Tim Branding & Publikasi",
  "Tim Branding & Publikasi",
  "Wakil Kepala Kesiswaan",
  "Pembina OSIS",
  "Kepala Sekolah",
];

export async function assertEvent(session: { role: string; email: string }) {
  if (session.role === "TEACHER") await assertJabatan(session, JABATAN_EVENT);
}

/** Versi tanpa lemparan — untuk menentukan menu/tombol tampil atau tidak. */
export async function bolehEvent(session: { role: string; email: string }): Promise<boolean> {
  if (session.role === "ADMIN" || session.role === "TAS") return true;
  if (session.role !== "TEACHER") return false;
  const j: string[] = await getJabatanNames(session.email).catch(() => []);
  return JABATAN_EVENT.some(x => j.includes(x));
}

/** Slug URL dari judul event: huruf kecil, tanpa tanda baca, dipisah tanda hubung. */
export function slugEvent(judul: string): string {
  return judul.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 80) || "event";
}

export const JENIS_EVENT = ["LOMBA", "SEMINAR", "PELATIHAN", "FESTIVAL", "LAINNYA"];
export const TINGKAT_EVENT = ["SEKOLAH", "KECAMATAN", "KABUPATEN", "PROVINSI", "NASIONAL", "INTERNASIONAL"];
export const STATUS_DAFTAR = ["DIAJUKAN", "DIVERIFIKASI", "DITOLAK", "JUARA", "TIDAK_LOLOS"];
