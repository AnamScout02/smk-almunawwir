import "server-only";
import { prisma } from "@/lib/prisma";

/** KKM/KKTP PER MATA PELAJARAN (17 Sep 2026). Diatur di Data Mapel (`Subject.kkm`); mapel tanpa KKM memakai KKM bawaan
 * sekolah (SiteSetting `akademik.kkmDefault`, bawaan 75). Mapel di jurnal/rapor dicatat dengan NAMA, jadi dicocokkan lewat
 * nama + tingkat kelas, mengutamakan mapel khusus jurusan siswa di atas mapel umum. */

export const KUNCI_KKM_BAWAAN = "akademik.kkmDefault";
export const KKM_BAWAAN_AWAL = 75;

export async function kkmBawaan(): Promise<number> {
  const s = await prisma.siteSetting.findUnique({ where: { key: KUNCI_KKM_BAWAAN }, select: { value: true } }).catch(() => null);
  const n = Number(s?.value);
  return Number.isInteger(n) && n >= 1 && n <= 100 ? n : KKM_BAWAAN_AWAL;
}

const kunciNama = (nama: string) => nama.trim().toLowerCase().replace(/\s+/g, " ");

/** Fungsi pencari KKM untuk satu siswa/kelas: `kkmUntuk("Matematika")`. */
export async function petaKkm(o: { grade?: number | null; majorId?: string | null }) {
  const [bawaan, mapel] = await Promise.all([
    kkmBawaan(),
    o.grade
      ? prisma.subject.findMany({
          where: { grade: o.grade, kkm: { not: null }, OR: [{ majorId: null }, ...(o.majorId ? [{ majorId: o.majorId }] : [])] },
          select: { name: true, kkm: true, majorId: true },
        }).catch(() => [])
      : Promise.resolve([] as { name: string; kkm: number | null; majorId: string | null }[]),
  ]);
  const peta = new Map<string, number>();
  // Mapel umum dulu, lalu mapel jurusan menimpa — yang khusus jurusan menang.
  for (const m of [...mapel].sort((a, b) => Number(!!a.majorId) - Number(!!b.majorId))) {
    if (m.kkm) peta.set(kunciNama(m.name), m.kkm);
  }
  return { bawaan, kkmUntuk: (nama: string) => peta.get(kunciNama(nama)) ?? bawaan };
}
