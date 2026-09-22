/** RUMUS FORM NILAI RAPOR — tiruan PERSIS lembar "U1" makro rapor sekolah (Lembar Penilaian Raport KURMER SMK Al Munawwir
 * IIBS, dikulik 22 September 2026). Murni (tanpa basis data) supaya layar isian guru, rapor wali kelas, dan cetakan
 * memakai hitungan yang SAMA. Keputusan user: jangan membuat aturan baru — semua angka & kalimat di bawah berasal dari makro.
 *
 *   LM (sumatif lingkup materi) = RATA(tes, non tes) — hanya LM yang ditulis teksnya; LM kosong dihitung 0
 *   RPH  = BULAT( Σ nilai LM ÷ banyaknya LM )
 *   HPA  = BULAT( (RPH×50 + STS×20 + SAS tes×30 + SAS non tes×0) ÷ 100 )   ← bobot bawaan makro, bisa diubah per form
 *   PRE  = >89 A · >79 B · >69 C · selainnya D
 *   Formatif = "Nama menunjukkan pemahaman dalam TP-a, TP-b" (TP ber-KKTP 1 DAN Tampil 1)
 *   Sumatif  = "Nama Memiliki kemampuan <tingkat> dalam <LM tertinggi>, <tingkat> kemampuan dalam <LM terendah>"
 *              (LM dibandingkan dari nilai TES + 0,01×urutan — pemecah seri makro; tingkat: >89 sangat baik · >79 baik ·
 *              >69 cukup · selainnya perlu bimbingan)
 *   Katrol (FORM KATROL sekolah): KKM + ⌈nilai⌉ × (100 − KKM) ÷ 100 — dipakai untuk LM & SAS; STS SELALU nilai asli. */

export interface ItemTeks { kode: string; teks: string }
export interface BobotRapor { rph: number; sts: number; sasTes: number; sasNonTes: number }
export const BOBOT_BAWAAN: BobotRapor = { rph: 50, sts: 20, sasTes: 30, sasNonTes: 0 };
export const MAKS_TP = 10;
export const MAKS_LM = 10;

export type Angka = number | null | undefined;
export interface NilaiSiswaForm {
  /** TP: kktp 1 = memenuhi KKTP, tampil 1 = ditampilkan di deskripsi. */
  tp?: Record<string, { kktp?: Angka; tampil?: Angka }>;
  lm?: Record<string, { tes?: Angka; nonTes?: Angka }>;
  sts?: Angka; sasTes?: Angka; sasNonTes?: Angka;
  /** Mapel DINIYAH (lembar D1): Pengetahuan (درجة المعرفة) & Penerapan (درجة التطبيق). */
  pengetahuan?: Angka; penerapan?: Angka;
}
export interface PengaturanForm { jenis: string; tp: ItemTeks[]; lm: ItemTeks[]; bobot: BobotRapor; kkm: number; katrol: boolean }

export type PredikatMakro = "A" | "B" | "C" | "D";
export const predikatMakro = (n: number): PredikatMakro => (n > 89 ? "A" : n > 79 ? "B" : n > 69 ? "C" : "D");
export const tingkatMakro = (n: number) => (n > 89 ? "sangat baik" : n > 79 ? "baik" : n > 69 ? "cukup" : "perlu bimbingan");

const ada = (v: Angka): v is number => typeof v === "number" && Number.isFinite(v);
/** BULAT ala Excel ROUND(x,0) — setengah menjauhi nol. */
export const bulat = (x: number) => Math.sign(x) * Math.round(Math.abs(x) + 1e-9);
const dua = (x: number) => Math.round(x * 100) / 100;

/** Nilai katrol (FORM KATROL sekolah): tabel "JIKA ≥ x MAKA y" dengan XLOOKUP mode 1 (sama atau lebih besar berikutnya). */
export function katrol(x: Angka, kkm: number): number | null {
  if (!ada(x)) return null;
  const t = Math.min(100, Math.max(1, Math.ceil(Math.round(x * 1000) / 1000)));
  return dua(kkm + (t * (100 - kkm)) / 100);
}

