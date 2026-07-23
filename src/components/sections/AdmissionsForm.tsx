"use client";
import { useState, useTransition, useEffect, useRef } from "react";
import { GraduationCap, CheckCircle2, Upload, X, FileText, Image as ImageIcon } from "lucide-react";
import DatePicker from "@/components/shared/DatePicker";
import type { Lang } from "@/lib/lang";

const MAJORS = [
  "Teknik Komputer & Jaringan (TKJ)",
  "Akuntansi (AK)",
  "Agribisnis Ternak Unggas (ATU)",
  "Desain Komunikasi Visual (DKV)",
  "Desain Pemodelan dan Informasi Bangunan (DPIB)",
];

const inputClass =
  "w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition bg-white placeholder:text-gray-400";
const labelClass = "block text-sm font-semibold text-primary-900 mb-1.5";

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
      { key: "ijazah" as DocKey, label: "Ijazah / SKL SMP/MTs", hint: "JPG, PNG, atau PDF · maks 5MB" },
      { key: "kk" as DocKey, label: "Kartu Keluarga (KK)", hint: "JPG, PNG, atau PDF · maks 5MB" },
      { key: "ktp_wali" as DocKey, label: "KTP Orang Tua / Wali", hint: "JPG, PNG, atau PDF · maks 5MB" },
      { key: "foto" as DocKey, label: "Pas Foto (3×4)", hint: "JPG atau PNG · maks 5MB" },
      { key: "dokumen_lain" as DocKey, label: "Dokumen Lain (Opsional)", hint: "Sertifikat, piagam, dll" },
    ],
    clickUpload: "Klik untuk upload",
    uploadFailed: "Upload gagal, coba lagi",
    uploading: "Mengupload",
    viewFile: "Lihat file",
    docRequired: (label: string) => `Dokumen "${label}" wajib diupload.`,
    submitFailed: "Gagal mengirim pendaftaran, coba lagi.",
    connFailed: "Koneksi gagal, silakan coba lagi.",
    successTitle: "Pendaftaran Terkirim!",
    successDesc: (name: string) => <>Terima kasih, <strong>{name}</strong>. Tim kami akan menghubungi Anda melalui WhatsApp dalam 3 hari kerja.</>,
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
      { key: "ijazah" as DocKey, label: "Diploma / Junior High Graduation Certificate", hint: "JPG, PNG, or PDF · max 5MB" },
      { key: "kk" as DocKey, label: "Family Card (KK)", hint: "JPG, PNG, or PDF · max 5MB" },
      { key: "ktp_wali" as DocKey, label: "Parent / Guardian ID Card", hint: "JPG, PNG, or PDF · max 5MB" },
      { key: "foto" as DocKey, label: "Photo (3×4)", hint: "JPG or PNG · max 5MB" },
      { key: "dokumen_lain" as DocKey, label: "Other Document (Optional)", hint: "Certificates, awards, etc." },
    ],
    clickUpload: "Click to upload",
    uploadFailed: "Upload failed, please try again",
    uploading: "Uploading",
    viewFile: "View file",
    docRequired: (label: string) => `The "${label}" document is required.`,
    submitFailed: "Failed to submit registration, please try again.",
    connFailed: "Connection failed, please try again.",
    successTitle: "Registration Submitted!",
    successDesc: (name: string) => <>Thank you, <strong>{name}</strong>. Our team will contact you via WhatsApp within 3 working days.</>,
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
  previousSchool: string; email: string; guardianName: string; chosenMajor: string;
};

type DocUrls = Partial<Record<DocKey, string>>;
type DocStatus = Partial<Record<DocKey, "idle" | "uploading" | "done" | "error">>;

type FormConfig = Record<string, string>;

const EMPTY: FormData = {
  fullName: "", birthPlace: "", birthDate: "", gender: "",
  nik: "", phone: "", nisn: "", address: "",
  previousSchool: "", email: "", guardianName: "", chosenMajor: "",
};

