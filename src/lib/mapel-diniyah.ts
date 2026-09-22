import "server-only";
import { prisma } from "@/lib/prisma";

/** MAPEL DINIYAH = MAPEL TAMBAHAN (keputusan user 21 September 2026): "jangan digabungkan dengan mapel lainnya karena
 * sifatnya mapel tambahan saja, baik di ujian maupun di DKN (di DKN tidak tampil sama sekali); kalau di ujian masih bisa
 * ujian". Dikenali dari KATEGORI mapel di Data Mapel (`Subject.category`, tertulis "Kelompok Mata Pelajaran Diniyyah") —
 * jadi mapel Diniyah baru otomatis ikut tanpa mengubah kode. Dipakai: DKN (disembunyikan) & Rekap Nilai Ujian (kelompok
 * terpisah, tidak ikut jumlah/rata-rata/peringkat). */

export const adalahKategoriDiniyah = (kategori: string | null | undefined) => /diniy/i.test(kategori ?? "");
export const kunciNamaMapel = (nama: string) => nama.trim().toLowerCase().replace(/\s+/g, " ");

/** Nama (dinormalkan) semua mapel berkategori Diniyah — nilai & ujian mencatat mapel dengan NAMA, bukan id. */
export async function namaMapelDiniyah(): Promise<Set<string>> {
  const mapel = await prisma.subject.findMany({ where: { category: { contains: "iniy", mode: "insensitive" } }, select: { name: true, category: true } }).catch(() => []);
  return new Set(mapel.filter(m => adalahKategoriDiniyah(m.category)).map(m => kunciNamaMapel(m.name)));
}