/** Kapital tiap kata (padanan PROPER Excel; huruf setelah tanda petik tetap kecil supaya nama seperti Syari'ah rapi). */
export function kapitalNama(nama: string): string {
  return nama.toLowerCase().replace(/(^|[\s\-.(/])([\p{L}])/gu, (_, a: string, b: string) => a + b.toUpperCase());
}

export interface HasilSiswa {
  lm: (number | null)[];          // rata LM per slot (urutan form); null = kosong
  rph: number | null;
  hpa: number | null;              // nilai rapor (sudah memakai nilai katrol bila form dikatrol)
  hpaAsli: number | null;          // tanpa katrol — pembanding di Form Katrol
  predikat: PredikatMakro | null;
  deskFormatif: string;
  deskSumatif: string;
  /** Rapor Tengah Semester: LM-1..5, TP-1..5 (KKTP), HPTS (= STS asli). */
  tsLm: (number | null)[]; tsTp: (number | null)[]; hpts: number | null;
}

const efektif = (v: Angka, f: PengaturanForm) => (ada(v) ? (f.katrol ? katrol(v, f.kkm) : v) : null);

function hitungInti(f: PengaturanForm, v: NilaiSiswaForm, pakaiKatrol: boolean) {
  const cfg = { ...f, katrol: pakaiKatrol && f.katrol };
  const lmAktif = f.lm.map(l => !!l.teks.trim());
  const lm = f.lm.map((l, i) => {
    if (!lmAktif[i]) return null;
    const x = v.lm?.[l.kode] ?? {};
    const isi = [efektif(x.tes, cfg), efektif(x.nonTes, cfg)].filter((n): n is number => n !== null);
    return isi.length ? isi.reduce((a, b) => a + b, 0) / isi.length : null;
  });
  const jumlahLm = lmAktif.filter(Boolean).length;
  const rph = jumlahLm ? bulat(lm.reduce<number>((a, n) => a + (n ?? 0), 0) / jumlahLm) : null;
  const w = f.bobot;
  const totalBobot = w.rph + w.sts + w.sasTes + w.sasNonTes;
  const sasTes = efektif(v.sasTes, cfg) ?? 0, sasNon = efektif(v.sasNonTes, cfg) ?? 0;
  const sts = ada(v.sts) ? v.sts : 0; // STS SELALU nilai asli (keputusan user 22 Sep 2026)
  const hpa = rph === null || !totalBobot ? null : bulat((rph * w.rph + sts * w.sts + sasTes * w.sasTes + sasNon * w.sasNonTes) / totalBobot);
  return { lm, rph, hpa, cfg };
}

export function hitungSiswa(f: PengaturanForm, v: NilaiSiswaForm, namaSiswa: string): HasilSiswa {
  const nama = kapitalNama(namaSiswa);
  const inti = hitungInti(f, v, true);
  const asli = f.katrol ? hitungInti(f, v, false).hpa : inti.hpa;

  // Formatif: TP dengan KKTP 1 DAN Tampil 1, sesuai urutan TP.
  const adaIsianTp = Object.values(v.tp ?? {}).some(t => ada(t.kktp) || ada(t.tampil));
  const tpLolos = f.tp.filter(t => t.teks.trim() && v.tp?.[t.kode]?.kktp === 1 && v.tp?.[t.kode]?.tampil === 1).map(t => t.teks.trim());
  const deskFormatif = adaIsianTp && tpLolos.length ? `${nama} menunjukkan pemahaman dalam ${tpLolos.join(", ")}.` : "";

  // Sumatif: LM dibandingkan dari nilai TES (+0,01 × urutan) — LM tertinggi & terendah.
  const kandidat = f.lm
    .map((l, i) => ({ teks: l.teks.trim(), skor: efektif(v.lm?.[l.kode]?.tes, inti.cfg), i }))
    .filter((x): x is { teks: string; skor: number; i: number } => !!x.teks && x.skor !== null)
    .map(x => ({ ...x, skor: x.skor + 0.01 * (x.i + 1) }));
  let deskSumatif = "";
  if (kandidat.length) {
    const maks = kandidat.reduce((a, b) => (b.skor > a.skor ? b : a));
    const min = kandidat.reduce((a, b) => (b.skor < a.skor ? b : a));
    const tMaks = tingkatMakro(maks.skor), tMin = tingkatMakro(min.skor);
    deskSumatif = maks.i === min.i
      ? `${nama} Memiliki kemampuan ${tMaks} dalam ${maks.teks}.`
      : tMaks === tMin
        ? `${nama} Memiliki kemampuan ${tMaks} dalam ${maks.teks} dan ${min.teks}.`
        : `${nama} Memiliki kemampuan ${tMaks} dalam ${maks.teks}, ${tMin} kemampuan dalam ${min.teks}.`;
  }

  return {
    lm: inti.lm.map(n => (n === null ? null : dua(n))), rph: inti.rph, hpa: inti.hpa, hpaAsli: asli,
    predikat: inti.hpa === null ? null : predikatMakro(inti.hpa),
    deskFormatif, deskSumatif,
    // Rapor Tengah Semester memakai nilai ASLI (keputusan user 22 Sep 2026: "kalau STS itu nilai asli").
    tsLm: f.lm.slice(0, 5).map(l => {
      if (!l.teks.trim()) return null;
      const x = v.lm?.[l.kode] ?? {};
      const isi = [x.tes, x.nonTes].filter(ada);
      return isi.length ? dua(isi.reduce((a, b) => a + b, 0) / isi.length) : null;
    }),
    tsTp: f.tp.slice(0, 5).map(t => (t.teks.trim() ? (ada(v.tp?.[t.kode]?.kktp) ? Number(v.tp?.[t.kode]?.kktp) : null) : null)),
    hpts: ada(v.sts) ? v.sts : null,
  };
}

/* ------------------------------------------------------------------ DINIYAH (lembar D1 & RAPORT D) */

/** Catatan otomatis menurut peringkat (tabel di lembar RAPORT D makro). */
const CATATAN_PERINGKAT: [number, number, string][] = [
  [1, 3, "Prestasinya sangat baik, perlu dipertahankan"],
  [4, 10, "Prestasi baik, perlu dipertahankan dan ditingkatkan"],
  [11, 15, "Prestasi cukup, perlu ditingkatkan belajar dan berdoa."],
  [16, 20, "Perlu ditingkatkan belajarnya, jangan lupa berdoa"],
  [21, 25, "Perlu dimaksimalkan belajarnya, usaha keras dan berdoa"],
  [26, 30, "Perlu usaha keras, maksimalkan belajarnya, lebih giat berdoa dan beribadah."],
];
export function catatanPeringkat(rank: number | null): string {
  if (!rank) return "";
  return (CATATAN_PERINGKAT.find(([a, b]) => rank >= a && rank <= b) ?? CATATAN_PERINGKAT[CATATAN_PERINGKAT.length - 1])[2];
}

/** RANK Excel (menurun, nilai sama = peringkat sama); jumlah 0/kosong tidak diberi peringkat. */
export function peringkat(jumlah: Map<string, number | null>): Map<string, number | null> {
  const nilai = [...jumlah.values()].filter((n): n is number => ada(n) && n !== 0);
  const hasil = new Map<string, number | null>();
  for (const [id, n] of jumlah) hasil.set(id, ada(n) && n !== 0 ? 1 + nilai.filter(x => x > n).length : null);
  return hasil;
}

/** Nilai kosong sebagai pengaturan form baru. */
export function formKosong(jenis: "UMUM" | "DINIYAH", kkm: number): PengaturanForm {
  return {
    jenis, kkm, katrol: false, bobot: { ...BOBOT_BAWAAN },
    tp: Array.from({ length: MAKS_TP }, (_, i) => ({ kode: `TP-${i + 1}`, teks: "" })),
    lm: Array.from({ length: MAKS_LM }, (_, i) => ({ kode: `LM-${i + 1}`, teks: "" })),
  };
}

/** Kerapian data masuk dari layar (angka 0–100, TP 0/1, teks dipotong). */
export function rapikanNilai(x: unknown, maks = 100): number | null {
  if (x === "" || x === null || x === undefined) return null;
  const n = Number(String(x).replace(",", "."));
  return Number.isFinite(n) ? Math.min(maks, Math.max(0, dua(n))) : null;
}

/* ===================== RIWAYAT PERUBAHAN OLEH WALI KELAS (22 September 2026) =====================
 * Wali kelas boleh mengedit form yang sudah DIKIRIM guru mapel (permintaan user). Setiap sel yang berubah dicatat
 * (label, nilai lama → baru) supaya guru mapel melihat apa yang diubah. Simpan otomatis beruntun oleh orang yang sama
 * dalam 30 menit digabung menjadi satu entri (nilai "dari" tetap yang pertama, "ke" yang terakhir). */
export interface PerubahanSel { label: string; dari: string | number | null; ke: string | number | null }
export interface EntriRiwayatWali { oleh: string; pada: string; ubah: Record<string, PerubahanSel> }

const nilaiSel = (x: unknown): string | number | null => (x === undefined || x === null || x === "" ? null : (x as string | number));

/** Sel yang berbeda antara dua isi form. `namaSiswa` untuk label yang terbaca ("Ahmad — LM-2 Tes"). */
export function bedaForm(
  lama: { pengaturan: PengaturanForm; nilai: Record<string, NilaiSiswaForm> },
  baru: { pengaturan: PengaturanForm; nilai: Record<string, NilaiSiswaForm> },
  namaSiswa: Map<string, string>,
): Record<string, PerubahanSel> {
  const hasil: Record<string, PerubahanSel> = {};
  const catat = (k: string, label: string, a: unknown, b: unknown) => {
    const x = nilaiSel(a), y = nilaiSel(b);
    if (x !== y) hasil[k] = { label, dari: x, ke: y };
  };
  const pl = lama.pengaturan, pb = baru.pengaturan;
  catat("atur|kkm", "KKM", pl.kkm, pb.kkm);
  catat("atur|katrol", "Katrol", pl.katrol ? "ya" : "tidak", pb.katrol ? "ya" : "tidak");
  (["rph", "sts", "sasTes", "sasNonTes"] as const).forEach(k => catat(`atur|bobot|${k}`, `Bobot ${k === "rph" ? "RPH" : k === "sts" ? "STS" : k === "sasTes" ? "SAS Tes" : "SAS Non Tes"}`, pl.bobot[k], pb.bobot[k]));
  pb.tp.forEach((t, i) => catat(`atur|${t.kode}`, `Teks ${t.kode}`, pl.tp[i]?.teks ?? "", t.teks));
  pb.lm.forEach((t, i) => catat(`atur|${t.kode}`, `Teks ${t.kode}`, pl.lm[i]?.teks ?? "", t.teks));
  const ids = new Set([...Object.keys(lama.nilai), ...Object.keys(baru.nilai)]);
  for (const id of ids) {
    const a = lama.nilai[id] ?? {}, b = baru.nilai[id] ?? {}, n = namaSiswa.get(id) ?? "Siswa";
    for (const t of pb.tp) {
      catat(`${id}|${t.kode}|kktp`, `${n} — ${t.kode} KKTP`, a.tp?.[t.kode]?.kktp, b.tp?.[t.kode]?.kktp);
      catat(`${id}|${t.kode}|tampil`, `${n} — ${t.kode} Tampil`, a.tp?.[t.kode]?.tampil, b.tp?.[t.kode]?.tampil);
    }
    for (const l of pb.lm) {
      catat(`${id}|${l.kode}|tes`, `${n} — ${l.kode} Tes`, a.lm?.[l.kode]?.tes, b.lm?.[l.kode]?.tes);
      catat(`${id}|${l.kode}|nonTes`, `${n} — ${l.kode} Non Tes`, a.lm?.[l.kode]?.nonTes, b.lm?.[l.kode]?.nonTes);
    }
    ([["sts", "STS"], ["sasTes", "SAS Tes"], ["sasNonTes", "SAS Non Tes"], ["pengetahuan", "Pengetahuan"], ["penerapan", "Penerapan"]] as const)
      .forEach(([k, l]) => catat(`${id}|${k}`, `${n} — ${l}`, a[k], b[k]));
  }
  return hasil;
}

/** Tambahkan perubahan ke riwayat (maks 30 entri, terbaru di akhir). Entri terakhir oleh orang yang sama < 30 menit digabung;
 * sel yang kembali ke nilai awalnya dihapus dari entri. */
export function tambahRiwayat(riwayat: EntriRiwayatWali[], oleh: string, ubah: Record<string, PerubahanSel>, kini = new Date()): EntriRiwayatWali[] {
  if (!Object.keys(ubah).length) return riwayat;
  const daftar = [...riwayat];
  const akhir = daftar[daftar.length - 1];
  if (akhir && akhir.oleh === oleh && kini.getTime() - new Date(akhir.pada).getTime() < 30 * 60_000) {
    const gabung = { ...akhir.ubah };
    for (const [k, v] of Object.entries(ubah)) {
      const awal = gabung[k] ? gabung[k].dari : v.dari;
      if (awal === v.ke) delete gabung[k]; else gabung[k] = { label: v.label, dari: awal, ke: v.ke };
    }
    daftar[daftar.length - 1] = { oleh, pada: kini.toISOString(), ubah: gabung };
    if (!Object.keys(gabung).length) daftar.pop();
  } else {
    daftar.push({ oleh, pada: kini.toISOString(), ubah });
  }
  return daftar.slice(-30);
}

/* ===================== MAPEL GABUNGAN — DPK 1–4 / KK 1–4 (22 September 2026) =====================
 * Keputusan user: "Gabung LM & TP" — meniru lembar K5 makro yang memuat seluruh LM & TP Konsentrasi Keahlian dalam SATU mapel.
 * Setiap bagian tetap diisi & dikirim guru pengampunya; di sini form-form bagian (yang sudah DIKIRIM) dirangkai:
 *   - LM & TP semua bagian menjadi LM/TP satu mapel, berurutan per bagian (kode diberi ulang LM-1, LM-2, …);
 *   - nilai LM & SAS dipakai SETELAH katrol bagiannya masing-masing (katrol = keputusan tiap guru atas formnya), sehingga
 *     form gabungan sendiri tidak dikatrol lagi; `nilaiAsli` menyimpan versi tanpa katrol (Rapor Tengah Semester, pembanding);
 *   - STS, SAS Tes, SAS Non Tes gabungan = rata-rata bagian yang terisi;
 *   - bobot = bobot bagian pertama (lazimnya seragam 50/20/30/0); KKM = rata-rata KKM bagian, dibulatkan. */
export interface FormBagian { pengaturan: PengaturanForm; nilai: Record<string, NilaiSiswaForm> }
export interface FormGabungan { pengaturan: PengaturanForm; nilai: Record<string, NilaiSiswaForm>; nilaiAsli: Record<string, NilaiSiswaForm> }

const rataAda = (xs: Angka[]) => { const a = xs.filter(ada); return a.length ? dua(a.reduce((p, c) => p + c, 0) / a.length) : null; };

export function gabungForm(bagian: FormBagian[]): FormGabungan {
  const lm: ItemTeks[] = [], tp: ItemTeks[] = [];
  const petaLm: Map<string, string>[] = [], petaTp: Map<string, string>[] = [];
  bagian.forEach(b => {
    const pl = new Map<string, string>(), pt = new Map<string, string>();
    for (const l of b.pengaturan.lm) if (l.teks.trim()) { const k = `LM-${lm.length + 1}`; lm.push({ kode: k, teks: l.teks.trim() }); pl.set(l.kode, k); }
    for (const t of b.pengaturan.tp) if (t.teks.trim()) { const k = `TP-${tp.length + 1}`; tp.push({ kode: k, teks: t.teks.trim() }); pt.set(t.kode, k); }
    petaLm.push(pl); petaTp.push(pt);
  });
  const ids = new Set(bagian.flatMap(b => Object.keys(b.nilai)));
  const nilai: Record<string, NilaiSiswaForm> = {}, nilaiAsli: Record<string, NilaiSiswaForm> = {};
  for (const id of ids) {
    const e: NilaiSiswaForm = { lm: {}, tp: {} }, a: NilaiSiswaForm = { lm: {}, tp: {} };
    const sts: Angka[] = [], sasT: Angka[] = [], sasN: Angka[] = [], sasTAsli: Angka[] = [], sasNAsli: Angka[] = [];
    bagian.forEach((b, i) => {
      const v = b.nilai[id];
      if (!v) return;
      for (const [lama, baru] of petaLm[i]) {
        const x = v.lm?.[lama];
        if (!x) continue;
        e.lm![baru] = { tes: efektif(x.tes, b.pengaturan), nonTes: efektif(x.nonTes, b.pengaturan) };
        a.lm![baru] = { tes: ada(x.tes) ? x.tes : null, nonTes: ada(x.nonTes) ? x.nonTes : null };
      }
      for (const [lama, baru] of petaTp[i]) {
        const x = v.tp?.[lama];
        if (x) { e.tp![baru] = { ...x }; a.tp![baru] = { ...x }; }
      }
      sts.push(v.sts); sasT.push(efektif(v.sasTes, b.pengaturan)); sasN.push(efektif(v.sasNonTes, b.pengaturan));
      sasTAsli.push(v.sasTes); sasNAsli.push(v.sasNonTes);
    });
    e.sts = a.sts = rataAda(sts);
    e.sasTes = rataAda(sasT); e.sasNonTes = rataAda(sasN);
    a.sasTes = rataAda(sasTAsli); a.sasNonTes = rataAda(sasNAsli);
    nilai[id] = e; nilaiAsli[id] = a;
  }
  const kkm = bagian.length ? bulat(bagian.reduce((p, b) => p + b.pengaturan.kkm, 0) / bagian.length) : 75;
  return {
    pengaturan: { jenis: "UMUM", tp, lm, bobot: bagian[0]?.pengaturan.bobot ?? { ...BOBOT_BAWAAN }, kkm, katrol: false },
    nilai, nilaiAsli,
  };
}

/** Hasil satu siswa untuk mapel gabungan: nilai rapor dari nilai efektif (katrol per bagian), Rapor Tengah Semester &
 * pembanding dari nilai asli. */
export function hitungSiswaGabungan(g: FormGabungan, siswaId: string, namaSiswa: string): HasilSiswa {
  const h = hitungSiswa(g.pengaturan, g.nilai[siswaId] ?? {}, namaSiswa);
  const asli = hitungSiswa(g.pengaturan, g.nilaiAsli[siswaId] ?? {}, namaSiswa);
  return { ...h, hpaAsli: asli.hpa, tsLm: asli.tsLm, tsTp: asli.tsTp, hpts: asli.hpts };
}
