import "server-only";
import { getJabatanNames } from "@/lib/jabatan-guard";

/** SUPERVISI AKADEMIK & PKG (18 Sep 2026). Penilai: Kepala Sekolah, Wakil Kepala Kurikulum, Penjamin Mutu, Admin.
 * Guru melihat hasil supervisinya sendiri (transparan, dasar pembinaan). */
export const JABATAN_SUPERVISI = ["Kepala Sekolah", "Wakil Kepala Kurikulum", "Wakil Kepala Bidang Penjamin Mutu"];

export const ASPEK_SUPERVISI = [
  { kunci: "perangkat", label: "Kelengkapan perangkat ajar (prota, promes, modul/RPP)" },
  { kunci: "pendahuluan", label: "Kegiatan pendahuluan (apersepsi & tujuan)" },
  { kunci: "materi", label: "Penguasaan materi & kesesuaian capaian pembelajaran" },
  { kunci: "metode", label: "Metode & media pembelajaran" },
  { kunci: "keterlibatan", label: "Keterlibatan dan interaksi siswa" },
  { kunci: "penilaian", label: "Penilaian proses & hasil belajar" },
  { kunci: "penutup", label: "Kegiatan penutup & refleksi" },
  { kunci: "waktu", label: "Pengelolaan waktu & kelas" },
] as const;

export const ASPEK_PKG = [
  { kunci: "pedagogik", label: "Kompetensi pedagogik" },
  { kunci: "kepribadian", label: "Kompetensi kepribadian" },
  { kunci: "sosial", label: "Kompetensi sosial" },
  { kunci: "profesional", label: "Kompetensi profesional" },
  { kunci: "kehadiran", label: "Kedisiplinan & kehadiran" },
  { kunci: "administrasi", label: "Tertib administrasi" },
] as const;

export const aspekUntuk = (jenis: string) => (jenis === "PKG" ? ASPEK_PKG : ASPEK_SUPERVISI);

/** Skala 1–4 → nilai 0–100 & predikat (Amat Baik/Baik/Cukup/Kurang). */
export function nilaiSupervisi(skor: Record<string, number>, jenis: string) {
  const aspek = aspekUntuk(jenis);
  const angka = aspek.map(a => Number(skor[a.kunci])).filter(n => n >= 1 && n <= 4);
  if (!angka.length) return { nilai: null as number | null, predikat: null as string | null };
  const nilai = Math.round((angka.reduce((x, y) => x + y, 0) / angka.length / 4) * 1000) / 10;
  const predikat = nilai >= 90 ? "Amat Baik" : nilai >= 76 ? "Baik" : nilai >= 61 ? "Cukup" : "Kurang";
  return { nilai, predikat };
}

export async function bolehSupervisi(s: { role: string; email: string }) {
  if (s.role === "ADMIN") return true;
  if (s.role !== "TEACHER" && s.role !== "TAS") return false;
  return (await getJabatanNames(s.email)).some(j => JABATAN_SUPERVISI.includes(j));
}
