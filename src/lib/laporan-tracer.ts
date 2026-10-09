import "server-only";
import { prisma } from "@/lib/prisma";

/** LAPORAN TRACER STUDY (8 Oktober 2026) — satu sumber untuk halaman Sebaran & Laporan Alumni dan lembar cetaknya.
 *  Keterserapan SELALU dihitung dari alumni yang SUDAH mengisi, dan persennya baru ditulis bila pengisinya
 *  ≥ `MIN_PENGISI` — "100%" dari satu pengisi bukan angka keterserapan. */
export const MIN_PENGISI = 20;
export type HitungTracer = { alumni: number; mengisi: number; BEKERJA: number; KULIAH: number; WIRAUSAHA: number; BELUM_BEKERJA: number; LAINNYA: number };
export type BarisTracer = HitungTracer & { label: string };
export type LaporanTracer = {
  semua: HitungTracer;
  perAngkatan: BarisTracer[];
  perJurusan: BarisTracer[];
  kerja: { nama: string; jumlah: number }[];
  kuliah: { nama: string; jumlah: number }[];
};

const kosong = (): HitungTracer => ({ alumni: 0, mengisi: 0, BEKERJA: 0, KULIAH: 0, WIRAUSAHA: 0, BELUM_BEKERJA: 0, LAINNYA: 0 });
function tambah(h: HitungTracer, status: string | undefined) {
  h.alumni++;
  if (!status) return;
  h.mengisi++;
  if (status === "BEKERJA" || status === "KULIAH" || status === "WIRAUSAHA" || status === "BELUM_BEKERJA") h[status]++; else h.LAINNYA++;
}
export const terserap = (h: HitungTracer) => h.BEKERJA + h.KULIAH + h.WIRAUSAHA;
/** Teks persen keterserapan, atau "—" bila pengisinya belum cukup. */
export const persenTerserap = (h: HitungTracer) => (h.mengisi >= MIN_PENGISI ? `${Math.round((terserap(h) / h.mengisi) * 100)}%` : "—");

export async function laporanTracer(): Promise<LaporanTracer> {
  const alumni = await prisma.student.findMany({
    where: { studentStatus: "LULUS" },
    select: { bukuIndukData: true, major: { select: { code: true, name: true } }, alumniTracer: { select: { status: true, institutionName: true } } },
  });
  const semua = kosong();
  const angkatan = new Map<string, HitungTracer>(), jurusan = new Map<string, HitungTracer>();
  const kerja = new Map<string, { nama: string; jumlah: number }>(), kuliah = new Map<string, { nama: string; jumlah: number }>();
  for (const a of alumni) {
    const tgl = ((a.bukuIndukData ?? {}) as Record<string, unknown>).graduationDate;
    const th = (typeof tgl === "string" && tgl.match(/^(\d{4})-/)?.[1]) || "Tanpa tanggal lulus";
    const jr = a.major ? `${a.major.code} — ${a.major.name}` : "Tanpa jurusan";
    const st = a.alumniTracer?.status;
    tambah(semua, st);
    if (!angkatan.has(th)) angkatan.set(th, kosong());
    tambah(angkatan.get(th)!, st);
    if (!jurusan.has(jr)) jurusan.set(jr, kosong());
    tambah(jurusan.get(jr)!, st);
    const inst = a.alumniTracer?.institutionName?.trim();
    if (inst && (st === "BEKERJA" || st === "KULIAH")) {
      const peta = st === "KULIAH" ? kuliah : kerja;
      const k = inst.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      const x = peta.get(k) ?? { nama: inst, jumlah: 0 };
      x.jumlah++; peta.set(k, x);
    }
  }
  const urut = (m: Map<string, { nama: string; jumlah: number }>) => [...m.values()].sort((a, b) => b.jumlah - a.jumlah || a.nama.localeCompare(b.nama, "id")).slice(0, 15);
  return {
    semua,
    perAngkatan: [...angkatan].sort((a, b) => b[0].localeCompare(a[0])).map(([label, h]) => ({ label, ...h })),
    perJurusan: [...jurusan].sort((a, b) => a[0].localeCompare(b[0])).map(([label, h]) => ({ label, ...h })),
    kerja: urut(kerja), kuliah: urut(kuliah),
  };
}
