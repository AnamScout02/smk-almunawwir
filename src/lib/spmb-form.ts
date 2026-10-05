/** Pemeriksaan isian formulir SPMB — SATU SUMBER untuk browser DAN server (netral, bukan
 *  `server-only`). Sebelum 1 Oktober 2026 server hanya menjawab "Periksa kembali isian Anda."
 *  tanpa menyebut isian mana, sementara beberapa isian (jurusan, jenis kelamin, tanggal lahir)
 *  dipegang komponen custom yang TIDAK ikut validasi bawaan browser — jadi tombol Daftar bisa
 *  terasa "tidak berfungsi" tanpa keterangan apa pun.
 *
 *  Acuan isi & istilah: SPMB menggantikan PPDB sejak Permendikdasmen No. 3 Tahun 2025. Untuk
 *  jenjang SMK tidak ada pembagian jalur baku seperti SMA — seleksinya memakai nilai rapor
 *  semester 1–5, Tes Kemampuan Akademik (TKA), dan pembobotan prestasi. Karena itu daftar jalur
 *  di situs ini diatur panitia (SiteSetting `spmb.jalur`), bukan ditulis mati. */

export type IsianSpmb = {
  fullName: string; birthPlace: string; birthDate: string; gender: string;
  nik: string; phone: string; nisn: string; address: string;
  previousSchool: string; email: string; guardianName: string;
  chosenMajor: string; jalur: string;
};

export type KunciIsian = keyof IsianSpmb;

/** Isian yang bisa dimatikan/dijadikan opsional admin lewat `form.require_<kunci>`. */
export type Kelonggaran = { wajib: (kunci: string) => boolean; tampil: (kunci: string) => boolean };

