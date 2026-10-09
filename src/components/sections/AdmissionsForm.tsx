"use client";
import { useState, useTransition, useEffect, useRef } from "react";
import { GraduationCap, CheckCircle2, Upload, X, FileText, Crop, Camera, Image as ImageIcon, Loader2, Copy, ChevronLeft, ChevronRight, ListChecks, MessageCircle } from "lucide-react";
import { salinTeks } from "@/lib/salin-teks";
import { periksaFormulirSpmb, type IsianSpmb, type KunciIsian } from "@/lib/spmb-form";
import type { Jalur } from "@/lib/spmb-konten";
import DatePicker from "@/components/shared/DatePicker";
import Select from "@/components/admin/Select";
import type { Lang } from "@/lib/lang";
import { catatJejak } from "@/lib/spmb-jejak";
import { bacaBerkas, BISA_DIBACA } from "@/lib/ocr-berkas";
import { kecilkanFoto, periksaMutu, periksaPasFoto, ukuranTeks, wajahDominan, wajahUtama } from "@/lib/olah-foto";
import KameraBerkas, { kameraTersedia } from "@/components/spmb/KameraBerkas";
import PasFotoOtomatis from "@/components/spmb/PasFotoOtomatis";
import type { Kotak } from "@/lib/pas-foto";
import PeriksaBerkasOcr, { type KeadaanOcr } from "@/components/spmb/PeriksaBerkasOcr";
import PemindaiDokumen from "@/components/spmb/PemindaiDokumen";
import { deteksiDokumen, kanvasKeFile, type Sudut } from "@/lib/pindai-dokumen";
import { JENIS_KOTAK, salahKotak } from "@/lib/kenali-dokumen";
import IsianSekolahAsal from "@/components/spmb/IsianSekolahAsal";

const inputClass =
  "w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition bg-white placeholder:text-gray-400";
const labelClass = "block text-sm font-semibold text-primary-900 mb-1.5";
/** Kotak yang isinya salah diberi garis merah — penanda visual, bukan hanya teks di bawahnya. */
const kelasSalah = " !border-red-300 !ring-2 !ring-red-100";
/** Simpanan isian sementara di perangkat pendaftar. Formulir ini panjang (13 isian + unggahan) dan
 *  diisi dari HP di jaringan sekolah/desa — tanpa ini, satu kali halaman tertutup atau koneksi
 *  putus berarti mengetik ulang semuanya. Dihapus begitu pendaftaran berhasil terkirim. */
const KUNCI_DRAF = "spmb-draf-formulir";

type DocKey = "ijazah" | "kk" | "ktp_wali" | "foto" | "dokumen_lain";

interface DocConfig {
  key: DocKey;
  label: string;
  hint: string;
  accept: string;
  icon: React.ElementType;
}

