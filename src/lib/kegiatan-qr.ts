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

export function dalamWaktu(k: { mulai: Date; selesai: Date }, sekarang = Date.now()) {
  return sekarang >= k.mulai.getTime() - BATAS_MENIT * 60_000 && sekarang <= k.selesai.getTime() + BATAS_MENIT * 60_000;
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