const HURUF_NAMA = /^[A-Za-z.'`\-\s,]+$/u;
const digit = (v: string) => (v ?? "").replace(/\D/g, "");

/** Nomor WhatsApp dirapikan ke bentuk 62… — "08", "+62", "62", dan spasi/tanda hubung diterima.
 *  Tanpa penyeragaman ini satu orang bisa punya dua baris berbeda hanya karena menulis 0812 vs 62812. */
export function rapikanNomorWa(mentah: string): string {
  let d = digit(mentah);
  if (d.startsWith("620")) d = "62" + d.slice(3);
  else if (d.startsWith("0")) d = "62" + d.slice(1);
  else if (d.startsWith("8")) d = "62" + d;
  return d;
}

export function umurPada(tglLahir: string, acuan = new Date()): number | null {
  const d = new Date(tglLahir + "T00:00:00+07:00");
  if (isNaN(d.getTime())) return null;
  let umur = acuan.getUTCFullYear() - d.getUTCFullYear();
  const bulan = acuan.getUTCMonth() - d.getUTCMonth();
  if (bulan < 0 || (bulan === 0 && acuan.getUTCDate() < d.getUTCDate())) umur--;
  return umur;
}

const PESAN = {
  id: {
    wajib: (l: string) => `${l} wajib diisi.`,
    pilih: (l: string) => `${l} wajib dipilih.`,
    minimal: (l: string, n: number) => `${l} terlalu pendek — minimal ${n} karakter.`,
    maksimal: (l: string, n: number) => `${l} terlalu panjang — maksimal ${n} karakter.`,
    hurufSaja: (l: string) => `${l} hanya boleh berisi huruf, spasi, titik, dan tanda hubung.`,
    digitPas: (l: string, n: number) => `${l} harus ${n} angka.`,
    digitRentang: (l: string, a: number, b: number) => `${l} harus ${a}–${b} angka.`,
    email: "Alamat e-mail belum benar — contoh: nama@gmail.com.",
    tanggal: "Tanggal lahir belum benar.",
    tanggalDepan: "Tanggal lahir tidak boleh di masa depan.",
    umur: (a: number, b: number) => `Periksa tanggal lahir — usia calon murid di luar rentang wajar (${a}–${b} tahun).`,
    jalur: "Jalur pendaftaran yang dipilih tidak dikenali. Muat ulang halaman lalu pilih lagi.",
  },
  en: {
    wajib: (l: string) => `${l} is required.`,
    pilih: (l: string) => `Please choose ${l}.`,
    minimal: (l: string, n: number) => `${l} is too short — minimum ${n} characters.`,
    maksimal: (l: string, n: number) => `${l} is too long — maximum ${n} characters.`,
    hurufSaja: (l: string) => `${l} may only contain letters, spaces, dots and hyphens.`,
    digitPas: (l: string, n: number) => `${l} must be exactly ${n} digits.`,
    digitRentang: (l: string, a: number, b: number) => `${l} must be ${a}–${b} digits.`,
    email: "That e-mail address isn't valid — e.g. name@gmail.com.",
    tanggal: "Date of birth isn't valid.",
    tanggalDepan: "Date of birth cannot be in the future.",
    umur: (a: number, b: number) => `Please check the date of birth — the age is outside the usual range (${a}–${b}).`,
    jalur: "The chosen admission track isn't recognised. Reload the page and pick again.",
  },
} as const;

/** Nama isian yang muncul di pesan galat. Sengaja sama dengan label di formulir. */
export const LABEL_ISIAN: Record<"id" | "en", Record<KunciIsian, string>> = {
  id: {
    fullName: "Nama lengkap", birthPlace: "Tempat lahir", birthDate: "Tanggal lahir",
    gender: "Jenis kelamin", nik: "NIK", phone: "Nomor WhatsApp", nisn: "NISN",
    address: "Alamat lengkap", previousSchool: "Sekolah asal", email: "E-mail",
    guardianName: "Nama orang tua / wali", chosenMajor: "Konsentrasi keahlian", jalur: "Jalur pendaftaran",
  },
  en: {
    fullName: "Full name", birthPlace: "Place of birth", birthDate: "Date of birth",
    gender: "Gender", nik: "NIK", phone: "WhatsApp number", nisn: "NISN",
    address: "Full address", previousSchool: "Previous school", email: "E-mail",
    guardianName: "Parent / guardian name", chosenMajor: "Major", jalur: "Admission track",
  },
};

export const UMUR_MIN = 11;
export const UMUR_MAKS = 25;

/**
 * Memeriksa seluruh isian sekaligus dan mengembalikan PETA kunci→pesan (kosong = lolos).
 * Seluruh isian diperiksa, bukan berhenti di yang pertama salah — supaya pendaftar tidak
 * memperbaiki satu per satu lewat lima kali klik Daftar.
 */
export function periksaFormulirSpmb(
  isian: Partial<IsianSpmb>,
  opsi: { lang?: "id" | "en"; longgar?: Kelonggaran; kodeJalur?: string[] } = {},
): Partial<Record<KunciIsian, string>> {
  const lang = opsi.lang ?? "id";
  const p = PESAN[lang];
  const L = LABEL_ISIAN[lang];
  const wajib = opsi.longgar?.wajib ?? (() => true);
  const tampil = opsi.longgar?.tampil ?? (() => true);
  const g: Partial<Record<KunciIsian, string>> = {};
  const t = (k: KunciIsian) => (isian[k] ?? "").trim();

  // --- Nama
  const nama = t("fullName");
  if (!nama) g.fullName = p.wajib(L.fullName);
  else if (nama.length < 3) g.fullName = p.minimal(L.fullName, 3);
  else if (nama.length > 100) g.fullName = p.maksimal(L.fullName, 100);
  else if (!HURUF_NAMA.test(nama)) g.fullName = p.hurufSaja(L.fullName);

  // --- Tempat lahir
  const tempat = t("birthPlace");
  if (!tempat) g.birthPlace = p.wajib(L.birthPlace);
  else if (tempat.length < 2) g.birthPlace = p.minimal(L.birthPlace, 2);
  else if (tempat.length > 60) g.birthPlace = p.maksimal(L.birthPlace, 60);

  // --- Tanggal lahir (DatePicker: tidak ikut validasi bawaan browser)
  const lahir = t("birthDate");
  if (!lahir) g.birthDate = p.pilih(L.birthDate);
  else {
    const umur = umurPada(lahir);
    if (umur === null) g.birthDate = p.tanggal;
    else if (umur < 0) g.birthDate = p.tanggalDepan;
    else if (umur < UMUR_MIN || umur > UMUR_MAKS) g.birthDate = p.umur(UMUR_MIN, UMUR_MAKS);
  }

  // --- Jenis kelamin (Select custom)
  const jk = t("gender");
  if (!jk) g.gender = p.pilih(L.gender);
  else if (!["L", "P", "LAKI-LAKI", "PEREMPUAN"].includes(jk.toUpperCase())) g.gender = p.pilih(L.gender);

  // --- NIK: 16 angka (Kartu Keluarga). Disimpan sebagai TEKS, bukan number — angka berawalan 0
  //     dan 16 digit melewati batas aman bilangan JavaScript.
  if (tampil("nik")) {
    const nik = digit(t("nik"));
    if (!nik) { if (wajib("nik")) g.nik = p.wajib(L.nik); }
    else if (nik.length !== 16) g.nik = p.digitPas(L.nik, 16);
  }

  // --- NISN: 10 angka
  if (tampil("nisn")) {
    const nisn = digit(t("nisn"));
    if (!nisn) { if (wajib("nisn")) g.nisn = p.wajib(L.nisn); }
    else if (nisn.length !== 10) g.nisn = p.digitPas(L.nisn, 10);
  }

  // --- Nomor WhatsApp
  const wa = rapikanNomorWa(t("phone"));
  if (!wa) g.phone = p.wajib(L.phone);
  else if (wa.length < 10 || wa.length > 15) g.phone = p.digitRentang(L.phone, 10, 15);

  // --- Alamat
  if (tampil("address")) {
    const alamat = t("address");
    if (!alamat) { if (wajib("address")) g.address = p.wajib(L.address); }
    else if (alamat.length < 10) g.address = p.minimal(L.address, 10);
    else if (alamat.length > 300) g.address = p.maksimal(L.address, 300);
  }

  // --- Sekolah asal
  const asal = t("previousSchool");
  if (!asal) g.previousSchool = p.wajib(L.previousSchool);
  else if (asal.length < 3) g.previousSchool = p.minimal(L.previousSchool, 3);
  else if (asal.length > 120) g.previousSchool = p.maksimal(L.previousSchool, 120);

  // --- E-mail
  const email = t("email");
  if (!email) g.email = p.wajib(L.email);
  else if (!/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(email)) g.email = p.email;
  else if (email.length > 120) g.email = p.maksimal(L.email, 120);

  // --- Nama orang tua / wali
  if (tampil("guardian")) {
    const wali = t("guardianName");
    if (!wali) { if (wajib("guardian")) g.guardianName = p.wajib(L.guardianName); }
    else if (wali.length < 3) g.guardianName = p.minimal(L.guardianName, 3);
    else if (wali.length > 100) g.guardianName = p.maksimal(L.guardianName, 100);
    else if (!HURUF_NAMA.test(wali)) g.guardianName = p.hurufSaja(L.guardianName);
  }

  // --- Konsentrasi keahlian: SEBELUM 1 Okt 2026 tidak wajib sama sekali, sehingga ada pendaftar
  //     tanpa jurusan yang tidak bisa diseleksi maupun dihitung kuotanya.
  if (!t("chosenMajor")) g.chosenMajor = p.pilih(L.chosenMajor);

  // --- Jalur pendaftaran
  const jalur = t("jalur");
  if (!jalur) g.jalur = p.pilih(L.jalur);
  else if (opsi.kodeJalur?.length && !opsi.kodeJalur.includes(jalur)) g.jalur = p.jalur;

  return g;
}
