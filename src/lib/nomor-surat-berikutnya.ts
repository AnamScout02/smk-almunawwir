import "server-only";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";
import { formatNomorSurat, parseNomorUrut } from "@/lib/nomor-surat";

/** Terbitkan nomor surat keluar berikutnya.
 *
 * SATU buku agenda surat keluar untuk SELURUH sekolah — nomornya berjalan lurus lintas modul:
 * Persuratan, Surat Keterangan, dan Surat Tugas semuanya mengambil dari urutan yang SAMA.
 *
 * Sebelum diperbaiki (13 September 2026, temuan user "urutan surat kok semuanya kembali ke 001"),
 * tiap modul menghitung urutan dari tabelnya sendiri: Persuratan sudah di 405 sementara Surat
 * Keterangan & Surat Tugas mulai lagi dari 001 — nomor resmi sekolah jadi kembar. Dua modul baru
 * itu juga salah mengambil kode sekolah dari `nominatif.kdSekolah` (= "167", kode Kd_Sekolah untuk
 * dokumen Dinas) alih-alih `school.kode` (= "026", kode yang dipakai di nomor surat).
 *
 * Urutan dibatasi per TAHUN AJARAN aktif — mengikuti perilaku Persuratan yang sudah berjalan:
 * nomor kembali dari 1 tiap pergantian tahun ajaran, bukan tiap tahun kalender.
 */
export async function nomorSuratBerikutnya(klasifikasi: string, tanggal: Date = new Date()): Promise<string> {
  const activeYear = await prisma.academicYear.findFirst({
    where: { isActive: true }, select: { startDate: true },
  });
  const sejak = activeYear?.startDate;

  const [suratKeluar, suratKeterangan, suratTugas, settings] = await Promise.all([
    prisma.surat.findMany({
      where: { tipe: "KELUAR", ...(sejak ? { tanggal: { gte: sejak } } : {}) },
      select: { nomor: true },
    }),
    prisma.suratKeterangan.findMany({
      where: sejak ? { tanggal: { gte: sejak } } : {},
      select: { nomorSurat: true },
    }),
    prisma.suratTugas.findMany({
      where: sejak ? { tanggal: { gte: sejak } } : {},
      select: { nomor: true },
    }),
    getSettings(["school.kode"]),
  ]);

  // Melanjutkan dari urutan TERTINGGI yang sudah ada, bukan dari jumlah baris — supaya nomor
  // tidak pernah bentrok walau ada surat yang dihapus atau diimpor dari catatan manual.
  const maxUrut = Math.max(
    0,
    ...suratKeluar.map(s => parseNomorUrut(s.nomor)),
    ...suratKeterangan.map(s => parseNomorUrut(s.nomorSurat ?? "")),
    ...suratTugas.map(s => parseNomorUrut(s.nomor)),
  );

  return formatNomorSurat(maxUrut + 1, klasifikasi, settings["school.kode"] || "026", tanggal);
}
