/** REKAP NILAI UJIAN — hitungan MURNI (tanpa basis data), dipakai tabel di layar (klien) DAN berkas Excel (server),
 * jadi angka di layar & di unduhan selalu sama. Data mentahnya disusun `muatRekapNilai` (src/lib/rekap-nilai-ujian.ts).
 * Permintaan user 21 September 2026: rekap per kelas, per mapel, dan lainnya + unduhan Excel yang rapi — BUKAN dikirim
 * ke Jurnal/rapor (sekolah akan memakai e-Rapor pemerintah). */

/** Satu sel nilai: `n` nilai utama (ujian reguler, atau susulan bila tidak ikut reguler), `s` = sementara (masih ada
 * uraian belum dikoreksi), `su` = nilai berasal dari ujian susulan, `r` = nilai remedial (terpisah, tidak menimpa). */
export interface SelNilai { n: number | null; s?: boolean; su?: boolean; r?: number | null }

export interface DataRekap {
  kegiatan: { id: string; nama: string; singkatan: string; tahunAjaran: string | null };
  kelas: { id: string; nama: string; grade: number; jurusan: string }[];
  /** Mapel yang diujikan per kelas (urut abjad). */
  mapelKelas: Record<string, string[]>;
  siswa: { id: string; nis: string; nama: string; classId: string }[];
  /** siswaId → mapel → sel */
  nilai: Record<string, Record<string, SelNilai>>;
  /** classId → mapel → KKM */
  kkm: Record<string, Record<string, number>>;
  /** Mapel DINIYAH (mapel tambahan, src/lib/mapel-diniyah.ts): tetap direkap tetapi TIDAK ikut jumlah, rata-rata, dan
   * peringkat — ditampilkan sebagai kelompok terpisah setelah mapel utama (keputusan user 21 September 2026). */
  diniyah: string[];
  /** Nama mapel → singkatan (Data Mapel → Singkatan Mapel) untuk kepala kolom leger; kosong = nama lengkap. */
  singkatan?: Record<string, string>;
}

export const adalahDiniyah = (d: DataRekap, mapel: string) => (d.diniyah ?? []).includes(mapel);

export const bulat = (x: number) => Math.round(x * 100) / 100;
export function statistik(nilai: number[]) {
  if (!nilai.length) return { ikut: 0, rata: null as number | null, maks: null as number | null, min: null as number | null };
  return { ikut: nilai.length, rata: bulat(nilai.reduce((a, b) => a + b, 0) / nilai.length), maks: Math.max(...nilai), min: Math.min(...nilai) };
}
export const semuaMapel = (d: DataRekap) => [...new Set(Object.values(d.mapelKelas).flat())].sort((a, b) => a.localeCompare(b, "id"));
const urutNama = <T extends { nama: string }>(a: T, b: T) => a.nama.localeCompare(b.nama, "id");

/* ------------------------------ 1. LEGER PER KELAS ------------------------------ */
export function legerKelas(d: DataRekap, classId: string) {
  const semua = d.mapelKelas[classId] ?? [];
  const mapel = semua.filter(m => !adalahDiniyah(d, m));          // mapel utama — ikut jumlah/rata-rata/peringkat
  const mapelDiniyah = semua.filter(m => adalahDiniyah(d, m));    // tambahan — kolom terpisah, tidak ikut dihitung
  const kkm = d.kkm[classId] ?? {};
  const siswa = d.siswa.filter(s => s.classId === classId).sort(urutNama);
  const baris = siswa.map(s => {
    const sel = mapel.map(m => d.nilai[s.id]?.[m] ?? { n: null });
    const selDiniyah = mapelDiniyah.map(m => d.nilai[s.id]?.[m] ?? { n: null });
    const ada = sel.map(x => x.n).filter((x): x is number => x !== null);
    return { siswa: s, sel, selDiniyah, jumlah: ada.length ? bulat(ada.reduce((a, b) => a + b, 0)) : null, rata: ada.length ? bulat(ada.reduce((a, b) => a + b, 0) / ada.length) : null, peringkat: null as number | null };
  });
  // Peringkat menurut rata-rata mapel UTAMA; nilai sama = peringkat sama.
  const urut = baris.filter(b => b.rata !== null).sort((a, b) => b.rata! - a.rata!);
  urut.forEach((b, i) => { b.peringkat = i > 0 && urut[i - 1].rata === b.rata ? urut[i - 1].peringkat : i + 1; });
  const statMapel = (daftar: string[], ambil: (b: (typeof baris)[number]) => SelNilai[]) => daftar.map((m, i) => {
    const angka = baris.map(b => ambil(b)[i].n).filter((x): x is number => x !== null);
    const k = kkm[m] ?? 75;
    return { mapel: m, kkm: k, ...statistik(angka), tuntas: angka.filter(x => x >= k).length, total: baris.length };
  });
  return {
    kelas: d.kelas.find(k => k.id === classId) ?? null, mapel, mapelDiniyah, kkm, baris,
    perMapel: statMapel(mapel, b => b.sel), perMapelDiniyah: statMapel(mapelDiniyah, b => b.selDiniyah),
  };
}

