/** TAHAPAN CALON SISWA SPMB (6 Oktober 2026) — satu sumber untuk halaman calon, portal panitia, dan API.
 *
 *  Keputusan rapat (user 6 Okt 2026): calon punya daftar tahapan seperti "pencapaian" yang tercentang
 *  satu per satu, BERURUTAN, sama untuk semua gelombang. Urutan disetujui user:
 *    Pendaftaran → Verifikasi Berkas → Ukuran Seragam → Asesmen Awal → Cek Fisik & Kesehatan
 *    → Diterima → Daftar Ulang & Pembayaran → Resmi peserta MPLS.
 *  Seragam SENGAJA di nomor 3 ("supaya pemesanannya terlihat" — user). Tahap Diterima & Daftar Ulang
 *  bisa dimatikan panitia (`spmb.tahapSeleksi`, `spmb.tahapDaftarUlang`).
 *
 *  NETRAL (bukan server-only): bentuk data & penghitung centang dipakai juga oleh komponen klien.
 *  Isian asesmen & pemeriksaan adalah DATA SENSITIF — fungsi `susunTahapan` TIDAK pernah memuatnya. */

export const KODE_TAHAP = ["DAFTAR", "VERIFIKASI", "SERAGAM", "ASESMEN", "PEMERIKSAAN", "DITERIMA", "DAFTAR_ULANG"] as const;
export type KodeTahap = (typeof KODE_TAHAP)[number];

export const INFO_TAHAP: Record<KodeTahap, { judul: string; ket: string; oleh: "CALON" | "PANITIA" | "OTOMATIS"; keSekolah: boolean }> = {
  DAFTAR: { judul: "Pendaftaran", ket: "Formulir dan berkas terkirim.", oleh: "OTOMATIS", keSekolah: false },
  VERIFIKASI: { judul: "Verifikasi Berkas", ket: "Panitia memeriksa kelengkapan dan kesesuaian berkas.", oleh: "PANITIA", keSekolah: false },
  SERAGAM: { judul: "Ukuran Seragam", ket: "Pilih ukuran baju dan celana untuk pemesanan seragam.", oleh: "CALON", keSekolah: false },
  ASESMEN: { judul: "Asesmen Awal", ket: "Wawancara singkat bersama panitia di sekolah.", oleh: "PANITIA", keSekolah: true },
  PEMERIKSAAN: { judul: "Cek Fisik & Kesehatan", ket: "Pemeriksaan fisik dan kesehatan oleh panitia di sekolah.", oleh: "PANITIA", keSekolah: true },
  DITERIMA: { judul: "Pengumuman Hasil", ket: "Keputusan penerimaan dari panitia.", oleh: "PANITIA", keSekolah: false },
  DAFTAR_ULANG: { judul: "Daftar Ulang", ket: "Konfirmasi bersedia bersekolah. Pembayaran boleh dicicil sesuai ketentuan panitia.", oleh: "CALON", keSekolah: true },
};

/** Tahap yang boleh diberi jadwal per gelombang (yang mengharuskan calon datang ke sekolah). */
export const TAHAP_BERJADWAL: KodeTahap[] = ["ASESMEN", "PEMERIKSAAN", "DAFTAR_ULANG"];

export type JadwalTahap = { tanggal?: string; tanggalSampai?: string; jamMulai?: string; jamSelesai?: string; tempat?: string; catatan?: string };
export type PetaJadwal = Partial<Record<KodeTahap, JadwalTahap>>;

export function bacaJadwal(v: unknown): PetaJadwal {
  if (!v || typeof v !== "object") return {};
  const hasil: PetaJadwal = {};
  for (const k of TAHAP_BERJADWAL) {
    const j = (v as Record<string, unknown>)[k];
    if (!j || typeof j !== "object") continue;
    const o = j as Record<string, unknown>;
    const t = (x: unknown) => (typeof x === "string" ? x.trim().slice(0, 300) : "");
    const isi: JadwalTahap = {
      tanggal: t(o.tanggal), tanggalSampai: t(o.tanggalSampai), jamMulai: t(o.jamMulai),
      jamSelesai: t(o.jamSelesai), tempat: t(o.tempat), catatan: t(o.catatan),
    };
    if (Object.values(isi).some(Boolean)) hasil[k] = isi;
  }
  return hasil;
}

/* ───────────────────────────── Seragam ───────────────────────────── */

export type UkuranSeragam = { label: string; keterangan: string };
export type ItemSeragam = { nama: string; ukuran: UkuranSeragam[] };
export type SetelanSeragam = { item: ItemSeragam[]; catatan: string; gambar: string };

