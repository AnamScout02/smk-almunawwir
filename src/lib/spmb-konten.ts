import type React from "react";

/** Isi halaman SPMB publik — SENGAJA netral (bukan `server-only`): dipakai halaman server yang
 *  merender dan penyunting klien di portal /pusat-spmb, supaya bentuk datanya tidak pernah beda. */

export const KUNCI_KONTEN_SPMB = [
  "spmb.tahun", "spmb.judul", "spmb.subjudul", "spmb.deskripsi", "spmb.tema",
  "spmb.poster", "spmb.posterLain", "spmb.fotoPromosi", "spmb.judulGaleri",
  "spmb.posterRasio", "spmb.posterIsi", "spmb.fotoRasio", "spmb.fotoIsi", "spmb.galeriLain",
  "spmb.logoMitra", "spmb.judulLogo", "spmb.sebelumSesudah", "spmb.brosur", "spmb.video",
  "spmb.kontakNama", "spmb.kontakWa", "spmb.biaya", "spmb.pengumumanTanggal", "spmb.hasilDibuka",
  "spmb.alur", "spmb.syarat", "spmb.beasiswa", "spmb.tanyaJawab",
  "spmb.jalur", "spmb.jadwal", "spmb.rincianBiaya", "spmb.catatan", "spmb.tautanGrup",
  "spmb.bobotPrestasi",
] as const;

/** Bentuk bingkai poster & foto promosi — DIPILIH panitia (permintaan user 2 Oktober 2026: "ada
 *  penyesuaian mau potret atau lanskap … ukuran berapa x berapa ada pilihan"). `r` = lebar ÷ tinggi;
 *  "auto" = ikuti ukuran asli gambar. Satu daftar untuk penyunting & halaman publik. */
export const RASIO_GAMBAR = [
  { nilai: "auto", label: "Otomatis — ikuti ukuran gambar", r: 0 },
  { nilai: "9:16", label: "Potret 9 × 16 (story Instagram/WA)", r: 9 / 16 },
  { nilai: "2:3", label: "Potret 2 × 3", r: 2 / 3 },
  { nilai: "a4", label: "Potret A4 / A3 (1 × 1,41)", r: 1 / 1.414 },
  { nilai: "3:4", label: "Potret 3 × 4", r: 3 / 4 },
  { nilai: "4:5", label: "Potret 4 × 5 (feed Instagram)", r: 4 / 5 },
  { nilai: "1:1", label: "Persegi 1 × 1", r: 1 },
  { nilai: "4:3", label: "Lanskap 4 × 3", r: 4 / 3 },
  { nilai: "3:2", label: "Lanskap 3 × 2 (foto kamera)", r: 3 / 2 },
  { nilai: "16:9", label: "Lanskap 16 × 9 (layar lebar)", r: 16 / 9 },
] as const;

/** Cara gambar mengisi bingkai. "utuh" tidak pernah memotong (sisa ruang = salinan buram);
 *  "penuh" memenuhi bingkai dan memotong bagian yang tidak muat. */
export const ISI_GAMBAR = [
  { nilai: "utuh", label: "Utuh — tidak dipotong" },
  { nilai: "penuh", label: "Penuhi bingkai — tepi bisa terpotong" },
] as const;
export type IsiGambar = (typeof ISI_GAMBAR)[number]["nilai"];

/** Galeri foto TAMBAHAN (permintaan user 2 Okt 2026: "bisa buat judul lagi dan foto lagi yang lain").
 *  Galeri pertama tetap memakai kunci lama (`spmb.fotoPromosi` + `judulGaleri` + `fotoRasio/Isi`)
 *  supaya foto yang sudah diunggah tidak hilang; yang berikutnya disimpan sebagai daftar di
 *  `spmb.galeriLain`. `rasio` di sini NILAI SETELAN ("4:3", "auto", …), bukan angka. */
