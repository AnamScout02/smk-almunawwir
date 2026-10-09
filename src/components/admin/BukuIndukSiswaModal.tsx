"use client";
import React, { useState, useEffect } from "react";
import {
  Save, User, Home, GraduationCap, Users, Smile,
  Heart, Award, Briefcase, LogOut, Trash2, Printer, Plus, KeyRound, Loader2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import DatePicker from "@/components/shared/DatePicker";
import Select from "@/components/admin/Select";
import ImageUpload from "@/components/admin/ImageUpload";
import WilayahSelect from "@/components/admin/WilayahSelect";
import Field from "@/components/admin/BukuIndukField";
import Section from "@/components/admin/BukuIndukSection";
import Alert from "@/components/admin/Alert";
import Modal from "@/components/admin/Modal";
import { toProperCaseName } from "@/lib/text";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Achievement {
  name: string; date: string; level: string; givenBy: string;
}

export interface BukuIndukData {
  // A
  fotoMasukUrl?: string;
  /** Foto khusus Kartu Tanda Siswa (4 Okt 2026) — terpisah dari Foto Masuk/Keluar, lihat src/lib/foto-kartu.ts. */
  fotoKartuUrl?: string;
  nik?: string; nickname?: string; citizenship?: string;
  childOrder?: string; siblingsCount?: string; halfSiblings?: string;
  adoptedSiblings?: string; orphanStatus?: string; dailyLanguage?: string;
  // B
  dusun?: string; rt?: string; rw?: string; desa?: string;
  kecamatan?: string; kabupaten?: string; province?: string; studentPhone?: string;
  livesWith?: string; distanceToSchool?: string;
  // C
  bloodType?: string; diseases?: string; height?: string; weight?: string;
  // D
  prevSchoolAddress?: string;
  asalNis?: string; masukSuratNo?: string; kelasAsal?: string;
  ijazahDate?: string; ijazahNo?: string;
  skhunDate?: string;
  lamaBelajar?: string; pindahanDari?: string; alasanPindahKe?: string;
  tingkatMasuk?: string; rombel?: string;
  bidangKeahlian?: string; programKeahlian?: string; kompetensiKeahlian?: string;
  diterimaDate?: string;
  // E – Ayah
  fatherName?: string; fatherNik?: string;
  fatherBirthPlace?: string; fatherBirthDate?: string;
  fatherReligion?: string; fatherCitizenship?: string;
  fatherEducation?: string; fatherJob?: string; fatherIncome?: string;
  fatherDusun?: string; fatherRt?: string; fatherRw?: string;
  fatherDesa?: string; fatherKecamatan?: string; fatherKabupaten?: string; fatherProvince?: string;
  fatherAlive?: string;
  // F – Ibu
  motherName?: string; motherNik?: string;
  motherBirthPlace?: string; motherBirthDate?: string;
  motherReligion?: string; motherCitizenship?: string;
  motherEducation?: string; motherJob?: string; motherIncome?: string;
  motherDusun?: string; motherRt?: string; motherRw?: string;
  motherDesa?: string; motherKecamatan?: string; motherKabupaten?: string; motherProvince?: string;
  motherAlive?: string;
  // G – Wali
  guardianName?: string; guardianNik?: string;
  guardianBirthPlace?: string; guardianBirthDate?: string;
  guardianReligion?: string; guardianCitizenship?: string;
  guardianEducation?: string; guardianJob?: string; guardianIncome?: string;
  guardianDusun?: string; guardianRt?: string; guardianRw?: string;
  guardianDesa?: string; guardianKecamatan?: string; guardianKabupaten?: string; guardianProvince?: string;
  guardianPhone?: string;
  // H
  hobbyArt?: string; hobbySport?: string; hobbyOrg?: string; hobbyOther?: string;
  // I
  achievements?: Achievement[];
  // J – PKL
  pklStartDate?: string; pklEndDate?: string;
  pklPlace?: string; pklAddress?: string;
  pklLatitude?: string; pklLongitude?: string;
  pklSupervisor?: string; pklScore?: string; pklLama?: string; pklDariPusat?: string;
  // K – Kelulusan
  graduationDate?: string;
  graduationIjazahNo?: string; skhunNo?: string;
  avgReport?: string; avgExam?: string;
  continueStudy?: string; workPlan?: string;
  // L – Pindah/Keluar
  fotoKeluarUrl?: string;
  pindahDate?: string; transferTo?: string; alasanPindah?: string; suratNo?: string;
}

/** Bentuk minimal siswa yang dibutuhkan modal ini — dibuat longgar (structural) supaya
 * kompatibel dengan interface Student di halaman Buku Induk Siswa maupun Tabel Lengkap. */
export interface BukuIndukModalStudent {
  id: string; nis: string; nisn?: string | null;
  birthPlace?: string | null; birthDate?: string | Date | null;
  gender?: string | null; religion?: string | null;
  address?: string | null; parentName?: string | null; parentPhone?: string | null; parentJob?: string | null;
  notifyEmail?: boolean | null; notifyWhatsapp?: boolean | null;
  previousSchool?: string | null; enrollYear?: number | null; studentStatus?: string | null;
  exitDate?: string | Date | null; studentNotes?: string | null;
  bukuIndukData?: BukuIndukData | Record<string, unknown> | null;
  user: { name: string; email: string };
  /** Kelas AKTUAL siswa sekarang — opsional/longgar krn tidak semua caller (mis. form "Tambah
   * Siswa") punya ini. Dipakai HANYA untuk info read-only di sebelah field "Rombel" (supaya
   * jelas beda dari field itu, yang cuma riwayat rombel saat diterima) — bukan field yang bisa
   * diedit dari sini. Ubah kelas aktual lewat tombol "Pindah Kelas" (`PindahKelasModal`). */
  class?: { name: string } | null;
}

interface MasterEntry { category: string; items: string[] }
interface MajorOption {
  id: string; name: string; code: string;
  bidangKeahlian: string | null; programKeahlian: string | null; kompetensiKeahlian: string | null;
}
interface ClassOption { id: string; name: string; grade: number; majorId: string }

const dateInput = (v?: string | Date | null): string => {
  if (!v) return "";
  const s = typeof v === "string" ? v : v.toISOString();
  return s.slice(0, 10);
};

const TINGKAT_PENGHARGAAN = ["Sekolah","Kecamatan","Kabupaten/Kota","Provinsi","Nasional","Internasional"];
const SAUDARA_OPTS = ["00 (Nol)","01 (Satu)","02 (Dua)","03 (Tiga)","04 (Empat)","05 (Lima)","06 (Enam)","07 (Tujuh)","08 (Delapan)","09 (Sembilan)","10 (Sepuluh)"];

const EMPTY_FORM = {
  nisn: "", birthPlace: "", birthDate: "", gender: "", religion: "",
  address: "", parentName: "", parentPhone: "", parentJob: "", previousSchool: "",
  enrollYear: undefined as number | undefined, studentStatus: "AKTIF", studentNotes: "", exitDate: "",
  notifyEmail: true, notifyWhatsapp: true,
};
const EMPTY_ACCOUNT = { name: "", email: "", password: "", majorId: "", classId: "", enrollYear: "", nis: "" };

interface GuardianKeys {
  name: keyof BukuIndukData; nik: keyof BukuIndukData;
  birthPlace: keyof BukuIndukData; birthDate: keyof BukuIndukData;
  religion: keyof BukuIndukData; citizenship: keyof BukuIndukData;
  education: keyof BukuIndukData; job: keyof BukuIndukData; income: keyof BukuIndukData;
  province: keyof BukuIndukData; kabupaten: keyof BukuIndukData;
  kecamatan: keyof BukuIndukData; desa: keyof BukuIndukData;
  dusun: keyof BukuIndukData; rt: keyof BukuIndukData; rw: keyof BukuIndukData;
}

/** Section E/F/G (Ayah/Ibu/Wali) berstruktur identik — hanya beda key & field penutup. */
function GuardianSection({
  title, accent, roleLabel, open, onToggle, keys, f, setF, md, trailing, addressReadOnly, birthPlaceListId,
}: {
  title: string; accent: string; roleLabel: string;
  open: boolean; onToggle: () => void; keys: GuardianKeys;
  f: (key: keyof BukuIndukData) => string;
  setF: (key: keyof BukuIndukData) => (v: string) => void;
  md: (cat: string) => string[];
  trailing: React.ReactNode;
  /** Ayah/Ibu: alamat mengikuti alamat siswa (Section B) & tidak bisa diedit terpisah di sini. */
  addressReadOnly?: boolean;
  /** id `<datalist>` saran Tempat Lahir — lihat komentar di BukuIndukField.tsx. */
  birthPlaceListId?: string;
}) {
  return (
    <Section title={title} icon={Users} open={open} onToggle={onToggle} accent={accent}>
      <Field label={`Nama ${roleLabel}${roleLabel === "Ayah" || roleLabel === "Ibu" ? " Kandung" : " Siswa"}`}
        value={f(keys.name)} wide onChange={setF(keys.name)} />
      <Field label={`NIK ${roleLabel} (16 digit)`} value={f(keys.nik)} type="nik" onChange={setF(keys.nik)} />
      <Field label={`Tempat Lahir ${roleLabel}`} value={f(keys.birthPlace)} list={birthPlaceListId} onChange={setF(keys.birthPlace)} />
      <Field label={`Tanggal Lahir ${roleLabel}`} value={f(keys.birthDate)} type="date" onChange={setF(keys.birthDate)} />
      <Field label="Agama" value={f(keys.religion)} options={md("agama")} onChange={setF(keys.religion)} />
      <Field label="Kewarganegaraan" value={f(keys.citizenship)} options={md("kewarganegaraan")} onChange={setF(keys.citizenship)} />
      <Field label="Pendidikan Terakhir" value={f(keys.education)} options={md("pendidikan_akhir")} onChange={setF(keys.education)} />
      <Field label="Pekerjaan" value={f(keys.job)} options={md("pekerjaan")} onChange={setF(keys.job)} />
      <Field label="Pengeluaran Bulanan" value={f(keys.income)} options={md("pengeluaran")} onChange={setF(keys.income)} />
      {addressReadOnly && (
        <div className="col-span-2 text-xs text-blue-600 bg-blue-50 rounded px-3 py-1.5">
          Alamat mengikuti alamat siswa (Section B) — ubah di sana kalau perlu.
        </div>
      )}
      <WilayahSelect
        province={f(keys.province)} regency={f(keys.kabupaten)} district={f(keys.kecamatan)} village={f(keys.desa)}
        onProvince={setF(keys.province)} onRegency={setF(keys.kabupaten)}
        onDistrict={setF(keys.kecamatan)} onVillage={setF(keys.desa)}
        readOnly={addressReadOnly}
      />
      <Field label="Dusun/Lingkungan" value={f(keys.dusun)} onChange={setF(keys.dusun)} readOnly={addressReadOnly} />
      <Field label="RT" value={f(keys.rt)} options={md("rt")} onChange={setF(keys.rt)} readOnly={addressReadOnly} />
      <Field label="RW" value={f(keys.rw)} options={md("rw")} onChange={setF(keys.rw)} readOnly={addressReadOnly} />
      {trailing}
    </Section>
  );
}

export default function BukuIndukSiswaModal({
  student, isNew, onClose, onSaved, canManageAccount = true,
}: {
  student: BukuIndukModalStudent | null;
  isNew: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** Wali kelas boleh edit biodata Buku Induk kelasnya TAPI TIDAK boleh reset password/ganti
   * email login siswa — itu tetap murni ADMIN/TAS/Operator Sekolah (server juga sudah menolak
   * field ini kalau di-kirim tanpa akses penuh, lihat [id]/route.ts — prop ini cuma sembunyikan
   * section-nya di UI supaya wali kelas tidak coba isi field yang toh diam-diam diabaikan). */
  canManageAccount?: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [bukuForm, setBukuForm] = useState<BukuIndukData>({});
  const [accountForm, setAccountForm] = useState({ ...EMPTY_ACCOUNT });
  const [sections, setSections] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  // Melacak proses generate NIS otomatis (async, dipicu saat pilih Jurusan di Section D) — dipakai
  // utk tampilkan spinner di field NIS (Section A) DAN cegah submit prematur sebelum fetch selesai
  // (temuan user 2026-08-12: submit sebelum NIS otomatis kelar bikin "NIS wajib diisi" padahal
  // Jurusan sudah dipilih — race condition, bukan gagal generate).
  const [nisGenerating, setNisGenerating] = useState(false);
  const [masterData, setMasterData] = useState<MasterEntry[]>([]);
  const [majors, setMajors] = useState<MajorOption[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [previousSchools, setPreviousSchools] = useState<{ name: string; address: string }[]>([]);
  const [birthPlaces, setBirthPlaces] = useState<string[]>([]);

  const open = isNew || student !== null;
  const md = (cat: string): string[] => masterData.find(m => m.category === cat)?.items ?? [];
  // Live dari tabel Major (Kelola Jurusan) — dulu dari kategori Master Data statis
  // "kompetensi_keahlian" yang terpisah & tidak otomatis update kalau jurusan baru ditambah.
  const kompetensiOptions = majors.map(m => m.kompetensiKeahlian).filter((v): v is string => !!v);

  useEffect(() => {
    fetch("/api/admin/master-data").then(r => r.json()).then(d => { if (Array.isArray(d)) setMasterData(d); }).catch(() => {});
    fetch("/api/admin/majors").then(r => r.json()).then(d => { if (Array.isArray(d)) setMajors(d); }).catch(() => {});
    fetch("/api/admin/classes").then(r => r.json()).then(d => { if (Array.isArray(d)) setClasses(d); }).catch(() => {});
    fetch("/api/admin/buku-induk/siswa/previous-schools").then(r => r.json()).then(d => { if (Array.isArray(d)) setPreviousSchools(d); }).catch(() => {});
    fetch("/api/admin/buku-induk/siswa/birth-places").then(r => r.json()).then(d => { if (Array.isArray(d)) setBirthPlaces(d); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (isNew) {
      setForm({ ...EMPTY_FORM });
      setBukuForm({});
      setAccountForm({ ...EMPTY_ACCOUNT });
      setSections({});
      setSaveError("");
    } else if (student) {
      setForm({
        nisn: student.nisn ?? "",
        birthPlace: student.birthPlace ?? "",
        birthDate: dateInput(student.birthDate),
        gender: student.gender ?? "", religion: student.religion ?? "",
        address: student.address ?? "", parentName: student.parentName ?? "",
        parentPhone: student.parentPhone ?? "", parentJob: student.parentJob ?? "",
        notifyEmail: student.notifyEmail ?? true, notifyWhatsapp: student.notifyWhatsapp ?? true,
        previousSchool: student.previousSchool ?? "",
        enrollYear: student.enrollYear ?? undefined,
        studentStatus: student.studentStatus ?? "AKTIF",
        studentNotes: student.studentNotes ?? "",
        exitDate: dateInput(student.exitDate),
      });
      setBukuForm((student.bukuIndukData as BukuIndukData) ?? {});
      setAccountForm({ ...EMPTY_ACCOUNT, name: student.user.name, email: student.user.email });
      setSections({});
      setSaveError("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student, isNew]);

  // Username (email login) siswa baru dibuat otomatis dari NIS — BUKAN lagi dari NISN (keputusan
  // eksplisit user 2026-08-09: NISN belum semua siswa punya/setor datanya dari Dapodik, jadi NIS
  // dipakai sbg satu-satunya basis identitas login yang konsisten & sudah 100% terisi resmi utk
  // semua siswa). Email = NIS disaring dari simbol "/" "." (tidak valid utk email). Password
  // default = "Almunawwir1" (keputusan eksplisit user, sama dgn guru — bukan lagi berbasis NIS).
  // Cuma isi kalau field-nya MASIH KOSONG — tidak pernah menimpa yang sudah diketik admin.
  useEffect(() => {
    if (!isNew || !accountForm.nis) return;
    setAccountForm(p => {
      if (p.email && p.password) return p;
      const emailLocal = p.nis.replace(/[^a-zA-Z0-9]/g, "");
      return {
        ...p,
        email: p.email || (emailLocal ? `${emailLocal}@smkalmunawwir.sch.id` : p.email),
        password: p.password || "Almunawwir1",
      };
    });
  }, [isNew, accountForm.nis]);

  async function handleSave() {
    setSaveError("");
    const derivedAddress = [
      bukuForm.dusun,
      (bukuForm.rt || bukuForm.rw) ? `RT ${bukuForm.rt || "-"}/RW ${bukuForm.rw || "-"}` : "",
      bukuForm.desa, bukuForm.kecamatan, bukuForm.kabupaten, bukuForm.province,
    ].filter(Boolean).join(", ");

    if (isNew) {
      if (nisGenerating) {
        setSaveError("NIS otomatis masih dibuat, tunggu sebentar lalu coba Simpan lagi.");
        setSections({ a: true }); return;
      }
      if (!accountForm.name || !accountForm.nis) {
        setSaveError("Nama Lengkap & NIS wajib diisi (Section A)");
        setSections({ a: true }); return;
      }
      if (!accountForm.majorId) {
        setSaveError("Jurusan wajib dipilih (Section D)");
        setSections({ d: true }); return;
      }
      if (!accountForm.email || !accountForm.password) {
        setSaveError("Email & Password wajib diisi (Section M)");
        setSections({ m: true }); return;
      }
      setSaving(true);
      const res = await fetch("/api/admin/buku-induk/siswa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: accountForm.name, email: accountForm.email, password: accountForm.password,
          nis: accountForm.nis, majorId: accountForm.majorId,
          classId: accountForm.classId || undefined,
          ...form,
          enrollYear: accountForm.enrollYear ? parseInt(accountForm.enrollYear) : undefined,
          address: derivedAddress || undefined,
          parentName: bukuForm.fatherName || undefined,
          parentPhone: form.parentPhone || undefined,
          bukuIndukData: bukuForm,
        }),
      });
      const data = await res.json();
      setSaving(false);
      if (!res.ok) { setSaveError(data.error ?? "Terjadi kesalahan"); return; }
      onSaved();
    } else {
      if (!student) return;
      setSaving(true);
      const body: Record<string, unknown> = {
        ...form,
        name: accountForm.name || undefined,
        address: derivedAddress || form.address || undefined,
        parentName: bukuForm.fatherName || form.parentName || undefined,
        parentPhone: form.parentPhone || undefined,
        parentJob: bukuForm.fatherJob || form.parentJob || undefined,
        bukuIndukData: bukuForm,
      };
      if (accountForm.password) body.password = accountForm.password;
      const res = await fetch(`/api/admin/buku-induk/siswa/${student.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setSaving(false);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSaveError(data.error ?? "Gagal menyimpan perubahan. Silakan coba lagi.");
        return;
      }
      onSaved();
    }
  }

  const f = (key: keyof BukuIndukData) => {
    const v = bukuForm[key];
    return Array.isArray(v) ? "" : String(v ?? "");
  };
  const setF = (key: keyof BukuIndukData) => (v: string) =>
    setBukuForm(p => ({ ...p, [key]: v } as BukuIndukData));
  const toggleSection = (key: string) => setSections(p => (p[key] ? {} : { [key]: true }));

  function setAddrField(key: keyof BukuIndukData, fKey: keyof BukuIndukData, mKey: keyof BukuIndukData) {
    return (v: string) => setBukuForm(p => ({ ...p, [key]: v, [fKey]: v, [mKey]: v } as BukuIndukData));
  }

  const filteredClasses = accountForm.majorId
    ? classes.filter(c => c.majorId === accountForm.majorId)
    : classes;

  const achievements: Achievement[] = Array.isArray(bukuForm.achievements) ? bukuForm.achievements : [];
  const addAchievement = () =>
    setBukuForm(p => ({ ...p, achievements: [...achievements, { name: "", date: "", level: "", givenBy: "" }] }));
  const removeAchievement = (idx: number) =>
    setBukuForm(p => ({ ...p, achievements: achievements.filter((_, i) => i !== idx) }));
  const updateAchievement = (idx: number, field: keyof Achievement, val: string) => {
    const arr = achievements.map((a, i) => i === idx ? { ...a, [field]: val } : a);
    setBukuForm(p => ({ ...p, achievements: arr }));
  };

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      scrollBody
      title={isNew ? "Tambah Siswa Baru" : "Buku Induk Siswa"}
      description={isNew ? "Isi data siswa baru dan akun login" : (student ? `${student.user.name} — NIS ${student.nis}` : "")}
      headerActions={!isNew && student && (
        <button onClick={() => router.push(`/dashboard/admin/buku-induk/siswa/${student.id}/cetak`)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white/15 hover:bg-white/25 text-white rounded-xl border border-white/20 font-medium transition-colors">
          <Printer size={14} /> Cetak
        </button>
      )}
      footer={
        <>
          <button onClick={onClose} className="btn-modal-cancel flex-1">
            Batal
          </button>
          <button onClick={handleSave} disabled={saving} className="btn-modal-save flex-1">
            <Save size={14} />
            {saving ? "Menyimpan..." : (isNew ? "Buat Siswa" : "Simpan")}
          </button>
        </>
      }
    >
      {saveError && <Alert variant="error">{saveError}</Alert>}

      {/* ── A ─────────────────────────────────────────────────────── */}
      <Section title="A. Keterangan Siswa" icon={User} open={!!sections.a} onToggle={() => toggleSection("a")}>
        <div className="col-span-2">
          <ImageUpload value={f("fotoMasukUrl")} onChange={setF("fotoMasukUrl")} folder="buku-induk/masuk" label="Foto Masuk (saat pendaftaran)"
            accept="image/jpeg,image/png" hint="JPG/PNG, rasio 3x4 — maks. 5MB" aspect="portrait" checkRatio={3/4} />
        </div>
        <div className="col-span-2">
          {/* Foto KHUSUS Kartu Tanda Siswa — terpisah dari Foto Masuk/Keluar (src/lib/foto-kartu.ts). */}
          <ImageUpload value={f("fotoKartuUrl")} onChange={setF("fotoKartuUrl")} folder="buku-induk/kartu" label="Foto Kartu (KTS)"
            accept="image/jpeg,image/png" hint="Dipakai di Kartu Tanda Siswa. Kosong = memakai Foto Masuk. JPG/PNG 3x4 — maks. 5MB" aspect="portrait" checkRatio={3/4} />
        </div>
        {isNew ? (
          <>
            <div>
              <label className="label-field">Nama Lengkap Siswa <span className="text-red-500">*</span></label>
              <input className="input-field" type="text" placeholder="Nama lengkap siswa" value={accountForm.name}
                onChange={e => setAccountForm(p => ({ ...p, name: e.target.value }))}
                onBlur={e => { if (e.target.value) setAccountForm(p => ({ ...p, name: toProperCaseName(e.target.value) })); }} />
            </div>
            <div>
              <label className="label-field">NIS <span className="text-red-500">*</span></label>
              <div className="relative">
                <input className="input-field" type="text" disabled={nisGenerating}
                  placeholder={nisGenerating ? "Membuat NIS otomatis..." : "Otomatis tersaran setelah pilih Jurusan (bisa diubah)"}
                  value={accountForm.nis}
                  onChange={e => setAccountForm(p => ({ ...p, nis: e.target.value }))} />
                {nisGenerating && (
                  <Loader2 size={15} className="animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            <Field label="Nama Lengkap Siswa" value={accountForm.name} wide
              onChange={v => setAccountForm(p => ({ ...p, name: v }))} />
            <Field label="NIS" value={student?.nis ?? ""} onChange={() => {}} readOnly />
          </>
        )}
        <Field label="NISN (10 digit)" value={String(form.nisn ?? "")} type="nik" maxLen={10} onChange={v => setForm(p => ({ ...p, nisn: v }))} />
        <Field label="NIK (16 digit)" value={f("nik")} type="nik" onChange={setF("nik")} />
        <Field label="Panggilan" value={f("nickname")} onChange={setF("nickname")} />
        <Field label="Jenis Kelamin" value={String(form.gender ?? "")}
          options={[{ value: "L", label: "Laki-laki" }, { value: "P", label: "Perempuan" }]}
          onChange={v => setForm(p => ({ ...p, gender: v }))} />
        <Field label="Tempat Lahir" value={String(form.birthPlace ?? "")} list="birth-place-options"
          onChange={v => setForm(p => ({ ...p, birthPlace: v }))} />
        <datalist id="birth-place-options">
          {birthPlaces.map(bp => <option key={bp} value={bp} />)}
        </datalist>
        <Field label="Tanggal Lahir" value={String(form.birthDate ?? "")} type="date"
          onChange={v => setForm(p => ({ ...p, birthDate: v }))} />
        <Field label="Agama" value={String(form.religion ?? "")} options={md("agama")}
          onChange={v => setForm(p => ({ ...p, religion: v }))} />
        <Field label="Kewarganegaraan" value={f("citizenship")} options={md("kewarganegaraan")} onChange={setF("citizenship")} />
        <Field label="Anak Ke-" value={f("childOrder")} options={md("jumlah_saudara")} onChange={setF("childOrder")} />
        <Field label="Jml Saudara Kandung" value={f("siblingsCount")} options={md("jumlah_saudara")} onChange={setF("siblingsCount")} />
        <Field label="Jml Saudara Tiri" value={f("halfSiblings")} options={SAUDARA_OPTS} onChange={setF("halfSiblings")} />
        <Field label="Jml Saudara Angkat" value={f("adoptedSiblings")} options={SAUDARA_OPTS} onChange={setF("adoptedSiblings")} />
        <Field label="Yatim/Piatu" value={f("orphanStatus")} options={md("yatim_piatu")} onChange={setF("orphanStatus")} />
        <Field label="Bahasa Sehari-hari" value={f("dailyLanguage")} options={md("bahasa")} onChange={setF("dailyLanguage")} />
      </Section>

      {/* ── B ─────────────────────────────────────────────────────── */}
      <Section title="B. Tempat Tinggal Siswa" icon={Home} open={!!sections.b} onToggle={() => toggleSection("b")}>
        <div className="col-span-2 text-xs text-blue-600 bg-blue-50 rounded px-3 py-1.5">
          Alamat Dusun s/d Kabupaten otomatis mengisi alamat Ayah &amp; Ibu
        </div>
        <WilayahSelect
          province={f("province")} regency={f("kabupaten")} district={f("kecamatan")} village={f("desa")}
          onProvince={setAddrField("province", "fatherProvince", "motherProvince")}
          onRegency={setAddrField("kabupaten", "fatherKabupaten", "motherKabupaten")}
          onDistrict={setAddrField("kecamatan", "fatherKecamatan", "motherKecamatan")}
          onVillage={setAddrField("desa", "fatherDesa", "motherDesa")}
        />
        <Field label="Dusun/Lingkungan" value={f("dusun")}
          onChange={setAddrField("dusun", "fatherDusun", "motherDusun")} />
        <Field label="RT" value={f("rt")} options={md("rt")}
          onChange={setAddrField("rt", "fatherRt", "motherRt")} />
        <Field label="RW" value={f("rw")} options={md("rw")}
          onChange={setAddrField("rw", "fatherRw", "motherRw")} />
        <Field label="No. HP/Tlp Siswa" value={f("studentPhone")} type="tel" onChange={setF("studentPhone")} />
        <Field label="No. HP/Tlp Orang Tua" value={String(form.parentPhone ?? "")} type="tel"
          onChange={v => setForm(p => ({ ...p, parentPhone: v }))} />
        <div className="col-span-2">
          <label className="label-field">Preferensi Notifikasi Tagihan</label>
          <p className="text-xs text-gray-400 mb-1.5">Belum aktif kirim otomatis (belum ada SMTP/WhatsApp API) — disiapkan utk nanti.</p>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={form.notifyEmail} onChange={e => setForm(p => ({ ...p, notifyEmail: e.target.checked }))} className="w-4 h-4 rounded accent-primary-700" />
              Email
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={form.notifyWhatsapp} onChange={e => setForm(p => ({ ...p, notifyWhatsapp: e.target.checked }))} className="w-4 h-4 rounded accent-primary-700" />
              WhatsApp
            </label>
          </div>
        </div>
        <Field label="Tinggal Dengan" value={f("livesWith")} options={md("tinggal_dengan")} onChange={setF("livesWith")} />
        <Field label="Jarak ke Sekolah" value={f("distanceToSchool")} options={md("jarak_sekolah")} onChange={setF("distanceToSchool")} />
      </Section>

      {/* ── C ─────────────────────────────────────────────────────── */}
      <Section title="C. Kesehatan Siswa" icon={Heart} open={!!sections.c} onToggle={() => toggleSection("c")} accent="text-rose-600">
        <Field label="Golongan Darah" value={f("bloodType")} options={md("golongan_darah")} onChange={setF("bloodType")} />
        <Field label="Tinggi Badan (cm)" value={f("height")} type="number" min={100} max={220} onChange={setF("height")} />
        <Field label="Berat Badan (kg)" value={f("weight")} type="number" min={20} max={200} onChange={setF("weight")} />
        <Field label="Penyakit yang Pernah Diderita" value={f("diseases")} type="textarea" wide onChange={setF("diseases")} />
      </Section>

      {/* ── D ─────────────────────────────────────────────────────── */}
      <Section title="D. Pendidikan Sebelumnya" icon={GraduationCap} open={!!sections.d} onToggle={() => toggleSection("d")}>
        {isNew && (
          <>
            <div className="col-span-2 text-xs text-blue-600 bg-blue-50 rounded px-3 py-1.5">
              Jurusan, Kelas, dan Tahun Angkatan otomatis mengisi Bidang/Program/Konsentrasi Keahlian, Diterima di Tingkat, dan Tanggal Diterima di bawah
            </div>
            <div>
              <label className="label-field">Jurusan <span className="text-red-500">*</span></label>
              <Select
                value={accountForm.majorId}
                onChange={v => {
                  const major = majors.find(m => m.id === v);
                  setAccountForm(p => ({ ...p, majorId: v, classId: "" }));
                  if (major?.kompetensiKeahlian) {
                    setBukuForm(p => ({ ...p, bidangKeahlian: major.bidangKeahlian ?? "", programKeahlian: major.programKeahlian ?? "", kompetensiKeahlian: major.kompetensiKeahlian ?? "" }));
                  } else if (major) {
                    setBukuForm(p => ({ ...p, kompetensiKeahlian: major.name }));
                  }
                  if (major && !accountForm.nis) {
                    // PERBAIKAN 2026-08-12 (temuan user: "NIS otomatis tidak terisi, tanpa pesan
                    // error") — dulu .catch(() => {}) menelan SEMUA kegagalan diam-diam (response
                    // gagal/non-JSON, jurusan belum punya nisCode, dll), field NIS cuma diam kosong
                    // tanpa petunjuk kenapa. Sekarang kegagalan ditampilkan lewat saveError.
                    setNisGenerating(true);
                    fetch(`/api/admin/buku-induk/siswa/next-nis?majorCode=${major.code}`)
                      .then(async r => {
                        const d = await r.json().catch(() => null);
                        if (!r.ok || !d?.nis) { setSaveError(d?.error || "Gagal generate NIS otomatis — isi NIS manual."); return; }
                        setAccountForm(p => ({ ...p, nis: d.nis }));
                      })
                      .catch(() => setSaveError("Gagal generate NIS otomatis (jaringan bermasalah) — isi NIS manual."))
                      .finally(() => setNisGenerating(false));
                  }
                }}
                options={majors.map(m => ({ value: m.id, label: `${m.name} (${m.code})` }))}
                placeholder="— Pilih Jurusan —"
              />
            </div>
            <div>
              <label className="label-field">Kelas / Rombel</label>
              <Select
                value={accountForm.classId}
                onChange={v => {
                  const cls = classes.find(c => c.id === v);
                  setAccountForm(p => ({ ...p, classId: v }));
                  if (cls) {
                    const tingkat = cls.grade === 10 ? "X (Sepuluh)" : cls.grade === 11 ? "XI (Sebelas)" : cls.grade === 12 ? "XII (Dua Belas)" : "";
                    const rombelNum = (cls.name.match(/(\d+)\s*$/)?.[1]) ?? "1";
                    setBukuForm(p => ({ ...p, rombel: rombelNum, ...(tingkat ? { tingkatMasuk: tingkat } : {}) }));
                  }
                }}
                options={filteredClasses.map(c => ({ value: c.id, label: `${c.name} (Grade ${c.grade})` }))}
                placeholder="— Pilih Kelas (opsional) —"
              />
            </div>
            <Field label="Tahun Angkatan" value={accountForm.enrollYear} type="number" min={2000} max={2050}
              placeholder="Contoh: 2024" hint="Tahun awal tahun ajaran saat angkatannya duduk di kelas X (angkatan 2024 = kelas X 2024/2025). Siswa pindahan mengikuti angkatan teman sekelasnya."
              onChange={v => {
                setAccountForm(p => ({ ...p, enrollYear: v }));
                // Tanggal diterima hanya diisi otomatis bila masih kosong — jangan menimpa tanggal asli siswa pindahan.
                if (v) setBukuForm(p => (p.diterimaDate ? p : { ...p, diterimaDate: `${v}-07-01` }));
              }} />
            <div /> {/* spacer */}
          </>
        )}
        <div className="col-span-2">
          <label className="label-field">Asal Sekolah (SMP/MTs)</label>
          <input className="input-field" list="prev-school-options" placeholder="Nama sekolah asal"
            value={String(form.previousSchool ?? "")}
            onChange={e => {
              const v = e.target.value;
              setForm(p => ({ ...p, previousSchool: v }));
              const match = previousSchools.find(sc => sc.name === v);
              if (match?.address && !f("prevSchoolAddress")) setF("prevSchoolAddress")(match.address);
            }} />
          <datalist id="prev-school-options">
            {previousSchools.map(sc => <option key={sc.name} value={sc.name} />)}
          </datalist>
        </div>
        <Field label="Alamat Asal Sekolah" value={f("prevSchoolAddress")} wide onChange={setF("prevSchoolAddress")} />
        <Field label="Nomor Induk Asal (NIS Sekolah Lama)" value={f("asalNis")} onChange={setF("asalNis")} kapital="asli" />
        <Field label="Nomor Surat Pindah Masuk" value={f("masukSuratNo")} onChange={setF("masukSuratNo")} kapital="asli" />
        <Field label="Tanggal Ijazah" value={f("ijazahDate")} type="date" onChange={setF("ijazahDate")} />
        <Field label="Nomor Ijazah" value={f("ijazahNo")} onChange={setF("ijazahNo")} kapital="asli" />
        <Field label="Tanggal SKHUN" value={f("skhunDate")} type="date" onChange={setF("skhunDate")} />
        <Field label="Lama Belajar" value={f("lamaBelajar")} options={md("lama_belajar")} onChange={setF("lamaBelajar")} />
        <Field label="Pindahan Dari" value={f("pindahanDari")} onChange={setF("pindahanDari")} kapital="sekolah" />
        <Field label="Kelas Asal (Sekolah Lama)" value={f("kelasAsal")} onChange={setF("kelasAsal")} />
        <Field label="Alasan Pindah ke SMK Ini" value={f("alasanPindahKe")} options={md("alasan_pindah")} onChange={setF("alasanPindahKe")} />
        <Field label="Diterima di Tingkat" value={f("tingkatMasuk")} options={md("tingkat_masuk")} onChange={setF("tingkatMasuk")} />
        <Field label="Rombel (saat diterima)" value={f("rombel")} onChange={setF("rombel")} />
        {!isNew && (
          <Field label="Kelas Saat Ini" value={student?.class?.name ?? "Belum ada kelas"} readOnly
            placeholder="Ubah lewat tombol Pindah Kelas" onChange={() => {}} />
        )}
        <Field label="Konsentrasi Keahlian" value={f("kompetensiKeahlian")}
          options={!f("kompetensiKeahlian") || kompetensiOptions.includes(f("kompetensiKeahlian"))
            ? kompetensiOptions
            : [f("kompetensiKeahlian"), ...kompetensiOptions]}
          onChange={v => {
            setF("kompetensiKeahlian")(v);
            const major = majors.find(m => m.kompetensiKeahlian === v);
            if (major) setBukuForm(p => ({ ...p, bidangKeahlian: major.bidangKeahlian ?? "", programKeahlian: major.programKeahlian ?? "" }));
          }} />
        <Field label="Bidang Keahlian" value={f("bidangKeahlian")} readOnly
          placeholder="Otomatis dari Konsentrasi Keahlian" onChange={() => {}} />
        <Field label="Program Keahlian" value={f("programKeahlian")} readOnly
          placeholder="Otomatis dari Konsentrasi Keahlian" onChange={() => {}} />
        <Field label="Tanggal Diterima" value={f("diterimaDate")} type="date" onChange={setF("diterimaDate")} />
        {!isNew && (
          <Field label="Tahun Angkatan" value={String(form.enrollYear ?? "")} type="number" min={2000} max={2050} hint="Tahun awal tahun ajaran saat angkatannya duduk di kelas X (angkatan 2024 = kelas X 2024/2025). Siswa pindahan mengikuti angkatan teman sekelasnya."
            onChange={v => {
              setForm(p => ({ ...p, enrollYear: parseInt(v) || undefined }));
              // Tanggal diterima hanya diisi otomatis bila masih kosong — mengubah angkatan siswa pindahan (mis. diterima Januari)
              // tidak boleh menimpa tanggal aslinya (temuan 17 Sep 2026).
              if (v) setBukuForm(p => (p.diterimaDate ? p : { ...p, diterimaDate: `${v}-07-01` }));
            }} />
        )}
      </Section>

      {/* ── E: Ayah ───────────────────────────────────────────────── */}
      <GuardianSection
        title="E. Keterangan Ayah" accent="text-blue-600" roleLabel="Ayah"
        open={!!sections.e} onToggle={() => toggleSection("e")}
        f={f} setF={setF} md={md} addressReadOnly birthPlaceListId="birth-place-options"
        keys={{
          name: "fatherName", nik: "fatherNik", birthPlace: "fatherBirthPlace", birthDate: "fatherBirthDate",
          religion: "fatherReligion", citizenship: "fatherCitizenship", education: "fatherEducation",
          job: "fatherJob", income: "fatherIncome", province: "fatherProvince", kabupaten: "fatherKabupaten",
          kecamatan: "fatherKecamatan", desa: "fatherDesa", dusun: "fatherDusun", rt: "fatherRt", rw: "fatherRw",
        }}
        trailing={<Field label="Masih Hidup / Telah Meninggal" value={f("fatherAlive")} options={md("status_ortu")} onChange={setF("fatherAlive")} />}
      />

      {/* ── F: Ibu ────────────────────────────────────────────────── */}
      <GuardianSection
        title="F. Keterangan Ibu" accent="text-pink-600" roleLabel="Ibu"
        open={!!sections.f} onToggle={() => toggleSection("f")}
        f={f} setF={setF} md={md} addressReadOnly birthPlaceListId="birth-place-options"
        keys={{
          name: "motherName", nik: "motherNik", birthPlace: "motherBirthPlace", birthDate: "motherBirthDate",
          religion: "motherReligion", citizenship: "motherCitizenship", education: "motherEducation",
          job: "motherJob", income: "motherIncome", province: "motherProvince", kabupaten: "motherKabupaten",
          kecamatan: "motherKecamatan", desa: "motherDesa", dusun: "motherDusun", rt: "motherRt", rw: "motherRw",
        }}
        trailing={<Field label="Masih Hidup / Telah Meninggal" value={f("motherAlive")} options={md("status_ortu")} onChange={setF("motherAlive")} />}
      />

      {/* ── G: Wali ───────────────────────────────────────────────── */}
      <GuardianSection
        title="G. Keterangan Wali" accent="text-violet-600" roleLabel="Wali"
        open={!!sections.g} onToggle={() => toggleSection("g")}
        f={f} setF={setF} md={md} birthPlaceListId="birth-place-options"
        keys={{
          name: "guardianName", nik: "guardianNik", birthPlace: "guardianBirthPlace", birthDate: "guardianBirthDate",
          religion: "guardianReligion", citizenship: "guardianCitizenship", education: "guardianEducation",
          job: "guardianJob", income: "guardianIncome", province: "guardianProvince", kabupaten: "guardianKabupaten",
          kecamatan: "guardianKecamatan", desa: "guardianDesa", dusun: "guardianDusun", rt: "guardianRt", rw: "guardianRw",
        }}
        trailing={<Field label="No. HP/Tlp Wali" value={f("guardianPhone")} type="tel" onChange={setF("guardianPhone")} />}
      />

      {/* ── H: Kegemaran ──────────────────────────────────────────── */}
      <Section title="H. Kegemaran Siswa" icon={Smile} open={!!sections.h} onToggle={() => toggleSection("h")} accent="text-amber-600">
        <Field label="Kesenian" value={f("hobbyArt")} options={md("kesenian")} onChange={setF("hobbyArt")} />
        <Field label="Olahraga" value={f("hobbySport")} options={md("olahraga")} onChange={setF("hobbySport")} />
        <Field label="Organisasi" value={f("hobbyOrg")} options={md("organisasi")} onChange={setF("hobbyOrg")} />
        <Field label="Lainnya" value={f("hobbyOther")} onChange={setF("hobbyOther")} />
      </Section>

      {/* ── I: Perkembangan ───────────────────────────────────────── */}
      <Section title="I. Keterangan Perkembangan Siswa" icon={Award} open={!!sections.i} onToggle={() => toggleSection("i")} accent="text-yellow-600">
        <div className="col-span-2 space-y-3">
          {achievements.length === 0 ? (
            <p className="text-sm text-gray-400">Belum ada data penghargaan/prestasi</p>
          ) : achievements.map((a, idx) => (
            <div key={idx} className="border border-gray-200 rounded-lg p-3 grid grid-cols-2 gap-2 relative">
              <button type="button" onClick={() => removeAchievement(idx)}
                className="absolute top-2 right-2 p-1 text-red-400 hover:text-red-600">
                <Trash2 size={13} />
              </button>
              <div className="col-span-2 pr-6">
                <label className="label-field">Nama Penghargaan</label>
                <input className="input-field" value={a.name}
                  onChange={e => updateAchievement(idx, "name", e.target.value)} />
              </div>
              <div>
                <label className="label-field">Tanggal</label>
                <DatePicker value={a.date} onChange={v => updateAchievement(idx, "date", v)} />
              </div>
              <div>
                <label className="label-field">Tingkat</label>
                <Select
                  value={a.level}
                  onChange={v => updateAchievement(idx, "level", v)}
                  options={TINGKAT_PENGHARGAAN.map(l => ({ value: l, label: l }))}
                  placeholder="— Pilih —"
                />
              </div>
              <div className="col-span-2">
                <label className="label-field">Diberikan Oleh</label>
                <input className="input-field" value={a.givenBy}
                  onChange={e => updateAchievement(idx, "givenBy", e.target.value)} />
              </div>
            </div>
          ))}
          <button type="button" onClick={addAchievement}
            className="flex items-center gap-2 text-sm text-primary-700 hover:text-primary-900 font-medium">
            <Plus size={14} /> Tambah Penghargaan
          </button>
        </div>
      </Section>

      {/* ── J: PKL ────────────────────────────────────────────────── */}
      <Section title="J. Praktik Kerja Lapangan (PKL)" icon={Briefcase} open={!!sections.j} onToggle={() => toggleSection("j")} accent="text-teal-600">
        {bukuForm.pklDariPusat === "1" && (
          <p className="col-span-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">Bagian ini terisi otomatis dari <span className="font-semibold">Pusat PKL</span> (penempatan, guru pembimbing, tanggal, dan nilai). Ubah di Pusat PKL → Penempatan Siswa; ketikan di sini akan tertimpa saat penempatannya diperbarui.</p>
        )}
        <Field label="Tanggal Mulai PKL" value={f("pklStartDate")} type="date" onChange={setF("pklStartDate")} />
        <Field label="Lama PKL" value={f("pklLama")} placeholder="3 bulan / 6 bulan" onChange={setF("pklLama")} kapital="asli" />
        <Field label="Tanggal Berakhir PKL" value={f("pklEndDate")} type="date" onChange={setF("pklEndDate")} />
        <Field label="Nama Tempat PKL" value={f("pklPlace")} wide onChange={setF("pklPlace")} />
        <Field label="Alamat Tempat PKL" value={f("pklAddress")} type="textarea" wide onChange={setF("pklAddress")} />
        <Field label="Lintang Selatan / LS" value={f("pklLatitude")} placeholder="-7.123456" onChange={setF("pklLatitude")} kapital="asli" />
        <Field label="Bujur Timur / BT" value={f("pklLongitude")} placeholder="110.123456" onChange={setF("pklLongitude")} kapital="asli" />
        {bukuForm.pklLatitude && bukuForm.pklLongitude && (
          <div className="col-span-2">
            <a href={`https://maps.google.com/?q=${bukuForm.pklLatitude},${bukuForm.pklLongitude}`}
              target="_blank" rel="noopener noreferrer"
              className="text-sm text-primary-700 hover:underline">
              Lihat Lokasi di Google Maps ↗
            </a>
          </div>
        )}
        <Field label="Guru Pembimbing" value={f("pklSupervisor")} onChange={setF("pklSupervisor")} />
        <Field label="Rata-rata Nilai PKL" value={f("pklScore")} type="number" min={0} max={100} onChange={setF("pklScore")} />
      </Section>

      {/* ── K: Kelulusan ──────────────────────────────────────────── */}
      <Section title="K. Keterangan Kelulusan" icon={GraduationCap} open={!!sections.k} onToggle={() => toggleSection("k")} accent="text-emerald-600">
        <div className="col-span-2">
          <ImageUpload value={f("fotoKeluarUrl")} onChange={setF("fotoKeluarUrl")} folder="buku-induk/keluar" label="Foto Keluar (saat lulus/pindah/keluar)"
            accept="image/jpeg,image/png" hint="JPG/PNG, rasio 3x4 — maks. 5MB" aspect="portrait" checkRatio={3/4} />
        </div>
        <Field label="Tanggal Lulus" value={f("graduationDate")} type="date" onChange={setF("graduationDate")} />
        <Field label="Nomor Ijazah Kelulusan" value={f("graduationIjazahNo")} onChange={setF("graduationIjazahNo")} kapital="asli" />
        <Field label="Nomor SKHUN" value={f("skhunNo")} onChange={setF("skhunNo")} kapital="asli" />
        <Field label="Nilai Rata-rata Rapor" value={f("avgReport")} type="number" min={0} max={100} onChange={setF("avgReport")} />
        <Field label="Nilai Rata-rata Ujian" value={f("avgExam")} type="number" min={0} max={100} onChange={setF("avgExam")} />
        <Field label="Akan Melanjutkan Ke" value={f("continueStudy")} wide onChange={setF("continueStudy")} kapital="sekolah" />
        <Field label="Rencana Kerja" value={f("workPlan")} wide onChange={setF("workPlan")} />
      </Section>

      {/* ── L: Pindah/Keluar ──────────────────────────────────────── */}
      <Section title="L. Keterangan Pindah / Keluar" icon={LogOut} open={!!sections.l} onToggle={() => toggleSection("l")} accent="text-red-600">
        <div>
          <label className="label-field">Status Siswa</label>
          <Select
            value={String(form.studentStatus ?? "AKTIF")}
            onChange={v => setForm(p => ({ ...p, studentStatus: v }))}
            options={[
              { value: "AKTIF", label: "AKTIF" },
              { value: "LULUS", label: "LULUS" },
              { value: "KELUAR", label: "KELUAR" },
              { value: "PINDAH", label: "PINDAH" },
            ]}
          />
        </div>
        <Field label="Tanggal Pindah/Keluar" value={f("pindahDate")} type="date" onChange={setF("pindahDate")} />
        <Field label="Nomor Surat" value={f("suratNo")} onChange={setF("suratNo")} placeholder="Nomor surat pindah/keluar" kapital="asli" />
        <Field label="Pindah Ke" value={f("transferTo")} wide onChange={setF("transferTo")} kapital="sekolah" />
        <Field label="Alasan Pindah/Keluar" value={f("alasanPindah")} options={md("alasan_pindah")} onChange={setF("alasanPindah")} />
        <Field label="Keterangan Lain" value={String(form.studentNotes ?? "")} type="textarea" wide
          onChange={v => setForm(p => ({ ...p, studentNotes: v }))} />
      </Section>

      {/* ── M: Akun & Login ───────────────────────────────────────── */}
      {canManageAccount && (
        <Section title="M. Akun & Login" icon={KeyRound} open={!!sections.m} onToggle={() => toggleSection("m")} accent="text-indigo-600">
          <div>
            <label className="label-field">
              Email Login {isNew && <span className="text-red-500">*</span>}
            </label>
            {isNew ? (
              <>
                <input className="input-field" type="email" placeholder="Otomatis dari NISN/NIS setelah diisi (bisa diubah)"
                  value={accountForm.email}
                  onChange={e => setAccountForm(p => ({ ...p, email: e.target.value }))} />
                <p className="text-xs text-gray-400 mt-1">Terisi otomatis dari NIS begitu diisi.</p>
              </>
            ) : (
              <input className="input-field bg-gray-50 text-gray-500 cursor-default" type="email"
                value={student?.user.email ?? ""} readOnly />
            )}
          </div>
          <div>
            <label className="label-field">
              Password{" "}
              {isNew ? <span className="text-red-500">*</span>
                : <span className="text-gray-400">(kosongkan jika tidak diubah)</span>}
            </label>
            <input className="input-field" type="password"
              placeholder={isNew ? "Otomatis = NIS (bisa diubah)" : "Isi untuk reset password"}
              value={accountForm.password}
              onChange={e => setAccountForm(p => ({ ...p, password: e.target.value }))} />
            {isNew && <p className="text-xs text-gray-400 mt-1">Terisi otomatis = &quot;Almunawwir1&quot;. Beri tahu siswa untuk segera ganti password sendiri.</p>}
          </div>
        </Section>
      )}
    </Modal>
  );
}