export const SERAGAM_BAWAAN: SetelanSeragam = {
  item: [
    {
      nama: "Baju",
      ukuran: [
        { label: "S", keterangan: "Lebar dada 48 cm · panjang 68 cm" },
        { label: "M", keterangan: "Lebar dada 50 cm · panjang 70 cm" },
        { label: "L", keterangan: "Lebar dada 53 cm · panjang 72 cm" },
        { label: "XL", keterangan: "Lebar dada 56 cm · panjang 74 cm" },
        { label: "XXL", keterangan: "Lebar dada 59 cm · panjang 76 cm" },
      ],
    },
    {
      nama: "Celana / Rok",
      ukuran: [
        { label: "28", keterangan: "Lingkar pinggang 71 cm" },
        { label: "30", keterangan: "Lingkar pinggang 76 cm" },
        { label: "32", keterangan: "Lingkar pinggang 81 cm" },
        { label: "34", keterangan: "Lingkar pinggang 86 cm" },
        { label: "36", keterangan: "Lingkar pinggang 91 cm" },
      ],
    },
  ],
  catatan: "",
  gambar: "",
};

export function bacaSetelanSeragam(teks: string | undefined): SetelanSeragam {
  try {
    const v = JSON.parse(teks || "") as Partial<SetelanSeragam>;
    const item = Array.isArray(v.item)
      ? v.item.map(i => ({
          nama: String(i?.nama ?? "").trim(),
          ukuran: Array.isArray(i?.ukuran)
            ? i.ukuran.map(u => ({ label: String(u?.label ?? "").trim(), keterangan: String(u?.keterangan ?? "").trim() })).filter(u => u.label)
            : [],
        })).filter(i => i.nama && i.ukuran.length)
      : SERAGAM_BAWAAN.item;
    return { item, catatan: String(v.catatan ?? ""), gambar: String(v.gambar ?? "") };
  } catch { return SERAGAM_BAWAAN; }
}

export type PilihanSeragam = { item: string; ukuran: string };
export type IsiSeragam = { pilihan: PilihanSeragam[]; catatan?: string };

/* ──────────────────────── Asesmen & pemeriksaan ──────────────────────── */

export type JenisIsian = "TEKS" | "PANJANG" | "ANGKA" | "PILIHAN" | "YA_TIDAK";
export const LABEL_JENIS: Record<JenisIsian, string> = {
  TEKS: "Teks singkat", PANJANG: "Teks panjang", ANGKA: "Angka", PILIHAN: "Pilihan", YA_TIDAK: "Ya / Tidak",
};

/** Satu isian yang disusun panitia. `bukuInduk` = kunci Buku Induk yang diisi saat konversi menjadi siswa. */
export type IsianTahap = {
  id: string; label: string; jenis: JenisIsian; pilihan?: string[]; satuan?: string;
  kelompok?: string; wajib?: boolean; bukuInduk?: "height" | "weight" | "bloodType" | "diseases";
};

/** Kunci Buku Induk siswa (grup "C. Kesehatan Siswa") yang boleh diisi dari pemeriksaan SPMB. */
export const KUNCI_BUKU_INDUK = { height: "Tinggi Badan", weight: "Berat Badan", bloodType: "Golongan Darah", diseases: "Riwayat Penyakit" } as const;

