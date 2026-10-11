/** REKAP KEHADIRAN GURU DI KELAS per orang (10 Oktober 2026, permintaan user) — hitungan MURNI dari baris yang SAMA dengan
 *  layar Kehadiran Guru Terpadu (`susunKehadiranGuru`), dipakai tab "Rekap per Guru" dan Excel-nya supaya angkanya tidak
 *  pernah berbeda. "Masuk kelas" = jam pelajaran yang dicatat guru piket HADIR atau TERLAMBAT. Jam yang BELUM dicatat piket
 *  tidak dianggap hadir maupun alpha — disebut terpisah, dan persennya dihitung dari jam yang SUDAH dicatat. */
type Baris = {
  userId: string; nama: string; nip: string | null; tanggal: string;
  harian: { status: string } | null; blok: { status: string; adaTugas: boolean | null }[]; blokSeharusnya: number; jurnal: number;
};
export type RekapGuru = {
  userId: string; nama: string; nip: string | null; hari: number; terjadwal: number; dicatat: number; belumDicatat: number;
  hadir: number; terlambat: number; izin: number; sakit: number; alpha: number; tugas: number; jurnal: number;
  hadirSekolah: number; persen: number | null;
};

export function rekapPerGuru(baris: Baris[]): RekapGuru[] {
  const peta = new Map<string, RekapGuru>();
  for (const b of baris) {
    if (b.blokSeharusnya <= 0 && b.blok.length === 0) continue;   // hari tanpa jam mengajar tidak masuk rekap kelas
    const r = peta.get(b.userId) ?? { userId: b.userId, nama: b.nama, nip: b.nip, hari: 0, terjadwal: 0, dicatat: 0, belumDicatat: 0,
      hadir: 0, terlambat: 0, izin: 0, sakit: 0, alpha: 0, tugas: 0, jurnal: 0, hadirSekolah: 0, persen: null };
    const terjadwal = Math.max(b.blokSeharusnya, b.blok.length);
    r.hari++; r.terjadwal += terjadwal; r.dicatat += b.blok.length; r.belumDicatat += terjadwal - b.blok.length; r.jurnal += b.jurnal;
    if (b.harian && ["HADIR", "TERLAMBAT"].includes(b.harian.status)) r.hadirSekolah++;
    for (const k of b.blok) {
      if (k.status === "HADIR") r.hadir++; else if (k.status === "TERLAMBAT") r.terlambat++; else if (k.status === "IZIN") r.izin++;
      else if (k.status === "SAKIT") r.sakit++; else r.alpha++;
      if (k.status !== "HADIR" && k.status !== "TERLAMBAT" && k.adaTugas) r.tugas++;
    }
    peta.set(b.userId, r);
  }
  return [...peta.values()].map(r => ({ ...r, persen: r.dicatat > 0 ? Math.round(((r.hadir + r.terlambat) / r.dicatat) * 100) : null }))
    .sort((a, b) => a.nama.localeCompare(b.nama, "id"));
}

export function jumlahRekap(r: RekapGuru[]) {
  const j = (f: (x: RekapGuru) => number) => r.reduce((a, x) => a + f(x), 0);
  const dicatat = j(x => x.dicatat), masuk = j(x => x.hadir + x.terlambat);
  return { guru: r.length, terjadwal: j(x => x.terjadwal), dicatat, belumDicatat: j(x => x.belumDicatat), hadir: j(x => x.hadir), terlambat: j(x => x.terlambat),
    izin: j(x => x.izin), sakit: j(x => x.sakit), alpha: j(x => x.alpha), tugas: j(x => x.tugas), jurnal: j(x => x.jurnal), persen: dicatat ? Math.round((masuk / dicatat) * 100) : null };
}
