import "server-only";
import { prisma } from "@/lib/prisma";
import { getJabatanNames } from "@/lib/jabatan-guard";
import type { KegiatanRingkas } from "@/lib/kegiatan-ujian";

/** Jabatan pengatur ujian SE-SEKOLAH (selain ADMIN): mengatur Kegiatan & Pengaturan Ujian, dan
 * melihat serta menindak SEMUA ujian (Ruang Kendali, Ringkasan, Papan Pantau). Keputusan user
 * 13 September 2026: "Wakil Kepala Kurikulum saja yang bisa" — Operator Sekolah & guru lain tetap
 * hanya ujian miliknya. */
export const JABATAN_PENGATUR_UJIAN = ["Wakil Kepala Kurikulum"];

export async function bolehAturUjian(session: { role: string; email: string }): Promise<boolean> {
  if (session.role === "ADMIN") return true;
  if (session.role !== "TEACHER" && session.role !== "TAS") return false;
  const nama = await getJabatanNames(session.email);
  return JABATAN_PENGATUR_UJIAN.some(j => nama.includes(j));
}

type BarisKegiatan = {
  id: string; jenis: string; nama: string; singkatan: string; semester: string | null;
  tingkat: number[]; tanggalMulai: Date | null; tanggalSelesai: Date | null; aktif: boolean;
  academicYearId: string | null; academicYear: { name: string } | null;
  token: string | null; tokenDiperbarui: Date; tokenOtomatisMenit: number; mekanisme: string;
};

export const SELECT_KEGIATAN = {
  id: true, jenis: true, nama: true, singkatan: true, semester: true, tingkat: true,
  tanggalMulai: true, tanggalSelesai: true, aktif: true, academicYearId: true, academicYear: { select: { name: true } },
  // Token bersama satu kegiatan (20 September 2026) — lihat KegiatanUjian.token.
  token: true, tokenDiperbarui: true, tokenOtomatisMenit: true,
  mekanisme: true,
} as const;

export function ringkasKegiatan(k: BarisKegiatan): KegiatanRingkas {
  return {
    id: k.id, jenis: k.jenis, nama: k.nama, singkatan: k.singkatan, semester: k.semester,
    academicYearId: k.academicYearId, tahunAjaran: k.academicYear?.name ?? null, tingkat: k.tingkat,
    tanggalMulai: k.tanggalMulai ? k.tanggalMulai.toISOString().slice(0, 10) : null,
    tanggalSelesai: k.tanggalSelesai ? k.tanggalSelesai.toISOString().slice(0, 10) : null,
    aktif: k.aktif,
    token: k.token ?? null,
    tokenOtomatisMenit: k.tokenOtomatisMenit,
    mekanisme: k.mekanisme === "KELAS" ? "KELAS" : "RUANG",
    tokenBerganti: k.token && k.tokenOtomatisMenit > 0
      ? new Date(k.tokenDiperbarui.getTime() + k.tokenOtomatisMenit * 60_000).toISOString() : null,
  };
}

/** Kegiatan aktif yang berlaku untuk satu tingkat kelas (kosong `tingkat` = semua tingkat).
 * Kalau ada beberapa, yang tanggalnya paling dekat dengan hari ini didahulukan. */
export async function kegiatanUntukTingkat(grade: number | null | undefined): Promise<KegiatanRingkas | null> {
  const semua = await prisma.kegiatanUjian.findMany({ where: { aktif: true }, select: SELECT_KEGIATAN }).catch(() => []);
  const cocok = semua.filter(k => !k.tingkat.length || (grade != null && k.tingkat.includes(grade)));
  if (!cocok.length) return null;
  const now = Date.now();
  const jarak = (k: BarisKegiatan) => {
    if (!k.tanggalMulai) return Number.MAX_SAFE_INTEGER;
    const a = k.tanggalMulai.getTime(), b = (k.tanggalSelesai ?? k.tanggalMulai).getTime() + 86_400_000;
    return now >= a && now <= b ? 0 : Math.min(Math.abs(now - a), Math.abs(now - b));
  };
  cocok.sort((x, y) => jarak(x) - jarak(y));
  return ringkasKegiatan(cocok[0]);
}