export const ASESMEN_BAWAAN: IsianTahap[] = [
  { id: "motivasi", label: "Apa alasan memilih SMK Al-Munawwir IIBS dan jurusan yang dipilih?", jenis: "PANJANG", kelompok: "Motivasi", wajib: true },
  { id: "citaCita", label: "Cita-cita / rencana setelah lulus", jenis: "PILIHAN", pilihan: ["Bekerja", "Kuliah", "Wirausaha", "Belum tahu"], kelompok: "Motivasi" },
  { id: "keinginanSendiri", label: "Masuk pesantren atas keinginan sendiri?", jenis: "YA_TIDAK", kelompok: "Motivasi" },
  { id: "pernahMondok", label: "Pernah tinggal di pondok / asrama sebelumnya?", jenis: "YA_TIDAK", kelompok: "Kesiapan Asrama" },
  { id: "jauhOrtu", label: "Kesiapan tinggal jauh dari orang tua", jenis: "PILIHAN", pilihan: ["Sangat siap", "Siap", "Ragu-ragu", "Belum siap"], kelompok: "Kesiapan Asrama" },
  { id: "bacaQuran", label: "Kemampuan membaca Al-Qur'an", jenis: "PILIHAN", pilihan: ["Lancar & tartil", "Lancar", "Terbata-bata", "Belum bisa"], kelompok: "Keagamaan" },
  { id: "hafalan", label: "Jumlah hafalan (juz)", jenis: "ANGKA", satuan: "juz", kelompok: "Keagamaan" },
  { id: "sholat", label: "Kebiasaan sholat lima waktu", jenis: "PILIHAN", pilihan: ["Selalu", "Sering", "Kadang-kadang", "Jarang"], kelompok: "Keagamaan" },
  { id: "minatBakat", label: "Minat, bakat, dan hobi", jenis: "TEKS", kelompok: "Minat & Bakat" },
  { id: "prestasi", label: "Prestasi yang pernah diraih", jenis: "TEKS", kelompok: "Minat & Bakat" },
  { id: "kebiasaanGawai", label: "Lama penggunaan HP per hari", jenis: "PILIHAN", pilihan: ["< 2 jam", "2–4 jam", "4–6 jam", "> 6 jam"], kelompok: "Kebiasaan" },
  { id: "kondisiKeluarga", label: "Kondisi keluarga yang perlu diketahui wali kelas", jenis: "PANJANG", kelompok: "Keluarga" },
  { id: "catatanPanitia", label: "Kesan & catatan panitia", jenis: "PANJANG", kelompok: "Catatan" },
];

export const PEMERIKSAAN_BAWAAN: IsianTahap[] = [
  { id: "tato", label: "Tato", jenis: "YA_TIDAK", kelompok: "Fisik" },
  { id: "tindik", label: "Tindik (selain telinga untuk putri)", jenis: "YA_TIDAK", kelompok: "Fisik" },
  { id: "rambutSemir", label: "Rambut disemir / diwarnai", jenis: "YA_TIDAK", kelompok: "Fisik" },
  { id: "tanganDominan", label: "Tangan dominan", jenis: "PILIHAN", pilihan: ["Kanan", "Kiri", "Keduanya"], kelompok: "Fisik" },
  { id: "kondisiFisik", label: "Kelainan / keterbatasan fisik", jenis: "TEKS", kelompok: "Fisik" },
  { id: "tinggi", label: "Tinggi badan", jenis: "ANGKA", satuan: "cm", kelompok: "Kesehatan", bukuInduk: "height", wajib: true },
  { id: "berat", label: "Berat badan", jenis: "ANGKA", satuan: "kg", kelompok: "Kesehatan", bukuInduk: "weight", wajib: true },
  { id: "golDarah", label: "Golongan darah", jenis: "PILIHAN", pilihan: ["A", "B", "AB", "O", "Belum tahu"], kelompok: "Kesehatan", bukuInduk: "bloodType" },
  { id: "tensi", label: "Tekanan darah", jenis: "TEKS", satuan: "mmHg", kelompok: "Kesehatan" },
  { id: "mataKanan", label: "Ketajaman mata kanan (visus)", jenis: "TEKS", kelompok: "Kesehatan" },
  { id: "mataKiri", label: "Ketajaman mata kiri (visus)", jenis: "TEKS", kelompok: "Kesehatan" },
  { id: "kacamata", label: "Memakai kacamata", jenis: "YA_TIDAK", kelompok: "Kesehatan" },
  { id: "butaWarna", label: "Tes buta warna (Ishihara)", jenis: "PILIHAN", pilihan: ["Normal", "Buta warna parsial", "Buta warna total"], kelompok: "Kesehatan" },
  { id: "pendengaran", label: "Pendengaran", jenis: "PILIHAN", pilihan: ["Normal", "Ada gangguan"], kelompok: "Kesehatan" },
  { id: "penyakit", label: "Riwayat penyakit (asma, epilepsi, dll.)", jenis: "TEKS", kelompok: "Kesehatan", bukuInduk: "diseases" },
  { id: "alergi", label: "Alergi (obat / makanan)", jenis: "TEKS", kelompok: "Kesehatan" },
  { id: "obatRutin", label: "Obat yang rutin diminum", jenis: "TEKS", kelompok: "Kesehatan" },
  { id: "catatanPemeriksa", label: "Catatan pemeriksa", jenis: "PANJANG", kelompok: "Catatan" },
];

