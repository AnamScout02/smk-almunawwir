"use client";
import React, { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search, Download, Upload, Save, Loader2,
  User, Home, GraduationCap, Briefcase, Plus, KeyRound, UserCog, Users, Table2,
} from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import ImageUpload from "@/components/admin/ImageUpload";
import WilayahSelect from "@/components/admin/WilayahSelect";
import Field from "@/components/admin/BukuIndukField";
import Section from "@/components/admin/BukuIndukSection";
import Alert from "@/components/admin/Alert";
import Modal from "@/components/admin/Modal";
import GroupedSection from "@/components/admin/GroupedSection";
import EmptyState from "@/components/admin/EmptyState";

interface TeacherExtended {
  nik?: string; nuptk?: string; certNo?: string;
  maritalStatus?: string; spouseName?: string;
  desa?: string; kecamatan?: string; kabupaten?: string; province?: string;
  workUnit?: string; subjectFull?: string;
  workStatus?: string; certStatus?: string;
  entryYear?: string; exitDate?: string; exitReason?: string;
  teacherNotes?: string;
  fotoMasukUrl?: string; fotoKeluarUrl?: string;
}

interface Teacher {
  id: string; nip: string; subject: string;
  phone?: string; birthPlace?: string; birthDate?: string;
  gender?: string; religion?: string; address?: string;
  education?: string; position?: string; startDate?: string;
  teacherStatus?: string; teacherNotes?: string;
  bukuIndukData?: TeacherExtended;
  user: { name: string; email: string };
  homeroomOf: { name: string }[];
}

interface MasterEntry { category: string; items: string[] }

const STATUS_COLOR: Record<string, string> = {
  AKTIF: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  PENSIUN: "bg-blue-50 text-blue-700 border border-blue-200",
  KELUAR: "bg-red-50 text-red-600 border border-red-200",
};

const CLS = "input-field";
// Field & Section diimpor dari @/components/admin — dipakai bersama dengan Buku Induk Siswa

const EMPTY_FORM: Partial<Teacher> = {
  phone: "", birthPlace: "", birthDate: "", gender: "", religion: "", address: "",
  education: "", position: "", startDate: "", teacherStatus: "AKTIF", teacherNotes: "",
};
const EMPTY_ACCOUNT = { name: "", email: "", password: "", nip: "", subject: "" };

