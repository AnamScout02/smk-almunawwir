import { Prisma } from "@prisma/client";
import { siapkanButir, type ButirMasuk } from "@/lib/soal-butir-server";
import { rapikanJadwalKelas } from "@/lib/jadwal-ujian-kelas";

/** Pengaturan ujian yang boleh diubah lewat POST/PUT. */
export interface PengaturanMasuk {
  title?: string; description?: string | null; duration?: number; startTime?: string; endTime?: string;
  acakSoal?: boolean; acakOpsi?: boolean; satuSoalPerHalaman?: boolean; tampilkanNilai?: boolean;
  izinKalkulator?: boolean; izinCoretan?: boolean;
  examkey?: string | null; batasPindahTab?: number; jumlahDikerjakan?: number | null; wajibSeb?: boolean; wajibAplikasi?: boolean;
  kegiatanId?: string | null;
  tokenOtomatisMenit?: number; batasPutarAudio?: number;
  paketDenah?: number;
}

export function ambilPengaturan(b: PengaturanMasuk) {
  const d: Record<string, unknown> = {};
  if (b.title !== undefined) d.title = String(b.title).trim();
  if (b.description !== undefined) d.description = b.description?.trim() || null;
  if (b.duration !== undefined) d.duration = Math.max(1, Number(b.duration) || 60);
  if (b.startTime !== undefined) d.startTime = new Date(b.startTime);
  if (b.endTime !== undefined) d.endTime = new Date(b.endTime);
  if (typeof b.wajibSeb === "boolean") d.wajibSeb = b.wajibSeb;
  if (typeof b.wajibAplikasi === "boolean") d.wajibAplikasi = b.wajibAplikasi;
  for (const k of ["acakSoal", "acakOpsi", "satuSoalPerHalaman", "tampilkanNilai", "izinKalkulator", "izinCoretan"] as const) {
    if (typeof b[k] === "boolean") d[k] = b[k];
  }
  if (b.examkey !== undefined) d.examkey = b.examkey?.trim() || null;
  if (b.batasPindahTab !== undefined) d.batasPindahTab = Math.max(0, Number(b.batasPindahTab) || 0);
  if (b.tokenOtomatisMenit !== undefined) d.tokenOtomatisMenit = Math.min(240, Math.max(0, Math.round(Number(b.tokenOtomatisMenit) || 0)));
  if (b.batasPutarAudio !== undefined) d.batasPutarAudio = Math.min(10, Math.max(0, Math.round(Number(b.batasPutarAudio) || 0)));
  // Paket menurut denah: 0 = acak per siswa, 2/3/4 = jumlah paket (src/lib/ujian-acak.ts `paketDariKursi`).
  if (b.paketDenah !== undefined) d.paketDenah = [2, 3, 4].includes(Number(b.paketDenah)) ? Number(b.paketDenah) : 0;
  if (b.kegiatanId !== undefined) d.kegiatanId = b.kegiatanId ? String(b.kegiatanId) : null;
  if (b.jumlahDikerjakan !== undefined) d.jumlahDikerjakan = b.jumlahDikerjakan ? Math.max(1, Number(b.jumlahDikerjakan)) : null;
  return d;
}

/** Jam per kelas (`jadwalKelas`) bila dikirim: dirapikan ke kelas peserta, lalu startTime/endTime diganti
 * amplopnya. Isian kosong menghapus jam per kelas. Mengembalikan pesan galat atau null. */
export function terapkanJadwalKelas(
  p: Record<string, unknown>, b: { jadwalKelas?: unknown }, kelasIds: string[], umum: { startTime: Date; endTime: Date },
): string | null {
  if (b.jadwalKelas === undefined) return null;
  const r = rapikanJadwalKelas(b.jadwalKelas, kelasIds, umum);
  if (r.galat) return r.galat;
  p.jadwalKelas = Object.keys(r.jadwal).length ? r.jadwal : Prisma.DbNull;
  p.startTime = r.startTime;
  p.endTime = r.endTime;
  return null;
}

export type SoalMasuk = ButirMasuk & { posisiKunci?: number | null };

export function siapkanSoalUjian(qs: SoalMasuk[]): { data: (ReturnType<typeof siapkanButir>["data"] & { posisiKunci: number | null })[]; error: string | null } {
  const data = [];
  for (let i = 0; i < qs.length; i++) {
    const { data: d, error } = siapkanButir(qs[i]);
    if (error) return { data: [], error: `Soal ${i + 1}: ${error}` };
    data.push({ ...d, posisiKunci: qs[i].posisiKunci ? Math.max(1, Number(qs[i].posisiKunci)) : null });
  }
  return { data, error: null };
}

