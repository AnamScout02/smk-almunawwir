import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { hakPengumuman } from "@/lib/pengumuman";

/** PRESENSI KEGIATAN QR (17 Sep 2026). QR berisi tautan `/hadir/<kegiatan>?t=<slot>.<tanda>` yang berganti tiap 30 detik
 * (HMAC turunan SESSION_SECRET). Token berlaku 5 menit — cukup untuk peserta yang harus login dulu, tetapi foto QR yang
 * diteruskan cepat basi. Presensi hanya diterima 30 menit sebelum mulai s.d. 30 menit setelah selesai. */
export const LANGKAH_DETIK = 30;
const JENDELA_SLOT = 10;
const BATAS_MENIT = 30;

function tanda(id: string, slot: number) {
  const kunci = createHmac("sha256", process.env.SESSION_SECRET ?? "").update("presensi-kegiatan").digest();
  return createHmac("sha256", kunci).update(`${id}.${slot}`).digest("base64url").slice(0, 16);
}

export function tokenKegiatan(id: string, sekarang = Date.now()) {
  const slot = Math.floor(sekarang / 1000 / LANGKAH_DETIK);
  return { token: `${slot}.${tanda(id, slot)}`, berlakuSampai: new Date((slot + 1) * LANGKAH_DETIK * 1000).toISOString() };
}

export function tokenSah(id: string, token: string, sekarang = Date.now()) {
  const [teksSlot, t] = (token ?? "").split(".");
  const slot = Number(teksSlot);
  const kini = Math.floor(sekarang / 1000 / LANGKAH_DETIK);
  if (!Number.isInteger(slot) || !t || slot > kini + 1 || slot < kini - JENDELA_SLOT) return false;
  const a = Buffer.from(tanda(id, slot)), b = Buffer.from(t);
  return a.length === b.length && timingSafeEqual(a, b);
}

const HARI_MS = 86_400_000;

/** Tanggal WIB (YYYY-MM-DD) dari sebuah instan — server berjalan UTC. */
export const isoWib = (d: Date) => new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
/** Tengah malam WIB sebuah tanggal, dipakai sebagai kunci `PresensiKegiatan.tanggal`. */
export const tengahMalamWib = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

export interface RentangKegiatan { mulai: Date; selesai: Date; sampaiTanggal?: Date | null }

/** Berapa HARI kegiatan ini berlangsung. Tanpa `sampaiTanggal` = 1 hari (perilaku lama). */
export function jumlahHari(k: RentangKegiatan): number {
  if (!k.sampaiTanggal) return 1;
  const awal = tengahMalamWib(isoWib(k.mulai)).getTime();
  return Math.max(1, Math.round((k.sampaiTanggal.getTime() - awal) / HARI_MS) + 1);
}

/** Semua tanggal WIB yang dicakup kegiatan (YYYY-MM-DD), urut. */
export function hariKegiatan(k: RentangKegiatan): string[] {
  const n = jumlahHari(k);
  return Array.from({ length: n }, (_, i) => isoWib(new Date(k.mulai.getTime() + i * HARI_MS)));
}

/**
 * Jendela presensi HARI INI, atau null kalau sedang di luar jam kegiatan.
 *
 * Kegiatan berhari-hari memakai JAM HARIAN YANG SAMA (diambil dari `mulai`/`selesai`), jadi
 * jendelanya dihitung per hari — bukan satu rentang menerus. Tanpa ini, kegiatan 5 hari membuat
 * QR presensi sah 24 jam nonstop selama lima hari.
 */
export function jendelaSekarang(k: RentangKegiatan, sekarang = Date.now()) {
  const n = jumlahHari(k);
  for (let i = 0; i < n; i++) {
    const mulai = k.mulai.getTime() + i * HARI_MS;
    const selesai = k.selesai.getTime() + i * HARI_MS;
    if (sekarang >= mulai - BATAS_MENIT * 60_000 && sekarang <= selesai + BATAS_MENIT * 60_000) {
      return { tanggal: tengahMalamWib(isoWib(new Date(mulai))), mulai: new Date(mulai), selesai: new Date(selesai) };
    }
  }
  return null;
}

export function dalamWaktu(k: RentangKegiatan, sekarang = Date.now()) {
  return jendelaSekarang(k, sekarang) !== null;
}

/** Pembuat kegiatan = pembuat pengumuman (Admin/TU/pimpinan semua sasaran, wali kelas untuk kelasnya)
 * ditambah semua guru untuk sasaran guru (rapat MGMP/jurusan). */
export async function hakKegiatan(s: { userId: string; email: string; role: string }) {
  const hak = await hakPengumuman(s);
  return { ...hak, boleh: hak.boleh || s.role === "TEACHER" };
}

export async function kegiatanMilik(id: string, s: { userId: string; email: string; role: string }) {
  const hak = await hakKegiatan(s);
  if (!hak.boleh) return null;
  const k = await prisma.kegiatan.findUnique({ where: { id } });
  if (!k || !(hak.semua || k.pembuatId === s.userId)) return null;
  return { k, hak };
}
