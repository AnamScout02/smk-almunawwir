import "server-only";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";
import { lahirIso, tandaCocok } from "@/lib/spmb-tanda";
import { ALAMAT_APLIKASI } from "@/lib/alamat-aplikasi";
import { bacaJadwal, bacaSetelanBayar, hitungBayar, susunTahapan, type AturanTahapan, type BarisTahapan, type InfoBayar, type PetaJadwal, type SetelanBayar } from "@/lib/spmb-tahapan";

/** Kolom yang dibutuhkan penyusun centang — TANPA isian asesmen/pemeriksaan (data sensitif). */
export const PILIH_TAHAPAN = {
  createdAt: true, status: true, verifikasiStatus: true, verifikasiPesan: true, verifikasiAt: true,
  seragamAt: true, asesmenAt: true, pemeriksaanAt: true, paymentVerified: true, daftarUlangConfirmedAt: true,
  potonganBiaya: true, gelombangId: true,
} as const;

export async function aturanTahapan(): Promise<AturanTahapan> {
  const s = await getSettings(["spmb.tahapSeleksi", "spmb.tahapDaftarUlang", "spmb.hasilDibuka"]);
  const seleksi = s["spmb.tahapSeleksi"] !== "0";
  return {
    seleksi,
    daftarUlang: s["spmb.tahapDaftarUlang"] !== "0",
    // Tanpa tahap seleksi, keputusan "diterima" tidak menunggu tombol Buka Hasil.
    hasilDibuka: !seleksi || s["spmb.hasilDibuka"] === "1",
  };
}

/** Tautan halaman tahapan calon — memakai alamat permanen karena dikirim lewat WA/e-mail. */
export function tautanTahapan(nomor: string, tanda?: string) {
  return `${ALAMAT_APLIKASI}/spmb/tahapan${tanda ? `?nomor=${encodeURIComponent(nomor)}&t=${encodeURIComponent(tanda)}` : ""}`;
}

/**
 * Pendaftar dari nomor + tanda (HMAC nomor|tanggal lahir, `tandaFormulir`). Tanda = kunci calon tanpa akun:
 * diterbitkan hanya setelah nomor + tanggal lahir cocok, jadi setara kekuatannya dan tanggal lahir tidak
 * perlu dikirim ulang di setiap permintaan.
 */
export async function calonDariTanda(nomor: unknown, tanda: unknown) {
  const n = typeof nomor === "string" ? nomor.trim().toUpperCase() : "";
  const t = typeof tanda === "string" ? tanda.trim() : "";
  if (!n || !t || n.length > 40 || t.length > 64) return null;
  const a = await prisma.admission.findUnique({ where: { nomor: n }, select: { id: true, birthDate: true } }).catch(() => null);
  if (!a || !tandaCocok(n, lahirIso(a.birthDate), t)) return null;
  return a.id;
}

/** Sesi kedatangan yang dipilih calon MENGGANTIKAN jadwal umum gelombang untuk asesmen & cek kesehatan. */
export type SesiRingkas = { tanggal: string; jamMulai: string; jamSelesai: string; tempat: string | null; catatan: string | null };
export function jadwalDenganSesi(jadwal: unknown, sesi?: SesiRingkas | null): PetaJadwal {
  const p = bacaJadwal(jadwal) as PetaJadwal;
  if (!sesi) return p;
  const j = { tanggal: sesi.tanggal, jamMulai: sesi.jamMulai, jamSelesai: sesi.jamSelesai, tempat: sesi.tempat ?? "", catatan: sesi.catatan ?? "" };
  return { ...p, ASESMEN: j, PEMERIKSAAN: j };
}

export function tahapanDari(b: BarisTahapan, aturan: AturanTahapan, jadwal: unknown, sesi?: SesiRingkas | null) {
  return susunTahapan(b, aturan, jadwalDenganSesi(jadwal, sesi));
}

/** Sesi kedatangan satu gelombang + jumlah terisi. */
export async function daftarSesi(gelombangId: string) {
  const sesi = await prisma.sesiSpmb.findMany({
    where: { gelombangId }, orderBy: [{ tanggal: "asc" }, { jamMulai: "asc" }],
    include: { _count: { select: { pendaftar: true } } },
  });
  return sesi.map(x => ({
    id: x.id, tanggal: x.tanggal, jamMulai: x.jamMulai, jamSelesai: x.jamSelesai, tempat: x.tempat, catatan: x.catatan,
    kuota: x.kuota, terisi: x._count.pendaftar, sisa: Math.max(0, x.kuota - x._count.pendaftar),
  }));
}

export async function setelanBayar(): Promise<SetelanBayar> {
  const [s, gel] = await Promise.all([
    getSettings(["spmb.syaratBayar", "spmb.uangMuka", "spmb.rincianBiaya", "spmb.infoBayar"]),
    prisma.gelombangSpmb.findMany({ select: { id: true, biayaDaftar: true } }).catch(() => []),
  ]);
  return { ...bacaSetelanBayar(s), perGelombang: Object.fromEntries(gel.filter(g => g.biayaDaftar > 0).map(g => [g.id, g.biayaDaftar])) };
}

/** Jumlah SAH & MENUNGGU per pendaftar — satu kueri groupBy untuk daftar sepanjang apa pun. */
export async function ringkasBayar(ids?: string[]): Promise<Map<string, { sah: number; menunggu: number }>> {
  const g = await prisma.pembayaranSpmb.groupBy({
    by: ["admissionId", "status"], _sum: { jumlah: true },
    where: { status: { in: ["SAH", "MENUNGGU"] }, ...(ids ? { admissionId: { in: ids } } : {}) },
  }).catch(() => []);
  const peta = new Map<string, { sah: number; menunggu: number }>();
  for (const r of g) {
    const x = peta.get(r.admissionId) ?? { sah: 0, menunggu: 0 };
    if (r.status === "SAH") x.sah += r._sum.jumlah ?? 0; else x.menunggu += r._sum.jumlah ?? 0;
    peta.set(r.admissionId, x);
  }
  return peta;
}

/** Baris tahapan + status bayar: `bayarCukup` dipakai penyusun centang tahap Daftar Ulang. */
export function denganBayar<T extends BarisTahapan & { id: string; potonganBiaya: number; gelombangId: string | null }>(
  b: T, set: SetelanBayar, peta: Map<string, { sah: number; menunggu: number }>,
): T & { bayar: InfoBayar } {
  const r = peta.get(b.id) ?? { sah: 0, menunggu: 0 };
  const bayar = hitungBayar(set, b.potonganBiaya, r.sah, r.menunggu, b.gelombangId);
  return { ...b, bayarCukup: bayar.cukup, bayar };
}
