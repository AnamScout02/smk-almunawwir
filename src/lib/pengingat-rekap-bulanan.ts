import "server-only";
import { prisma } from "@/lib/prisma";
import type { IsiNotifikasi } from "@/lib/push-server";

/** KABAR "REKAP BULAN LALU SIAP" (11 Okt 2026) — ke pemegang jabatan Kepala Sekolah, pada HARI SEKOLAH PERTAMA tiap bulan
 *  (tanggal 1–7; penjadwal sudah diam di hari libur, jadi tanggal 1 yang libur bergeser sendiri). Kunci per bulan per
 *  orang → sekali saja. Isinya hanya ajakan membuka lembarnya; angkanya dihitung saat lembar dibuka. */
const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

export async function pengingatRekapBulanan(w: { tanggal: string }, opsi: { kirim: (n: IsiNotifikasi) => Promise<unknown> }) {
  if (Number(w.tanggal.slice(8, 10)) > 7) return;
  const d = new Date(`${w.tanggal.slice(0, 7)}-01T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() - 1);
  const lalu = d.toISOString().slice(0, 7), nama = `${BULAN[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  const j = await prisma.jabatan.findFirst({ where: { name: "Kepala Sekolah" }, select: { teachers: { select: { teacher: { select: { userId: true } } } }, staff: { select: { userId: true } } } }).catch(() => null);
  for (const userId of new Set([...(j?.teachers.map(t => t.teacher.userId) ?? []), ...(j?.staff.map(s => s.userId) ?? [])])) {
    await opsi.kirim({
      userIds: [userId], jenis: "PENGUMUMAN", kunci: `rekap-bulanan:${lalu}:${userId}`,
      judul: `Rekap ${nama} siap dibaca`, isi: "Kehadiran guru dan siswa, guru masuk kelas, jurnal mengajar, dan persuratan bulan lalu dalam satu lembar.",
      url: `/dashboard/teacher/rekap-bulanan?bulan=${lalu}`,
    });
  }
}
