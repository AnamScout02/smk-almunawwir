import "server-only";
import { prisma } from "@/lib/prisma";

export type AgendaPkl = { id: string; tanggal: string; judul: string; ket: string; untuk: "PANITIA" | "SEMUA" };

/** AGENDA PKL YANG DIKETIK PANITIA (9 Okt 2026) — pembekalan, rapat orang tua, batas kumpul laporan, ujian PKL, dsb.
 *  Disimpan sebagai satu daftar di SiteSetting `pkl.agenda` (jumlahnya belasan per tahun, tidak perlu tabel sendiri).
 *  `untuk: "SEMUA"` = ikut tampil di halaman PKL siswa; "PANITIA" = hanya di Kalender PKL. */
export async function bacaAgendaPkl(): Promise<AgendaPkl[]> {
  const r = await prisma.siteSetting.findUnique({ where: { key: "pkl.agenda" } }).catch(() => null);
  try {
    const a = JSON.parse(r?.value || "[]") as unknown[];
    return (Array.isArray(a) ? a : []).filter((x): x is AgendaPkl => !!x && typeof x === "object" && typeof (x as AgendaPkl).id === "string" && /^\d{4}-\d{2}-\d{2}$/.test((x as AgendaPkl).tanggal))
      .sort((x, y) => x.tanggal.localeCompare(y.tanggal));
  } catch { return []; }
}
export async function simpanAgendaPkl(a: AgendaPkl[]) {
  const value = JSON.stringify(a.slice(-300));
  await prisma.siteSetting.upsert({ where: { key: "pkl.agenda" }, create: { key: "pkl.agenda", value }, update: { value } });
}