export type GaleriSpmb = { judul: string; foto: string[]; rasio: string; isi: IsiGambar };
export function rapikanGaleri(x: unknown): GaleriSpmb | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  const foto = Array.isArray(o.foto) ? o.foto.filter((f): f is string => typeof f === "string" && !!f.trim()) : [];
  return {
    judul: typeof o.judul === "string" ? o.judul.trim().slice(0, 60) : "",
    foto,
    rasio: RASIO_GAMBAR.some(r => r.nilai === o.rasio) ? (o.rasio as string) : "4:3",
    isi: o.isi === "penuh" ? "penuh" : "utuh",
  };
}

/** Logo mitra industri / kampus alumni untuk deret logo bergulir (2 Okt 2026). */
export type LogoMitra = { nama: string; logo: string };
export function rapikanLogo(x: unknown): LogoMitra | null {
  const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
  const logo = typeof o.logo === "string" ? o.logo.trim() : "";
  return logo ? { nama: typeof o.nama === "string" ? o.nama.trim().slice(0, 80) : "", logo } : null;
}
/** Pasangan foto sebelum/sesudah (karya siswa, renovasi) untuk penggeser pembanding. */
export type SebelumSesudah = { judul: string; ket: string; sebelum: string; sesudah: string; labelA: string; labelB: string };
export function rapikanBanding(x: unknown): SebelumSesudah | null {
  const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
  const t = (k: string, maks = 120) => (typeof o[k] === "string" ? (o[k] as string).trim().slice(0, maks) : "");
  return {
    judul: t("judul"), ket: t("ket", 300), sebelum: t("sebelum", 300), sesudah: t("sesudah", 300),
    labelA: t("labelA", 30) || "Sebelum", labelB: t("labelB", 30) || "Sesudah",
  };
}

/** Nilai setelan → lebar÷tinggi, atau null bila "auto"/tidak dikenal. */
export function rasioGambar(nilai: string | undefined): number | null {
  const r = RASIO_GAMBAR.find(x => x.nilai === nilai)?.r;
  return r ? r : null;
}
const isiGambar = (x: string | undefined): IsiGambar => (x === "penuh" ? "penuh" : "utuh");

/** Langkah alur / beasiswa. `gambar` OPSIONAL — alur boleh bergambar bila panitia merasa perlu
 *  (permintaan user 1 Oktober 2026), dan tetap rapi kalau dibiarkan kosong. */
/** Isian formulir SPMB yang bisa dijadikan wajib / opsional / disembunyikan. Dipindah dari Konten
 *  Halaman ke Pusat SPMB (1 Oktober 2026) — pengaturan SPMB tidak boleh terpecah dua tempat. */
/** ISIAN DATA formulir — bukan dokumen. Diatur di Pengaturan SPMB → tab "Isian Formulir". */
export const ISIAN_DATA_SPMB = [
  { kunci: "form.require_nik", label: "NIK (Nomor Induk Keluarga)", ket: "16 angka pada Kartu Keluarga" },
  { kunci: "form.require_nisn", label: "NISN", ket: "10 angka dari sekolah asal" },
  { kunci: "form.require_address", label: "Alamat Lengkap", ket: "Dusun, RT/RW, desa, kecamatan, kabupaten" },
  { kunci: "form.require_guardian", label: "Nama Orang Tua / Wali", ket: "" },
] as const;

/** DOKUMEN BAKU — lima slot unggahan yang punya kolom sendiri di baris pendaftar
 *  (`ijazahUrl`, `kkUrl`, `ktpWaliUrl`, `fotoUrl`, `dokumenLainUrl`), jadi tidak bisa dihapus
 *  seperti dokumen tambahan. Sampai 2 Oktober 2026 kelimanya tampil di tab "Isian Formulir"
 *  SEKALIGUS tab "Dokumen Syarat" mengurus dokumen juga — dua tempat untuk satu urusan
 *  (temuan user: "dokumen syarat dan isian formulir kok sama-sama ada dokumen?").
 *  Sekarang SELURUH dokumen ada di tab Dokumen Syarat. */
