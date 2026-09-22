/** KALIMAT SIKAP RAPOR — tiruan lembar "NILAI SIKAP" makro rapor sekolah (22 September 2026). Wali kelas memilih predikat
 * (SB/B/C/K) dan nomor perilaku menonjol dari daftar 10 pilihan; kalimatnya dirangkai seperti rumus makro. Tidak ada
 * pilihan → kalimat baku "siswa yang tidak menonjol". Murni — dipakai isian wali kelas (pratinjau) & cetak rapor. */

export const PILIHAN_SPIRITUAL = [
  "berdoa sebelum dan sesudah melakukan kegiatan",
  "menjalankan ibadah sesuai dengan agamanya",
  "memberi salam pada saat awal dan akhir kegiatan",
  "bersyukur atas nikmat dan karunia Tuhan Yang Maha Esa",
  "mensyukuri kemampuan manusia dalam mengendalikan diri",
  "bersyukur ketika berhasil mengerjakan sesuatu",
  "berserah diri (tawakal) kepada Tuhan setelah berikhtiar atau melakukan usaha",
  "memelihara hubungan baik dengan sesama umat",
  "bersyukur sebagai bangsa Indonesia",
  "menghormati orang lain yang menjalankan ibadah sesuai dengan agamanya",
];
export const PILIHAN_SOSIAL = [
  "jujur", "disiplin", "tanggung jawab", "santun", "percaya diri", "peduli", "toleransi", "gotong royong", "nasionalis", "demokratis",
];
export const BAKU_SPIRITUAL = "Menunjukkan sikap bersyukur, selalu memberi salam, menghormati orang yang menjalankan ibadah sesuai agamanya dengan baik.";
export const BAKU_SOSIAL = "Menunjukkan sikap jujur, disiplin, gotong royong, santun dan percaya diri dengan baik";

export const PREDIKAT_SIKAP = [
  { value: "SB", label: "Sangat Baik" }, { value: "B", label: "Baik" }, { value: "C", label: "Cukup" }, { value: "K", label: "Kurang" },
] as const;
/** Label predikat seperti rumus makro: SB→Sangat Baik, B→Baik, C→Cukup, selainnya Kurang. */
export const labelPredikatSikap = (p: string | null | undefined) =>
  !p ? "" : p === "SB" ? "Sangat Baik" : p === "B" ? "Baik" : p === "C" ? "Cukup" : "Kurang";

export const NILAI_SIKAP_DINIYAH = ["Sangat Baik", "Baik", "Cukup", "Kurang"] as const;

export interface PilihanSikap {
  spiritual?: { selalu?: number[]; mulai?: number[] };
  sosial?: { sangatBaik?: number[]; baik?: number[]; kurang?: number[]; mulai?: number[]; catatan?: string };
}
/** Batas kolom di makro: spiritual Selalu 3 & Mulai 2; sosial Sangat Baik 3, Baik 3, Kurang 2, Mulai Meningkat 2. */
export const BATAS_PILIHAN = { selalu: 3, mulai: 2, sangatBaik: 3, baik: 3, kurang: 2, mulaiSosial: 2 } as const;

const ambil = (daftar: string[], nomor: number[] | undefined, maks: number) =>
  [...new Set(nomor ?? [])].filter(n => Number.isInteger(n) && n >= 1 && n <= daftar.length).slice(0, maks).map(n => daftar[n - 1]);
const gabung = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} dan ${xs[xs.length - 1]}`);

/** Kalimat sikap spiritual (rumus Q17 makro): "Selalu A, B dan C. Sedangkan sikap D dan E mulai dilakukan". */
export function kalimatSpiritual(p: PilihanSikap["spiritual"]): string {
  const selalu = ambil(PILIHAN_SPIRITUAL, p?.selalu, BATAS_PILIHAN.selalu);
  const mulai = ambil(PILIHAN_SPIRITUAL, p?.mulai, BATAS_PILIHAN.mulai);
  if (!selalu.length && !mulai.length) return BAKU_SPIRITUAL;
  const a = selalu.length ? `Selalu ${gabung(selalu)}` : "";
  const b = mulai.length ? `${selalu.length ? ". Sedangkan sikap " : "Sikap "}${gabung(mulai)} mulai dilakukan` : "";
  return `${a}${b}.`;
}

/** Kalimat sikap sosial (rumus AD17 makro): "Selalu menunjukkan sikap A, B dengan Sangat Baik, sikap C dengan Baik, sikap
 * Kurang D, sedangkan sikap E mulai meningkat. <catatan>". Bagian "mulai meningkat" muncul bila pilihannya diisi (di makro
 * rumusnya keliru merujuk kolom Baik — di sini mengikuti maksudnya). */
export function kalimatSosial(p: PilihanSikap["sosial"]): string {
  const sb = ambil(PILIHAN_SOSIAL, p?.sangatBaik, BATAS_PILIHAN.sangatBaik);
  const b = ambil(PILIHAN_SOSIAL, p?.baik, BATAS_PILIHAN.baik);
  const k = ambil(PILIHAN_SOSIAL, p?.kurang, BATAS_PILIHAN.kurang).map(x => `Kurang ${x}`);
  const m = ambil(PILIHAN_SOSIAL, p?.mulai, BATAS_PILIHAN.mulaiSosial);
  if (!sb.length && !b.length && !k.length && !m.length) return BAKU_SOSIAL;
  const bagian: string[] = [];
  if (sb.length) bagian.push(`sikap ${gabung(sb)} dengan Sangat Baik`);
  if (b.length) bagian.push(`sikap ${gabung(b)} dengan Baik`);
  if (k.length) bagian.push(`sikap ${k.join(" dan ")}`);
  let kalimat = bagian.length ? `Selalu menunjukkan ${bagian.join(", ")}` : "";
  if (m.length) kalimat += `${kalimat ? ", sedangkan sikap " : "Sikap "}${gabung(m)} mulai meningkat`;
  const catatan = (p?.catatan ?? "").trim();
  return `${kalimat}.${catatan ? ` ${catatan}` : ""}`;
}