/* ------------------------------ 2. PER MAPEL ------------------------------ */
export type StatusNilai = "BELUM_IKUT" | "TUNTAS" | "BELUM_TUNTAS" | "TUNTAS_REMEDIAL";
export const LABEL_STATUS_NILAI: Record<StatusNilai, string> = {
  BELUM_IKUT: "Belum ikut", TUNTAS: "Tuntas", BELUM_TUNTAS: "Belum tuntas", TUNTAS_REMEDIAL: "Tuntas (remedial)",
};
export function statusNilai(sel: SelNilai, kkm: number): StatusNilai {
  if (sel.n === null) return "BELUM_IKUT";
  if (sel.n >= kkm) return "TUNTAS";
  return sel.r != null && sel.r >= kkm ? "TUNTAS_REMEDIAL" : "BELUM_TUNTAS";
}
export function rekapMapel(d: DataRekap, mapel: string) {
  const kelas = d.kelas.filter(k => (d.mapelKelas[k.id] ?? []).includes(mapel)).sort(urutNama);
  const grup = kelas.map(k => {
    const kkm = d.kkm[k.id]?.[mapel] ?? 75;
    const baris = d.siswa.filter(s => s.classId === k.id).sort(urutNama).map(s => {
      const sel = d.nilai[s.id]?.[mapel] ?? { n: null };
      return { siswa: s, sel, status: statusNilai(sel, kkm) };
    });
    const angka = baris.map(b => b.sel.n).filter((x): x is number => x !== null);
    return {
      kelas: k, kkm, baris,
      ringkas: { ...statistik(angka), total: baris.length, tuntas: baris.filter(b => b.status === "TUNTAS").length,
        tuntasRemedial: baris.filter(b => b.status === "TUNTAS_REMEDIAL").length, belumTuntas: baris.filter(b => b.status === "BELUM_TUNTAS").length },
    };
  });
  const semua = grup.flatMap(g => g.baris.map(b => b.sel.n)).filter((x): x is number => x !== null);
  return { mapel, grup, ringkas: statistik(semua) };
}

/* ------------------------------ 3. RINGKASAN KELAS × MAPEL ------------------------------ */
export function ringkasanKelasMapel(d: DataRekap) {
  // Mapel utama dulu, lalu mapel Diniyah (tambahan) di ujung kanan; rata-rata kelas HANYA dari mapel utama.
  const mapel = [...semuaMapel(d).filter(m => !adalahDiniyah(d, m)), ...semuaMapel(d).filter(m => adalahDiniyah(d, m))];
  const kelas = [...d.kelas].sort((a, b) => a.grade - b.grade || a.nama.localeCompare(b.nama, "id", { numeric: true }));
  const baris = kelas.map(k => {
    const siswa = d.siswa.filter(s => s.classId === k.id);
    const sel = mapel.map(m => {
      if (!(d.mapelKelas[k.id] ?? []).includes(m)) return null; // mapel tidak diujikan di kelas ini
      const kkm = d.kkm[k.id]?.[m] ?? 75;
      const angka = siswa.map(s => d.nilai[s.id]?.[m]?.n ?? null).filter((x): x is number => x !== null);
      const st = statistik(angka);
      return { ...st, total: siswa.length, persenTuntas: angka.length ? Math.round((angka.filter(x => x >= kkm).length / angka.length) * 100) : null };
    });
    const rata = sel.filter((_, i) => !adalahDiniyah(d, mapel[i])).map(x => x?.rata).filter((x): x is number => x != null);
    return { kelas: k, jumlahSiswa: siswa.length, sel, rataKelas: rata.length ? bulat(rata.reduce((a, b) => a + b, 0) / rata.length) : null };
  });
  const perMapel = mapel.map((m, i) => {
    const rata = baris.map(b => b.sel[i]?.rata).filter((x): x is number => x != null);
    return rata.length ? bulat(rata.reduce((a, b) => a + b, 0) / rata.length) : null;
  });
  return { mapel, diniyah: mapel.map(m => adalahDiniyah(d, m)), baris, perMapel };
}

/** Tampilan sel: "82", "82*" (sementara), "—" (belum ikut). */
export function teksSel(sel: SelNilai | null | undefined): string {
  if (!sel || sel.n === null) return "—";
  return `${sel.n}${sel.s ? "*" : ""}`;
}