const ui = {
  id: {
    docs: [
      { key: "ijazah" as DocKey, label: "Ijazah / SKL SMP/MTs", hint: "JPG, PNG, atau PDF · foto HP otomatis dikecilkan" },
      { key: "kk" as DocKey, label: "Kartu Keluarga (KK)", hint: "JPG, PNG, atau PDF · foto HP otomatis dikecilkan" },
      { key: "ktp_wali" as DocKey, label: "KTP Orang Tua / Wali", hint: "JPG, PNG, atau PDF · foto HP otomatis dikecilkan" },
      { key: "foto" as DocKey, label: "Pas Foto (3×4)", hint: "JPG atau PNG · tegak, wajah terlihat jelas" },
      { key: "dokumen_lain" as DocKey, label: "Dokumen Lain (Opsional)", hint: "Sertifikat, piagam, dll" },
    ],
    clickUpload: "Klik untuk upload",
    uploadFailed: "Upload gagal, coba lagi",
    uploading: "Mengupload",
    viewFile: "Lihat file",
    memproses: "Menyiapkan foto…",
    terlaluBesar: "Berkas lebih dari 5 MB. Kirim foto/PDF yang lebih kecil.",
    dikecilkan: (a: string, b: string) => `dikecilkan ${a} → ${b}`,
    hapusBerkas: "Hapus berkas",
    memeriksaWajah: "Memeriksa pas foto…",
    saranJudul: "Sebaiknya foto ulang:",
    gantiFoto: "Ganti foto",
    saranTetap: "Atau biarkan bila menurut Anda sudah jelas.",
    rapikan: "Potong & luruskan",
    dirapikan: "dipotong & diluruskan",
    rapikanPas: "Rapikan pas foto",
    pasDirapikan: "dipotong 3×4",
    pindaiKamera: "Pindai dengan kamera",
    ambilFoto: "Ambil foto dengan kamera",
    salahKotak: (n: number) => `${n} berkas tampaknya salah kotak — lihat peringatan kuning di bawah berkasnya. Bila berkas Anda memang sudah benar, tekan Daftar sekali lagi.`,
    docRequired: (label: string) => `Dokumen "${label}" wajib diupload.`,
    submitFailed: "Gagal mengirim pendaftaran, coba lagi.",
    connFailed: "Koneksi gagal, silakan coba lagi.",
    docHintUmum: "JPG, PNG, atau PDF — maks. 5MB",
    refLabel: "Kode Referral / Perujuk",
    refPh: "Kosongkan bila tidak ada",
    refKet: "Diisi bila ada siswa, guru, atau alumni yang mengajak Anda mendaftar.",
    refMemeriksa: "Memeriksa kode…",
    refKetemu: (nama: string, jenis: string) => `Kode atas nama ${nama} (${jenis}).`,
    refTidakAda: "Kode tidak dikenali. Periksa kembali, atau kosongkan saja.",
    refOtomatis: "Kode perujuk terisi otomatis dari tautan yang Anda buka.",
    langkah: ["Data Diri", "Kontak & Alamat", "Sekolah & Pilihan", "Berkas"],
    lanjut: "Lanjut", kembali: "Kembali", dariLangkah: (a: number, b: number) => `Langkah ${a} dari ${b}`,
    drafAda: "Isian Anda sebelumnya dipulihkan dari perangkat ini.",
    drafHapus: "Mulai dari kosong",
    ringkasGalat: (n: number) => `Ada ${n} isian yang perlu diperbaiki sebelum pendaftaran bisa dikirim:`,
    ringkasGalatSatu: "Satu isian perlu diperbaiki sebelum pendaftaran bisa dikirim:",
    opsional: "opsional",
    nomorLabel: "Nomor pendaftaran Anda",
    nomorKet: "Simpan atau foto nomor ini. Status pendaftaran dibuka dengan nomor ini dan tanggal lahir Anda.",
    salin: "Salin nomor",
    lihatTahapan: "Lihat Tahapan Pendaftaran",
    gabungGrup: "Gabung Grup WhatsApp Gelombang",
    grupKet: "Informasi jadwal dan pengumuman dibagikan panitia di grup ini.",
    tersalin: "Nomor tersalin",
    gagalSalin: "Nomor belum tersalin — catat manual",
    successTitle: "Pendaftaran Terkirim!",
    successDesc: (name: string) => <>Terima kasih, <strong>{name}</strong>. Pantau setiap tahap di halaman Tahapan Pendaftaran dan aktifkan pemberitahuan di sana — kabar dari panitia langsung masuk ke HP Anda.</>,
    registerAgain: "Daftar lagi",
    formTitle: "Formulir Pendaftaran Online",
    formDesc: "Isi dengan lengkap dan benar. Tanda",
    formDescSuffix: "wajib diisi.",
    name: "Nama", namePh: "Tuliskan Nama Sesuai Ijazah SMP/MTs",
    birthPlace: "Tempat Lahir", birthPlacePh: "Tuliskan Tempat Lahir",
    birthDate: "Tanggal Lahir", datePickerPh: "Pilih tanggal",
    gender: "Jenis Kelamin", selectPlaceholder: "Silakan Pilih", male: "Laki-laki", female: "Perempuan",
    nik: "Nomor Induk Keluarga (NIK)", nikPh: "Tuliskan NIK (16 digit)",
    phone: "Nomor WhatsApp", phonePh: "Masukkan No WhatsApp",
    nisn: "NISN", nisnPh: "Isi NISN Anda (10 digit)",
    address: "Alamat Lengkap", addressPh: "Contoh: Dsn. Krajan, RT 001, RW 002, Ds. Sragi, Kec. Songgon, Kab. Banyuwangi",
    prevSchool: "Nama Sekolah Asal SMP/MTs", prevSchoolPh: "Tuliskan Nama Sekolah Asal",
    email: "E-mail",
    guardian: "Nama Wali", guardianPh: "Tuliskan Nama Wali Anda",
    major: "Konsentrasi Keahlian",
    docsTitle: "Dokumen Pendukung",
    sending: "Mengirim...",
    submit: "Kirim Pendaftaran",
    terms: "Dengan mendaftar, Anda menyetujui syarat dan ketentuan SPMB yang berlaku.",
  },
  en: {
    docs: [
      { key: "ijazah" as DocKey, label: "Diploma / Junior High Graduation Certificate", hint: "JPG, PNG, or PDF · phone photos are reduced automatically" },
      { key: "kk" as DocKey, label: "Family Card (KK)", hint: "JPG, PNG, or PDF · phone photos are reduced automatically" },
      { key: "ktp_wali" as DocKey, label: "Parent / Guardian ID Card", hint: "JPG, PNG, or PDF · phone photos are reduced automatically" },
      { key: "foto" as DocKey, label: "Photo (3×4)", hint: "JPG or PNG · portrait, face clearly visible" },
      { key: "dokumen_lain" as DocKey, label: "Other Document (Optional)", hint: "Certificates, awards, etc." },
    ],
    clickUpload: "Click to upload",
    uploadFailed: "Upload failed, please try again",
    uploading: "Uploading",
    viewFile: "View file",
    memproses: "Preparing photo…",
    terlaluBesar: "File is over 5 MB. Please send a smaller photo/PDF.",
    dikecilkan: (a: string, b: string) => `reduced ${a} → ${b}`,
    hapusBerkas: "Remove file",
    memeriksaWajah: "Checking photo…",
    saranJudul: "Consider retaking the photo:",
    gantiFoto: "Replace photo",
    saranTetap: "Or keep it if it looks clear to you.",
    rapikan: "Crop & straighten",
    dirapikan: "cropped & straightened",
    rapikanPas: "Tidy up photo",
    pasDirapikan: "cropped to 3×4",
    pindaiKamera: "Scan with camera",
    ambilFoto: "Take photo with camera",
    salahKotak: (n: number) => `${n} file(s) seem to be in the wrong box — see the yellow warning under the file. If your files are correct, press Register once more.`,
    docRequired: (label: string) => `The "${label}" document is required.`,
    submitFailed: "Failed to submit registration, please try again.",
    connFailed: "Connection failed, please try again.",
    docHintUmum: "JPG, PNG, or PDF — max. 5MB",
    refLabel: "Referral Code",
    refPh: "Leave blank if none",
    refKet: "Fill in if a student, teacher or alumnus invited you to register.",
    refMemeriksa: "Checking the code…",
    refKetemu: (nama: string, jenis: string) => `Code belongs to ${nama} (${jenis}).`,
    refTidakAda: "Code not recognised. Check it again, or simply leave it blank.",
    refOtomatis: "The referral code was filled in automatically from the link you opened.",
    langkah: ["Personal Data", "Contact & Address", "School & Choice", "Documents"],
    lanjut: "Next", kembali: "Back", dariLangkah: (a: number, b: number) => `Step ${a} of ${b}`,
    drafAda: "Your previous entries were restored from this device.",
    drafHapus: "Start from blank",
    ringkasGalat: (n: number) => `${n} fields need fixing before your registration can be sent:`,
    ringkasGalatSatu: "One field needs fixing before your registration can be sent:",
    opsional: "optional",
    nomorLabel: "Your registration number",
    nomorKet: "Save or photograph this number. Your status is opened with this number and your date of birth.",
    salin: "Copy number",
    lihatTahapan: "View Registration Progress",
    gabungGrup: "Join the Wave WhatsApp Group",
    grupKet: "The committee shares schedules and announcements in this group.",
    tersalin: "Number copied",
    gagalSalin: "Not copied — please write it down",
    successTitle: "Registration Submitted!",
    successDesc: (name: string) => <>Thank you, <strong>{name}</strong>. Track every step on the Registration Progress page and turn on notifications there — updates from the committee go straight to your phone.</>,
    registerAgain: "Register again",
    formTitle: "Online Registration Form",
    formDesc: "Fill in completely and accurately. Fields marked",
    formDescSuffix: "are required.",
    name: "Full Name", namePh: "Write your name as it appears on your junior high diploma",
    birthPlace: "Place of Birth", birthPlacePh: "Write your place of birth",
    birthDate: "Date of Birth", datePickerPh: "Select date",
    gender: "Gender", selectPlaceholder: "Please Select", male: "Male", female: "Female",
    nik: "Family ID Number (NIK)", nikPh: "Write your NIK (16 digits)",
    phone: "WhatsApp Number", phonePh: "Enter your WhatsApp number",
    nisn: "NISN", nisnPh: "Enter your NISN (10 digits)",
    address: "Full Address", addressPh: "Example: Dsn. Krajan, RT 001, RW 002, Ds. Sragi, Kec. Songgon, Kab. Banyuwangi",
    prevSchool: "Previous Junior High School Name", prevSchoolPh: "Write your previous school name",
    email: "Email",
    guardian: "Guardian's Name", guardianPh: "Write your guardian's name",
    major: "Chosen Major",
    docsTitle: "Supporting Documents",
    sending: "Sending...",
    submit: "Submit Registration",
    terms: "By registering, you agree to the applicable SPMB terms and conditions.",
  },
};

type FormData = {
  fullName: string; birthPlace: string; birthDate: string; gender: string;
  nik: string; phone: string; nisn: string; address: string;
  previousSchool: string; email: string; guardianName: string; chosenMajor: string; jalur: string;
  /** Kode referral — opsional, dan BUKAN bagian dari `periksaFormulirSpmb`: kode yang salah
   *  tidak boleh menggagalkan pendaftaran. */
  perujukKode: string;
  /** Wilayah terstruktur (kode Kepmendagri) — untuk peta sebaran pendaftar. Opsional. */
  kabupatenKode: string; kecamatanKode: string; desaKode: string;
};

const JALUR_OPTIONS: Record<Lang, { value: string; label: string }[]> = {
  id: [
    { value: "REGULER", label: "Reguler" },
    { value: "PRESTASI_AKADEMIK", label: "Prestasi Akademik" },
    { value: "PRESTASI_NON_AKADEMIK", label: "Prestasi Non-Akademik" },
    { value: "TAHFIDZ", label: "Tahfidz Qur'an" },
    { value: "AFIRMASI", label: "Afirmasi" },
  ],
  en: [
    { value: "REGULER", label: "Regular" },
    { value: "PRESTASI_AKADEMIK", label: "Academic Achievement" },
    { value: "PRESTASI_NON_AKADEMIK", label: "Non-Academic Achievement" },
    { value: "TAHFIDZ", label: "Qur'an Memorization (Tahfidz)" },
    { value: "AFIRMASI", label: "Affirmation" },
  ],
};
const LABEL_JALUR: Record<Lang, string> = { id: "Jalur Pendaftaran", en: "Admission Track" };

type DocUrls = Partial<Record<DocKey, string>>;
type DocStatus = Partial<Record<DocKey, "idle" | "uploading" | "done" | "error">>;

type FormConfig = Record<string, string>;
/** Dokumen syarat yang didaftarkan panitia di /pusat-spmb/pengaturan (TAMBAHAN di luar lima slot baku). */
type SyaratDok = { id: string; nama: string; keterangan: string | null; wajib: boolean };

