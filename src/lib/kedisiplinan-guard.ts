import "server-only";
import { assertJabatan } from "@/lib/jabatan-guard";
import { prisma } from "@/lib/prisma";
import { getWeekTypeForDate } from "@/lib/schedule-week.server";

const DAYS = ["MINGGU", "SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];

/** Cek murni: apakah user ini terjadwal piket HARI INI di Jadwal Piket (DutyRoster)? Dipakai
 * bareng oleh assertKedisiplinan di bawah & guard input Poin Siswa (kesiswaan-guard.ts) —
 * keduanya sama-sama "guru piket boleh akses fitur ini kalau memang lagi piket hari ini". */
export async function isOnDutyToday(email: string): Promise<boolean> {
  const user = await prisma.user.findFirst({ where: { email }, select: { id: true } });
  if (!user) return false;
  const today = new Date();
  const day = DAYS[new Date(today.getTime() + 7 * 3600_000).getUTCDay()]; // server UTC → hari WIB
  const weekType = await getWeekTypeForDate(today);
  const duty = await prisma.dutyRoster.findFirst({
    where: { userId: user.id, day, OR: [{ weekType: "SEMUA" }, { weekType }] },
  });
  return !!duty;
}

// Wakil Kepala Bidang Penjamin Mutu & Wakil Kepala Kurikulum selalu boleh akses Kedisiplinan
// Guru. Guru/staff LAIN boleh akses HANYA kalau memang terjadwal piket HARI INI di Jadwal Piket
// (DutyRoster) — TIDAK perlu jabatan formal "Guru Piket" tersendiri, karena piket di sekolah ini
// dijalankan bergiliran oleh banyak guru (32 orang beda-beda per hari/minggu sesuai Jadwal
// Piket), bukan dipegang tetap oleh segelintir orang berjabatan "Guru Piket". Mensyaratkan
// jabatan itu JUGA di atas jadwal piket cuma bikin guru yang memang terjadwal piket hari ini
// tetap tidak bisa akses menunya (bug nyata: guru terjadwal piket Senin tapi menu tidak muncul).
export async function assertKedisiplinan(session: { role: string; email: string }) {
  if (session.role === "ADMIN") return;
  if (session.role !== "TEACHER" && session.role !== "TAS") return;

  try {
    await assertJabatan(session, ["Wakil Kepala Bidang Penjamin Mutu", "Wakil Kepala Kurikulum"]);
    return;
  } catch {
    // Bukan salah satu jabatan di atas — lanjut cek apakah terjadwal piket hari ini.
  }

  if (!(await isOnDutyToday(session.email))) throw new Error("FORBIDDEN");
}

// Khusus untuk MENGATUR Jadwal Piket itu sendiri (DutyRoster) — TIDAK pakai gating "harus piket
// hari ini" seperti assertKedisiplinan di atas, karena itu bikin buntu: Guru Piket yang belum
// pernah dijadwalkan (roster masih kosong) jadi tidak akan pernah bisa mengisi jadwalnya sendiri
// (bug nyata yang pernah terjadi — POST selalu FORBIDDEN diam-diam selama roster kosong).
// Mengatur roster cukup syaratkan jabatan saja, tanpa syarat tanggal.
export async function assertDutyRosterAccess(session: { role: string; email: string }) {
  if (session.role === "ADMIN") return;
  if (session.role !== "TEACHER" && session.role !== "TAS") return;
  await assertJabatan(session, ["Wakil Kepala Bidang Penjamin Mutu", "Wakil Kepala Kurikulum", "Guru Piket"]);
}