function FileUploadField({
  config, required, onUploaded, t,
}: { config: DocConfig; required: boolean; onUploaded: (url: string) => void; t: typeof ui["id"] }) {
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [fileName, setFileName] = useState("");
  const [url, setUrl] = useState("");
  const ref = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setStatus("uploading");
    setFileName(file.name);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("type", config.key);
    const res = await fetch("/api/admissions/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (res.ok) {
      setStatus("done");
      setUrl(data.url);
      onUploaded(data.url);
    } else {
      setStatus("error");
    }
  }

  function clear() {
    setStatus("idle");
    setFileName("");
    setUrl("");
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
        <label className="flex flex-col items-center justify-center w-full h-28 rounded-xl border-2 border-dashed border-gray-200 hover:border-primary-400 bg-gray-50 hover:bg-primary-50 cursor-pointer transition-colors">
          <Icon size={22} className="text-gray-300 mb-1" />
          <span className="text-xs text-gray-400 font-medium">{t.clickUpload}</span>
          <span className="text-xs text-gray-300 mt-0.5">{config.hint}</span>
          {status === "error" && <span className="text-xs text-red-500 mt-1">{t.uploadFailed}</span>}
          <input ref={ref} type="file" accept={config.accept} className="hidden" required={required && !url}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        </label>
      ) : status === "uploading" ? (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 bg-gray-50">
          <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-500">{t.uploading} {fileName}…</span>
        </div>
      ) : (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-emerald-200 bg-emerald-50">
          <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-emerald-700 truncate">{fileName}</p>
            <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-600 hover:underline">{t.viewFile}</a>
          </div>
          <button type="button" onClick={clear} className="text-gray-400 hover:text-red-500 transition-colors">
            <X size={15} />
          </button>
        </div>
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
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    fetch("/api/admissions/config").then(r => r.json()).then(setConfig).catch(() => {});
  }, []);

  function setField(key: keyof FormData, value: string) {
    setForm(f => ({ ...f, [key]: value }));
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

    // Cek dokumen wajib
    for (const doc of DOCS) {
      if (isRequired(doc.key) && isVisible(doc.key) && !docUrls[doc.key]) {
        setError(t.docRequired(doc.label));
        return;
      }
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/admissions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, ...docUrls }),
        });
        const data = await res.json();
        if (res.ok) {
          setSuccess(true);
        } else {
          setError(data.error || t.submitFailed);
        }
      } catch {
        setError(t.connFailed);
      }
    });
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
        <p className="font-arabic text-primary-700 text-xl mb-6">جَزَاكُمُ اللَّهُ خَيْرًا</p>
        <button onClick={() => { setForm(EMPTY); setDocUrls({}); setSuccess(false); }}
          className="text-sm text-primary-600 hover:text-primary-800 underline underline-offset-2 transition-colors">
          {t.registerAgain}
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
      <h2 className="font-heading text-2xl font-bold text-navy mb-1">{t.formTitle}</h2>
      <p className="text-gray-500 text-sm mb-7">{t.formDesc} {req} {t.formDescSuffix}</p>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Nama */}
        <div>
          <label className={labelClass}>{t.name} {req}</label>
          <input value={form.fullName} onChange={e => setField("fullName", e.target.value)} type="text" required
            placeholder={t.namePh} className={inputClass} />
        </div>

        {/* Tempat & Tanggal Lahir */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>{t.birthPlace} {req}</label>
            <input value={form.birthPlace} onChange={e => setField("birthPlace", e.target.value)} type="text" required
              placeholder={t.birthPlacePh} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>{t.birthDate} {req}</label>
            <DatePicker value={form.birthDate} onChange={v => setField("birthDate", v)} required placeholder={t.datePickerPh} />
          </div>
        </div>

        {/* Jenis Kelamin */}
        <div>
          <label className={labelClass}>{t.gender} {req}</label>
          <select value={form.gender} onChange={e => setField("gender", e.target.value)} required className={inputClass}>
            <option value="">{t.selectPlaceholder}</option>
            <option value="Laki-laki">{t.male}</option>
            <option value="Perempuan">{t.female}</option>
          </select>
        </div>

        {/* NIK */}
        {isVisible("nik") && (
          <div>
            <label className={labelClass}>{t.nik} {isRequired("nik") && req}</label>
            <input value={form.nik} onChange={e => setField("nik", e.target.value)} type="text"
              required={isRequired("nik")} maxLength={16} placeholder={t.nikPh} className={inputClass} />
          </div>
        )}

        {/* No WA */}
        <div>
          <label className={labelClass}>{t.phone} {req}</label>
          <input value={form.phone} onChange={e => setField("phone", e.target.value)} type="tel" required
            placeholder={t.phonePh} className={inputClass} />
        </div>

        {/* NISN */}
        {isVisible("nisn") && (
          <div>
            <label className={labelClass}>{t.nisn} {isRequired("nisn") && req}</label>
            <input value={form.nisn} onChange={e => setField("nisn", e.target.value)} type="text"
              required={isRequired("nisn")} maxLength={10} placeholder={t.nisnPh} className={inputClass} />
          </div>
        )}

        {/* Alamat */}
        {isVisible("address") && (
          <div>
            <label className={labelClass}>{t.address} {isRequired("address") && req}</label>
            <textarea value={form.address} onChange={e => setField("address", e.target.value)}
              required={isRequired("address")} rows={3}
              placeholder={t.addressPh}
              className={inputClass + " resize-none"} />
          </div>
        )}

        {/* Asal Sekolah */}
        <div>
          <label className={labelClass}>{t.prevSchool} {req}</label>
          <input value={form.previousSchool} onChange={e => setField("previousSchool", e.target.value)} type="text" required
            placeholder={t.prevSchoolPh} className={inputClass} />
        </div>

        {/* Email */}
        <div>
          <label className={labelClass}>{t.email} {req}</label>
          <input value={form.email} onChange={e => setField("email", e.target.value)} type="email" required
            placeholder="contoh@gmail.com" className={inputClass} />
        </div>

        {/* Nama Wali */}
        {isVisible("guardian") && (
          <div>
            <label className={labelClass}>{t.guardian} {isRequired("guardian") && req}</label>
            <input value={form.guardianName} onChange={e => setField("guardianName", e.target.value)} type="text"
              required={isRequired("guardian")} placeholder={t.guardianPh} className={inputClass} />
          </div>
        )}

        {/* Konsentrasi Keahlian */}
        <div>
          <label className={labelClass}>{t.major}</label>
          <select value={form.chosenMajor} onChange={e => setField("chosenMajor", e.target.value)} className={inputClass}>
            <option value="">{t.selectPlaceholder}</option>
            {MAJORS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        {/* Dokumen Pendukung */}
        <div className="pt-2">
          <div className="flex items-center gap-2 mb-4">
            <Upload size={16} className="text-primary-600" />
            <h3 className="font-heading font-bold text-navy text-base">{t.docsTitle}</h3>
          </div>
          <div className="space-y-4">
            {DOCS.filter(d => isVisible(d.key)).map(doc => (
              <FileUploadField
                key={doc.key}
                config={doc}
                required={isRequired(doc.key)}
                onUploaded={url => setDoc(doc.key, url)}
                t={t}
              />
            ))}
          </div>
        </div>

        {error && (
          <p className="text-red-500 text-sm bg-red-50 border border-red-100 rounded-xl px-4 py-3">{error}</p>
        )}

        <button type="submit" disabled={isPending}
          className="btn-gold w-full !rounded-xl flex items-center justify-center gap-2 text-base !py-4">
          <GraduationCap size={18} />
          {isPending ? t.sending : t.submit}
        </button>

        <p className="text-xs text-gray-400 text-center leading-relaxed">
          {t.terms}
        </p>
      </form>
    </div>
  );
}
