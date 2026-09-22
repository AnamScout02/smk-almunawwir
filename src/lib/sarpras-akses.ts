import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getJabatanNames } from "@/lib/jabatan-guard";
import { TAS_JABATAN } from "@/lib/tas-access-guard";
import { LAB_ASSET_FILTER, isLabAsset } from "@/lib/inventaris-scope";

/** LAYANAN SARPRAS & LAB (17 Sep 2026).
 * - Semua guru & staf: lapor kerusakan, pinjam barang/ruang, lihat aset lewat QR.
 * - Pengelola penuh: Admin, staf TU, Wakil Kepala Sarana Prasarana.
 * - Kepala Laboratorium: mengelola yang berlingkup LAB (aset/ruang/lokasi mengandung "lab"). */
export const JABATAN_SARPRAS = "Wakil Kepala Sarana Prasarana";
export const JABATAN_LAB = "Kepala Laboratorium";

export interface AksesSarpras { masuk: boolean; penuh: boolean; lab: boolean; kelola: boolean }

export async function aksesSarpras(s: { role: string; email: string }): Promise<AksesSarpras> {
  if (s.role === "ADMIN") return { masuk: true, penuh: true, lab: true, kelola: true };
  if (s.role !== "TEACHER" && s.role !== "TAS") return { masuk: false, penuh: false, lab: false, kelola: false };
  const j = await getJabatanNames(s.email);
  const penuh = j.includes(JABATAN_SARPRAS) || j.some(n => TAS_JABATAN.includes(n));
  const lab = penuh || j.includes(JABATAN_LAB);
  return { masuk: true, penuh, lab, kelola: penuh || lab };
}

export const teksLab = (...t: (string | null | undefined)[]) => t.filter(Boolean).join(" ").toLowerCase().includes("lab");

/** Lingkup sebuah permintaan: LAB bila barang/ruang/lokasinya milik lab. */
export function lingkupDari(o: { asset?: { category: string; location: string | null } | null; ruang?: string | null; lokasi?: string | null }) {
  return (o.asset && isLabAsset(o.asset)) || teksLab(o.ruang, o.lokasi) ? "LAB" : "SARPRAS";
}

/** Filter laporan kerusakan yang boleh dikelola Kepala Lab (bukan pengelola penuh). */
export const FILTER_KERUSAKAN_LAB: Prisma.AssetDamageReportWhereInput = {
  OR: [{ asset: LAB_ASSET_FILTER }, { lokasi: { contains: "lab", mode: "insensitive" } }],
};

/** userId penerima notifikasi pengelola (penuh + Kepala Lab bila lingkup LAB). */
export async function penerimaPengelola(lingkup: string): Promise<string[]> {
  const nama = lingkup === "LAB" ? [JABATAN_SARPRAS, JABATAN_LAB] : [JABATAN_SARPRAS];
  const [guru, staf] = await Promise.all([
    prisma.teacher.findMany({ where: { jabatan: { some: { jabatan: { name: { in: nama } } } } }, select: { userId: true } }),
    prisma.user.findMany({ where: { role: "TAS", staffJabatan: { some: { jabatan: { name: { in: nama } } } } }, select: { id: true } }),
  ]);
  return [...guru.map(g => g.userId), ...staf.map(s => s.id)];
}

/** Daftar ruang: ruang di Jadwal Pelajaran + Ruang Ujian + tambahan manual (SiteSetting sarpras.ruangTambahan). */
export async function daftarRuang(): Promise<string[]> {
  const [jadwal, ujian, set] = await Promise.all([
    prisma.schedule.findMany({ where: { room: { not: null } }, select: { room: true }, distinct: ["room"] }),
    prisma.ruangUjian.findMany({ where: { aktif: true }, select: { nama: true } }),
    prisma.siteSetting.findUnique({ where: { key: "sarpras.ruangTambahan" } }),
  ]);
  let tambahan: string[] = [];
  try { tambahan = JSON.parse(set?.value ?? "[]"); } catch { tambahan = []; }
  const semua = [...jadwal.map(j => (j.room ?? "").trim()), ...ujian.map(u => u.nama.trim()), ...tambahan.map(t => String(t).trim())].filter(Boolean);
  return [...new Set(semua)].sort((a, b) => a.localeCompare(b, "id", { numeric: true }));
}

const HARI = ["MINGGU", "SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];
const jamWib = (d: Date) => new Date(d.getTime() + 7 * 3600_000).toISOString().slice(11, 16);

/** Bentrok pemakaian ruang: peminjaman lain yang masih berlaku + jadwal pelajaran di ruang itu (hari & jam WIB). */
export async function cekBentrokRuang(ruang: string, mulai: Date, selesai: Date, kecualiId?: string) {
  const [pinjam, jadwal] = await Promise.all([
    prisma.peminjamanSarpras.findMany({
      where: { jenis: "RUANG", ruang, status: { in: ["MENUNGGU", "DISETUJUI", "DIPINJAM"] }, mulai: { lt: selesai }, selesai: { gt: mulai }, ...(kecualiId ? { id: { not: kecualiId } } : {}) },
      select: { peminjamNama: true, keperluan: true, mulai: true, selesai: true, status: true },
    }),
    (async () => {
      // Hanya dicek untuk pemakaian dalam satu hari.
      const a = new Date(mulai.getTime() + 7 * 3600_000), b = new Date(selesai.getTime() + 7 * 3600_000);
      if (a.toISOString().slice(0, 10) !== b.toISOString().slice(0, 10)) return [];
      return prisma.schedule.findMany({
        where: { room: ruang, day: HARI[a.getUTCDay()], startTime: { lt: jamWib(selesai) }, endTime: { gt: jamWib(mulai) } },
        select: { startTime: true, endTime: true, subject: true, class: { select: { name: true } } },
        take: 5,
      });
    })(),
  ]);
  return {
    peminjaman: pinjam,
    jadwal: jadwal.map(j => `${j.class.name} ${j.subject} ${j.startTime}–${j.endTime}`),
  };
}

/** Sisa unit barang yang bisa dipinjam pada rentang waktu itu. */
export async function sisaBarang(assetId: string, jumlahTotal: number, mulai: Date, selesai: Date, kecualiId?: string) {
  const agg = await prisma.peminjamanSarpras.aggregate({
    where: { jenis: "BARANG", assetId, status: { in: ["DISETUJUI", "DIPINJAM"] }, mulai: { lt: selesai }, selesai: { gt: mulai }, ...(kecualiId ? { id: { not: kecualiId } } : {}) },
    _sum: { jumlah: true },
  });
  return jumlahTotal - (agg._sum.jumlah ?? 0);
}

export { LAB_ASSET_FILTER };
