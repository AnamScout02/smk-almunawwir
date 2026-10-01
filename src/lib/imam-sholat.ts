import "server-only";
import { prisma } from "./prisma";
import { assertJabatan } from "./jabatan-guard";
import { assertKedisiplinan } from "./kedisiplinan-guard";
import { getWeekTypeForDate } from "./schedule-week.server";

/**
 * JADWAL IMAM SHOLAT — Duha (satu petugas) & Dzuhur (satu laki, satu perempuan).
 *
 * Mengikuti pola Jadwal Piket (`DutyRoster` + `DutyAttendance`) sesuai permintaan user
 * 30 September 2026 ("seperti piket pagi"): jadwalnya MINGGUAN BERULANG dengan rotasi minggu
 * A/B, dan kehadiran petugasnya dicatat sendiri — bukan ditumpangkan ke absensi mengajar.
 *
 * Kenapa tabel kehadirannya terpisah dari `DutyAttendance`: tabel itu unik per (userId, date),
 * sedangkan satu guru bisa piket pagi DAN menjadi imam di hari yang sama. Di sini kuncinya
 * (userId, date, sesi).
 */

export const HARI = ["MINGGU", "SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"] as const;
export const SESI = ["DUHA", "DZUHUR"] as const;
export type Sesi = (typeof SESI)[number];

/** Slot per sesi. Duha satu petugas; Dzuhur dua — jamaah putra & putri terpisah. */
export const SLOT: Record<Sesi, string[]> = { DUHA: ["-"], DZUHUR: ["L", "P"] };
export const LABEL_SLOT: Record<string, string> = { "-": "Petugas", L: "Imam Putra", P: "Imam Putri" };
export const STATUS = ["HADIR", "IZIN", "SAKIT", "ALPHA"] as const;

export const sesiSah = (v: unknown): v is Sesi => typeof v === "string" && (SESI as readonly string[]).includes(v);
export const slotSah = (sesi: Sesi, v: unknown) => typeof v === "string" && SLOT[sesi].includes(v);

/** Hari menurut WIB — server berjalan di UTC (DESIGN_SYSTEM §17.4 butir 3). */
export function hariWib(d = new Date()): string {
  return HARI[new Date(d.getTime() + 7 * 3600_000).getUTCDay()];
}

/** Tengah malam WIB untuk tanggal tertentu — dipakai sebagai kunci `PresensiImam.date`. */
export function tanggalKunci(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

/**
 * Pengelola jadwal imam: Admin & staf TU otomatis lolos (tidak masuk cabang `if`), guru wajib
 * Wakil Kepala Kesiswaan atau Pembina OSIS — pola standar CLAUDE.md #13. Sekolah belum punya
 * jabatan keagamaan tersendiri di katalog; kalau nanti dibuat, tambahkan namanya di sini saja.
 */
export const JABATAN_IMAM = ["Wakil Kepala Kesiswaan", "Pembina OSIS", "Kepala Sekolah"];

export async function assertImam(session: { role: string; email: string }) {
  if (session.role === "TEACHER") await assertJabatan(session, JABATAN_IMAM);
}

/** Versi tanpa lemparan — untuk menentukan tombol/menu tampil atau tidak. */
export async function bolehImam(session: { role: string; email: string }): Promise<boolean> {
  try { await assertImam(session); return true; } catch { return false; }
}

/**
 * MENGATUR JADWAL vs MENCATAT KEHADIRAN dibedakan (30 September 2026, permintaan user: presensi
 * imam "muncul di absensi yang dicek guru piket biar jadi 1").
 *
 * Jadwalnya tetap disusun Kesiswaan/Pembina OSIS (`assertImam`), tetapi KEHADIRAN hariannya dicek
 * di Buku Piket bersama kehadiran petugas piket — jadi petugas piket hari itu juga harus boleh
 * menyimpannya (`assertKedisiplinan`: Penjamin Mutu/Kurikulum, atau siapa pun yang terjadwal piket
 * hari ini). Salah satu lolos sudah cukup.
 */
export async function assertPresensiImam(session: { role: string; email: string }) {
  try {
    await assertImam(session);
    return;
  } catch {
    // Bukan pengelola jadwal imam — mungkin petugas piket yang sedang mengisi Buku Piket.
  }
  await assertKedisiplinan(session);
}

export interface PetugasHariIni {
  sesi: Sesi;
  slot: string;
  userId: string;
  nama: string;
  status: string | null;
}

/**
 * Siapa yang bertugas menjadi imam pada tanggal tertentu, lengkap dengan status kehadirannya
 * bila sudah dicatat. Satu sumber untuk halaman presensi, papan informasi, dan pengingat —
 * jangan menyusun ulang kueri jadwal di tempat lain.
 */
export async function petugasTanggal(iso: string): Promise<PetugasHariIni[]> {
  const tgl = tanggalKunci(iso);
  const day = hariWib(tgl);
  const weekType = await getWeekTypeForDate(tgl);

  const jadwal = await prisma.jadwalImam.findMany({
    where: { day, OR: [{ weekType: "SEMUA" }, { weekType }] },
    include: { user: { select: { id: true, name: true } } },
  });
  if (jadwal.length === 0) return [];

  const presensi = await prisma.presensiImam.findMany({
    where: { date: tgl, userId: { in: jadwal.map(j => j.userId) } },
    select: { userId: true, sesi: true, status: true },
  });
  const peta = new Map(presensi.map(p => [`${p.userId}|${p.sesi}`, p.status]));

  return jadwal
    .map(j => ({
      sesi: j.sesi as Sesi,
      slot: j.slot,
      userId: j.userId,
      nama: j.user.name,
      status: peta.get(`${j.userId}|${j.sesi}`) ?? null,
    }))
    .sort((a, b) => (a.sesi === b.sesi ? a.slot.localeCompare(b.slot) : a.sesi === "DUHA" ? -1 : 1));
}