const EMPTY: FormData = {
  fullName: "", birthPlace: "", birthDate: "", gender: "",
  nik: "", phone: "", nisn: "", address: "",
  previousSchool: "", email: "", guardianName: "", chosenMajor: "", jalur: "REGULER",
  perujukKode: "", kabupatenKode: "", kecamatanKode: "", desaKode: "",
};

/** Pesan merah di bawah kotak isian. `role="alert"` supaya pembaca layar menyebutkannya. */
function Galat({ pesan }: { pesan?: string }) {
  if (!pesan) return null;
  return <p role="alert" className="mt-1.5 text-xs font-medium text-red-600">{pesan}</p>;
}

function FileUploadField({
  config, required, onUploaded, onBerkas, t, lang,
}: { config: DocConfig; required: boolean; onUploaded: (url: string) => void; onBerkas?: (file: File, kanvas: HTMLCanvasElement | null) => void; t: typeof ui["id"]; lang: Lang }) {
  const [status, setStatus] = useState<"idle" | "memproses" | "uploading" | "done" | "error">("idle");
  const [fileName, setFileName] = useState("");
  const [url, setUrl] = useState("");
  const [ukuran, setUkuran] = useState<{ asal: number; jadi: number } | null>(null);
  const [saran, setSaran] = useState<string[]>([]);
  const [memeriksa, setMemeriksa] = useState(false);
  const [pesanGagal, setPesanGagal] = useState("");
  const [dirapikan, setDirapikan] = useState(false);
  /** Pemindai dokumen terbuka. `otomatis` = terbuka sendiri sebelum unggah (tepi kertas terduga). */
  const [pindai, setPindai] = useState<{ sudut: Sudut | null; otomatis: boolean } | null>(null);
  /** Foto ASLI (sudah dikecilkan) — disimpan supaya bisa dirapikan ulang tanpa memilih berkas lagi. */
  const sumber = useRef<{ file: File; kanvas: HTMLCanvasElement; ukuranAsal: number; wajah?: Kotak } | null>(null);
  /** Foto Pas Otomatis terbuka (potong 3×4 + ganti latar). `otomatis` = terbuka sendiri sebelum unggah. */
  const [pas, setPas] = useState<{ wajah: Kotak; otomatis: boolean } | null>(null);
  /** Kamera di dalam halaman — hanya di HTTPS; diperiksa setelah terpasang supaya tidak beda dengan render server. */
  const [adaKamera, setAdaKamera] = useState(false);
  const [kamera, setKamera] = useState(false);
  useEffect(() => { setAdaKamera(kameraTersedia()); }, []);
  const ref = useRef<HTMLInputElement>(null);
  const pasFoto = config.key === "foto";
  const giliran = useRef(0);

  // Foto dikecilkan DI HP dulu (olah-foto.ts) — foto kamera 4–8 MB sering gagal terkirim di sinyal lemah.
  // Foto DOKUMEN yang tepi kertasnya terduga dibuka di pemindai (potong, luruskan, jernihkan) sebelum diunggah;
  // yang tidak terduga langsung diunggah dan bisa dirapikan belakangan lewat tombol "Potong & luruskan".
  async function handleFile(asli: File) {
    const ke = ++giliran.current;
    sumber.current = null;
    setStatus("memproses"); setFileName(asli.name); setSaran([]); setUkuran(null); setPesanGagal(""); setDirapikan(false);
    const olah = await kecilkanFoto(asli, pasFoto ? 1600 : 2000).catch(() => null);
    if (giliran.current !== ke) return;
    const file = olah?.file ?? asli;
    if (olah?.kanvas && pasFoto) {
      // Pas foto: bila wajah ditemukan dan fotonya BELUM berbentuk pas foto (bukan 3×4, atau pemeriksa memberi
      // saran), tawarkan Foto Pas Otomatis. Pas foto studio yang sudah benar langsung diunggah apa adanya.
      const wajah = await wajahUtama(olah.kanvas);
      if (giliran.current !== ke) return;
      if (wajah) {
        sumber.current = { file, kanvas: olah.kanvas, ukuranAsal: olah.ukuranAsal, wajah };
        const bentuk = olah.kanvas.height / olah.kanvas.width;
        const catatan = bentuk < 1.25 || bentuk > 1.42 ? ["bentuk"] : await periksaPasFoto(olah.kanvas, lang).catch(() => []);
        if (giliran.current !== ke) return;
        if (catatan.length) { setPas({ wajah, otomatis: true }); return; }
      }
    }
    if (olah?.kanvas && !pasFoto) {
      sumber.current = { file, kanvas: olah.kanvas, ukuranAsal: olah.ukuranAsal };
      const sudut = deteksiDokumen(olah.kanvas);
      if (sudut) { setPindai({ sudut, otomatis: true }); return; }
    }
    unggah(file, olah?.kanvas ?? null, olah?.dikecilkan ? olah.ukuranAsal : null, false, ke);
  }

  async function unggah(file: File, kanvas: HTMLCanvasElement | null, ukuranAsal: number | null, rapi: boolean, ke: number) {
    if (file.size > 5 * 1024 * 1024) { setStatus("error"); setPesanGagal(t.terlaluBesar); return; }
    setSaran([]);
    if (kanvas) {
      const awal = periksaMutu(kanvas, lang);
      setSaran(awal);
      if (pasFoto) {
        setMemeriksa(true);
        periksaPasFoto(kanvas, lang).then(w => { if (giliran.current === ke) setSaran([...awal, ...w]); })
          .catch(() => {}).finally(() => { if (giliran.current === ke) setMemeriksa(false); });
      }
    }
    setStatus("uploading"); setFileName(file.name);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", config.key);
      const res = await fetch("/api/admissions/upload", { method: "POST", body: fd });
      const data = await res.json().catch(() => null);
      if (giliran.current !== ke) return;
      if (res.ok && data?.url) {
        setStatus("done");
        setUrl(data.url);
        setUkuran(ukuranAsal ? { asal: ukuranAsal, jadi: file.size } : null);
        setDirapikan(rapi);
        onUploaded(data.url);
        onBerkas?.(file, kanvas);
      } else {
        setStatus("error"); setPesanGagal(data?.error || t.uploadFailed);
      }
    } catch {
      // Dulu tanpa penangkap: sinyal putus di tengah unggah membuat "Mengupload…" berputar selamanya.
      if (giliran.current === ke) { setStatus("error"); setPesanGagal(t.uploadFailed); }
    }
  }

  /** Hasil pemindai dipakai: dijadikan berkas JPEG lalu diunggah (menggantikan unggahan sebelumnya bila ada). */
  async function pakaiHasil(hasil: HTMLCanvasElement) {
    const s = sumber.current;
    setPindai(null); setPas(null);
    if (!s) return;
    const ke = ++giliran.current;
    setStatus("memproses");
    const file = await kanvasKeFile(hasil, s.file.name).catch(() => null);
    if (giliran.current !== ke) return;
    if (file) unggah(file, hasil, s.ukuranAsal, true, ke);
    else unggah(s.file, s.kanvas, s.ukuranAsal, false, ke);
  }

  /** Pemindai ditutup tanpa hasil. Saat terbuka otomatis, unggahan dilanjutkan dengan foto asli — tidak pernah menggantung. */
  function tutupPindai() {
    const p = pindai ?? pas, s = sumber.current;
    setPindai(null); setPas(null);
    if (p?.otomatis && s) unggah(s.file, s.kanvas, s.ukuranAsal, false, giliran.current);
  }

  /** "Pakai Foto Asli": saat terbuka otomatis = lanjut unggah; saat dibuka belakangan = kembali ke foto asli
   *  hanya bila yang terunggah sekarang adalah hasil rapikan. */
  function pakaiAsli() {
    const p = pindai ?? pas, s = sumber.current;
    setPindai(null); setPas(null);
    if (s && (p?.otomatis || dirapikan)) unggah(s.file, s.kanvas, s.ukuranAsal, false, ++giliran.current);
  }

  function clear() {
    giliran.current++;
    setStatus("idle");
    setFileName("");
    setUrl("");
    setUkuran(null); setSaran([]); setMemeriksa(false); setPesanGagal(""); setDirapikan(false); setPindai(null); setPas(null);
    sumber.current = null;
    onUploaded("");
    if (ref.current) ref.current.value = "";
  }

  const Icon = config.icon;

  return (
    <div>
      <label className={labelClass}>
        {config.label} {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {status === "idle" || status === "error" ? (
        <>
        <label className="flex flex-col items-center justify-center w-full h-28 rounded-xl border-2 border-dashed border-gray-200 hover:border-primary-500 bg-gray-50 hover:bg-primary-50 cursor-pointer transition-colors">
          <Icon size={22} className="text-gray-300 mb-1" />
          <span className="text-xs text-gray-400 font-medium">{t.clickUpload}</span>
          <span className="text-xs text-gray-400 mt-0.5 px-3 text-center">{config.hint}</span>
          {status === "error" && <span className="text-xs text-red-500 mt-1 px-3 text-center">{pesanGagal || t.uploadFailed}</span>}
          <input ref={ref} type="file" accept={config.accept} className="hidden" required={required && !url}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        </label>
        {adaKamera && (
          <button type="button" onClick={() => setKamera(true)} className="btn-modal-cancel btn-teks mt-2 w-full">
            <Camera size={16} /> {pasFoto ? t.ambilFoto : t.pindaiKamera}
          </button>
        )}
        </>
      ) : status === "memproses" || status === "uploading" ? (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 bg-gray-50">
          <Loader2 size={20} className="animate-spin text-gray-400" />
          <span className="min-w-0 truncate text-sm text-gray-500">{status === "memproses" ? t.memproses : `${t.uploading} ${fileName}…`}</span>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-3 p-4 rounded-xl border border-emerald-200 bg-emerald-50">
            <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-emerald-700 truncate">{fileName}</p>
              <p className="text-xs text-emerald-700">
                <a href={url} target="_blank" rel="noopener noreferrer" className="hover:underline">{t.viewFile}</a>
                {ukuran && <span className="angka text-emerald-600"> · {t.dikecilkan(ukuranTeks(ukuran.asal), ukuranTeks(ukuran.jadi))}</span>}
                {dirapikan && <span className="text-emerald-600"> · {pasFoto ? t.pasDirapikan : t.dirapikan}</span>}
              </p>
            </div>
            {sumber.current && !pasFoto && (
              <button type="button" onClick={() => setPindai({ sudut: sumber.current ? deteksiDokumen(sumber.current.kanvas) : null, otomatis: false })}
                className="btn-modal-cancel btn-teks shrink-0 px-3 py-1.5 text-xs"><Crop size={14} /> {t.rapikan}</button>
            )}
            {sumber.current?.wajah && pasFoto && (
              <button type="button" onClick={() => setPas({ wajah: sumber.current!.wajah!, otomatis: false })}
                className="btn-modal-cancel btn-teks shrink-0 px-3 py-1.5 text-xs"><Crop size={14} /> {t.rapikanPas}</button>
            )}
            <button type="button" onClick={clear} title={t.hapusBerkas} className="sentuh text-gray-400 hover:text-red-500 transition-colors">
              <X size={15} />
            </button>
          </div>
          {memeriksa && <p className="flex items-center gap-1.5 text-xs text-gray-400"><Loader2 size={12} className="animate-spin" /> {t.memeriksaWajah}</p>}
          {saran.length > 0 && (
            <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-800">
              <p className="font-semibold">{t.saranJudul}</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">{saran.map(x => <li key={x}>{x}</li>)}</ul>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <button type="button" onClick={clear} className="btn-modal-cancel btn-teks px-3 py-1.5 text-xs"><Upload size={14} /> {t.gantiFoto}</button>
                <span className="text-xs text-amber-700">{t.saranTetap}</span>
              </div>
            </div>
          )}
        </div>
      )}
      {pindai && sumber.current && (
        <PemindaiDokumen kanvas={sumber.current.kanvas} sudutAwal={pindai.sudut} lang={lang}
          onPakai={pakaiHasil} onAsli={pakaiAsli} onTutup={tutupPindai} />
      )}
      {pas && sumber.current && (
        <PasFotoOtomatis kanvas={sumber.current.kanvas} wajah={pas.wajah} lang={lang}
          onPakai={pakaiHasil} onAsli={pakaiAsli} onTutup={tutupPindai} />
      )}
      {kamera && (
        <KameraBerkas mode={pasFoto ? "swafoto" : "dokumen"} lang={lang} onTutup={() => setKamera(false)}
          onFoto={f => { setKamera(false); handleFile(f); }} />
      )}
    </div>
  );
}