export const DOKUMEN_BAKU_SPMB = [
  { kunci: "form.require_ijazah", label: "Ijazah / SKL SMP/MTs", ket: "Boleh surat keterangan lulus bila ijazah belum terbit" },
  { kunci: "form.require_kk", label: "Kartu Keluarga (KK)", ket: "" },
  { kunci: "form.require_ktp_wali", label: "KTP Orang Tua / Wali", ket: "" },
  { kunci: "form.require_foto", label: "Pas Foto (3×4)", ket: "Dipakai juga di cetakan formulir pendaftaran" },
  { kunci: "form.require_dokumen_lain", label: "Dokumen Lain", ket: "Sertifikat, piagam, dan sejenisnya" },
] as const;

export const ISIAN_FORM_SPMB = [...ISIAN_DATA_SPMB, ...DOKUMEN_BAKU_SPMB];
export const KUNCI_FORM_SPMB = ISIAN_FORM_SPMB.map(x => x.kunci);

export type Langkah = { judul: string; isi: string; gambar?: string };
export type Tanya = { tanya: string; jawab: string };
export type Jalur = { kode: string; nama: string; keterangan?: string };
export type AgendaSpmb = { label: string; tanggal: string };
export type BarisBiaya = { nama: string; jumlah: number };
export type BobotPrestasi = Record<string, Record<string, number>>;

export const TINGKAT_PRESTASI = ["KABUPATEN", "PROVINSI", "NASIONAL", "INTERNASIONAL"] as const;
export const LABEL_TINGKAT: Record<string, string> = {
  KABUPATEN: "Kabupaten / Kota", PROVINSI: "Provinsi", NASIONAL: "Nasional", INTERNASIONAL: "Internasional",
};
export const PERINGKAT_PRESTASI = ["1", "2", "3"] as const;

/** Tampilan halaman SPMB publik — dipilih panitia di Pengaturan, bukan tertulis mati.
 *  SEMUA warna teks halaman diambil dari sini (`teks`/`lembut`/`samar`), bukan `text-white` lepas —
 *  itulah yang memungkinkan tema TERANG ada berdampingan dengan tema gelap tanpa halaman rusak
 *  (sebelum 2 Oktober 2026 ada 18 `text-white` tertulis mati, jadi tema terang mustahil). */
