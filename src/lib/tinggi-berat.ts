import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { hitungGizi } from "./uks-akses";

/**
 * Tinggi & berat badan siswa tercatat di DUA tempat: kolom `height`/`weight` di
 * `Student.bukuIndukData` (Buku Induk / Biodata) dan baris `PemeriksaanKesehatan` milik UKS.
 * Keputusan user 29 September 2026: keduanya harus SATU angka — mengubah salah satu mengubah
 * yang lain, supaya petugas UKS dan TU tidak memegang data yang berbeda untuk siswa yang sama.
 *
 * Arahnya dua-duanya, tetapi tidak simetris:
 * - UKS menyimpan pemeriksaan → angka terbaru DISALIN ke Buku Induk (`keBukuInduk`).
 * - Buku Induk/Biodata diubah → pemeriksaan TERAKHIR siswa itu ikut diperbarui, atau dibuatkan
 *   satu baris bertanggal hari ini bila ia memang belum pernah diperiksa (`keUks`). Riwayat
 *   pemeriksaan lama tidak pernah disentuh — hanya yang terakhir, karena itulah yang dibaca
 *   layar UKS sebagai keadaan siswa sekarang.
 */

function angka(v: unknown): number | null {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Salin tinggi/berat hasil pemeriksaan UKS ke `bukuIndukData` beberapa siswa sekaligus. */
export async function keBukuInduk(baris: { studentId: string; tinggiCm: number | null; beratKg: number | null }[]) {
  const perlu = baris.filter(b => b.tinggiCm != null || b.beratKg != null);
  if (perlu.length === 0) return 0;
  const siswa = await prisma.student.findMany({
    where: { id: { in: perlu.map(b => b.studentId) } },
    select: { id: true, bukuIndukData: true },
  });
  const peta = new Map(siswa.map(s => [s.id, s.bukuIndukData]));
  let n = 0;
  for (const b of perlu) {
    const lama = (peta.get(b.studentId) ?? {}) as Record<string, unknown>;
    const baru: Record<string, unknown> = { ...lama };
    if (b.tinggiCm != null) baru.height = String(b.tinggiCm);
    if (b.beratKg != null) baru.weight = String(b.beratKg);
    if (baru.height === lama.height && baru.weight === lama.weight) continue;
    await prisma.student.update({ where: { id: b.studentId }, data: { bukuIndukData: baru as Prisma.InputJsonValue } });
    n++;
  }
  return n;
}

/**
 * Terapkan tinggi/berat dari Buku Induk ke pemeriksaan UKS siswa itu. `olehNama` dipakai hanya
 * bila baris pemeriksaan baru harus dibuat. Mengembalikan true bila ada yang berubah.
 */
export async function keUks(studentId: string, data: Record<string, unknown>, olehNama: string) {
  const tinggi = angka(data.height);
  const berat = angka(data.weight);
  if (tinggi == null && berat == null) return false;

  const terakhir = await prisma.pemeriksaanKesehatan.findFirst({
    where: { studentId }, orderBy: { tanggal: "desc" },
  });
  const tinggiBaru = tinggi ?? terakhir?.tinggiCm ?? null;
  const beratBaru = berat ?? terakhir?.beratKg ?? null;
  if (terakhir && terakhir.tinggiCm === tinggiBaru && terakhir.beratKg === beratBaru) return false;

  const g = hitungGizi(tinggiBaru, beratBaru);
  if (terakhir) {
    await prisma.pemeriksaanKesehatan.update({
      where: { id: terakhir.id },
      data: { tinggiCm: tinggiBaru, beratKg: beratBaru, imt: g.imt, statusGizi: g.status },
    });
  } else {
    await prisma.pemeriksaanKesehatan.create({
      data: {
        studentId, tanggal: new Date(), tinggiCm: tinggiBaru, beratKg: beratBaru,
        imt: g.imt, statusGizi: g.status, olehNama,
      },
    });
  }
  return true;
}