export function bacaIsian(teks: string | undefined, bawaan: IsianTahap[]): IsianTahap[] {
  try {
    const v = JSON.parse(teks || "");
    if (!Array.isArray(v) || !v.length) return bawaan;
    const jenisSah = Object.keys(LABEL_JENIS);
    return v.map((x, i) => ({
      id: String(x?.id || `isian${i + 1}`).replace(/[^a-zA-Z0-9_]/g, "").slice(0, 40) || `isian${i + 1}`,
      label: String(x?.label ?? "").trim().slice(0, 300),
      jenis: (jenisSah.includes(x?.jenis) ? x.jenis : "TEKS") as JenisIsian,
      pilihan: Array.isArray(x?.pilihan) ? x.pilihan.map((p: unknown) => String(p).trim()).filter(Boolean).slice(0, 20) : undefined,
      satuan: x?.satuan ? String(x.satuan).slice(0, 20) : undefined,
      kelompok: x?.kelompok ? String(x.kelompok).slice(0, 60) : undefined,
      wajib: !!x?.wajib,
      bukuInduk: x?.bukuInduk && x.bukuInduk in KUNCI_BUKU_INDUK ? x.bukuInduk : undefined,
    })).filter(x => x.label);
  } catch { return bawaan; }
}

/** Jawaban tersimpan = SALINAN label + nilai, supaya tetap terbaca walau daftar isian diubah kemudian. */
export type JawabanTahap = { id: string; label: string; nilai: string; satuan?: string; kelompok?: string; bukuInduk?: string };
export type IsiTahap = { jawaban: JawabanTahap[]; catatan?: string };

export function bacaIsiTahap(v: unknown): IsiTahap {
  if (!v || typeof v !== "object") return { jawaban: [] };
  const o = v as Record<string, unknown>;
  return {
    jawaban: Array.isArray(o.jawaban) ? (o.jawaban as JawabanTahap[]).filter(j => j && typeof j.id === "string") : [],
    catatan: typeof o.catatan === "string" ? o.catatan : undefined,
  };
}

/** IMT (indeks massa tubuh) dari tinggi (cm) & berat (kg) — kategori Kemenkes untuk dewasa muda. */
export function hitungImt(tinggiCm: number, beratKg: number): { nilai: number; kategori: string } | null {
  if (!(tinggiCm > 50) || !(beratKg > 10)) return null;
  const m = tinggiCm / 100;
  const nilai = Math.round((beratKg / (m * m)) * 10) / 10;
  const kategori = nilai < 17 ? "Kurus berat" : nilai < 18.5 ? "Kurus" : nilai <= 25 ? "Normal" : nilai <= 27 ? "Gemuk" : "Obesitas";
  return { nilai, kategori };
}

/** Jurusan yang menurut juknis beberapa daerah mensyaratkan bebas buta warna — HANYA peringatan untuk panitia. */
export function peringatanButaWarna(hasilTes: string, jurusan: string): string | null {
  if (!hasilTes || /^normal/i.test(hasilTes)) return null;
  if (/dkv|desain|komunikasi visual|tkj|komputer|jaringan|informatika|teknologi informasi/i.test(jurusan)) {
    return `Hasil tes buta warna "${hasilTes}" — jurusan ${jurusan} di beberapa daerah mensyaratkan bebas buta warna. Keputusan tetap di panitia.`;
  }
  return null;
}

/* ───────────────────────────── MPLS ───────────────────────────── */

export type InfoMpls = { judul: string; mulai: string; selesai: string; jam: string; tempat: string; keterangan: string; perlengkapan: string };
export const MPLS_BAWAAN: InfoMpls = {
  judul: "Masa Pengenalan Lingkungan Sekolah (MPLS)", mulai: "", selesai: "", jam: "", tempat: "SMK Al-Munawwir IIBS",
  keterangan: "", perlengkapan: "",
};
export function bacaMpls(teks: string | undefined): InfoMpls {
  try { return { ...MPLS_BAWAAN, ...(JSON.parse(teks || "{}") as Partial<InfoMpls>) }; } catch { return MPLS_BAWAAN; }
}

/* ─────────────────────────── Penyusun centang ─────────────────────────── */

export type StatusTahap = "SELESAI" | "BERJALAN" | "MENUNGGU" | "PERBAIKAN" | "BERHENTI";

export interface TahapCalon {
  kode: KodeTahap;
  judul: string;
  ket: string;
  status: StatusTahap;
  /** ISO — kapan tercentang. */
  tanggal: string | null;
  pesan?: string | null;
  jadwal?: JadwalTahap | null;
}

