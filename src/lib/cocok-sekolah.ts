import { bakuNamaSekolah, kunciSekolah, miripSekolah } from "@/lib/nama-sekolah";

/** PENCOCOK nama sekolah dari sumber LUAR (Sekolah Kita / Dapodik) ke sekolah asal di data kita (8 Oktober 2026).
 *  Sumber luar menulis jenjang dengan caranya sendiri — "MTSS AL FATAH SRAGI", "MTs MTS UNGGULAN AL-MU`AYYAD",
 *  "SMP NEGERI MANBAUL FALAH SINGOJURUH" — jadi `kunciSekolah` saja tidak cukup. Urutan: kunci sama → satu-satunya
 *  yang berawalan sama (sumber luar sering menambah nama tempat di belakang) → `miripSekolah` yang tunggal.
 *  Lebih dari satu calon = TIDAK dicocokkan (jangan menebak; angka potensi sekolah lain bisa tertukar). */
export function kunciCocok(nama: string): string {
  const rapi = (nama ?? "").toUpperCase().replace(/[`'’.]/g, "")
    .replace(/\bMTSN\b/g, "MTS NEGERI").replace(/\bMTSS\b/g, "MTS").replace(/\bSMPN\b/g, "SMP NEGERI").replace(/\bSMPS\b/g, "SMP")
    .replace(/\b(MTS|SMP)(\s+\1)+\b/g, "$1");
  return kunciSekolah(bakuNamaSekolah(rapi));
}

export function buatPencocok<T extends { nama: string }>(luar: T[]) {
  // Nama baku sumber dihitung SEKALI — `miripSekolah` dipanggil ribuan kali (tiap sekolah kita × tiap sekolah sumber).
  const daftar = luar.map(s => ({ s, k: kunciCocok(s.nama), baku: bakuNamaSekolah(s.nama) }));
  const perKunci = new Map<string, T[]>();
  for (const d of daftar) perKunci.set(d.k, [...(perKunci.get(d.k) ?? []), d.s]);
  return (namaKita: string): T | null => {
    const k = kunciCocok(namaKita);
    if (!k) return null;
    const persis = perKunci.get(k);
    if (persis) return persis.length === 1 ? persis[0] : null;
    if (k.length >= 8) {
      const awal = daftar.filter(d => d.k.startsWith(k) || k.startsWith(d.k) && d.k.length >= 8);
      if (awal.length === 1) return awal[0].s;
      if (awal.length > 1) return null;
    }
    const mirip = daftar.filter(d => miripSekolah(namaKita, d.baku));
    return mirip.length === 1 ? mirip[0].s : null;
  };
}