export const TEMA_SPMB = {
  malam: {
    label: "Malam — navy keemasan",
    latar: "from-[#0A1030] via-[#0F1A45] to-[#1B2B6B]",
    aksen: "text-gold", aksenBg: "bg-gold", aksenTeks: "text-primary-900",
    cincin: "ring-gold/30", kaca: "bg-white/10 border-white/15",
    teks: "text-white", lembut: "text-white/70", samar: "text-white/60",
    kacaIsi: "bg-white/15", kacaHover: "hover:bg-white/15", polaInvert: true,
    /* Warna untuk BAGIAN TERANG halaman (judul, ikon, latar seksi, tombol) & Footer —
       dipasang sebagai variabel CSS di pembungkus halaman, lihat `gayaTema`. */
    cssUtama: "#0F1A45", cssAksen: "#E8A020", cssAksenTeks: "#0F1A45",
    cssTipis: "#CBD1E9", cssLembut: "#F8F7F2", cssFooter: "linear-gradient(135deg, #0A1030 0%, #0F1A45 40%, #1B2B6B 100%)",
  },
  fajar: {
    label: "Fajar — navy ke ungu",
    latar: "from-[#0F1A45] via-[#2E3F8F] to-[#6D28D9]",
    aksen: "text-amber-300", aksenBg: "bg-amber-300", aksenTeks: "text-primary-900",
    cincin: "ring-amber-300/30", kaca: "bg-white/10 border-white/15",
    teks: "text-white", lembut: "text-white/70", samar: "text-white/60",
    kacaIsi: "bg-white/15", kacaHover: "hover:bg-white/15", polaInvert: true,
    /* Warna untuk BAGIAN TERANG halaman (judul, ikon, latar seksi, tombol) & Footer —
       dipasang sebagai variabel CSS di pembungkus halaman, lihat `gayaTema`. */
    cssUtama: "#4C1D95", cssAksen: "#FCD34D", cssAksenTeks: "#3B0764",
    cssTipis: "#DDD6FE", cssLembut: "#F5F3FF", cssFooter: "linear-gradient(135deg, #0F1A45 0%, #2E3F8F 45%, #6D28D9 100%)",
  },
  zamrud: {
    label: "Zamrud — hijau pesantren",
    latar: "from-[#052e2b] via-[#065f46] to-[#0F1A45]",
    aksen: "text-emerald-300", aksenBg: "bg-emerald-300", aksenTeks: "text-[#052e2b]",
    cincin: "ring-emerald-300/30", kaca: "bg-white/10 border-white/15",
    teks: "text-white", lembut: "text-white/70", samar: "text-white/60",
    kacaIsi: "bg-white/15", kacaHover: "hover:bg-white/15", polaInvert: true,
    /* Warna untuk BAGIAN TERANG halaman (judul, ikon, latar seksi, tombol) & Footer —
       dipasang sebagai variabel CSS di pembungkus halaman, lihat `gayaTema`. */
    cssUtama: "#065F46", cssAksen: "#34D399", cssAksenTeks: "#052E2B",
    cssTipis: "#A7F3D0", cssLembut: "#ECFDF5", cssFooter: "linear-gradient(135deg, #052e2b 0%, #065f46 45%, #0F1A45 100%)",
  },
  senja: {
    label: "Senja — jingga ke maroon",
    latar: "from-[#431407] via-[#9a3412] to-[#7f1d1d]",
    aksen: "text-amber-200", aksenBg: "bg-amber-300", aksenTeks: "text-[#431407]",
    cincin: "ring-amber-200/30", kaca: "bg-white/10 border-white/15",
    teks: "text-white", lembut: "text-white/75", samar: "text-white/60",
    kacaIsi: "bg-white/15", kacaHover: "hover:bg-white/15", polaInvert: true,
    /* Warna untuk BAGIAN TERANG halaman (judul, ikon, latar seksi, tombol) & Footer —
       dipasang sebagai variabel CSS di pembungkus halaman, lihat `gayaTema`. */
    cssUtama: "#7F1D1D", cssAksen: "#FBBF24", cssAksenTeks: "#431407",
    cssTipis: "#FED7AA", cssLembut: "#FFF7ED", cssFooter: "linear-gradient(135deg, #431407 0%, #9a3412 45%, #7f1d1d 100%)",
  },
  samudra: {
    label: "Samudra — biru laut ke toska",
    latar: "from-[#082f49] via-[#0e7490] to-[#115e59]",
    aksen: "text-cyan-200", aksenBg: "bg-cyan-300", aksenTeks: "text-[#082f49]",
    cincin: "ring-cyan-200/30", kaca: "bg-white/10 border-white/15",
    teks: "text-white", lembut: "text-white/75", samar: "text-white/60",
    kacaIsi: "bg-white/15", kacaHover: "hover:bg-white/15", polaInvert: true,
    /* Warna untuk BAGIAN TERANG halaman (judul, ikon, latar seksi, tombol) & Footer —
       dipasang sebagai variabel CSS di pembungkus halaman, lihat `gayaTema`. */
    cssUtama: "#0E7490", cssAksen: "#67E8F9", cssAksenTeks: "#082F49",
    cssTipis: "#A5F3FC", cssLembut: "#ECFEFF", cssFooter: "linear-gradient(135deg, #082f49 0%, #0e7490 45%, #115e59 100%)",
  },
  batik: {
    label: "Batik — cokelat tua keemasan",
    latar: "from-[#1c1917] via-[#44403c] to-[#78350f]",
    aksen: "text-gold-light", aksenBg: "bg-gold", aksenTeks: "text-[#1c1917]",
    cincin: "ring-gold/30", kaca: "bg-white/10 border-white/15",
    teks: "text-white", lembut: "text-white/75", samar: "text-white/60",
    kacaIsi: "bg-white/15", kacaHover: "hover:bg-white/15", polaInvert: true,
    /* Warna untuk BAGIAN TERANG halaman (judul, ikon, latar seksi, tombol) & Footer —
       dipasang sebagai variabel CSS di pembungkus halaman, lihat `gayaTema`. */
    cssUtama: "#78350F", cssAksen: "#F5C842", cssAksenTeks: "#1C1917",
    cssTipis: "#FDE68A", cssLembut: "#FFFBEB", cssFooter: "linear-gradient(135deg, #1c1917 0%, #44403c 45%, #78350f 100%)",
  },
  /** Satu-satunya tema TERANG. Teksnya navy di atas krem, jadi kelas kacanya pun berbeda —
   *  `bg-white/10` di atas latar terang tidak terlihat sama sekali. */
  terang: {
    label: "Terang — krem bersih (teks navy)",
    latar: "from-[#FFFDF7] via-[#F8F7F2] to-[#EEF0F8]",
    aksen: "text-gold-dark", aksenBg: "bg-primary-900", aksenTeks: "text-white",
    cincin: "ring-primary-100", kaca: "bg-white border-gray-200 shadow-sm",
    teks: "text-primary-900", lembut: "text-gray-600", samar: "text-gray-500",
    kacaIsi: "bg-primary-50", kacaHover: "hover:bg-primary-50", polaInvert: false,
    /* Warna untuk BAGIAN TERANG halaman (judul, ikon, latar seksi, tombol) & Footer —
       dipasang sebagai variabel CSS di pembungkus halaman, lihat `gayaTema`. */
    cssUtama: "#0F1A45", cssAksen: "#B87D0E", cssAksenTeks: "#FFFFFF",
    cssTipis: "#CBD1E9", cssLembut: "#F8F7F2", cssFooter: "linear-gradient(135deg, #0A1030 0%, #0F1A45 40%, #1B2B6B 100%)",
  },
} as const;
export type NamaTema = keyof typeof TEMA_SPMB;