export interface BarisTahapan {
  createdAt: Date | string;
  status: string;
  verifikasiStatus: string;
  verifikasiPesan: string | null;
  verifikasiAt: Date | string | null;
  seragamAt: Date | string | null;
  asesmenAt: Date | string | null;
  pemeriksaanAt: Date | string | null;
  paymentVerified: boolean;
  daftarUlangConfirmedAt: Date | string | null;
  /** Syarat pembayaran untuk menuntaskan Daftar Ulang sudah terpenuhi (dihitung `hitungBayar`). */
  bayarCukup?: boolean;
}

export interface AturanTahapan { seleksi: boolean; daftarUlang: boolean; hasilDibuka: boolean }

const DITERIMA = ["DITERIMA", "ACCEPTED"];
const DITOLAK = ["DITOLAK", "REJECTED"];
const isoAtauNull = (d: Date | string | null) => (d ? new Date(d).toISOString() : null);

/** Kode tahap yang berlaku menurut setelan panitia (urutan tetap). */
export function tahapBerlaku(a: Pick<AturanTahapan, "seleksi" | "daftarUlang">): KodeTahap[] {
  return KODE_TAHAP.filter(k => (k !== "DITERIMA" || a.seleksi) && (k !== "DAFTAR_ULANG" || a.daftarUlang));
}

/** Apakah satu tahap sudah tercentang. Satu sumber untuk calon, panitia, dan rekap. */
export function tahapSelesai(kode: KodeTahap, b: BarisTahapan, a: AturanTahapan): string | null | false {
  switch (kode) {
    case "DAFTAR": return isoAtauNull(b.createdAt);
    case "VERIFIKASI": return b.verifikasiStatus === "TERVERIFIKASI" ? isoAtauNull(b.verifikasiAt) ?? "" : false;
    case "SERAGAM": return b.seragamAt ? isoAtauNull(b.seragamAt) : false;
    case "ASESMEN": return b.asesmenAt ? isoAtauNull(b.asesmenAt) : false;
    case "PEMERIKSAAN": return b.pemeriksaanAt ? isoAtauNull(b.pemeriksaanAt) : false;
    // Diterima hanya "tercentang" bagi calon setelah panitia membuka hasil — pola #102.
    case "DITERIMA": return DITERIMA.includes(b.status) && a.hasilDibuka ? "" : false;
    // Daftar ulang = konfirmasi bersedia bersekolah + syarat bayar yang dipilih panitia (bisa "tanpa syarat").
    case "DAFTAR_ULANG": return b.daftarUlangConfirmedAt && (b.bayarCukup ?? b.paymentVerified) ? isoAtauNull(b.daftarUlangConfirmedAt) : false;
  }
}

/**
 * Tahapan untuk SATU calon, berurutan: tahap pertama yang belum selesai = BERJALAN, sesudahnya MENUNGGU.
 * Ditolak setelah hasil dibuka = tahap Diterima BERHENTI dan sisanya tidak ditampilkan berjalan.
 */
export function susunTahapan(b: BarisTahapan, a: AturanTahapan, jadwal: PetaJadwal = {}): { tahap: TahapCalon[]; tuntas: boolean; ditolak: boolean } {
  const kode = tahapBerlaku(a);
  const tahap: TahapCalon[] = [];
  let terhenti = false;
  let ditolak = false;
  for (const k of kode) {
    const info = INFO_TAHAP[k];
    const sel = tahapSelesai(k, b, a);
    let status: StatusTahap;
    let pesan: string | null = null;
    if (terhenti) status = "MENUNGGU";
    else if (sel !== false) status = "SELESAI";
    else {
      status = "BERJALAN";
      terhenti = true;
      if (k === "VERIFIKASI" && b.verifikasiStatus === "PERBAIKAN") { status = "PERBAIKAN"; pesan = b.verifikasiPesan; }
      if (k === "DITERIMA" && a.hasilDibuka && DITOLAK.includes(b.status)) { status = "BERHENTI"; ditolak = true; pesan = "Mohon maaf, pendaftaran belum dapat kami terima."; }
      if (k === "DITERIMA" && a.hasilDibuka && b.status === "CADANGAN") pesan = "Anda masuk daftar cadangan. Panitia akan menghubungi bila ada kursi yang kosong.";
      if (k === "DITERIMA" && !a.hasilDibuka) pesan = "Hasil diumumkan panitia sesuai jadwal.";
    }
    tahap.push({
      kode: k, judul: info.judul, ket: info.ket, status,
      tanggal: sel === false ? null : (sel || null),
      pesan, jadwal: jadwal[k] ?? null,
    });
  }
  return { tahap, tuntas: !terhenti, ditolak };
}

