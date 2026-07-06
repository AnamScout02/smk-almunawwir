"use client";
import React, { useState, useEffect, useCallback } from "react";
import {
  Search, Download, Upload, X, Save, Loader2,
  BookOpen, User, Home, GraduationCap, Users, Smile, Plus, KeyRound,
  Heart, Award, Briefcase, LogOut, Trash2, Printer,
} from "lucide-react";
import { useRouter } from "next/navigation";
import DatePicker from "@/components/shared/DatePicker";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import ImageUpload from "@/components/admin/ImageUpload";
import WilayahSelect from "@/components/admin/WilayahSelect";
import Field from "@/components/admin/BukuIndukField";
import Section from "@/components/admin/BukuIndukSection";
import Alert from "@/components/admin/Alert";
import GroupedSection from "@/components/admin/GroupedSection";
import EmptyState from "@/components/admin/EmptyState";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Achievement {
  name: string; date: string; level: string; givenBy: string;
}

interface BukuIndukData {
  // A
  fotoMasukUrl?: string;
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
  pklSupervisor?: string; pklScore?: string;
  // K – Kelulusan
  graduationDate?: string;
  graduationIjazahNo?: string; skhunNo?: string;
  avgReport?: string; avgExam?: string;
  continueStudy?: string; workPlan?: string;
  // L – Pindah/Keluar
  fotoKeluarUrl?: string;
  pindahDate?: string; transferTo?: string; alasanPindah?: string;
}

interface Student {
  id: string; nis: string; nisn?: string; noInduk?: string;
  birthPlace?: string; birthDate?: string; gender?: string; religion?: string;
  address?: string; parentName?: string; parentPhone?: string; parentJob?: string;
  previousSchool?: string; enrollYear?: number; studentStatus?: string;
  exitDate?: string; studentNotes?: string; bukuIndukData?: BukuIndukData;
  user: { name: string; email: string }; class?: { name: string };
  major: { name: string; code: string };
}

interface MasterEntry { category: string; items: string[] }
interface MajorOption { id: string; name: string; code: string }
interface ClassOption { id: string; name: string; grade: number; majorId: string }

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  AKTIF: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  LULUS: "bg-blue-50 text-blue-700 border border-blue-200",
  KELUAR: "bg-red-50 text-red-600 border border-red-200",
  PINDAH: "bg-amber-50 text-amber-700 border border-amber-200",
};

const TINGKAT_PENGHARGAAN = ["Sekolah","Kecamatan","Kabupaten/Kota","Provinsi","Nasional","Internasional"];

// Field & Section diimpor dari @/components/admin — dipakai bersama dengan Buku Induk Guru

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
  title, accent, roleLabel, open, onToggle, keys, f, setF, md, trailing,
}: {
  title: string; accent: string; roleLabel: string;
  open: boolean; onToggle: () => void; keys: GuardianKeys;
  f: (key: keyof BukuIndukData) => string;
  setF: (key: keyof BukuIndukData) => (v: string) => void;
  md: (cat: string) => string[];
  trailing: React.ReactNode;
}) {
  return (
    <Section title={title} icon={Users} open={open} onToggle={onToggle} accent={accent}>
      <Field label={`Nama ${roleLabel}${roleLabel === "Ayah" || roleLabel === "Ibu" ? " Kandung" : " Siswa"}`}
        value={f(keys.name)} wide onChange={setF(keys.name)} />
      <Field label={`NIK ${roleLabel} (16 digit)`} value={f(keys.nik)} type="nik" onChange={setF(keys.nik)} />
      <Field label={`Tempat Lahir ${roleLabel}`} value={f(keys.birthPlace)} onChange={setF(keys.birthPlace)} />
      <Field label={`Tanggal Lahir ${roleLabel}`} value={f(keys.birthDate)} type="date" onChange={setF(keys.birthDate)} />
      <Field label="Agama" value={f(keys.religion)} options={md("agama")} onChange={setF(keys.religion)} />
      <Field label="Kewarganegaraan" value={f(keys.citizenship)} options={md("kewarganegaraan")} onChange={setF(keys.citizenship)} />
      <Field label="Pendidikan Terakhir" value={f(keys.education)} options={md("pendidikan_akhir")} onChange={setF(keys.education)} />
      <Field label="Pekerjaan" value={f(keys.job)} options={md("pekerjaan")} onChange={setF(keys.job)} />
      <Field label="Pengeluaran Bulanan" value={f(keys.income)} options={md("pengeluaran")} onChange={setF(keys.income)} />
      <WilayahSelect
        province={f(keys.province)} regency={f(keys.kabupaten)} district={f(keys.kecamatan)} village={f(keys.desa)}
        onProvince={setF(keys.province)} onRegency={setF(keys.kabupaten)}
        onDistrict={setF(keys.kecamatan)} onVillage={setF(keys.desa)}
      />
      <Field label="Dusun/Lingkungan" value={f(keys.dusun)} onChange={setF(keys.dusun)} />
      <Field label="RT" value={f(keys.rt)} options={md("rt")} onChange={setF(keys.rt)} />
      <Field label="RW" value={f(keys.rw)} options={md("rw")} onChange={setF(keys.rw)} />
      {trailing}
    </Section>
  );
}