/** Variabel CSS pembungkus halaman SPMB. Dipasang SEKALI di elemen terluar, lalu blok
 *  `.tema-spmb` di globals.css memetakannya ke utility navy/emas yang dipakai bagian terang
 *  halaman + Footer — jadi seluruh halaman ikut tema tanpa harus mengoper prop ke tiap komponen
 *  anak (formulir, tab Cek Status, Footer semuanya komponen terpisah). */
export function gayaTema(nama?: string): React.CSSProperties {
  const w = tema(nama);
  return {
    "--spmb-utama": w.cssUtama,
    "--spmb-aksen": w.cssAksen,
    "--spmb-aksen-teks": w.cssAksenTeks,
    "--spmb-tipis": w.cssTipis,
    "--spmb-lembut": w.cssLembut,
    "--spmb-footer": w.cssFooter,
  } as React.CSSProperties;
}
export function tema(nama?: string) {
  return TEMA_SPMB[(nama ?? "") as NamaTema] ?? TEMA_SPMB.malam;
}

function daftar<T>(mentah: string | undefined, sah: (x: unknown) => T | null): T[] {
  if (!mentah) return [];
  try {
    const j = JSON.parse(mentah);
    if (!Array.isArray(j)) return [];
    return j.map(sah).filter((x): x is T => x !== null);
  } catch { return []; }
}

const teks = (x: unknown) => (typeof x === "string" ? x.trim() : "");

/** Satu pintu baca: setelan mentah → bentuk siap render. Isian rusak/kosong jadi daftar kosong,
 *  JANGAN melempar — halaman publik tidak boleh 500 karena satu isian salah ketik. */