/** Tahap terbuka untuk diisi panitia/calon: semua tahap SEBELUMNYA sudah selesai. */
export function tahapTerbuka(kode: KodeTahap, b: BarisTahapan, a: AturanTahapan): boolean {
  for (const k of tahapBerlaku(a)) {
    if (k === kode) return true;
    if (tahapSelesai(k, b, a) === false) return false;
  }
  return false;
}

/** Kunci berkas baku (kolom sendiri di Admission) — sama dengan DOKUMEN_BAKU_SPMB di spmb-konten. */
export const BERKAS_BAKU: { kunci: string; kolom: "ijazahUrl" | "kkUrl" | "ktpWaliUrl" | "fotoUrl" | "dokumenLainUrl"; label: string }[] = [
  { kunci: "ijazah", kolom: "ijazahUrl", label: "Ijazah / SKL" },
  { kunci: "kk", kolom: "kkUrl", label: "Kartu Keluarga" },
  { kunci: "ktp_wali", kolom: "ktpWaliUrl", label: "KTP Orang Tua / Wali" },
  { kunci: "foto", kolom: "fotoUrl", label: "Pas Foto" },
  { kunci: "dokumen_lain", kolom: "dokumenLainUrl", label: "Dokumen Lain" },
];

/** Pesan WhatsApp untuk calon — disusun dari tahap terakhir yang berubah. Dipakai tombol "Kabari lewat WA" & e-mail. */
export function pesanKabar(o: {
  nama: string; nomor: string; sekolah: string; tautan: string;
  tahap: TahapCalon | null; tuntas: boolean; mpls?: InfoMpls | null;
}): string {
  const salam = `Assalamu'alaikum. Kami panitia SPMB ${o.sekolah} menyampaikan kabar untuk ${o.nama} (no. pendaftaran ${o.nomor}).`;
  let isi: string;
  if (o.tuntas) {
    isi = `Alhamdulillah, seluruh tahapan sudah selesai. ${o.nama} resmi menjadi peserta ${o.mpls?.judul || "MPLS"}.` +
      (o.mpls?.mulai ? ` Jadwal: ${o.mpls.mulai}${o.mpls.selesai ? ` s.d. ${o.mpls.selesai}` : ""}${o.mpls.jam ? `, ${o.mpls.jam}` : ""}${o.mpls.tempat ? ` di ${o.mpls.tempat}` : ""}.` : "");
  } else if (o.tahap?.status === "PERBAIKAN") {
    isi = `Berkas pendaftaran perlu diperbaiki: ${o.tahap.pesan || "silakan lihat keterangan di halaman tahapan."}`;
  } else if (o.tahap) {
    const j = o.tahap.jadwal;
    isi = `Tahap berikutnya: ${o.tahap.judul}.` +
      (j?.tanggal ? ` Jadwal: ${j.tanggal}${j.tanggalSampai ? ` s.d. ${j.tanggalSampai}` : ""}${j.jamMulai ? `, pukul ${j.jamMulai}${j.jamSelesai ? `–${j.jamSelesai}` : ""}` : ""}${j.tempat ? ` di ${j.tempat}` : ""}.` : "") +
      (j?.catatan ? ` ${j.catatan}` : "");
  } else isi = "";
  return `${salam}\n\n${isi}\n\nPantau tahapan pendaftaran di: ${o.tautan}\n(buka dengan nomor pendaftaran & tanggal lahir)\n\nTerima kasih.`;
}

/** Kunci SiteSetting tahapan — diizinkan ditulis lewat /api/spmb/pengaturan. */
export const KUNCI_TAHAPAN_SPMB = [
  "spmb.tahapSeleksi", "spmb.tahapDaftarUlang", "spmb.seragam", "spmb.asesmen", "spmb.pemeriksaan", "spmb.mpls",
  "spmb.syaratBayar", "spmb.uangMuka", "spmb.infoBayar", "spmb.alurTahap",
];

/* ─────────────────── Alur Pendaftaran di halaman SPMB publik ───────────────────
 * Permintaan user 6 Okt 2026: alur di web "harusnya sama satu dengan yang sudah di setting ketentuan
 * terbaru". Jadi JUDUL & URUTAN langkah diambil dari tahapan (ikut sakelar Pengumuman/Daftar Ulang);
 * panitia hanya mengubah penjelasan & gambar tiap langkah (`spmb.alurTahap`). Langkah tidak bisa
 * ditambah/dihapus dari editor — itu yang dulu membuat alur web & tahapan calon berbeda. */

