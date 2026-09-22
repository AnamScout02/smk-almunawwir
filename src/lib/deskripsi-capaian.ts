/** DESKRIPSI CAPAIAN & PREDIKAT RAPOR (17 Sep 2026 — permintaan user: "deskripsi capaian otomatis dari nilai, supaya wali kelas
 * tidak mengetik manual"). Murni fungsi (tanpa database) — dipakai rapor siswa/orang tua dan pratinjau wali kelas.
 *
 * Predikat memakai interval dari KKM mapel (pola rapor K13/Merdeka): rentang = (100 − KKM) / 3.
 *   A ≥ KKM + 2·rentang · B ≥ KKM + rentang · C ≥ KKM · D < KKM (belum tuntas).
 * Contoh KKM 75 → A ≥ 91,67 · B ≥ 83,33 · C ≥ 75 · D < 75. */

export type Predikat = "A" | "B" | "C" | "D";

export function batasPredikat(kkm: number) {
  const r = (100 - kkm) / 3;
  return { A: kkm + 2 * r, B: kkm + r, C: kkm };
}

export function predikat(nilai: number, kkm: number): Predikat {
  const b = batasPredikat(kkm);
  return nilai >= b.A ? "A" : nilai >= b.B ? "B" : nilai >= b.C ? "C" : "D";
}

const ringkas = (t: string | null | undefined, maks = 70) => {
  const s = (t ?? "").replace(/\s+/g, " ").trim().replace(/[.;,]+$/, "");
  return s.length > maks ? `${s.slice(0, maks - 1).trimEnd()}…` : s;
};

/** Kalimat capaian dari nilai akhir + materi dengan nilai tertinggi/terendah di Jurnal Mengajar (bila ada). */
export function deskripsiCapaian(o: {
  mapel: string; nilai: number; kkm: number; materiTerbaik?: string | null; materiTerendah?: string | null;
}): string {
  const p = predikat(o.nilai, o.kkm);
  const baik = ringkas(o.materiTerbaik);
  let kurang = ringkas(o.materiTerendah);
  if (kurang && kurang === baik) kurang = "";
  switch (p) {
    case "A":
      return `Sangat baik dalam menguasai kompetensi ${o.mapel}${baik ? `, menonjol pada materi ${baik}` : ""}.`;
    case "B":
      return `Baik dalam menguasai kompetensi ${o.mapel}${baik ? `, terutama materi ${baik}` : ""}`
        + `${kurang ? `; perlu pendalaman pada materi ${kurang}` : ""}.`;
    case "C":
      return `Cukup dalam menguasai kompetensi ${o.mapel} dan sudah mencapai KKM`
        + `${kurang ? `; perlu peningkatan pada materi ${kurang}` : "; perlu peningkatan pada beberapa materi"}.`;
    default:
      return `Belum mencapai KKM ${o.kkm} pada ${o.mapel}; perlu bimbingan dan remedial`
        + `${kurang ? ` terutama pada materi ${kurang}` : ""}.`;
  }
}
