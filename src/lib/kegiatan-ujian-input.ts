import { JENIS_KEGIATAN } from "@/lib/kegiatan-ujian";

/** Validasi & rapikan isian formulir Kegiatan Ujian (dipakai POST dan PUT). */
export function bacaIsianKegiatan(b: Record<string, unknown>, sebagian = false):
  { data: Record<string, unknown>; error: string | null } {
  const d: Record<string, unknown> = {};
  const teks = (v: unknown) => String(v ?? "").trim();

  if (!sebagian || b.jenis !== undefined) {
    const jenis = teks(b.jenis).toUpperCase();
    if (!JENIS_KEGIATAN.some(j => j.value === jenis)) return { data: {}, error: "Jenis kegiatan tidak dikenal." };
    d.jenis = jenis;
  }
  if (!sebagian || b.nama !== undefined) {
    const nama = teks(b.nama).slice(0, 120);
    if (!nama) return { data: {}, error: "Nama kegiatan wajib diisi." };
    d.nama = nama;
  }
  if (!sebagian || b.singkatan !== undefined) {
    const singkatan = teks(b.singkatan).toUpperCase().slice(0, 12);
    if (!singkatan) return { data: {}, error: "Singkatan wajib diisi (mis. STS)." };
    d.singkatan = singkatan;
  }
  // Cara pelaksanaan (21 September 2026): RUANG (denah campur) atau KELAS (di kelas masing-masing, pengawas guru mapel).
  if (b.mekanisme !== undefined) d.mekanisme = b.mekanisme === "KELAS" ? "KELAS" : "RUANG";
  if (b.tokenOtomatisMenit !== undefined) {
    // Sama batasnya dengan Exam.tokenOtomatisMenit (0 = tidak berganti, maksimum 240 menit).
    d.tokenOtomatisMenit = Math.min(240, Math.max(0, Math.round(Number(b.tokenOtomatisMenit) || 0)));
  }
  if (b.semester !== undefined) {
    const s = teks(b.semester).toUpperCase();
    d.semester = s === "GANJIL" || s === "GENAP" ? s : null;
  }
  if (b.academicYearId !== undefined) d.academicYearId = teks(b.academicYearId) || null;
  if (b.tingkat !== undefined) {
    d.tingkat = Array.isArray(b.tingkat)
      ? [...new Set(b.tingkat.map(Number).filter(n => n === 10 || n === 11 || n === 12))].sort()
      : [];
  }
  for (const k of ["tanggalMulai", "tanggalSelesai"] as const) {
    if (b[k] === undefined) continue;
    const v = teks(b[k]);
    if (!v) { d[k] = null; continue; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return { data: {}, error: "Format tanggal tidak sah." };
    d[k] = new Date(`${v}T00:00:00.000Z`);
  }
  if (d.tanggalMulai && d.tanggalSelesai && (d.tanggalMulai as Date) > (d.tanggalSelesai as Date)) {
    return { data: {}, error: "Tanggal selesai tidak boleh sebelum tanggal mulai." };
  }
  if (typeof b.aktif === "boolean") d.aktif = b.aktif;
  return { data: d, error: null };
}
