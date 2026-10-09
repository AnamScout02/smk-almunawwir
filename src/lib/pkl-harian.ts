import "server-only";
import { prisma } from "@/lib/prisma";

/** Tengah malam UTC untuk tanggal WIB hari ini — kunci `PresensiPkl.tanggal` (sama dengan portal industri). */
export function hariPkl(d = new Date()) {
  return new Date(new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 10) + "T00:00:00Z");
}

/** Jarak garis lurus dua titik (meter, haversine). */
export function jarakMeter(lat1: number, lng1: number, lat2: number, lng2: number) {
  const r = (d: number) => (d * Math.PI) / 180, R = 6371000;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}

/** "Di lokasi" = paling jauh 300 m dari titik DUDI — angka yang sama dengan monitoring guru (CLAUDE.md #141). */
export const RADIUS_DI_LOKASI = 300;

export const ASPEK_UMPAN = [
  { kunci: "bimbingan", label: "Bimbingan dari pembimbing industri" },
  { kunci: "pekerjaan", label: "Pekerjaan sesuai jurusan" },
  { kunci: "lingkungan", label: "Lingkungan & keselamatan kerja" },
] as const;

/** Umpan balik siswa dibuka 14 hari sebelum PKL selesai sampai 30 hari sesudahnya (atau selama berstatus Selesai). */
export function umpanTerbuka(p: { status: string; endDate: Date }, kini = new Date()) {
  if (p.status === "CANCELLED") return false;
  const sisa = (p.endDate.getTime() - kini.getTime()) / 86_400_000;
  return sisa <= 14 && sisa >= -30;
}

/** PANTAUAN PKL SATU SISWA — dipakai halaman orang tua. Sengaja TANPA: laporan masalah (bisa memuat hal yang belum
 *  dibicarakan anak dengan orang tuanya — itu ranah guru pembimbing), kontak pembimbing industri, dan titik lokasi. */
export async function pantauPklSiswa(studentId: string) {
  const tigaPuluh = new Date(hariPkl().getTime() - 29 * 86_400_000);
  const p = await prisma.internship.findUnique({
    where: { studentId },
    select: {
      company: true, position: true, startDate: true, endDate: true, status: true, mitraId: true, nilaiIndustriRata: true, laporanAkhirStatus: true,
      teacher: { select: { user: { select: { name: true } } } },
      mitra: { select: { address: true, kecamatan: true, jamKerja: true } },
      presensi: { where: { tanggal: { gte: tigaPuluh } }, orderBy: { tanggal: "desc" }, select: { tanggal: true, status: true, jamMasuk: true, jamPulang: true, jarakMeter: true } },
      journal: { orderBy: { date: "desc" }, take: 10, select: { id: true, date: true, activity: true, parafIndustriAt: true, teacherNote: true } },
      monitoring: { orderBy: { tanggal: "desc" }, take: 1, select: { tanggal: true, cara: true } },
      _count: { select: { journal: true, monitoring: true } },
    },
  });
  return p;
}