export default function AdmissionsForm({ lang = "id" }: { lang?: Lang }) {
  const t = ui[lang];
  const DOCS: DocConfig[] = t.docs.map((d, i) => ({
    ...d,
    accept: i === 3 ? "image/*" : "image/*,application/pdf",
    icon: i === 3 ? ImageIcon : FileText,
  }));
  const [form, setForm] = useState<FormData>(EMPTY);
  const [docUrls, setDocUrls] = useState<DocUrls>({});
  const [config, setConfig] = useState<FormConfig>({});
  const [syarat, setSyarat] = useState<SyaratDok[]>([]);
  const [berkasSyarat, setBerkasSyarat] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState(false);
  const [nomor, setNomor] = useState("");
  const [pesanSalin, setPesanSalin] = useState("");
  // Kunci halaman tahapan & tautan grup WA gelombang — tampil TEPAT setelah daftar (user 6 Okt 2026).
  const [tanda, setTanda] = useState("");
  const [tautanGrup, setTautanGrup] = useState("");
  const [error, setError] = useState("");
  /** Pesan per isian. Kuncinya sama dengan nama isian supaya bisa ditempel di bawah kotaknya. */
  const [galat, setGalat] = useState<Partial<Record<KunciIsian | "dokumen", string>>>({});
  const [jalurOpsi, setJalurOpsi] = useState<Jalur[]>([]);
  const [drafDipulihkan, setDrafDipulihkan] = useState(false);
  /** Formulir dipecah 4 langkah (permintaan user 2 Oktober 2026: "kan itu panjang"). Sebagian besar
   *  calon mengisi dari HP; 13 isian + unggahan dalam satu gulungan membuat orang menyerah di tengah.
   *  Isinya TETAP satu state — berpindah langkah tidak pernah menghilangkan yang sudah diketik. */
  const [langkah, setLangkah] = useState(0);
  const [refStatus, setRefStatus] = useState<{ keadaan: "diam" | "cek" | "ada" | "kosong"; nama?: string; label?: string }>({ keadaan: "diam" });
  const [refDariTautan, setRefDariTautan] = useState(false);
  const ringkasRef = useRef<HTMLDivElement | null>(null);
  // Lanjut/Kembali menggulir ke AWAL KARTU FORMULIR, bukan ke puncak halaman (laporan user 6 Okt 2026: "klik lanjut malah
  // gulir ke halaman paling atas" — dulu window.scrollTo({ top: 0 })). scroll-mt memberi ruang untuk navbar yang menempel.
  const kartuRef = useRef<HTMLDivElement>(null);
  const keAwalKartu = () => requestAnimationFrame(() => kartuRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  const [majors, setMajors] = useState<{ code: string; name: string }[]>([]);
  const [ocr, setOcr] = useState<Record<string, KeadaanOcr>>({});
  const [kabupatenList, setKabupatenList] = useState<{ k: string; n: string; p: string }[]>([]);
  const [kecamatanList, setKecamatanList] = useState<{ k: string; n: string }[]>([]);
  const [desaKab, setDesaKab] = useState<{ k: string; n: string }[]>([]);

  // Daftar wilayah resmi (public/data/wilayah) — kabupaten sekali saat dimuat, kecamatan per kabupaten.
  useEffect(() => {
    fetch("/data/wilayah/kabupaten.json").then(r => r.json()).then(setKabupatenList).catch(() => {});
  }, []);
  useEffect(() => {
    if (!form.kabupatenKode) { setKecamatanList([]); return; }
    fetch(`/data/wilayah/kec/${form.kabupatenKode}.json`).then(r => r.json()).then(setKecamatanList).catch(() => setKecamatanList([]));
    fetch(`/data/wilayah/desa/${form.kabupatenKode}.json`).then(r => r.json()).then(setDesaKab).catch(() => setDesaKab([]));
  }, [form.kabupatenKode]);
  const desaList = form.kecamatanKode ? desaKab.filter(d => d.k.startsWith(form.kecamatanKode + ".")) : [];

  // Jejak corong: langkah yang DICAPAI (bukan yang sedang dilihat saat kembali) dan pendaftaran berhasil.
  useEffect(() => { if (langkah > 0) catatJejak(`LANGKAH_${langkah + 1}`); }, [langkah]);
  useEffect(() => { if (success) catatJejak("KIRIM"); }, [success]);

  /** Jurusan pilihan dari kuis minat jurusan: lewat tautan `?jurusan=KODE` (hasil kuis yang
   *  dibagikan) atau peristiwa `spmb-pilih-jurusan` (kuis di halaman yang sama). Hanya mengisi bila
   *  isian jurusan masih kosong ATAU pendaftar menekan tombol di kuis secara sadar. */
  useEffect(() => {
    if (!majors.length) return;
    const pasang = (kode: string, paksa: boolean) => {
      const m = majors.find(x => x.code.toUpperCase() === kode.toUpperCase());
      if (!m) return;
      const label = `${m.name} (${m.code})`;
      setForm(f => (paksa || !f.chosenMajor ? { ...f, chosenMajor: label } : f));
    };
    try {
      const dariUrl = new URLSearchParams(window.location.search).get("jurusan");
      if (dariUrl) pasang(dariUrl, false);
    } catch { /* abaikan */ }
    const dengar = (e: Event) => pasang(String((e as CustomEvent).detail ?? ""), true);
    window.addEventListener("spmb-pilih-jurusan", dengar);
    return () => window.removeEventListener("spmb-pilih-jurusan", dengar);
  }, [majors]);

  /** KK, ijazah, dan KTP wali dibaca otomatis setelah terunggah: KK & ijazah untuk MEMERIKSA ketikan
   *  (ocr-berkas.ts), dan ketiganya untuk mengenali berkas yang salah kotak (kenali-dokumen.ts).
   *  Berkas yang nyaris tanpa tulisan diperiksa wajahnya — pas foto yang masuk kotak dokumen. */
  function periksaBerkas(kunci: string, file: File, kanvas: HTMLCanvasElement | null) {
    if (!JENIS_KOTAK[kunci]) return;
    setSalahDitegur(false);
    if (!BISA_DIBACA.test(file.type)) { setOcr(o => ({ ...o, [kunci]: { keadaan: "lewat" } })); return; }
    setOcr(o => ({ ...o, [kunci]: { keadaan: "baca" } }));
    bacaBerkas(file)
      .then(async hasil => {
        let salah: KeadaanOcr["salah"] = hasil ? salahKotak(kunci, hasil.teks) : null;
        if (!salah && kanvas && (hasil?.teks.replace(/\s/g, "").length ?? 0) < 60 && await wajahDominan(kanvas)) salah = "foto";
        setOcr(o => ({ ...o, [kunci]: { keadaan: "siap", hasil, salah } }));
      })
      .catch(() => setOcr(o => ({ ...o, [kunci]: { keadaan: "gagal" } })));
  }
  /** Teguran salah kotak hanya menahan Daftar SEKALI — dugaan bisa keliru, calon tetap boleh melanjutkan. */
  const [salahDitegur, setSalahDitegur] = useState(false);
  const [isPending, startTransition] = useTransition();

  /** Kode perujuk datang lewat `?ref=KODE` (tautan atau QR yang dibagikan perujuk) — diisikan
   *  sendiri supaya calon tidak perlu mengetik apa pun. Disimpan juga di sessionStorage agar tidak
   *  hilang bila calon membuka halaman lain dulu sebelum mengisi formulir. */
  useEffect(() => {
    try {
      const dariUrl = new URLSearchParams(window.location.search).get("ref");
      const simpan = sessionStorage.getItem("spmb-ref");
      const kode = (dariUrl || simpan || "").trim().toUpperCase().slice(0, 40);
      if (!kode) return;
      if (dariUrl) sessionStorage.setItem("spmb-ref", kode);
      setForm(f => (f.perujukKode ? f : { ...f, perujukKode: kode }));
      setRefDariTautan(true);
    } catch { /* mode privat */ }
  }, []);

  // Dipulihkan di useEffect (bukan saat render) supaya HTML dari server dan hasil hidrasi sama.
  useEffect(() => {
    try {
      const simpan = localStorage.getItem(KUNCI_DRAF);
      if (!simpan) return;
      const d = JSON.parse(simpan) as Partial<FormData>;
      if (d && typeof d === "object" && Object.values(d).some(v => typeof v === "string" && v.trim())) {
        setForm(f => ({ ...f, ...d }));
        setDrafDipulihkan(true);
      }
    } catch { /* simpanan rusak diabaikan */ }
  }, []);

  // Simpan tiap perubahan. Dokumen TIDAK ikut disimpan — berkasnya sudah terunggah di server dan
  // alamatnya tidak perlu tertinggal di perangkat yang dipakai bergantian.
  useEffect(() => {
    if (success) return;
    try {
      if (Object.values(form).some(v => v.trim())) localStorage.setItem(KUNCI_DRAF, JSON.stringify(form));
    } catch { /* penyimpanan penuh / mode privat */ }
  }, [form, success]);

  useEffect(() => {
    fetch("/api/admissions/config").then(r => r.json()).then((d: FormConfig & { syarat?: SyaratDok[]; jalur?: Jalur[] }) => {
      const { syarat: daftar, ...setelan } = d ?? {};
      const { jalur, ...sisa } = setelan as FormConfig & { jalur?: Jalur[] };
      setConfig(sisa as FormConfig);
      setSyarat(Array.isArray(daftar) ? daftar : []);
      const dj = Array.isArray(jalur) ? jalur : [];
      setJalurOpsi(dj);
      // Jalur bawaan = yang pertama didaftarkan panitia, bukan "REGULER" yang ditulis mati.
      if (dj.length) setForm(f => (dj.some(j => j.kode === f.jalur) ? f : { ...f, jalur: dj[0].kode }));
    }).catch(() => {});
    fetch("/api/public/majors").then(r => r.json()).then(setMajors).catch(() => {});
  }, []);

  // Pemeriksaan kode ditunda 500 ms sejak ketikan terakhir — bukan tiap huruf. Endpointnya
  // dibatasi per IP, jadi memanggil tiap ketukan akan membuat pengisi yang wajar ikut kena batas.
  useEffect(() => {
    const kode = form.perujukKode.trim();
    if (kode.length < 3) { setRefStatus({ keadaan: "diam" }); return; }
    setRefStatus({ keadaan: "cek" });
    const id = setTimeout(() => {
      fetch(`/api/public/spmb-perujuk?kode=${encodeURIComponent(kode)}`)
        .then(r => r.json())
        .then(d => setRefStatus(d?.ketemu ? { keadaan: "ada", nama: d.nama, label: d.label } : { keadaan: "kosong" }))
        .catch(() => setRefStatus({ keadaan: "diam" }));
    }, 500);
    return () => clearTimeout(id);
  }, [form.perujukKode]);

  function setField(key: keyof FormData, value: string) {
    setForm(f => ({ ...f, [key]: value }));
    catatJejak("MULAI");
    // Pesan di bawah kotak hilang begitu isinya disentuh — bukan menetap sampai klik Daftar lagi.
    setGalat(g => (g[key as KunciIsian] ? { ...g, [key]: undefined } : g));
  }

  /** Isian berisi angka saja (NIK 16, NISN 10) disimpan sebagai TEKS — `type="number"` membuang
   *  angka 0 di depan, memunculkan tombol naik-turun, dan menerima "e"/"+" yang bukan angka. */
  function setAngka(key: keyof FormData, value: string, maks: number) {
    setField(key, value.replace(/\D/g, "").slice(0, maks));
  }

  function setDoc(key: DocKey, url: string) {
    setDocUrls(d => ({ ...d, [key]: url }));
  }

  function isRequired(key: string): boolean {
    return config[`form.require_${key}`] !== "0" && config[`form.require_${key}`] !== "off";
  }

  function isVisible(key: string): boolean {
    return config[`form.require_${key}`] !== "off";
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    // SELURUH isian diperiksa sekali jalan — pendaftar tidak perlu menekan Daftar lima kali
    // untuk menemukan lima kesalahan.
    const temuan: Partial<Record<KunciIsian | "dokumen", string>> = periksaFormulirSpmb(
      form as unknown as Partial<IsianSpmb>,
      { lang, longgar: { wajib: isRequired, tampil: isVisible }, kodeJalur: jalurOpsi.map(j => j.kode) },
    );

    // Dokumen wajib: lima slot baku + dokumen syarat yang didaftarkan panitia.
    const dokumenKurang: string[] = [];
    for (const doc of DOCS) {
      if (isRequired(doc.key) && isVisible(doc.key) && !docUrls[doc.key]) dokumenKurang.push(doc.label);
    }
    for (const sy of syarat) {
      if (sy.wajib && !berkasSyarat[sy.id]) dokumenKurang.push(sy.nama);
    }
    if (dokumenKurang.length) temuan.dokumen = t.docRequired(dokumenKurang.join(", "));

    setGalat(temuan);
    const jumlah = Object.keys(temuan).length;
    if (jumlah) {
      setError(jumlah === 1 ? t.ringkasGalatSatu : t.ringkasGalat(jumlah));
      // Gulir ke ringkasan supaya terlihat walau kesalahannya di bawah layar.
      requestAnimationFrame(() => ringkasRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
      return;
    }

    // Berkas yang terbaca sebagai jenis lain (KK di kotak ijazah) ditegur SEBELUM terkirim — sekali saja.
    const salah = Object.entries(ocr).filter(([k, v]) => v.salah && docUrls[k as DocKey]).length;
    if (salah && !salahDitegur) {
      setSalahDitegur(true);
      setLangkah(TERAKHIR);
      setError(t.salahKotak(salah));
      requestAnimationFrame(() => ringkasRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/admissions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...form, ...docUrls,
            berkas: Object.entries(berkasSyarat).map(([syaratId, berkas]) => ({ syaratId, berkas })),
          }),
        });
        const data = await res.json();
        if (res.ok) {
          setNomor(typeof data?.nomor === "string" ? data.nomor : "");
          setTanda(typeof data?.tanda === "string" ? data.tanda : "");
          setTautanGrup(typeof data?.tautanGrup === "string" ? data.tautanGrup : "");
          try { localStorage.removeItem(KUNCI_DRAF); } catch { /* abaikan */ }
          setSuccess(true);
        } else {
          // Server mengirim `kolom` berisi pesan per isian — ditempel di bawah kotaknya masing-masing.
          if (data?.kolom && typeof data.kolom === "object") {
            const kolom = data.kolom as Partial<Record<KunciIsian, string>>;
            setGalat(kolom);
            // Lompat ke langkah PERTAMA yang memuat isian bermasalah — kalau tidak, pendaftar
            // melihat daftar kesalahan di langkah Berkas sementara isiannya ada di langkah 1.
            const kunci = Object.keys(kolom) as KunciIsian[];
            const tujuan = ISIAN_LANGKAH.findIndex(g => g.some(k => kunci.includes(k)));
            if (tujuan >= 0) setLangkah(tujuan);
            requestAnimationFrame(() => ringkasRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
          }
          setError(data?.error || t.submitFailed);
        }
      } catch {
        setError(t.connFailed);
      }
    });
  }

  /** Isian milik tiap langkah — dipakai memeriksa HANYA langkah yang sedang dibuka saat menekan
   *  Lanjut, dan untuk melompat ke langkah yang salah bila server menolak. */
  const ISIAN_LANGKAH: KunciIsian[][] = [
    ["fullName", "birthPlace", "birthDate", "gender", "nik", "nisn"],
    ["phone", "email", "address", "guardianName"],
    ["previousSchool", "chosenMajor", "jalur"],
    [],
  ];
  const TERAKHIR = ISIAN_LANGKAH.length - 1;

  function periksaLangkah(n: number): boolean {
    const semua = periksaFormulirSpmb(form as unknown as Partial<IsianSpmb>, {
      lang, longgar: { wajib: isRequired, tampil: isVisible }, kodeJalur: jalurOpsi.map(j => j.kode),
    });
    const milikLangkah = Object.fromEntries(
      Object.entries(semua).filter(([k]) => ISIAN_LANGKAH[n].includes(k as KunciIsian)));
    setGalat(milikLangkah);
    const jumlah = Object.keys(milikLangkah).length;
    if (jumlah) {
      setError(jumlah === 1 ? t.ringkasGalatSatu : t.ringkasGalat(jumlah));
      requestAnimationFrame(() => ringkasRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
      return false;
    }
    setError("");
    return true;
  }

  const req = <span className="text-red-500 ml-0.5">*</span>;

  if (success) {
    return (
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-10 flex flex-col items-center justify-center text-center min-h-[400px]">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-5">
          <CheckCircle2 size={40} className="text-emerald-600" />
        </div>
        <h3 className="font-heading text-2xl font-bold text-primary-900 mb-2">{t.successTitle}</h3>
        <p className="text-gray-500 mb-4 max-w-sm leading-relaxed">
          {t.successDesc(form.fullName)}
        </p>
        {nomor && (
          <div className="mb-6 w-full max-w-sm rounded-2xl border border-primary-100 bg-primary-50 p-5">
            <p className="label-kecil text-primary-700">{t.nomorLabel}</p>
            <p className="angka font-heading my-1 text-2xl font-bold tracking-wider text-primary-900">{nomor}</p>
            <p className="text-xs leading-relaxed text-gray-500">{t.nomorKet}</p>
            <button type="button"
              onClick={async () => {
                // salinTeks, bukan navigator.clipboard langsung — situs juga dibuka lewat HTTP (CLAUDE.md #28)
                const ok = await salinTeks(nomor);
                setPesanSalin(ok ? t.tersalin : t.gagalSalin);
              }}
              className="btn-modal-cancel mt-3 w-full">
              <Copy size={16} /> {t.salin}
            </button>
            {pesanSalin && <p className="mt-2 text-xs font-medium text-primary-700">{pesanSalin}</p>}
          </div>
        )}
        {nomor && tanda && (
          <div className="mb-6 flex w-full max-w-sm flex-col gap-2">
            {tautanGrup && (
              <>
                <a href={tautanGrup} target="_blank" rel="noopener noreferrer"
                  onClick={() => {
                    fetch("/api/spmb/calon", { method: "POST", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ aksi: "grup-klik", nomor, t: tanda }) }).catch(() => {});
                  }}
                  className="btn-modal-save w-full"><MessageCircle size={16} /> {t.gabungGrup}</a>
                <p className="text-xs text-gray-500">{t.grupKet}</p>
              </>
            )}
            <a href={`/spmb/tahapan?nomor=${encodeURIComponent(nomor)}&t=${encodeURIComponent(tanda)}`}
              className={`${tautanGrup ? "btn-modal-cancel" : "btn-modal-save"} w-full`}><ListChecks size={16} /> {t.lihatTahapan}</a>
          </div>
        )}
        <p className="font-arabic text-primary-700 text-xl mb-6">جَزَاكُمُ اللَّهُ خَيْرًا</p>
        <button onClick={() => { setForm(EMPTY); setDocUrls({}); setSuccess(false); setNomor(""); setTanda(""); setTautanGrup(""); setPesanSalin(""); setLangkah(0); }}
          className="text-sm text-primary-700 hover:text-primary-900 underline underline-offset-2 transition-colors">
          {t.registerAgain}
        </button>
      </div>
    );
  }

  return (
    <div ref={kartuRef} className="scroll-mt-24 bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
      <h2 className="font-heading text-2xl font-bold text-navy mb-1">{t.formTitle}</h2>
      <p className="text-gray-500 text-sm mb-7">{t.formDesc} {req} {t.formDescSuffix}</p>

      {/* Penunjuk langkah — angka + batang kemajuan, cukup untuk 4 langkah dan tidak memakan
          ruang di layar HP. */}
      <div className="mb-6">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <p className="font-heading text-sm font-semibold text-navy">{t.langkah[langkah]}</p>
          <p className="angka text-xs text-gray-400">{t.dariLangkah(langkah + 1, t.langkah.length)}</p>
        </div>
        <div className="flex gap-1.5">
          {t.langkah.map((nama, i) => (
            <span key={nama} aria-hidden="true"
              className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                i <= langkah ? "bg-primary-700" : "bg-gray-200"}`} />
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {drafDipulihkan && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
            <p className="text-sm text-blue-800">{t.drafAda}</p>
            <button type="button"
              onClick={() => {
                setForm(EMPTY); setDocUrls({}); setBerkasSyarat({}); setGalat({}); setError("");
                try { localStorage.removeItem(KUNCI_DRAF); } catch { /* abaikan */ }
                setDrafDipulihkan(false);
              }}
              className="text-sm font-semibold text-blue-700 underline underline-offset-2">
              {t.drafHapus}
            </button>
          </div>
        )}
        {langkah === 0 && (
          <>
          {/* Nama */}
          <div>
            <label className={labelClass}>{t.name} {req}</label>
            <input value={form.fullName} onChange={e => setField("fullName", e.target.value)} type="text"
              autoComplete="name" maxLength={100} placeholder={t.namePh}
              aria-invalid={!!galat.fullName} className={inputClass + (galat.fullName ? kelasSalah : "")} />
            <Galat pesan={galat.fullName} />
          </div>
          {/* Tempat & Tanggal Lahir */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>{t.birthPlace} {req}</label>
              <input value={form.birthPlace} onChange={e => setField("birthPlace", e.target.value)} type="text"
                maxLength={60} placeholder={t.birthPlacePh}
                aria-invalid={!!galat.birthPlace} className={inputClass + (galat.birthPlace ? kelasSalah : "")} />
              <Galat pesan={galat.birthPlace} />
            </div>
            <div>
              <label className={labelClass}>{t.birthDate} {req}</label>
              <DatePicker value={form.birthDate} onChange={v => setField("birthDate", v)} placeholder={t.datePickerPh} />
              <Galat pesan={galat.birthDate} />
            </div>
          </div>
          {/* Jenis Kelamin */}
          <div>
            <label className={labelClass}>{t.gender} {req}</label>
            <Select value={form.gender} onChange={v => setField("gender", v)} placeholder={t.selectPlaceholder}
              options={[{ value: "Laki-laki", label: t.male }, { value: "Perempuan", label: t.female }]}
              buttonClassName={inputClass + (galat.gender ? kelasSalah : "") + " flex items-center justify-between gap-2 cursor-pointer"} />
            <Galat pesan={galat.gender} />
          </div>
          {/* NIK */}
          {isVisible("nik") && (
            <div>
              <label className={labelClass}>{t.nik} {isRequired("nik") && req}</label>
              <input value={form.nik} onChange={e => setAngka("nik", e.target.value, 16)} type="text"
                inputMode="numeric" pattern="[0-9]*" autoComplete="off" maxLength={16} placeholder={t.nikPh}
                aria-invalid={!!galat.nik} className={inputClass + (galat.nik ? kelasSalah : "")} />
              <Galat pesan={galat.nik} />
            </div>
          )}
          {/* NISN */}
          {isVisible("nisn") && (
            <div>
              <label className={labelClass}>{t.nisn} {isRequired("nisn") && req}</label>
              <input value={form.nisn} onChange={e => setAngka("nisn", e.target.value, 10)} type="text"
                inputMode="numeric" pattern="[0-9]*" autoComplete="off" maxLength={10} placeholder={t.nisnPh}
                aria-invalid={!!galat.nisn} className={inputClass + (galat.nisn ? kelasSalah : "")} />
              <Galat pesan={galat.nisn} />
            </div>
          )}
          </>
        )}

        {langkah === 1 && (
          <>
          {/* No WA */}
          <div>
            <label className={labelClass}>{t.phone} {req}</label>
            <input value={form.phone} onChange={e => setField("phone", e.target.value.replace(/[^0-9+\s-]/g, "").slice(0, 20))}
              type="tel" inputMode="tel" autoComplete="tel" placeholder={t.phonePh}
              aria-invalid={!!galat.phone} className={inputClass + (galat.phone ? kelasSalah : "")} />
            <Galat pesan={galat.phone} />
          </div>
          {/* Email */}
          <div>
            <label className={labelClass}>{t.email} {req}</label>
            <input value={form.email} onChange={e => setField("email", e.target.value.trim())} type="email"
              inputMode="email" autoComplete="email" maxLength={120} placeholder="contoh@gmail.com"
              aria-invalid={!!galat.email} className={inputClass + (galat.email ? kelasSalah : "")} />
            <Galat pesan={galat.email} />
          </div>
          {/* Kabupaten/Kota, Kecamatan & Desa — pilihan dari daftar resmi, untuk peta sebaran pendaftar. */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="min-w-0">
              <label className={labelClass}>{lang === "id" ? "Kabupaten/Kota" : "Regency/City"}</label>
              <Select value={form.kabupatenKode}
                onChange={v => setForm(f => v === f.kabupatenKode ? f : ({ ...f, kabupatenKode: v, kecamatanKode: "", desaKode: "" }))}
                placeholder={lang === "id" ? "Cari kabupaten/kota…" : "Search regency/city…"}
                options={kabupatenList.map(k => ({ value: k.k, label: `${k.n} — ${k.p}` }))}
                buttonClassName={inputClass + " flex items-center justify-between gap-2 cursor-pointer"} />
            </div>
            <div className="min-w-0">
              <label className={labelClass}>{lang === "id" ? "Kecamatan" : "District"}</label>
              <Select value={form.kecamatanKode} onChange={v => setForm(f => v === f.kecamatanKode ? f : ({ ...f, kecamatanKode: v, desaKode: "" }))}
                disabled={!form.kabupatenKode}
                placeholder={form.kabupatenKode ? (lang === "id" ? "Pilih kecamatan…" : "Choose district…") : (lang === "id" ? "Pilih kabupaten dulu" : "Choose regency first")}
                options={kecamatanList.map(k => ({ value: k.k, label: k.n }))}
                buttonClassName={inputClass + " flex items-center justify-between gap-2 cursor-pointer"} />
            </div>
            <div className="min-w-0">
              <label className={labelClass}>{lang === "id" ? "Desa/Kelurahan" : "Village"}</label>
              <Select value={form.desaKode} onChange={v => setField("desaKode", v)}
                disabled={!form.kecamatanKode}
                placeholder={form.kecamatanKode ? (lang === "id" ? "Pilih desa/kelurahan…" : "Choose village…") : (lang === "id" ? "Pilih kecamatan dulu" : "Choose district first")}
                options={desaList.map(k => ({ value: k.k, label: k.n }))}
                buttonClassName={inputClass + " flex items-center justify-between gap-2 cursor-pointer"} />
            </div>
          </div>
          {/* Alamat */}
          {isVisible("address") && (
            <div>
              <label className={labelClass}>{t.address} {isRequired("address") && req}</label>
              <textarea value={form.address} onChange={e => setField("address", e.target.value)}
                rows={3} maxLength={300} placeholder={t.addressPh}
                aria-invalid={!!galat.address} className={inputClass + " resize-none" + (galat.address ? kelasSalah : "")} />
              <Galat pesan={galat.address} />
            </div>
          )}
          {/* Nama Wali */}
          {isVisible("guardian") && (
            <div>
              <label className={labelClass}>{t.guardian} {isRequired("guardian") && req}</label>
              <input value={form.guardianName} onChange={e => setField("guardianName", e.target.value)} type="text"
                maxLength={100} placeholder={t.guardianPh}
                aria-invalid={!!galat.guardianName} className={inputClass + (galat.guardianName ? kelasSalah : "")} />
              <Galat pesan={galat.guardianName} />
            </div>
          )}
          </>
        )}

        {langkah === 2 && (
          <>
          {/* Asal Sekolah */}
          <div>
            <label className={labelClass}>{t.prevSchool} {req}</label>
            <IsianSekolahAsal value={form.previousSchool} onChange={v => setField("previousSchool", v)} placeholder={t.prevSchoolPh}
              invalid={!!galat.previousSchool} className={inputClass + (galat.previousSchool ? kelasSalah : "")}
              judulSaran={lang === "en" ? "Pick your school if it's listed:" : "Pilih bila sekolahmu ada di daftar:"} />
            <Galat pesan={galat.previousSchool} />
          </div>
          {/* Konsentrasi Keahlian */}
          <div>
            <label className={labelClass}>{t.major} {req}</label>
            <Select value={form.chosenMajor} onChange={v => setField("chosenMajor", v)} placeholder={t.selectPlaceholder}
              options={majors.map(m => { const label = `${m.name} (${m.code})`; return { value: label, label }; })}
              buttonClassName={inputClass + (galat.chosenMajor ? kelasSalah : "") + " flex items-center justify-between gap-2 cursor-pointer"} />
            <Galat pesan={galat.chosenMajor} />
          </div>
          {/* Jalur Pendaftaran */}
          <div>
            <label className={labelClass}>{LABEL_JALUR[lang]} {req}</label>
            <Select value={form.jalur} onChange={v => setField("jalur", v)}
              placeholder={t.selectPlaceholder}
              options={(jalurOpsi.length ? jalurOpsi.map(j => ({ value: j.kode, label: j.nama })) : JALUR_OPTIONS[lang])}
              buttonClassName={inputClass + (galat.jalur ? kelasSalah : "") + " flex items-center justify-between gap-2 cursor-pointer"} />
            <Galat pesan={galat.jalur} />
            {jalurOpsi.find(j => j.kode === form.jalur)?.keterangan && (
              <p className="mt-1.5 text-xs leading-relaxed text-gray-500">
                {jalurOpsi.find(j => j.kode === form.jalur)!.keterangan}
              </p>
            )}
          </div>
          {/* Kode Referral — opsional */}
          <div>
            <label className={labelClass}>{t.refLabel}</label>
            <input value={form.perujukKode}
              onChange={e => setField("perujukKode", e.target.value.toUpperCase().slice(0, 40))}
              type="text" autoComplete="off" placeholder={t.refPh}
              className={inputClass + " uppercase"} />
            <p className="mt-1.5 text-xs text-gray-500">{refDariTautan ? t.refOtomatis : t.refKet}</p>
            {refStatus.keadaan === "cek" && (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-400"><Loader2 size={12} className="animate-spin" /> {t.refMemeriksa}</p>
            )}
            {refStatus.keadaan === "ada" && (
              <p className="mt-1 text-xs font-medium text-emerald-700">{t.refKetemu(refStatus.nama ?? "", refStatus.label ?? "")}</p>
            )}
            {refStatus.keadaan === "kosong" && (
              <p className="mt-1 text-xs font-medium text-amber-600">{t.refTidakAda}</p>
            )}
          </div>
          </>
        )}

        {langkah === 3 && (
          <>
          {/* Dokumen Pendukung */}
          <div className="pt-2">
            <div className="flex items-center gap-2 mb-4">
              <Upload size={16} className="text-primary-700" />
              <h3 className="font-heading font-bold text-navy text-base">{t.docsTitle}</h3>
            </div>
            <div className="space-y-4">
              {DOCS.filter(d => isVisible(d.key)).map(doc => (
                <div key={doc.key}>
                <FileUploadField
                  config={doc}
                  required={isRequired(doc.key)}
                  onUploaded={url => {
                    setDoc(doc.key, url);
                    if (!url) setOcr(o => { const n = { ...o }; delete n[doc.key]; return n; });
                  }}
                  onBerkas={(file, kanvas) => periksaBerkas(doc.key, file, kanvas)}
                  t={t} lang={lang}
                />
                {(doc.key === "kk" || doc.key === "ijazah" || doc.key === "ktp_wali") && (
                  <PeriksaBerkasOcr jenis={doc.key} label={doc.label} ocr={ocr[doc.key]} lang={lang}
                    isian={{ fullName: form.fullName, nik: form.nik, nisn: form.nisn, birthDate: form.birthDate }}
                    pakai={(kunci, nilai) => setField(kunci, nilai)} />
                )}
                </div>
              ))}
              {syarat.map(sy => (
                <FileUploadField
                  key={sy.id}
                  config={{
                    key: `syarat-${sy.id}` as DocKey,
                    label: sy.nama,
                    hint: sy.keterangan ?? t.docHintUmum,
                    accept: "image/*,application/pdf",
                    icon: FileText,
                  }}
                  required={sy.wajib}
                  onUploaded={url => setBerkasSyarat(b => ({ ...b, [sy.id]: url }))}
                  t={t} lang={lang}
                />
              ))}
            </div>
            <Galat pesan={galat.dokumen} />
          </div>
          </>
        )}

        {(error || Object.keys(galat).length > 0) && (
          <div ref={ringkasRef} role="alert"
            className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5 scroll-mt-28">
            <p className="text-sm font-semibold text-red-800">{error}</p>
            {Object.keys(galat).length > 0 && (
              <ul className="mt-2 space-y-1">
                {Object.entries(galat).filter(([, v]) => v).map(([k, v]) => (
                  <li key={k} className="text-sm text-red-700">• {v}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="flex gap-3">
          {langkah > 0 && (
            <button type="button" onClick={() => { setLangkah(langkah - 1); setError(""); setGalat({}); keAwalKartu(); }}
              className="btn-modal-cancel shrink-0 !py-4">
              <ChevronLeft size={18} /> {t.kembali}
            </button>
          )}
          {langkah < TERAKHIR ? (
            /* type="button" — menekan Enter di isian tidak boleh mengirim formulir dari langkah 1. */
            <button type="button"
              onClick={() => { if (periksaLangkah(langkah)) { setLangkah(langkah + 1); keAwalKartu(); } }}
              className="btn-gold flex w-full !items-center !justify-center gap-2 !rounded-xl text-base !py-4">
              {t.lanjut} <ChevronRight size={18} />
            </button>
          ) : (
            <button type="submit" disabled={isPending}
              className="btn-gold flex w-full !items-center !justify-center gap-2 !rounded-xl text-base !py-4">
              <GraduationCap size={18} />
              {isPending ? t.sending : t.submit}
            </button>
          )}
        </div>

        {langkah === TERAKHIR && (
          <p className="text-xs text-gray-400 text-center leading-relaxed">
            {t.terms}
          </p>
        )}
      </form>
    </div>
  );
}
