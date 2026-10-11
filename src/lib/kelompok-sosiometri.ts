/** SARAN KELOMPOK BELAJAR DARI SOSIOMETRI (11 Okt 2026) — murni & deterministik, jalan di peramban Guru BK.
 *  Tujuannya BUKAN mengumpulkan sahabat dalam satu kelompok, melainkan memastikan siswa yang tidak dipilih siapa pun
 *  ditempatkan bersama orang yang ia pilih (atau, bila ia belum mengisi, bersama teman yang paling banyak dipilih),
 *  sambil menyebar siswa yang paling populer supaya tidak menumpuk di satu kelompok.
 *   1. jumlah kelompok = ⌈n ÷ ukuran⌉; siswa terpopuler menjadi JANGKAR, satu per kelompok;
 *   2. sisanya ditempatkan mulai dari yang PALING SEDIKIT dipilih: ke kelompok yang masih muat dengan nilai tertinggi —
 *      pilihannya sendiri ada di sana (×3), ada yang memilih dia (×2), lalu kelompok yang paling sedikit isinya.
 *  Hasilnya USULAN: guru tetap menimbang hal yang tidak ada di angket (konflik, kemampuan, laki-laki/perempuan). */
export interface AnggotaKelompok { id: string; nama: string; dipilih: number; alasan: string }

export function sarankanKelompok(siswa: { id: string; nama: string; dipilih: number; mengisi: boolean }[], pilihan: [string, string][], ukuran: number): AnggotaKelompok[][] {
  const n = siswa.length;
  if (!n) return [];
  const k = Math.min(8, Math.max(2, Math.round(ukuran))), jumlah = Math.ceil(n / k);
  const memilih = new Map<string, Set<string>>();
  for (const [a, b] of pilihan) memilih.set(a, (memilih.get(a) ?? new Set()).add(b));
  const urutPopuler = [...siswa].sort((a, b) => b.dipilih - a.dipilih || a.nama.localeCompare(b.nama));
  const kelompok: AnggotaKelompok[][] = urutPopuler.slice(0, jumlah).map(s => [{ id: s.id, nama: s.nama, dipilih: s.dipilih, alasan: "paling banyak dipilih — disebar satu per kelompok" }]);
  // Batas isi: kelompok pertama boleh k, sisanya rata (selisih paling banyak satu orang).
  const batas = (i: number) => Math.floor(n / jumlah) + (i < n % jumlah ? 1 : 0);
  const sisa = urutPopuler.slice(jumlah).sort((a, b) => a.dipilih - b.dipilih || a.nama.localeCompare(b.nama));
  for (const s of sisa) {
    let terbaik = -1, nilaiTerbaik = -1, alasan = "";
    kelompok.forEach((g, i) => {
      if (g.length >= batas(i)) return;
      const pilihanku = g.filter(x => memilih.get(s.id)?.has(x.id)), pemilihku = g.filter(x => memilih.get(x.id)?.has(s.id));
      const nilai = pilihanku.length * 3 + pemilihku.length * 2 + (1 - g.length / (k + 1));
      if (nilai > nilaiTerbaik) {
        nilaiTerbaik = nilai; terbaik = i;
        alasan = pilihanku.length && pemilihku.length ? `saling memilih dengan ${pilihanku[0].nama}`
          : pilihanku.length ? `memilih ${pilihanku.map(x => x.nama).slice(0, 2).join(" & ")}`
          : pemilihku.length ? `dipilih ${pemilihku.map(x => x.nama).slice(0, 2).join(" & ")}`
          : s.dipilih === 0 ? "tidak dipilih siapa pun — ditempatkan bersama teman yang banyak dipilih" : "mengisi tempat yang tersisa";
      }
    });
    if (terbaik < 0) terbaik = kelompok.reduce((m, g, i) => (g.length < kelompok[m].length ? i : m), 0);
    kelompok[terbaik].push({ id: s.id, nama: s.nama, dipilih: s.dipilih, alasan });
  }
  return kelompok;
}