// ─── Form State Init ──────────────────────────────────────────────────────────

const EMPTY_FORM: Partial<Student> = {
  noInduk: "", nisn: "", birthPlace: "", birthDate: "", gender: "", religion: "",
  address: "", parentName: "", parentPhone: "", parentJob: "", previousSchool: "",
  enrollYear: undefined, studentStatus: "AKTIF", studentNotes: "", exitDate: "",
};
const EMPTY_ACCOUNT = { name: "", email: "", password: "", majorId: "", classId: "", enrollYear: "", nis: "" };

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BukuIndukSiswaPage() {
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [filtered, setFiltered] = useState<Student[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Student | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState<Partial<Student>>({});
  const [bukuForm, setBukuForm] = useState<BukuIndukData>({});
  const [accountForm, setAccountForm] = useState({ ...EMPTY_ACCOUNT });
  const [sections, setSections] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; updated: number; errors: string[] } | null>(null);
  const [masterData, setMasterData] = useState<MasterEntry[]>([]);
  const [majors, setMajors] = useState<MajorOption[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);

  const md = (cat: string): string[] => masterData.find(m => m.category === cat)?.items ?? [];

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/buku-induk/siswa");
    const data = await res.json();
    setStudents(data); setFiltered(data); setLoading(false);
  }, []);

  useEffect(() => {
    fetchStudents();
    fetch("/api/admin/master-data").then(r => r.json()).then(d => { if (Array.isArray(d)) setMasterData(d); }).catch(() => {});
    fetch("/api/admin/majors").then(r => r.json()).then(setMajors).catch(() => {});
    fetch("/api/admin/classes").then(r => r.json()).then(setClasses).catch(() => {});
  }, [fetchStudents]);

  useEffect(() => {
    let list = students;
    if (statusFilter !== "ALL") list = list.filter(s => s.studentStatus === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.user.name.toLowerCase().includes(q) ||
        s.nis.toLowerCase().includes(q) ||
        (s.noInduk ?? "").toLowerCase().includes(q)
      );
    }
    setFiltered(list);
  }, [students, search, statusFilter]);

  function openCreate() {
    setIsNew(true);
    setSelected({ id: "", nis: "", user: { name: "", email: "" }, major: { name: "", code: "" } });
    setForm({ ...EMPTY_FORM });
    setBukuForm({});
    setAccountForm({ ...EMPTY_ACCOUNT });
    setSections({});
    setSaveError("");
  }

  function openEdit(student: Student) {
    setIsNew(false);
    setSelected(student);
    setForm({
      noInduk: student.noInduk ?? "", nisn: student.nisn ?? "",
      birthPlace: student.birthPlace ?? "",
      birthDate: student.birthDate ? student.birthDate.slice(0, 10) : "",
      gender: student.gender ?? "", religion: student.religion ?? "",
      address: student.address ?? "", parentName: student.parentName ?? "",
      parentPhone: student.parentPhone ?? "", parentJob: student.parentJob ?? "",
      previousSchool: student.previousSchool ?? "",
      enrollYear: student.enrollYear ?? undefined,
      studentStatus: student.studentStatus ?? "AKTIF",
      studentNotes: student.studentNotes ?? "",
      exitDate: student.exitDate ? student.exitDate.slice(0, 10) : "",
    });
    setBukuForm((student.bukuIndukData as BukuIndukData) ?? {});
    setAccountForm({ ...EMPTY_ACCOUNT, email: student.user.email });
    setSections({});
    setSaveError("");
  }

  async function handleSave() {
    setSaveError("");
    const derivedAddress = [
      bukuForm.dusun,
      (bukuForm.rt || bukuForm.rw) ? `RT ${bukuForm.rt || "-"}/RW ${bukuForm.rw || "-"}` : "",
      bukuForm.desa, bukuForm.kecamatan, bukuForm.kabupaten, bukuForm.province,
    ].filter(Boolean).join(", ");

    if (isNew) {
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
          enrollYear: accountForm.enrollYear ? parseInt(accountForm.enrollYear) : undefined,
          ...form,
          address: derivedAddress || undefined,
          parentName: bukuForm.fatherName || undefined,
          parentPhone: form.parentPhone || undefined,
          bukuIndukData: bukuForm,
        }),
      });
      const data = await res.json();
      setSaving(false);
      if (!res.ok) { setSaveError(data.error ?? "Terjadi kesalahan"); return; }
      setSelected(null); fetchStudents();
    } else {
      if (!selected) return;
      setSaving(true);
      const body: Record<string, unknown> = {
        ...form,
        address: derivedAddress || form.address || undefined,
        parentName: bukuForm.fatherName || form.parentName || undefined,
        parentPhone: form.parentPhone || undefined,
        parentJob: bukuForm.fatherJob || form.parentJob || undefined,
        bukuIndukData: bukuForm,
      };
      if (accountForm.password) body.password = accountForm.password;
      const res = await fetch(`/api/admin/buku-induk/siswa/${selected.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setSaving(false);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSaveError(data.error ?? "Gagal menyimpan perubahan. Silakan coba lagi.");
        return;
      }
      setSelected(null); fetchStudents();
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setImportLoading(true); setImportResult(null);
    const fd = new FormData(); fd.append("file", file);
    const res = await fetch("/api/admin/buku-induk/siswa/import", { method: "POST", body: fd });
    const data = await res.json();
    setImportResult(data); setImportLoading(false); fetchStudents(); e.target.value = "";
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

  const SAUDARA_OPTS = ["00 (Nol)","01 (Satu)","02 (Dua)","03 (Tiga)","04 (Empat)","05 (Lima)","06 (Enam)","07 (Tujuh)","08 (Delapan)","09 (Sembilan)","10 (Sepuluh)"];

  const groupedByClass = Array.from(new Set(filtered.filter(s => s.class).map(s => s.class!.name)))
    .sort()
    .map(name => ({
      name,
      items: filtered.filter(s => s.class?.name === name),
      classId: classes.find(c => c.name === name)?.id,
    }));
  const unclassed = filtered.filter(s => !s.class);

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader
        icon={<BookOpen size={22} />}
        title="Buku Induk Siswa"
        description="Data lengkap kependudukan siswa SMK Al Munawwir IIBS"
      />

      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input-field pl-10"
            placeholder="Cari nama, NIS, atau No. Induk..." value={search}
            onChange={e => setSearch(e.target.value)} />
        </div>
        <Select
          className="sm:w-44"
          value={statusFilter}
          onChange={v => setStatusFilter(v)}
          options={[
            { value: "ALL", label: "Semua Status" },
            { value: "AKTIF", label: "Aktif" },
            { value: "LULUS", label: "Lulus" },
            { value: "KELUAR", label: "Keluar" },
            { value: "PINDAH", label: "Pindah" },
          ]}
        />
        <button onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors">
          <Plus size={15} /> Tambah Siswa
        </button>
        <a href="/api/admin/buku-induk/siswa/template"
          className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-xl text-sm font-semibold transition-colors">
          <Download size={15} /> Template
        </a>
        <label className="flex items-center gap-2 px-4 py-2.5 bg-primary-700 hover:bg-primary-800 text-white rounded-xl text-sm font-semibold transition-colors cursor-pointer">
          <Upload size={15} />
          {importLoading ? "Mengimpor..." : "Import Excel"}
          <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} disabled={importLoading} />
        </label>
      </div>

      {importResult && (
        <Alert variant={importResult.errors.length > 0 ? "warning" : "success"} className="mb-4"
          title={`Hasil import: ${importResult.created} dibuat, ${importResult.updated} diperbarui`}>
          {importResult.errors.length > 0 && (
            <ul className="mt-1 text-red-600 text-xs list-disc list-inside">
              {importResult.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
              {importResult.errors.length > 5 && <li>...dan {importResult.errors.length - 5} error lainnya</li>}
            </ul>
          )}
        </Alert>
      )}

      {/* Tabel */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-primary-500" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={User} title="Tidak ada data siswa" />
      ) : (
        <div className="space-y-6">
          {groupedByClass.map(({ name, items, classId }) => (
            <GroupedSection key={name} title={name} count={items.length} icon={GraduationCap}
              headerActions={classId && (
                <a href={`/dashboard/admin/buku-induk/siswa/cetak-kelas/${classId}`} target="_blank" rel="noopener noreferrer"
                  title="Cetak Buku Induk Sekelas"
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-white/15 hover:bg-white/25 text-white rounded-lg border border-white/20 font-medium transition-colors">
                  <Printer size={12} /> Cetak Kelas
                </a>
              )}>
              <BukuIndukSiswaTable items={items} onEdit={openEdit} />
            </GroupedSection>
          ))}
          {unclassed.length > 0 && (
            <GroupedSection title="Belum Ada Kelas" count={unclassed.length} icon={Users} variant="warning">
              <BukuIndukSiswaTable items={unclassed} onEdit={openEdit} />
            </GroupedSection>
          )}
          <p className="text-xs text-gray-400">Menampilkan {filtered.length} dari {students.length} siswa</p>
        </div>
      )}

      {/* ── Modal ─────────────────────────────────────────────────────────────── */}
      {selected !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 shrink-0"
              style={{ background: "linear-gradient(135deg, #0A1030 0%, #0F1A45 40%, #1B2B6B 100%)" }}>
              <div>
                <h2 className="text-base font-bold text-white">
                  {isNew ? "Tambah Siswa Baru" : "Buku Induk Siswa"}
                </h2>
                <p className="text-xs text-white/50 mt-0.5">
                  {isNew ? "Isi data siswa baru dan akun login" : `${selected.user.name} — NIS ${selected.nis}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {!isNew && selected && (
                  <button onClick={() => router.push(`/dashboard/admin/buku-induk/siswa/${selected.id}/cetak`)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white/15 hover:bg-white/25 text-white rounded-xl border border-white/20 font-medium transition-colors">
                    <Printer size={14} /> Cetak
                  </button>
                )}
                <button onClick={() => setSelected(null)} className="p-2 text-white/60 hover:text-white rounded-lg transition-colors"><X size={20} /></button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {saveError && <Alert variant="error">{saveError}</Alert>}

              {/* ── A ─────────────────────────────────────────────────────── */}
              <Section title="A. Keterangan Siswa" icon={User} open={!!sections.a} onToggle={() => toggleSection("a")}>
                <div className="col-span-2">
                  <ImageUpload value={f("fotoMasukUrl")} onChange={setF("fotoMasukUrl")} folder="buku-induk/masuk" label="Foto Masuk (saat pendaftaran)"
                    accept="image/jpeg,image/png" hint="JPG/PNG, rasio 3x4 — maks. 5MB" aspect="portrait" checkRatio={3/4} />
                </div>
                {isNew ? (
                  <>
                    <div>
                      <label className="label-field">Nama Lengkap Siswa <span className="text-red-500">*</span></label>
                      <input className="input-field" type="text" placeholder="Nama lengkap siswa" value={accountForm.name}
                        onChange={e => setAccountForm(p => ({ ...p, name: e.target.value }))} />
                    </div>
                    <div>
                      <label className="label-field">NIS <span className="text-red-500">*</span></label>
                      <input className="input-field" type="text" placeholder="Nomor Induk Siswa" value={accountForm.nis}
                        onChange={e => setAccountForm(p => ({ ...p, nis: e.target.value }))} />
                    </div>
                  </>
                ) : (
                  <>
                    <Field label="Nama Lengkap Siswa" value={selected?.user.name ?? ""} onChange={() => {}} readOnly wide />
                    <Field label="NIS" value={selected?.nis ?? ""} onChange={() => {}} readOnly />
                  </>
                )}
                <Field label="No. Induk" value={String(form.noInduk ?? "")} onChange={v => setForm(p => ({ ...p, noInduk: v }))} />
                <Field label="NISN (10 digit)" value={String(form.nisn ?? "")} type="nik" maxLen={10} onChange={v => setForm(p => ({ ...p, nisn: v }))} />
                <Field label="NIK (16 digit)" value={f("nik")} type="nik" onChange={setF("nik")} />
                <Field label="Panggilan" value={f("nickname")} onChange={setF("nickname")} />
                <Field label="Jenis Kelamin" value={String(form.gender ?? "")} options={md("jenis_kelamin")}
                  onChange={v => setForm(p => ({ ...p, gender: v }))} />
                <Field label="Tempat Lahir" value={String(form.birthPlace ?? "")}
                  onChange={v => setForm(p => ({ ...p, birthPlace: v }))} />
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
                      Jurusan, Kelas, dan Tahun Masuk otomatis mengisi Kompetensi Keahlian, Diterima di Tingkat, dan Tanggal Diterima di bawah
                    </div>
                    <div>
                      <label className="label-field">Jurusan <span className="text-red-500">*</span></label>
                      <Select
                        value={accountForm.majorId}
                        onChange={v => {
                          const major = majors.find(m => m.id === v);
                          setAccountForm(p => ({ ...p, majorId: v, classId: "" }));
                          if (major) setBukuForm(p => ({ ...p, kompetensiKeahlian: major.name }));
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
                            setBukuForm(p => ({ ...p, rombel: cls.name, ...(tingkat ? { tingkatMasuk: tingkat } : {}) }));
                          }
                        }}
                        options={filteredClasses.map(c => ({ value: c.id, label: `${c.name} (Grade ${c.grade})` }))}
                        placeholder="— Pilih Kelas (opsional) —"
                      />
                    </div>
                    <Field label="Tahun Masuk" value={accountForm.enrollYear} type="number" min={2000} max={2050}
                      placeholder="Contoh: 2024"
                      onChange={v => {
                        setAccountForm(p => ({ ...p, enrollYear: v }));
                        if (v) setBukuForm(p => ({ ...p, diterimaDate: `${v}-07-01` }));
                      }} />
                    <div /> {/* spacer */}
                  </>
                )}
                <Field label="Asal Sekolah (SMP/MTs)" value={String(form.previousSchool ?? "")} wide
                  onChange={v => setForm(p => ({ ...p, previousSchool: v }))} />
                <Field label="Alamat Asal Sekolah" value={f("prevSchoolAddress")} wide onChange={setF("prevSchoolAddress")} />
                <Field label="Tanggal Ijazah" value={f("ijazahDate")} type="date" onChange={setF("ijazahDate")} />
                <Field label="Nomor Ijazah" value={f("ijazahNo")} onChange={setF("ijazahNo")} />
                <Field label="Tanggal SKHUN" value={f("skhunDate")} type="date" onChange={setF("skhunDate")} />
                <Field label="Lama Belajar" value={f("lamaBelajar")} options={md("lama_belajar")} onChange={setF("lamaBelajar")} />
                <Field label="Pindahan Dari" value={f("pindahanDari")} onChange={setF("pindahanDari")} />
                <Field label="Alasan Pindah ke SMK Ini" value={f("alasanPindahKe")} options={md("alasan_pindah")} onChange={setF("alasanPindahKe")} />
                <Field label="Diterima di Tingkat" value={f("tingkatMasuk")} options={md("tingkat_masuk")} onChange={setF("tingkatMasuk")} />
                <Field label="Rombel" value={f("rombel")} onChange={setF("rombel")} />
                <Field label="Bidang Keahlian" value={f("bidangKeahlian")} options={md("bidang_keahlian")} onChange={setF("bidangKeahlian")} />
                <Field label="Program Keahlian" value={f("programKeahlian")} options={md("program_keahlian")} onChange={setF("programKeahlian")} />
                <Field label="Kompetensi Keahlian" value={f("kompetensiKeahlian")}
                  options={!f("kompetensiKeahlian") || md("kompetensi_keahlian").includes(f("kompetensiKeahlian"))
                    ? md("kompetensi_keahlian")
                    : [f("kompetensiKeahlian"), ...md("kompetensi_keahlian")]}
                  onChange={setF("kompetensiKeahlian")} />
                <Field label="Tanggal Diterima" value={f("diterimaDate")} type="date" onChange={setF("diterimaDate")} />
                {!isNew && (
                  <Field label="Tahun Masuk SMK" value={String(form.enrollYear ?? "")} type="number" min={2000} max={2050}
                    onChange={v => {
                      setForm(p => ({ ...p, enrollYear: parseInt(v) || undefined }));
                      if (v) setBukuForm(p => ({ ...p, diterimaDate: `${v}-07-01` }));
                    }} />
                )}
              </Section>

              {/* ── E: Ayah ───────────────────────────────────────────────── */}
              <GuardianSection
                title="E. Keterangan Ayah" accent="text-blue-600" roleLabel="Ayah"
                open={!!sections.e} onToggle={() => toggleSection("e")}
                f={f} setF={setF} md={md}
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
                f={f} setF={setF} md={md}
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
                f={f} setF={setF} md={md}
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
                    <p className="text-sm text-gray-400 italic">Belum ada data penghargaan/prestasi</p>
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
                    className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-800 font-medium">
                    <Plus size={14} /> Tambah Penghargaan
                  </button>
                </div>
              </Section>

              {/* ── J: PKL ────────────────────────────────────────────────── */}
              <Section title="J. Praktik Kerja Lapangan (PKL)" icon={Briefcase} open={!!sections.j} onToggle={() => toggleSection("j")} accent="text-teal-600">
                <Field label="Tanggal Mulai PKL" value={f("pklStartDate")} type="date" onChange={setF("pklStartDate")} />
                <Field label="Tanggal Berakhir PKL" value={f("pklEndDate")} type="date" onChange={setF("pklEndDate")} />
                <Field label="Nama Tempat PKL" value={f("pklPlace")} wide onChange={setF("pklPlace")} />
                <Field label="Alamat Tempat PKL" value={f("pklAddress")} type="textarea" wide onChange={setF("pklAddress")} />
                <Field label="Lintang Selatan / LS" value={f("pklLatitude")} placeholder="-7.123456" onChange={setF("pklLatitude")} />
                <Field label="Bujur Timur / BT" value={f("pklLongitude")} placeholder="110.123456" onChange={setF("pklLongitude")} />
                {bukuForm.pklLatitude && bukuForm.pklLongitude && (
                  <div className="col-span-2">
                    <a href={`https://maps.google.com/?q=${bukuForm.pklLatitude},${bukuForm.pklLongitude}`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-sm text-primary-600 hover:underline">
                      Lihat Lokasi di Google Maps ↗
                    </a>
                  </div>
                )}
                <Field label="Guru Pembimbing" value={f("pklSupervisor")} onChange={setF("pklSupervisor")} />
                <Field label="Rata-rata Nilai PKL" value={f("pklScore")} type="number" min={0} max={100} onChange={setF("pklScore")} />
              </Section>

              {/* ── K: Kelulusan ──────────────────────────────────────────── */}
              <Section title="K. Keterangan Kelulusan" icon={GraduationCap} open={!!sections.k} onToggle={() => toggleSection("k")} accent="text-emerald-600">
                <Field label="Tanggal Lulus" value={f("graduationDate")} type="date" onChange={setF("graduationDate")} />
                <Field label="Nomor Ijazah Kelulusan" value={f("graduationIjazahNo")} onChange={setF("graduationIjazahNo")} />
                <Field label="Nomor SKHUN" value={f("skhunNo")} onChange={setF("skhunNo")} />
                <Field label="Nilai Rata-rata Rapor" value={f("avgReport")} type="number" min={0} max={100} onChange={setF("avgReport")} />
                <Field label="Nilai Rata-rata Ujian" value={f("avgExam")} type="number" min={0} max={100} onChange={setF("avgExam")} />
                <Field label="Akan Melanjutkan Ke" value={f("continueStudy")} wide onChange={setF("continueStudy")} />
                <Field label="Rencana Kerja" value={f("workPlan")} wide onChange={setF("workPlan")} />
              </Section>

              {/* ── L: Pindah/Keluar ──────────────────────────────────────── */}
              <Section title="L. Keterangan Pindah / Keluar" icon={LogOut} open={!!sections.l} onToggle={() => toggleSection("l")} accent="text-red-600">
                <div className="col-span-2">
                  <ImageUpload value={f("fotoKeluarUrl")} onChange={setF("fotoKeluarUrl")} folder="buku-induk/keluar" label="Foto Keluar (saat lulus/pindah/keluar)"
                    accept="image/jpeg,image/png" hint="JPG/PNG, rasio 3x4 — maks. 5MB" aspect="portrait" checkRatio={3/4} />
                </div>
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
                <Field label="Pindah Ke" value={f("transferTo")} wide onChange={setF("transferTo")} />
                <Field label="Alasan Pindah/Keluar" value={f("alasanPindah")} options={md("alasan_pindah")} onChange={setF("alasanPindah")} />
                <Field label="Keterangan Lain" value={String(form.studentNotes ?? "")} type="textarea" wide
                  onChange={v => setForm(p => ({ ...p, studentNotes: v }))} />
              </Section>

              {/* ── M: Akun & Login ───────────────────────────────────────── */}
              <Section title="M. Akun & Login" icon={KeyRound} open={!!sections.m} onToggle={() => toggleSection("m")} accent="text-indigo-600">
                <div>
                  <label className="label-field">
                    Email Login {isNew && <span className="text-red-500">*</span>}
                  </label>
                  {isNew ? (
                    <input className="input-field" type="email" placeholder="gmail atau email lainnya"
                      value={accountForm.email}
                      onChange={e => setAccountForm(p => ({ ...p, email: e.target.value }))} />
                  ) : (
                    <input className="input-field bg-gray-50 text-gray-500 cursor-default" type="email"
                      value={selected?.user.email ?? ""} readOnly />
                  )}
                </div>
                <div>
                  <label className="label-field">
                    Password{" "}
                    {isNew ? <span className="text-red-500">*</span>
                      : <span className="text-gray-400">(kosongkan jika tidak diubah)</span>}
                  </label>
                  <input className="input-field" type="password"
                    placeholder={isNew ? "Password login" : "Isi untuk reset password"}
                    value={accountForm.password}
                    onChange={e => setAccountForm(p => ({ ...p, password: e.target.value }))} />
                </div>
              </Section>

            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
              <button onClick={() => setSelected(null)} className="btn-modal-cancel flex-1">
                Batal
              </button>
              <button onClick={handleSave} disabled={saving} className="btn-modal-save flex-1 flex items-center justify-center gap-2">
                <Save size={14} />
                {saving ? "Menyimpan..." : (isNew ? "Buat Siswa" : "Simpan")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BukuIndukSiswaTable({ items, onEdit }: { items: Student[]; onEdit: (s: Student) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-primary-100"
            style={{ background: "linear-gradient(135deg, rgba(15,26,69,0.05) 0%, rgba(27,43,107,0.03) 100%)" }}>
            <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">No. Induk</th>
            <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">NIS</th>
            <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Nama Siswa</th>
            <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Jurusan</th>
            <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Status</th>
            <th className="text-right px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {items.map((s) => (
            <tr key={s.id} className="border-b border-gray-50 last:border-0 hover:bg-primary-50/30 transition-colors">
              <td className="px-5 py-3.5 font-mono text-xs text-gray-400">{s.noInduk || "—"}</td>
              <td className="px-5 py-3.5 font-mono font-semibold text-gray-600">{s.nis}</td>
              <td className="px-5 py-3.5 font-semibold text-primary-900">{s.user.name}</td>
              <td className="px-5 py-3.5 text-xs">
                <span className="bg-gray-50 text-gray-600 font-semibold px-2 py-0.5 rounded-full border border-gray-200">{s.major.code}</span>
              </td>
              <td className="px-5 py-3.5">
                <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold ${STATUS_COLOR[s.studentStatus ?? "AKTIF"] ?? "bg-gray-100 text-gray-600 border border-gray-200"}`}>
                  {s.studentStatus ?? "AKTIF"}
                </span>
              </td>
              <td className="px-5 py-3.5 text-right">
                <div className="flex items-center justify-end gap-1.5">
                  <a href={`/dashboard/admin/buku-induk/siswa/${s.id}/cetak`} target="_blank" rel="noopener noreferrer"
                    title="Cetak Buku Induk"
                    className="p-1.5 text-gray-400 hover:text-primary-700 hover:bg-primary-50 rounded-lg border border-transparent hover:border-primary-100 transition-colors">
                    <Printer size={14} />
                  </a>
                  <button onClick={() => onEdit(s)}
                    className="px-3 py-1.5 text-xs bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100 border border-primary-100 font-semibold transition-colors">
                    Lihat/Edit
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
