import "server-only";
import { prisma } from "@/lib/prisma";
import { waktuWib } from "@/lib/pengingat-terjadwal";
import type { TugasHariIni } from "@/lib/tugas-hari-ini";

/** Pengingat hari ini (absensi/jurnal/piket) yang TUGASNYA SUDAH DIKERJAKAN otomatis ditandai dibaca, supaya kotak
 * notifikasi & angka lonceng tidak terus menagih hal yang sudah beres. Status "masih perlu" diambil dari
 * `tugasHariIni` (dihitung langsung dari data absensi/piket/jurnal), dan penerimanya sama dengan pengingat berjam
 * (wali/pengurus kelas, guru pengajar, petugas piket dari roster). */
export async function tandaiPengingatSelesai(userId: string, tugas: TugasHariIni[], now = new Date()) {
  const awalHariWib = new Date(waktuWib(now).awalHari.getTime() - 7 * 3600_000);
  const belum = await prisma.notifikasiPengguna.findMany({
    where: {
      userId, dibacaAt: null, createdAt: { gte: awalHariWib },
      notifikasi: { jenis: { in: ["ABSENSI_BELUM", "JURNAL_BELUM", "PIKET_BELUM"] } },
    },
    select: { id: true, notifikasi: { select: { jenis: true, judul: true } } },
  });
  if (!belum.length) return 0;
  const masihPerlu = (jenis: string, judul: string) => {
    if (jenis === "JURNAL_BELUM") return tugas.some(t => t.jenis === "JURNAL");
    if (jenis === "PIKET_BELUM") return tugas.some(t => t.jenis === "PIKET");
    const kelas = judul.replace(/^Absensi\s+/, "").replace(/\s+belum diisi$/, "");
    return tugas.some(t => t.jenis === "ABSENSI" && t.judul === `Absensi ${kelas} hari ini belum diisi`);
  };
  const selesai = belum.filter(b => !masihPerlu(b.notifikasi.jenis, b.notifikasi.judul)).map(b => b.id);
  if (!selesai.length) return 0;
  const r = await prisma.notifikasiPengguna.updateMany({ where: { id: { in: selesai }, dibacaAt: null }, data: { dibacaAt: new Date() } });
  return r.count;
}
