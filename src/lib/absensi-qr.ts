import "server-only";
import { createHmac, timingSafeEqual } from "crypto";

/** QR ABSENSI MANDIRI — token berganti tiap 30 detik, ditandatangani server (HMAC turunan SESSION_SECRET).
 * Isi QR: `SMKABSEN1.<stasiun>.<slot>.<tanda>` — stasiun = "GERBANG" (semua kelas) atau id kelas.
 *
 * Anti titip absen: QR hanya berlaku ±1 menit (difoto lalu dikirim ke teman tidak sempat dipakai lama),
 * siswa wajib login di akun sendiri, dan setiap pindaian dicatat per perangkat (AbsensiPindaiLog) supaya satu
 * HP yang dipakai beberapa siswa langsung terlihat. */

export const LANGKAH_DETIK = 30;
const AWALAN = "SMKABSEN1";

function tanda(stasiun: string, slot: number) {
  const kunci = createHmac("sha256", process.env.SESSION_SECRET ?? "").update("absensi-qr-mandiri").digest();
  return createHmac("sha256", kunci).update(`${stasiun}.${slot}`).digest("base64url").slice(0, 16);
}

export function tokenStasiun(stasiun: string, sekarang = Date.now()) {
  const slot = Math.floor(sekarang / 1000 / LANGKAH_DETIK);
  return {
    isi: `${AWALAN}.${stasiun}.${slot}.${tanda(stasiun, slot)}`,
    berlakuSampai: new Date((slot + 1) * LANGKAH_DETIK * 1000).toISOString(),
  };
}

export type HasilToken = { ok: true; stasiun: string } | { ok: false; alasan: string };

/** Token dari slot saat ini atau dua slot sebelumnya (≤ ±90 detik) diterima — memberi waktu siswa yang
 * kameranya lambat fokus, tapi foto QR yang diteruskan ke teman cepat basi. */
export function periksaToken(isi: string, sekarang = Date.now()): HasilToken {
  const bagian = (isi ?? "").trim().split(".");
  if (bagian.length !== 4 || bagian[0] !== AWALAN) return { ok: false, alasan: "Ini bukan QR absensi sekolah." };
  const [, stasiun, teksSlot, tandaDiterima] = bagian;
  const slot = Number(teksSlot);
  const kini = Math.floor(sekarang / 1000 / LANGKAH_DETIK);
  if (!Number.isInteger(slot) || slot > kini + 1 || slot < kini - 2) {
    return { ok: false, alasan: "QR sudah kedaluwarsa. Pindai QR terbaru yang tampil di layar." };
  }
  const harus = Buffer.from(tanda(stasiun, slot));
  const diterima = Buffer.from(tandaDiterima);
  if (harus.length !== diterima.length || !timingSafeEqual(harus, diterima)) return { ok: false, alasan: "QR tidak sah." };
  return { ok: true, stasiun };
}

/** Jam WIB sekarang dalam menit + tanggal WIB + tengah malam UTC tanggal itu (konvensi tabel Attendance). */
export function hariIniWib(sekarang = new Date()) {
  const wib = new Date(sekarang.getTime() + 7 * 3600_000);
  const tanggal = wib.toISOString().slice(0, 10);
  const awal = new Date(`${tanggal}T00:00:00.000Z`);
  return { tanggal, awal, akhir: new Date(awal.getTime() + 86400_000), menit: wib.getUTCHours() * 60 + wib.getUTCMinutes(), hariKe: wib.getUTCDay() };
}

export const menitDariJam = (jam: string) => {
  const [h, m] = (jam ?? "").split(/[:.]/).map(Number);
  return Number.isFinite(h) ? h * 60 + (Number.isFinite(m) ? m : 0) : NaN;
};
