import "server-only";
import { prisma } from "@/lib/prisma";
import { getJabatanNames } from "@/lib/jabatan-guard";
import type { SessionPayload } from "@/types";

/** PAPAN TUGAS ANTAR JABATAN (18 September 2026) — penugasan internal dari pimpinan/TU kepada satu
 * pegawai ATAU kepada pemegang jabatan tertentu (mis. "Wakil Kepala Sarana Prasarana"). Tugas muncul
 * di kotak notifikasi & antrean "Perlu tindakan" penerimanya; penerima menandai Dikerjakan/Selesai
 * beserta catatan hasil. Bukan pengganti disposisi surat — ini untuk tugas yang lahir dari rapat,
 * instruksi kepala sekolah, atau permintaan antar-bagian. */

export const PRIORITAS = ["RENDAH", "NORMAL", "TINGGI"] as const;
export const STATUS_TUGAS = ["BARU", "DIKERJAKAN", "SELESAI", "DIBATALKAN"] as const;

/** Yang boleh MEMBERI tugas: Admin, staf TU, dan jabatan pimpinan (Kepala Sekolah, para Wakil Kepala,
 * Kepala TAS, Kepala Kompetensi Keahlian). Guru/pegawai lain hanya melihat tugas untuk dirinya. */
const JABATAN_PEMBERI = [
  "Kepala Sekolah", "Kepala Tenaga Administrasi Sekolah", "Wakil Kepala Kurikulum", "Wakil Kepala Kesiswaan",
  "Wakil Kepala Sarana Prasarana", "Wakil Kepala Humas", "Wakil Kepala Bidang Penjamin Mutu", "Operator Sekolah",
];

export async function hakTugas(session: SessionPayload) {
  const jabatan = session.role === "ADMIN" ? [] : await getJabatanNames(session.email);
  const pimpinan = session.role === "ADMIN" || session.role === "TAS"
    || jabatan.some(n => JABATAN_PEMBERI.includes(n) || n.startsWith("Kepala Kompetensi Keahlian"));
  return { jabatan, bolehMemberi: pimpinan, bolehLihatSemua: pimpinan };
}

/** Filter Prisma: tugas yang ditujukan ke akun ini (perorangan atau lewat jabatannya). */
export function untukSaya(userId: string, jabatan: string[]) {
  return { OR: [{ penerimaId: userId }, ...(jabatan.length ? [{ targetJabatan: { hasSome: jabatan } }] : [])] };
}

/** Penerima tugas untuk notifikasi: satu akun, atau semua pemegang jabatan sasaran. */
export async function penerimaTugas(t: { penerimaId: string | null; targetJabatan: string[] }): Promise<string[]> {
  if (t.penerimaId) return [t.penerimaId];
  if (!t.targetJabatan.length) return [];
  const [guru, staf] = await Promise.all([
    prisma.teacherJabatan.findMany({
      where: { jabatan: { name: { in: t.targetJabatan } } },
      select: { teacher: { select: { userId: true } } },
    }).catch(() => []),
    prisma.staffJabatan.findMany({
      where: { jabatan: { name: { in: t.targetJabatan } } }, select: { userId: true },
    }).catch(() => []),
  ]);
  return [...new Set([...guru.map(g => g.teacher.userId), ...staf.map(s => s.userId)])];
}
