import "server-only";
import { prisma } from "@/lib/prisma";
import { GRUP_MAPEL } from "@/lib/mapel-gabungan";
import { saranSingkatan } from "@/lib/singkatan-mapel";

/** Peta nama mapel → singkatan: tersimpan (Data Mapel) bila ada, selain itu saran otomatis. Nama dicocokkan tanpa beda huruf
 * besar/kecil & spasi berlebih. */
export async function petaSingkatanMapel(nama: string[]): Promise<Record<string, string>> {
  const unik = [...new Set(nama.filter(Boolean))];
  if (!unik.length) return {};
  const kunci = (x: string) => x.trim().replace(/\s+/g, " ").toLowerCase();
  const baris = await prisma.subject.findMany({ where: { singkatan: { not: null } }, select: { name: true, singkatan: true } }).catch(() => []);
  const dariDb = new Map<string, string>();
  for (const b of baris) if (b.singkatan?.trim() && !dariDb.has(kunci(b.name))) dariDb.set(kunci(b.name), b.singkatan.trim());
  const hasil: Record<string, string> = {};
  for (const n of unik) {
    // Urutan: isian Data Mapel → kode makro kolom gabungan DPK/KK → saran otomatis (permintaan user 22 Sep 2026: kepala kolom
    // DKN/leger langsung ringkas walau form Singkatan Mapel belum diisi; isian form selalu menang).
    hasil[n] = dariDb.get(kunci(n)) ?? GRUP_MAPEL.find(g => g.nama === n)?.singkatan ?? saranSingkatan(n);
  }
  return hasil;
}