export default function BukuIndukGuruPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [filtered, setFiltered] = useState<Teacher[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Teacher | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState<Partial<Teacher>>({});
  const [ext, setExt] = useState<TeacherExtended>({});
  const [accountForm, setAccountForm] = useState({ ...EMPTY_ACCOUNT });
  const [sections, setSections] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; updated: number; errors: string[] } | null>(null);
  const [masterData, setMasterData] = useState<MasterEntry[]>([]);

  const md = (cat: string): string[] => masterData.find(m => m.category === cat)?.items ?? [];

  const fetchTeachers = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/buku-induk/guru");
    const data = await res.json();
    setTeachers(data); setFiltered(data); setLoading(false);
  }, []);

  useEffect(() => {
    fetchTeachers();
    fetch("/api/admin/master-data").then(r => r.json()).then(setMasterData).catch(() => {});
  }, [fetchTeachers]);

  useEffect(() => {
    let list = teachers;
    if (statusFilter !== "ALL") list = list.filter(t => t.teacherStatus === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(t =>
        t.user.name.toLowerCase().includes(q) ||
        t.nip.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q)
      );
    }
    setFiltered(list);
  }, [teachers, search, statusFilter]);

  function openCreate() {
    setIsNew(true);
    setSelected({ id: "", nip: "", subject: "", user: { name: "", email: "" }, homeroomOf: [] });
    setForm({ ...EMPTY_FORM });
    setExt({});
    setAccountForm({ ...EMPTY_ACCOUNT });
    setSections({});
    setSaveError("");
  }

  function openEdit(teacher: Teacher) {
    setIsNew(false);
    setSelected(teacher);
    setForm({
      phone: teacher.phone ?? "",
      birthPlace: teacher.birthPlace ?? "",
      birthDate: teacher.birthDate ? teacher.birthDate.slice(0, 10) : "",
      gender: teacher.gender ?? "",
      religion: teacher.religion ?? "",
      address: teacher.address ?? "",
      education: teacher.education ?? "",
      position: teacher.position ?? "",
      startDate: teacher.startDate ? teacher.startDate.slice(0, 10) : "",
      teacherStatus: teacher.teacherStatus ?? "AKTIF",
      teacherNotes: teacher.teacherNotes ?? "",
    });
    setExt((teacher.bukuIndukData as TeacherExtended) ?? {});
    setAccountForm({ ...EMPTY_ACCOUNT, email: teacher.user.email });
    setSections({});
    setSaveError("");
  }

  // Deep link dari halaman /teachers: buka modal edit guru tertentu otomatis lewat ?edit=<id>
  useEffect(() => {
    const editId = searchParams.get("edit");
    if (!editId || teachers.length === 0) return;
    const target = teachers.find(t => t.id === editId);
    if (target) openEdit(target);
    router.replace("/dashboard/admin/buku-induk/guru");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teachers, searchParams]);

  async function handleSave() {
    setSaveError("");
    if (isNew) {
      if (!accountForm.name || !accountForm.email || !accountForm.password || !accountForm.nip || !accountForm.subject) {
        setSaveError("Nama, email, password, NIP, dan mata pelajaran wajib diisi di Section Akun & Login");
        setSections({ akun: true });
        return;
      }
      setSaving(true);
      const res = await fetch("/api/admin/buku-induk/guru", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: accountForm.name,
          email: accountForm.email,
          password: accountForm.password,
          nip: accountForm.nip,
          subject: accountForm.subject,
          ...form,
          bukuIndukData: ext,
        }),
      });
      const data = await res.json();
      setSaving(false);
      if (!res.ok) { setSaveError(data.error ?? "Terjadi kesalahan"); return; }
      setSelected(null); fetchTeachers();
    } else {
      if (!selected) return;
      setSaving(true);
      const body: Record<string, unknown> = { ...form, bukuIndukData: ext };
      if (accountForm.password) body.password = accountForm.password;
      const res = await fetch(`/api/admin/buku-induk/guru/${selected.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setSaving(false);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSaveError(data.error ?? "Gagal menyimpan perubahan. Silakan coba lagi.");
        return;
      }
      setSelected(null); fetchTeachers();
    }
  }

  async function handleImport(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0]; if (!file) return;
    setImportLoading(true); setImportResult(null);
    const fd = new FormData(); fd.append("file", file);
    const res = await fetch("/api/admin/buku-induk/guru/import", { method: "POST", body: fd });
    const data = await res.json();
    setImportResult(data); setImportLoading(false); fetchTeachers(); ev.target.value = "";
  }

  const e = (key: keyof TeacherExtended) => String(ext[key] ?? "");
  const setE = (key: keyof TeacherExtended) => (v: string) => setExt(p => ({ ...p, [key]: v }));
  const toggleSection = (k: string) => setSections(p => (p[k] ? {} : { [k]: true }));

  const waliKelas = filtered.filter(t => t.homeroomOf.length > 0);
  const bukanWali = filtered.filter(t => t.homeroomOf.length === 0);

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader
        icon={<UserCog size={22} />}
        title="Buku Induk Guru"
        description="Data lengkap kepegawaian guru SMK Al Munawwir IIBS"
      />

      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input-field pl-10"
            placeholder="Cari nama, NIP, atau mata pelajaran..."
            value={search} onChange={ev => setSearch(ev.target.value)} />
        </div>
        <Select
          className="w-auto"
          value={statusFilter}
          onChange={v => setStatusFilter(v)}
          options={[
            { value: "ALL", label: "Semua Status" },
            { value: "AKTIF", label: "Aktif" },
            { value: "PENSIUN", label: "Pensiun" },
            { value: "KELUAR", label: "Keluar" },
          ]}
        />
        <button onClick={openCreate} className="btn-gold flex items-center gap-2 text-sm">
          <Plus size={16} /> Tambah Guru
        </button>
        <a href="/dashboard/admin/buku-induk/guru/tabel"
          className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-xl text-sm font-semibold transition-colors">
          <Table2 size={16} /> Tabel Lengkap
        </a>
        <a href="/api/admin/buku-induk/guru/template"
          className="flex items-center gap-2 px-4 py-2.5 bg-white text-primary-700 border border-primary-200 rounded-xl text-sm font-semibold hover:bg-primary-50 transition-colors">
          <Download size={16} /> Download Template
        </a>
        <label className="flex items-center gap-2 px-4 py-2.5 bg-white text-primary-700 border border-primary-200 rounded-xl text-sm font-semibold hover:bg-primary-50 transition-colors cursor-pointer">
          <Upload size={16} />
          {importLoading ? "Mengimpor..." : "Import Excel"}
          <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} disabled={importLoading} />
        </label>
      </div>

      {importResult && (
        <Alert variant={importResult.errors.length > 0 ? "warning" : "success"} className="mb-4"
          title={`Hasil import: ${importResult.created} dibuat, ${importResult.updated} diperbarui`}>
          {importResult.errors.length > 0 && (
            <ul className="mt-1 text-red-600 text-xs list-disc list-inside">
              {importResult.errors.slice(0, 5).map((err, i) => <li key={i}>{err}</li>)}
              {importResult.errors.length > 5 && <li>...dan {importResult.errors.length - 5} error lainnya</li>}
            </ul>
          )}
        </Alert>
      )}

      {/* Tabel */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-primary-500" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={User} title="Tidak ada data guru" />
      ) : (
        <div className="space-y-6">
          {waliKelas.length > 0 && (
            <GroupedSection title="Wali Kelas" count={waliKelas.length} icon={GraduationCap}>
              <TeacherTable items={waliKelas} onEdit={openEdit} />
            </GroupedSection>
          )}
          {bukanWali.length > 0 && (
            <GroupedSection title="Bukan Wali Kelas" count={bukanWali.length} icon={Users}>
              <TeacherTable items={bukanWali} onEdit={openEdit} />
            </GroupedSection>
          )}
          <p className="text-xs text-gray-400">Menampilkan {filtered.length} dari {teachers.length} guru</p>
        </div>
      )}

      {/* Modal Edit / Tambah */}
      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        size="xl"
        scrollBody
        title={isNew ? "Tambah Guru Baru" : "Buku Induk Guru"}
        description={isNew ? "Isi data guru baru dan akun login" : (selected ? `${selected.user.name} — NIP ${selected.nip}` : "")}
        footer={
          <>
            <button onClick={() => setSelected(null)} className="btn-modal-cancel flex-1">Batal</button>
            <button onClick={handleSave} disabled={saving} className="btn-modal-save flex-1 flex items-center justify-center gap-2">
              <Save size={16} />
              {saving ? "Menyimpan..." : (isNew ? "Buat Guru" : "Simpan")}
            </button>
          </>
        }
      >
              {saveError && <Alert variant="error">{saveError}</Alert>}

              {/* A: Data Pribadi */}
              <Section title="A. Data Pribadi" icon={User} open={!!sections.personal} onToggle={() => toggleSection("personal")}>
                <Field label="NIK (16 digit)" value={e("nik")} type="nik" onChange={setE("nik")} />
                <Field label="NUPTK" value={e("nuptk")} type="nik" onChange={setE("nuptk")} />
                <Field label="Jenis Kelamin" value={String(form.gender ?? "")} options={md("jenis_kelamin")}
                  onChange={v => setForm(p => ({...p, gender: v}))} />
                <Field label="Tempat Lahir" value={String(form.birthPlace ?? "")}
                  onChange={v => setForm(p => ({...p, birthPlace: v}))} />
                <Field label="Tanggal Lahir" value={String(form.birthDate ?? "")} type="date"
                  onChange={v => setForm(p => ({...p, birthDate: v}))} />
                <Field label="Agama" value={String(form.religion ?? "")} options={md("agama")}
                  onChange={v => setForm(p => ({...p, religion: v}))} />
                <Field label="No. HP" value={String(form.phone ?? "")} type="tel"
                  onChange={v => setForm(p => ({...p, phone: v}))} />
                <Field label="Status Pernikahan" value={e("maritalStatus")}
                  options={["Belum Kawin","Kawin","Cerai Hidup","Cerai Mati"]}
                  onChange={setE("maritalStatus")} />
                <Field label="Nama Suami/Istri" value={e("spouseName")} onChange={setE("spouseName")} />
              </Section>

              {/* B: Kepegawaian */}
              <Section title="B. Data Kepegawaian" icon={Briefcase} open={!!sections.kerja} onToggle={() => toggleSection("kerja")}>
                <Field label="Pendidikan Terakhir" value={String(form.education ?? "")} options={md("pendidikan_guru")}
                  onChange={v => setForm(p => ({...p, education: v}))} />
                <Field label="No. Sertifikat Pendidik" value={e("certNo")} onChange={setE("certNo")} />
                <Field label="Status Sertifikasi" value={e("certStatus")}
                  options={["Belum Sertifikasi","Sudah Sertifikasi","Sedang Proses"]}
                  onChange={setE("certStatus")} />
                <Field label="Jabatan/Status Kepegawaian" value={String(form.position ?? "")}
                  options={md("status_kepegawaian")}
                  onChange={v => setForm(p => ({...p, position: v}))} />
                <Field label="Unit Kerja" value={e("workUnit")} onChange={setE("workUnit")} />
                <Field label="Mata Pelajaran Lengkap" value={e("subjectFull")} wide onChange={setE("subjectFull")} />
                <Field label="Tanggal Mulai Mengajar" value={String(form.startDate ?? "")} type="date"
                  onChange={v => setForm(p => ({...p, startDate: v}))} />
                <Field label="Tahun Masuk" value={e("entryYear")} type="number" min={1980} max={2050}
                  onChange={setE("entryYear")} />
                <div className="col-span-2">
                  <ImageUpload value={e("fotoMasukUrl")} onChange={setE("fotoMasukUrl")} folder="buku-induk/masuk" label="Foto Masuk (saat mulai mengajar)"
                    accept="image/jpeg,image/png" hint="JPG/PNG, rasio 3x4 — maks. 5MB" aspect="portrait" checkRatio={3/4} />
                </div>
                <div>
                  <label className="label-field">Status</label>
                  <Select
                    value={String(form.teacherStatus ?? "AKTIF")}
                    onChange={v => setForm(p => ({...p, teacherStatus: v}))}
                    options={[
                      { value: "AKTIF", label: "AKTIF" },
                      { value: "PENSIUN", label: "PENSIUN" },
                      { value: "KELUAR", label: "KELUAR" },
                    ]}
                  />
                </div>
                <Field label="Tanggal Keluar" value={e("exitDate")} type="date" onChange={setE("exitDate")} />
                <Field label="Alasan Keluar/Pensiun" value={e("exitReason")} wide onChange={setE("exitReason")} />
                <div className="col-span-2">
                  <ImageUpload value={e("fotoKeluarUrl")} onChange={setE("fotoKeluarUrl")} folder="buku-induk/keluar" label="Foto Keluar (saat pensiun/keluar)"
                    accept="image/jpeg,image/png" hint="JPG/PNG, rasio 3x4 — maks. 5MB" aspect="portrait" checkRatio={3/4} />
                </div>
                <Field label="Keterangan Tambahan" value={String(form.teacherNotes ?? "")} type="textarea" wide
                  onChange={v => setForm(p => ({...p, teacherNotes: v}))} />
              </Section>

              {/* C: Pendidikan */}
              <Section title="C. Riwayat Pendidikan" icon={GraduationCap} open={!!sections.pendidikan} onToggle={() => toggleSection("pendidikan")}>
                <div className="col-span-2 text-xs text-gray-400 bg-gray-50 rounded px-3 py-2">
                  Isi rincian riwayat pendidikan pada kolom keterangan, atau lampirkan dokumen terpisah.
                </div>
                <Field label="Keterangan Riwayat Pendidikan" value={String(form.teacherNotes ?? "")} type="textarea" wide
                  onChange={v => setForm(p => ({...p, teacherNotes: v}))} />
              </Section>

              {/* D: Tempat Tinggal */}
              <Section title="D. Data Tempat Tinggal" icon={Home} open={!!sections.alamat} onToggle={() => toggleSection("alamat")}>
                <Field label="Alamat Lengkap" value={String(form.address ?? "")} type="textarea" wide
                  onChange={v => setForm(p => ({...p, address: v}))} />
                <WilayahSelect
                  province={e("province")} regency={e("kabupaten")} district={e("kecamatan")} village={e("desa")}
                  onProvince={setE("province")} onRegency={setE("kabupaten")}
                  onDistrict={setE("kecamatan")} onVillage={setE("desa")}
                />
              </Section>

              {/* E: Akun & Login */}
              <Section title="E. Akun & Login" icon={KeyRound} open={!!sections.akun} onToggle={() => toggleSection("akun")} accent="text-indigo-600">
                {isNew ? (
                  <>
                    <div>
                      <label className="label-field">
                        Nama Lengkap <span className="text-red-500">*</span>
                      </label>
                      <input className={CLS} type="text" placeholder="Nama guru" value={accountForm.name}
                        onChange={ev => setAccountForm(p => ({ ...p, name: ev.target.value }))} />
                    </div>
                    <div>
                      <label className="label-field">
                        NIP <span className="text-red-500">*</span>
                      </label>
                      <input className={CLS} type="text" placeholder="Nomor Induk Pegawai" value={accountForm.nip}
                        onChange={ev => setAccountForm(p => ({ ...p, nip: ev.target.value }))} />
                    </div>
                    <div>
                      <label className="label-field">
                        Email Login <span className="text-red-500">*</span>
                      </label>
                      <input className={CLS} type="email" placeholder="email@contoh.com" value={accountForm.email}
                        onChange={ev => setAccountForm(p => ({ ...p, email: ev.target.value }))} />
                    </div>
                    <div>
                      <label className="label-field">
                        Password <span className="text-red-500">*</span>
                      </label>
                      <input className={CLS} type="password" placeholder="Minimal 8 karakter" value={accountForm.password}
                        onChange={ev => setAccountForm(p => ({ ...p, password: ev.target.value }))} />
                    </div>
                    <div className="col-span-2">
                      <label className="label-field">
                        Mata Pelajaran <span className="text-red-500">*</span>
                      </label>
                      <input className={CLS} type="text" placeholder="Contoh: Matematika, Bahasa Indonesia"
                        value={accountForm.subject}
                        onChange={ev => setAccountForm(p => ({ ...p, subject: ev.target.value }))} />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="col-span-2">
                      <label className="label-field">Email Login</label>
                      <input className={`${CLS} bg-gray-50 text-gray-500`} type="email"
                        value={selected?.user.email ?? ""} readOnly />
                    </div>
                    <div className="col-span-2">
                      <label className="label-field">
                        Password Baru <span className="text-gray-400">(kosongkan jika tidak ingin mengubah)</span>
                      </label>
                      <input className={CLS} type="password" placeholder="Isi untuk reset password"
                        value={accountForm.password}
                        onChange={ev => setAccountForm(p => ({ ...p, password: ev.target.value }))} />
                    </div>
                  </>
                )}
              </Section>
      </Modal>
    </div>
  );
}

function TeacherTable({ items, onEdit }: { items: Teacher[]; onEdit: (t: Teacher) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-primary-100"
            style={{ background: "linear-gradient(135deg, rgba(15,26,69,0.05) 0%, rgba(27,43,107,0.03) 100%)" }}>
            <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">NIP</th>
            <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Nama Guru</th>
            <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Mata Pelajaran</th>
            <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Jabatan</th>
            <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Status</th>
            <th className="text-right px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {items.map((t) => (
            <tr key={t.id} className="border-b border-gray-50 last:border-0 hover:bg-primary-50/30 transition-colors">
              <td className="px-5 py-3.5 font-mono text-xs text-gray-600">{t.nip}</td>
              <td className="px-5 py-3.5 font-semibold text-primary-900">{t.user.name}</td>
              <td className="px-5 py-3.5 text-gray-600">{t.subject}</td>
              <td className="px-5 py-3.5 text-gray-500 text-xs">{t.position ?? "-"}</td>
              <td className="px-5 py-3.5">
                <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold ${STATUS_COLOR[t.teacherStatus ?? "AKTIF"] ?? "bg-gray-50 text-gray-600 border border-gray-200"}`}>
                  {t.teacherStatus ?? "AKTIF"}
                </span>
              </td>
              <td className="px-5 py-3.5 text-right">
                <button onClick={() => onEdit(t)}
                  className="px-3 py-1.5 text-xs bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100 border border-primary-100 font-semibold transition-colors">
                  Lihat/Edit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
