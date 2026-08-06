import "server-only";
import type { WeekType } from "@/lib/schedule-week";

// Jangkar rotasi Minggu 1(A)/Minggu 2(B) SENGAJA dipisah dari AcademicYear.startDate (dulu 1 Juli
// 2026 dipakai bareng) — startDate itu masih dipakai fitur lain (Buku Mutasi, Kenaikan Kelas,
// Statistik, Nomor Surat) yang TIDAK boleh ikut bergeser cuma karena rotasi Produktif/Umum perlu
// dikoreksi.
//
// Riwayat koreksi 5 Agustus 2026 (dikonfirmasi user, JANGAN diubah lagi tanpa data pasti serupa):
// - Senin 27 Jul 2026 = Umum utk kelas X (B).
// - Senin 3 Ags s/d Rabu 5 Ags 2026 = Produktif utk kelas X (A), satu minggu kalender penuh sama.
// Jangkar lama (1 Juli, hari Rabu) SALAH karena batas siklusnya jatuh di hari Rabu, bukan Senin —
// akibatnya Senin-Selasa & Rabu dalam satu minggu kalender yang sama malah dianggap beda siklus.
// Percobaan pertama (digeser 7 hari, tetap di hari Rabu) OVERCORRECT: Rabu jadi benar tapi
// Senin-Selasa yang tadinya SUDAH benar ikut kebalik jadi salah, bikin data absensi yg sudah
// terlanjur tercatat Senin-Selasa jadi tidak match lagi. Jangkar final di bawah = hari SENIN
// (bukan Rabu), supaya siklus 7-harian sejalan dgn minggu kalender (Senin-Sabtu 1 kelompok utuh).
const WEEK_ROTATION_ANCHOR = new Date("2026-07-20T00:00:00.000Z");

export async function getCurrentWeekType(): Promise<WeekType> {
  return getWeekTypeForDate(new Date());
}

/** Sama seperti getCurrentWeekType tapi untuk tanggal manapun (mis. mengecek jadwal di tanggal lampau). */
export async function getWeekTypeForDate(date: Date): Promise<WeekType> {
  const days = Math.floor((date.getTime() - WEEK_ROTATION_ANCHOR.getTime()) / 86400000);
  return Math.floor(days / 7) % 2 === 0 ? "A" : "B";
}
