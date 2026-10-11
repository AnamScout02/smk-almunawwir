import "server-only";
import { prisma } from "@/lib/prisma";
import type { IsiNotifikasi } from "@/lib/push-server";

/** PENGINGAT PERAWATAN BERKALA (11 Okt 2026) — jadwal perawatan (menu Sarpras → Perawatan Berkala) sudah ada sejak
 *  17 Sep, tetapi jatuh temponya hanya terlihat bila halamannya dibuka. Pada jam `notifikasi.jamPerawatan` (bawaan 07.00):
 *   - jadwal yang jatuh tempo HARI INI, dan
 *   - yang sudah TERLAMBAT — diulang tiap 3 hari saja (bukan tiap hari) supaya tidak jadi bising,
 *  dikabarkan dalam SATU pesan per orang: Wakil Kepala Sarana Prasarana (semua) dan Kepala Laboratorium (lingkup LAB).
 *  Nama jabatan sama dengan `JABATAN_SARPRAS`/`JABATAN_LAB` di sarpras-akses.ts (tidak diimpor: modul penjadwal tidak
 *  boleh menarik penjaga halaman). */
const SARPRAS = "Wakil Kepala Sarana Prasarana", LAB = "Kepala Laboratorium";

export async function pengingatPerawatan(w: { tanggal: string }, opsi: { kirim: (n: IsiNotifikasi) => Promise<unknown> }) {
  const hari = new Date(`${w.tanggal}T00:00:00Z`), besok = new Date(hari.getTime() + 86_400_000);
  const jadwal = await prisma.jadwalPerawatan.findMany({
    where: { aktif: true, berikutnya: { lt: besok } }, orderBy: { berikutnya: "asc" },
    select: { judul: true, lingkup: true, berikutnya: true, lokasi: true, asset: { select: { name: true } } },
  });
  const perlu = jadwal.map(j => ({ ...j, telat: Math.max(0, Math.floor((hari.getTime() - new Date(j.berikutnya.toISOString().slice(0, 10) + "T00:00:00Z").getTime()) / 86_400_000)) }))
    .filter(j => j.telat % 3 === 0);
  if (!perlu.length) return;
  const jab = await prisma.jabatan.findMany({
    where: { name: { in: [SARPRAS, LAB] } },
    select: { name: true, teachers: { select: { teacher: { select: { userId: true } } } }, staff: { select: { userId: true } } },
  }).catch(() => []);
  const pemegang = (nama: string) => { const j = jab.find(x => x.name === nama); return j ? [...j.teachers.map(t => t.teacher.userId), ...j.staff.map(s => s.userId)] : []; };
  const sarpras = new Set(pemegang(SARPRAS));
  const susun = (d: typeof perlu) => d.slice(0, 6).map(j => `${j.judul}${j.asset ? ` (${j.asset.name})` : j.lokasi ? ` (${j.lokasi})` : ""}${j.telat ? ` — terlambat ${j.telat} hari` : ""}`).join("; ") + (d.length > 6 ? `; dan ${d.length - 6} lainnya` : "") + ".";
  const kabari = async (userId: string, d: typeof perlu, url: string) => {
    if (!d.length) return;
    await opsi.kirim({
      userIds: [userId], jenis: "SARPRAS", kunci: `perawatan:${w.tanggal}:${userId}`, gantiHariIni: true,
      judul: d.some(j => j.telat) ? "Perawatan berkala terlambat" : "Perawatan berkala jatuh tempo hari ini", isi: susun(d), url,
    });
  };
  for (const u of sarpras) await kabari(u, perlu, "/dashboard/teacher/wakasek/sarpras/perawatan");
  for (const u of pemegang(LAB)) if (!sarpras.has(u)) await kabari(u, perlu.filter(j => j.lingkup === "LAB"), "/dashboard/teacher/lab/perawatan");
}
