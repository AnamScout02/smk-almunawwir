/** NILAI AKHIR PKL BERBOBOT (9 Okt 2026) — hitungan MURNI, dipakai layar, Excel, dan penetapan.
 *  Lima komponen 0–100; bobotnya DIATUR PANITIA (SiteSetting `pkl.bobotNilai`), angka di bawah hanya bawaan.
 *  Bobot dinormalkan terhadap komponen yang BENAR-BENAR ada (pola skor SPMB, CLAUDE.md #102) supaya siswa yang satu
 *  komponennya belum terisi tidak terlihat jelek — tetapi komponen yang kosong selalu DISEBUT, tidak disembunyikan. */
export const KOMPONEN_NILAI = [
  { kunci: "industri", label: "Nilai pembimbing industri", ket: "rata-rata penilaian DUDI" },
  { kunci: "guru", label: "Nilai guru pembimbing", ket: "Nilai PKL yang diisi guru" },
  { kunci: "jurnal", label: "Jurnal harian", ket: "persen hari kerja yang berjurnal" },
  { kunci: "kehadiran", label: "Kehadiran", ket: "persen hadir dari presensi PKL" },
  { kunci: "laporan", label: "Laporan akhir", ket: "100 bila disetujui" },
] as const;
export type KunciNilai = (typeof KOMPONEN_NILAI)[number]["kunci"];
export type BobotNilai = Record<KunciNilai, number>;
export const BOBOT_BAWAAN: BobotNilai = { industri: 40, guru: 20, jurnal: 15, kehadiran: 15, laporan: 10 };

export function bacaBobot(mentah?: string | null): BobotNilai {
  try {
    const o = JSON.parse(mentah || "{}") as Record<string, unknown>;
    const b = Object.fromEntries(KOMPONEN_NILAI.map(k => [k.kunci, Number.isFinite(Number(o[k.kunci])) && o[k.kunci] !== null && o[k.kunci] !== undefined ? Math.min(100, Math.max(0, Math.round(Number(o[k.kunci])))) : BOBOT_BAWAAN[k.kunci]])) as BobotNilai;
    return Object.values(b).some(v => v > 0) ? b : BOBOT_BAWAAN;
  } catch { return BOBOT_BAWAAN; }
}

/** Hari kerja (Senin–Sabtu) dari `mulai` s.d. `sampai` inklusif. PKL mengikuti hari kerja DUDI; Minggu tidak dihitung. */
export function hariKerja(mulai: Date, sampai: Date) {
  let n = 0;
  for (let t = Date.UTC(mulai.getUTCFullYear(), mulai.getUTCMonth(), mulai.getUTCDate()); t <= sampai.getTime(); t += 86_400_000) if (new Date(t).getUTCDay() !== 0) n++;
  return n;
}

export type BahanNilai = {
  nilaiIndustri: number | null; nilaiGuru: number | null; jumlahJurnal: number; mulai: Date; selesai: Date;
  presensi: { hadir: number; total: number }; laporanStatus: string | null;
};
export function hitungNilaiPkl(b: BahanNilai, bobot: BobotNilai, hariIni: Date) {
  const sampai = b.selesai < hariIni ? b.selesai : hariIni;
  const hk = sampai >= b.mulai ? hariKerja(b.mulai, sampai) : 0;
  const bulat = (n: number) => Math.round(n * 10) / 10;
  const komponen: Record<KunciNilai, number | null> = {
    industri: b.nilaiIndustri, guru: b.nilaiGuru,
    jurnal: hk >= 5 ? bulat(Math.min(100, (b.jumlahJurnal / hk) * 100)) : null,
    // Di bawah 5 catatan presensi belum bisa disebut angka kehadiran.
    kehadiran: b.presensi.total >= 5 ? bulat((b.presensi.hadir / b.presensi.total) * 100) : null,
    laporan: b.laporanStatus === "DISETUJUI" ? 100 : null,
  };
  let jumlah = 0, pembagi = 0;
  for (const k of KOMPONEN_NILAI) { const v = komponen[k.kunci], w = bobot[k.kunci]; if (v != null && w > 0) { jumlah += v * w; pembagi += w; } }
  const kosong = KOMPONEN_NILAI.filter(k => bobot[k.kunci] > 0 && komponen[k.kunci] == null).map(k => k.label);
  return { komponen, akhir: pembagi ? bulat(jumlah / pembagi) : null, kosong, lengkap: kosong.length === 0 };
}