export type KodeAlur = KodeTahap | "MPLS";
export const ALUR_WEB_BAWAAN: Record<KodeAlur, { judul: string; isi: string }> = {
  DAFTAR: { judul: "Isi Formulir & Unggah Berkas", isi: "Lengkapi formulir online dan unggah berkas. Nomor pendaftaran langsung terbit, dan tautan grup WhatsApp gelombang tampil setelah mendaftar." },
  VERIFIKASI: { judul: "Verifikasi Berkas", isi: "Panitia memeriksa kelengkapan berkas. Bila ada yang kurang, pesan panitia muncul di halaman tahapan dan berkas bisa diunggah ulang." },
  SERAGAM: { judul: "Pilih Ukuran Seragam", isi: "Pilih ukuran baju dan celana sesuai tabel ukuran untuk pemesanan seragam." },
  ASESMEN: { judul: "Asesmen Awal", isi: "Wawancara singkat bersama panitia di sekolah sesuai jadwal gelombang." },
  PEMERIKSAAN: { judul: "Cek Fisik & Kesehatan", isi: "Pemeriksaan fisik dan kesehatan di sekolah: tinggi & berat badan, mata, tes buta warna, dan lainnya." },
  DITERIMA: { judul: "Pengumuman Hasil", isi: "Hasil dibuka lewat nomor pendaftaran dan tanggal lahir di halaman tahapan." },
  DAFTAR_ULANG: { judul: "Daftar Ulang & Pembayaran", isi: "Konfirmasi bersedia bersekolah. Pembayaran bisa langsung lunas atau dicicil — juga setelah MPLS — sesuai ketentuan panitia." },
  MPLS: { judul: "Resmi Peserta MPLS", isi: "Seluruh tahap selesai — calon resmi mengikuti Masa Pengenalan Lingkungan Sekolah." },
};

export type LangkahAlur = { kode: KodeAlur; judul: string; isi: string; gambar?: string };

export function susunAlurWeb(a: Pick<AturanTahapan, "seleksi" | "daftarUlang">, kustomTeks: string | undefined): LangkahAlur[] {
  let kustom: Record<string, { isi?: unknown; gambar?: unknown }> = {};
  try { const v = JSON.parse(kustomTeks || "{}"); if (v && typeof v === "object") kustom = v; } catch { /* bawaan */ }
  return ([...tahapBerlaku(a), "MPLS"] as KodeAlur[]).map(k => {
    const isi = typeof kustom[k]?.isi === "string" ? (kustom[k].isi as string).trim() : "";
    const gambar = typeof kustom[k]?.gambar === "string" ? (kustom[k].gambar as string).trim() : "";
    // Judul PERSIS sama dengan tahapan calon — satu sumber (INFO_TAHAP); hanya langkah penutup MPLS yang khusus web.
    const judul = k === "MPLS" ? ALUR_WEB_BAWAAN.MPLS.judul : INFO_TAHAP[k].judul;
    return { kode: k, judul, isi: isi || ALUR_WEB_BAWAAN[k].isi, ...(gambar ? { gambar } : {}) };
  });
}

/* ─────────────────────────── Pembayaran (bisa dicicil) ───────────────────────────
 * Keputusan user 6 Okt 2026: pembayaran bisa langsung, dicicil, atau setelah MPLS; syarat untuk
 * menuntaskan Daftar Ulang (dan jadi peserta MPLS) DIATUR panitia: tanpa syarat / uang muka / lunas.
 * Pendaftaran GRATIS (user 6 Okt 2026). Tagihan = BIAYA DAFTAR ULANG GELOMBANG calon (`GelombangSpmb.biayaDaftar`);
 * gelombang tanpa biaya memakai jumlah Rincian Biaya di Isi Halaman Web. Dikurangi potongan per calon. */

export type SyaratBayar = "TIDAK" | "UANG_MUKA" | "LUNAS";
export const LABEL_SYARAT_BAYAR: Record<SyaratBayar, string> = {
  TIDAK: "Tidak ada syarat bayar", UANG_MUKA: "Minimal uang muka", LUNAS: "Harus lunas",
};
export type SetelanBayar = { syarat: SyaratBayar; uangMuka: number; total: number; info: string; perGelombang?: Record<string, number> };

