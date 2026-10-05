import "server-only";
import { prisma } from "@/lib/prisma";

/** PROFIL BEL & MODE BEL TV (4 Oktober 2026) — SATU sumber untuk pemutar bel pusat dan papan TV.
 *  Permintaan user: "jika ada jadwal ujian bagaimana bel otomatis disesuaikan" + ruang ANBK/TKA yang tidak
 *  boleh terganggu bel.
 *  - Profil hari ini = UJIAN bila ada Kegiatan Ujian AKTIF yang rentang tanggalnya memuat hari ini DAN TU sudah
 *    menyusun minimal satu bel UJIAN aktif. Tanpa bel UJIAN, sekolah tetap memakai bel REGULER — hari ujian
 *    tidak boleh berubah menjadi hari tanpa bel hanya karena jadwal ujiannya belum disusun.
 *  - Mode TV (Layar.belMode) menimpa profil itu khusus untuk TV tersebut; lewat `belModeSampai` = NORMAL. */
export type ProfilBel = "REGULER" | "UJIAN";
export type ModeBel = "NORMAL" | "HENING" | "UJIAN";

/** Tanggal WIB hari ini "YYYY-MM-DD" (server berjalan di UTC — CLAUDE.md #42). */
export function hariIniWib(kini = new Date()) {
  return new Date(kini.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
}

export async function profilBelHariIni(kini = new Date()): Promise<{ profil: ProfilBel; kegiatan: string | null }> {
  const tgl = new Date(`${hariIniWib(kini)}T00:00:00.000Z`); // kolom @db.Date dibandingkan sebagai tengah malam UTC
  const [kegiatan, adaBelUjian] = await Promise.all([
    prisma.kegiatanUjian.findFirst({
      where: { aktif: true, tanggalMulai: { lte: tgl }, tanggalSelesai: { gte: tgl } },
      select: { nama: true },
    }).catch(() => null),
    prisma.bellSchedule.count({ where: { active: true, profil: "UJIAN" } }).catch(() => 0),
  ]);
  return kegiatan && adaBelUjian > 0 ? { profil: "UJIAN", kegiatan: kegiatan.nama } : { profil: "REGULER", kegiatan: null };
}

/** Mode bel yang BENAR-BENAR berlaku untuk satu TV sekarang. */
export function modeBelBerlaku(l: { belMode: string; belModeSampai: Date | null }, kini = new Date()): ModeBel {
  if (l.belModeSampai && l.belModeSampai.getTime() <= kini.getTime()) return "NORMAL";
  return l.belMode === "HENING" || l.belMode === "UJIAN" ? l.belMode : "NORMAL";
}