export function bacaKontenSpmb(s: Record<string, string>) {
  return {
    tahun: s["spmb.tahun"] ?? "",
    judul: s["spmb.judul"] ?? "Penerimaan Murid Baru",
    subjudul: s["spmb.subjudul"] ?? "",
    deskripsi: s["spmb.deskripsi"] ?? "",
    tema: (s["spmb.tema"] as NamaTema) ?? "malam",
    poster: teks(s["spmb.poster"]),
    /** SEMUA poster, berurutan: poster utama lebih dulu, lalu poster tambahan. Satu poster tetap
     *  ditampilkan diam; dua atau lebih berganti sendiri (lihat PosterSpmb). `spmb.poster` sengaja
     *  dipertahankan sebagai poster utama supaya setelan yang sudah ada tidak hilang. */
    posters: [teks(s["spmb.poster"]), ...daftar<string>(s["spmb.posterLain"], x => (teks(x) ? teks(x) : null))].filter(Boolean),
    fotoPromosi: daftar<string>(s["spmb.fotoPromosi"], x => (teks(x) ? teks(x) : null)),
    /** Judul galeri foto promosi. Kosong = judul bawaan halaman ("Galeri Promosi"). Dulu tertulis
     *  mati "Suasana Sekolah" padahal panitia mengunggah foto promosi apa pun (temuan user 2 Okt 2026). */
    judulGaleri: teks(s["spmb.judulGaleri"]),
    posterRasio: rasioGambar(s["spmb.posterRasio"]),
    posterIsi: isiGambar(s["spmb.posterIsi"]),
    fotoRasio: rasioGambar(s["spmb.fotoRasio"]),
    fotoIsi: isiGambar(s["spmb.fotoIsi"]),
    logoMitra: daftar(s["spmb.logoMitra"], rapikanLogo),
    judulLogo: teks(s["spmb.judulLogo"]),
    /** Pasangan yang fotonya belum lengkap tidak tampil di situs. */
    sebelumSesudah: daftar(s["spmb.sebelumSesudah"], rapikanBanding).filter(b => b.sebelum && b.sesudah),
    /** Galeri tambahan siap render — yang tanpa foto tidak ikut tampil. */
    galeriLain: daftar(s["spmb.galeriLain"], rapikanGaleri)
      .filter(g => g.foto.length > 0)
      .map(g => ({ judul: g.judul, foto: g.foto, rasio: rasioGambar(g.rasio), isi: g.isi })),
    brosur: teks(s["spmb.brosur"]),
    video: teks(s["spmb.video"]),
    kontakNama: s["spmb.kontakNama"] ?? "",
    kontakWa: (s["spmb.kontakWa"] ?? "").replace(/[^0-9]/g, ""),
    biaya: s["spmb.biaya"] ?? "",
    pengumumanTanggal: teks(s["spmb.pengumumanTanggal"]),
    hasilDibuka: s["spmb.hasilDibuka"] === "1",
    alur: daftar<Langkah>(s["spmb.alur"], x => {
      const o = x as Langkah; const judul = teks(o?.judul);
      return judul ? { judul, isi: teks(o?.isi), gambar: teks(o?.gambar) || undefined } : null;
    }),
    syarat: daftar<string>(s["spmb.syarat"], x => (teks(x) ? teks(x) : null)),
    beasiswa: daftar<Langkah>(s["spmb.beasiswa"], x => {
      const o = x as Langkah; const judul = teks(o?.judul);
      return judul ? { judul, isi: teks(o?.isi), gambar: teks(o?.gambar) || undefined } : null;
    }),
    tanyaJawab: daftar<Tanya>(s["spmb.tanyaJawab"], x => {
      const o = x as Tanya; const tanya = teks(o?.tanya);
      return tanya ? { tanya, jawab: teks(o?.jawab) } : null;
    }),
    catatan: s["spmb.catatan"] ?? "",
    tautanGrup: teks(s["spmb.tautanGrup"]),
    jalur: daftar<Jalur>(s["spmb.jalur"], x => {
      const o = x as Jalur; const kode = teks(o?.kode).toUpperCase().replace(/[^A-Z0-9_]/g, "");
      const nama = teks(o?.nama);
      return kode && nama ? { kode, nama, keterangan: teks(o?.keterangan) || undefined } : null;
    }),
    jadwal: daftar<AgendaSpmb>(s["spmb.jadwal"], x => {
      const o = x as AgendaSpmb; const label = teks(o?.label);
      return label ? { label, tanggal: teks(o?.tanggal) } : null;
    }),
    rincianBiaya: daftar<BarisBiaya>(s["spmb.rincianBiaya"], x => {
      const o = x as BarisBiaya; const nama = teks(o?.nama);
      const jumlah = Number((o as { jumlah?: unknown })?.jumlah);
      return nama ? { nama, jumlah: Number.isFinite(jumlah) ? Math.max(0, Math.round(jumlah)) : 0 } : null;
    }),
    bobotPrestasi: bacaBobot(s["spmb.bobotPrestasi"]),
  };
}
export type KontenSpmb = ReturnType<typeof bacaKontenSpmb>;