export function bacaSetelanBayar(s: Record<string, string | undefined>): SetelanBayar {
  const syarat = (["TIDAK", "UANG_MUKA", "LUNAS"].includes(s["spmb.syaratBayar"] ?? "") ? s["spmb.syaratBayar"] : "TIDAK") as SyaratBayar;
  let total = 0;
  try {
    const r = JSON.parse(s["spmb.rincianBiaya"] || "[]");
    if (Array.isArray(r)) total = r.reduce((a, x) => a + (Math.max(0, Number(x?.jumlah) || 0)), 0);
  } catch { /* kosong */ }
  return { syarat, uangMuka: Math.max(0, Number(s["spmb.uangMuka"]) || 0), total, info: s["spmb.infoBayar"] ?? "" };
}

export type InfoBayar = {
  total: number; potongan: number; tagihan: number; sah: number; menunggu: number; sisa: number;
  wajib: number; cukup: boolean; lunas: boolean; syarat: SyaratBayar;
};

export function hitungBayar(set: SetelanBayar, potongan: number, sah: number, menunggu: number, gelombangId?: string | null): InfoBayar {
  const total = (gelombangId && set.perGelombang?.[gelombangId]) || set.total;
  const tagihan = Math.max(0, total - Math.max(0, potongan));
  const wajib = set.syarat === "LUNAS" ? tagihan : set.syarat === "UANG_MUKA" ? Math.min(set.uangMuka, tagihan) : 0;
  return {
    total, potongan, tagihan, sah, menunggu, sisa: Math.max(0, tagihan - sah),
    wajib, cukup: sah >= wajib, lunas: tagihan > 0 && sah >= tagihan, syarat: set.syarat,
  };
}

export const rupiah = (n: number) => "Rp " + Math.round(n).toLocaleString("id-ID");

/* ───────────── Jadwal Penting di halaman SPMB = disusun otomatis per gelombang ─────────────
 * Temuan user 6 Okt 2026 ("ini juga apa masih perlu"): daftar Jadwal Penting manual mengulang data yang sudah
 * ada — tanggal gelombang, jadwal tahap per gelombang / sesi kedatangan, tanggal pengumuman, dan info MPLS —
 * dan hanya SATU jadwal padahal tiap gelombang berbeda. Sekarang disusun dari data itu; `spmb.jadwal` tidak dibaca lagi. */

export type TitikJadwal = { label: string; dari: string | null; sampai?: string | null };
export type JadwalGelombang = { nama: string; titik: TitikJadwal[] };

export function susunJadwalWeb(
  gelombang: { nama: string; buka: Date; tutup: Date; jadwalTahap: unknown; sesi?: { tanggal: string }[] }[],
  o: { pengumumanTanggal: string; mpls: InfoMpls; seleksi: boolean; daftarUlang: boolean },
): JadwalGelombang[] {
  const iso = (d: Date) => new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
  return gelombang.map(g => {
    const j = bacaJadwal(g.jadwalTahap);
    const sesi = (g.sesi ?? []).map(x => x.tanggal).sort();
    const titik: TitikJadwal[] = [{ label: "Pendaftaran", dari: iso(g.buka), sampai: iso(g.tutup) }];
    if (sesi.length) titik.push({ label: "Asesmen & cek kesehatan", dari: sesi[0], sampai: sesi.length > 1 ? sesi[sesi.length - 1] : null });
    else if (j.ASESMEN?.tanggal && j.PEMERIKSAAN?.tanggal && j.ASESMEN.tanggal !== j.PEMERIKSAAN.tanggal) {
      titik.push({ label: "Asesmen awal", dari: j.ASESMEN.tanggal, sampai: j.ASESMEN.tanggalSampai || null });
      titik.push({ label: "Cek fisik & kesehatan", dari: j.PEMERIKSAAN.tanggal, sampai: j.PEMERIKSAAN.tanggalSampai || null });
    } else {
      const x = j.ASESMEN?.tanggal ? j.ASESMEN : j.PEMERIKSAAN;
      titik.push({ label: "Asesmen & cek kesehatan", dari: x?.tanggal || null, sampai: x?.tanggalSampai || null });
    }
    if (o.seleksi) titik.push({ label: "Pengumuman hasil", dari: o.pengumumanTanggal || null });
    if (o.daftarUlang) titik.push({ label: "Daftar ulang", dari: j.DAFTAR_ULANG?.tanggal || null, sampai: j.DAFTAR_ULANG?.tanggalSampai || null });
    titik.push({ label: "MPLS", dari: o.mpls.mulai || null, sampai: o.mpls.selesai || null });
    return { nama: g.nama, titik };
  });
}
