import type { DataRaporKelas } from "@/lib/rapor-cetak";
import { labelMapel } from "@/lib/singkatan-mapel";

/** LEGER NILAI RAPOR satu kelas (22 September 2026) — padanan lembar REKAP/LEMBAR DKN makro: semua siswa × semua mapel dengan
 * nilai rapor (HPA, sudah katrol bila form dikatrol), jumlah, rata-rata, peringkat, lalu mapel Diniyah (Pengetahuan &
 * Penerapan) sebagai kelompok terpisah yang TIDAK ikut jumlah/rata-rata/peringkat utama (CLAUDE.md #67). Hanya form DIKIRIM.
 * Murni — dipakai halaman leger & unduhan Excel supaya angkanya selalu sama. */
export interface KolomLeger { mapel: string; label: string; kelompok: "UMUM" | "KEJURUAN"; kkm: number | null; terkirim: boolean }
export interface KolomDiniyah { mapel: string; label: string; terkirim: boolean }
export interface BarisLeger {
  id: string; nis: string; nama: string;
  nilai: (number | null)[]; jumlah: number | null; rata: number | null; peringkat: number | null;
  diniyah: { p: number | null; t: number | null }[]; jumlahDiniyah: number | null; peringkatDiniyah: number | null;
}
export interface StatKolom { rata: number | null; maks: number | null; min: number | null; belumTuntas: number }

const dua = (x: number) => Math.round(x * 100) / 100;
function stat(xs: (number | null)[], kkm: number | null): StatKolom {
  const a = xs.filter((n): n is number => typeof n === "number");
  return {
    rata: a.length ? dua(a.reduce((p, c) => p + c, 0) / a.length) : null,
    maks: a.length ? Math.max(...a) : null, min: a.length ? Math.min(...a) : null,
    belumTuntas: kkm === null ? 0 : a.filter(n => n < kkm).length,
  };
}

export function legerRapor(d: DataRaporKelas, singkatan: Record<string, string>) {
  const contoh = d.siswa[0];
  const tanpa = new Set(d.mapelTanpaForm.map(m => m.nama));
  const kolom: KolomLeger[] = contoh ? [
    ...contoh.umum.map(b => ({ mapel: b.mapel, anggota: b.anggota ?? [b.mapel], kelompok: "UMUM" as const })),
    ...contoh.kejuruan.map(b => ({ mapel: b.mapel, anggota: b.anggota ?? [b.mapel], kelompok: "KEJURUAN" as const })),
  ].map(({ anggota, ...k }) => ({
    // Mapel gabungan (DPK/KK) baru "terkirim" bila SEMUA bagiannya sudah dikirim guru.
    ...k, label: labelMapel(k.mapel, singkatan), terkirim: !anggota.some(m => tanpa.has(m)),
    kkm: d.siswa.map(s => [...s.umum, ...s.kejuruan].find(b => b.mapel === k.mapel)?.kkm).find((x): x is number => typeof x === "number") ?? null,
  })) : [];
  const kolomDiniyah: KolomDiniyah[] = contoh ? contoh.diniyah.map(b => ({ mapel: b.mapel, label: labelMapel(b.mapel, singkatan), terkirim: !tanpa.has(b.mapel) })) : [];
  const baris: BarisLeger[] = d.siswa.map(s => {
    const peta = new Map([...s.umum, ...s.kejuruan].map(b => [b.mapel, b.hasil?.hpa ?? null]));
    const nilai = kolom.map(k => peta.get(k.mapel) ?? null);
    const ada = nilai.filter((n): n is number => typeof n === "number");
    const din = kolomDiniyah.map(k => { const b = s.diniyah.find(x => x.mapel === k.mapel); return { p: b?.pengetahuan ?? null, t: b?.penerapan ?? null }; });
    const adaDin = din.some(x => x.p !== null || x.t !== null);
    return {
      id: s.id, nis: s.nis, nama: s.nama, nilai,
      jumlah: ada.length ? dua(ada.reduce((p, c) => p + c, 0)) : null, rata: s.rata, peringkat: s.peringkat,
      diniyah: din, jumlahDiniyah: adaDin ? s.jumlahDiniyah.pengetahuan + s.jumlahDiniyah.penerapan : null, peringkatDiniyah: s.peringkatDiniyah,
    };
  });
  const statMapel = kolom.map((k, j) => stat(baris.map(b => b.nilai[j]), k.kkm));
  return { kolom, kolomDiniyah, baris, statMapel };
}
export type DataLeger = ReturnType<typeof legerRapor>;
