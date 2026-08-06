import "server-only";
import { assertJabatan } from "@/lib/jabatan-guard";
import { prisma } from "@/lib/prisma";
import { getWeekTypeForDate } from "@/lib/schedule-week.server";

const DAYS = ["MINGGU", "SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];

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

  // Cek lewat User.id langsung (bukan Teacher.userId) — DutyRoster boleh diisi guru MAUPUN
  // staf TAS (lihat duty-roster/route.ts), jadi lookup-nya tidak boleh cuma lewat tabel Teacher.
  const user = await prisma.user.findFirst({ where: { email: session.email }, select: { id: true } });
  if (!user) throw new Error("FORBIDDEN");

  const today = new Date();
  const day = DAYS[today.getDay()];
  const weekType = await getWeekTypeForDate(today);
  const duty = await prisma.dutyRoster.findFirst({
    where: { userId: user.id, day, OR: [{ weekType: "SEMUA" }, { weekType }] },
  });
  if (!duty) throw new Error("FORBIDDEN");
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
