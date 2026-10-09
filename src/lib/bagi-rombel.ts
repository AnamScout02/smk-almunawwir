import { kunciSekolah } from "@/lib/nama-sekolah";

/** PEMBAGIAN ROMBEL KELAS X (7 Oktober 2026) — hitungan MURNI (netral), dipakai pratinjau server & layar.
 *
 *  Permintaan user: kelas maksimal 30, dibagi RATA ("50 anak TKJ = 25 TKJ 1 + 25 TKJ 2"), seimbang putra/putri
 *  dan asal sekolah, lalu panitia menyetujui. Caranya: jumlah kelas = ⌈n / maks⌉; siswa diurutkan menurut
 *  jenis kelamin → asal sekolah → nama, lalu dibagikan ULAR (1,2,3,3,2,1,…) ke kelas-kelas itu. Hasilnya:
 *  selisih jumlah antarkelas paling banyak 1, putra & putri terbagi rata, dan siswa dari sekolah asal yang sama
 *  tersebar (bukan menumpuk di satu kelas). Urutan nama di tiap kelas = urutan absen (abjad). */

export type SiswaRombel = { id: string; nama: string; jk: "L" | "P" | "?"; sekolah: string | null };
export type KelasRencana = { nama: string; siswa: SiswaRombel[] };

export const MAKS_BAWAAN = 30;

export function jumlahKelas(n: number, maks: number) {
  return n <= 0 ? 0 : Math.ceil(n / Math.max(1, maks));
}

export function jkDari(g: string | null | undefined): "L" | "P" | "?" {
  return /^l/i.test(g ?? "") ? "L" : /^p/i.test(g ?? "") ? "P" : "?";
}

export const urutNama = (a: { nama: string }, b: { nama: string }) => a.nama.localeCompare(b.nama, "id", { sensitivity: "base" });

/** Bagi satu jurusan ke `k` kelas bernama `${awalan} 1..k`. */
export function bagiRombel(siswa: SiswaRombel[], k: number, awalan: string): KelasRencana[] {
  const kelas: KelasRencana[] = Array.from({ length: Math.max(1, k) }, (_, i) => ({ nama: `${awalan} ${i + 1}`, siswa: [] }));
  const urut = [...siswa].sort((a, b) =>
    a.jk.localeCompare(b.jk) || kunciSekolah(a.sekolah).localeCompare(kunciSekolah(b.sekolah)) || urutNama(a, b));
  urut.forEach((s, i) => {
    const putaran = Math.floor(i / kelas.length), pos = i % kelas.length;
    kelas[putaran % 2 === 0 ? pos : kelas.length - 1 - pos].siswa.push(s);
  });
  for (const k of kelas) k.siswa.sort(urutNama);
  return kelas;
}

/** Ringkasan satu kelas: jumlah, putra/putri, dan asal sekolah terbanyak. */
export function ringkasKelas(k: KelasRencana) {
  const L = k.siswa.filter(s => s.jk === "L").length, P = k.siswa.filter(s => s.jk === "P").length;
  const sek = new Map<string, { nama: string; n: number }>();
  for (const s of k.siswa) {
    if (!s.sekolah) continue;
    const kunci = kunciSekolah(s.sekolah);
    const x = sek.get(kunci) ?? { nama: s.sekolah, n: 0 };
    x.n++; sek.set(kunci, x);
  }
  return { jumlah: k.siswa.length, L, P, sekolahTerbanyak: [...sek.values()].sort((a, b) => b.n - a.n).slice(0, 3) };
}