/** Tabel bobot prestasi; isian rusak kembali ke tabel kosong, JANGAN melempar. */
function bacaBobot(mentah?: string): BobotPrestasi {
  const hasil: BobotPrestasi = {};
  if (!mentah) return hasil;
  try {
    const j = JSON.parse(mentah);
    if (!j || typeof j !== "object") return hasil;
    for (const tingkat of TINGKAT_PRESTASI) {
      const baris = (j as Record<string, unknown>)[tingkat];
      if (!baris || typeof baris !== "object") continue;
      hasil[tingkat] = {};
      for (const pk of PERINGKAT_PRESTASI) {
        const n = Number((baris as Record<string, unknown>)[pk]);
        hasil[tingkat][pk] = Number.isFinite(n) ? Math.max(0, n) : 0;
      }
    }
  } catch { /* tabel kosong */ }
  return hasil;
}

/** Nilai sertifikat prestasi dari tabel bobot. 0 = tidak dihitung. */
export function nilaiPrestasi(bobot: BobotPrestasi, tingkat?: string | null, peringkat?: string | null): number {
  if (!tingkat || !peringkat) return 0;
  return bobot[tingkat.toUpperCase()]?.[String(peringkat)] ?? 0;
}

/** Id video YouTube dari bentuk tautan apa pun (watch?v=, youtu.be, /embed/, /shorts/). */
export function idYoutube(tautan: string): string | null {
  const t = tautan.trim();
  if (!t) return null;
  if (/^[A-Za-z0-9_-]{11}$/.test(t)) return t;
  const m = /(?:v=|youtu\.be\/|\/embed\/|\/shorts\/)([A-Za-z0-9_-]{11})/.exec(t);
  return m ? m[1] : null;
}

/** Mencocokkan `Admission.chosenMajor` ke baris `Major`.
 *  Formulir publik menyimpan LABEL ("Teknik Komputer dan Jaringan (TKJ)"), bukan kode — jadi
 *  pencocokan yang hanya menyamakan `code` ATAU `name` persis TIDAK PERNAH kena, dan kuota per
 *  jurusan diam-diam tidak pernah berlaku. Terima ketiga bentuk itu. */
export function cocokJurusan(pilihan: string, major: { code: string; name: string }): boolean {
  const p = (pilihan ?? "").trim().toLowerCase();
  if (!p) return false;
  const kode = major.code.trim().toLowerCase();
  const nama = major.name.trim().toLowerCase();
  if (p === kode || p === nama) return true;
  if (p === `${nama} (${kode})`) return true;
  // Bentuk lain yang mungkin tersimpan: "NAMA - KODE", atau label dengan kode di dalam kurung.
  const dalamKurung = /\(([^)]+)\)\s*$/.exec(p)?.[1]?.trim();
  if (dalamKurung && dalamKurung === kode) return true;
  return p.replace(/\s*[-–]\s*/g, " ").trim() === `${nama} ${kode}`;
}
