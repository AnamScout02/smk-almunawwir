import "server-only";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { assertBendahara } from "@/lib/bendahara-guard";
import { rapikanAngkatan, type AngkatanMasuk, type TransaksiMasuk } from "@/lib/alokasi-dana";

/** Akses Alokasi Dana = Admin + pemegang jabatan Bendahara (Sekolah/BOS/BPOPP) — penjaga yang SAMA dengan modul
 *  Bendahara lama (`assertBendahara`), dipakai ulang tanpa menyentuh modul itu. Melempar FORBIDDEN. */
export async function sesiAlokasi() {
  const s = await verifySession();
  await assertBendahara(s);
  return s;
}

/** Jumlah siswa AKTIF per tingkat kelas — untuk tombol "Ambil dari data". */
export async function siswaPerTingkat(): Promise<Record<number, number>> {
  const baris = await prisma.student.findMany({
    where: { studentStatus: "AKTIF", classId: { not: null } }, select: { class: { select: { grade: true } } },
  }).catch(() => []);
  const hasil: Record<number, number> = {};
  for (const b of baris) if (b.class) hasil[b.class.grade] = (hasil[b.class.grade] ?? 0) + 1;
  return hasil;
}

export async function muatRencana(id: string) {
  const r = await prisma.alokasiRencana.findUnique({
    where: { id },
    include: { angkatan: { orderBy: { urutan: "asc" } }, transaksi: { orderBy: [{ tanggal: "desc" }, { createdAt: "desc" }] } },
  });
  if (!r) return null;
  const angkatan: AngkatanMasuk[] = r.angkatan.map(a => rapikanAngkatan({
    id: a.id, nama: a.nama, tingkat: a.tingkat, jumlahSiswa: a.jumlahSiswa, iuran: a.iuran,
    keringanan: a.keringanan as never, pos: a.pos as never,
  }));
  const transaksi: (TransaksiMasuk & { dicatatOleh: string })[] = r.transaksi.map(t => ({
    id: t.id, jenis: t.jenis === "KELUAR" ? "KELUAR" : "MASUK", angkatanId: t.angkatanId, pos: t.pos,
    tanggal: t.tanggal.toISOString().slice(0, 10), jumlah: t.jumlah, keterangan: t.keterangan, dicatatOleh: t.dicatatOleh,
  }));
  return {
    id: r.id, nama: r.nama, tahunAjaran: r.tahunAjaran, bulan: r.bulan, posPenampung: r.posPenampung, catatan: r.catatan,
    diperbarui: r.updatedAt.toISOString(), angkatan, transaksi,
  };
}

/** Pos bawaan rencana baru — nama dari contoh user, persennya dikosongkan untuk diisi bendahara. */
export const POS_BAWAAN = [
  { nama: "Kesiswaan", jenis: "PERSEN" as const, nilai: 0 },
  { nama: "Kegiatan Umum", jenis: "PERSEN" as const, nilai: 0 },
];
