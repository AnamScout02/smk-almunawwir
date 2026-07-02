"use client";
import React, { useState, useEffect, useCallback } from "react";
import {
  Search, Download, Upload, ChevronDown, ChevronUp, X, Save,
  BookOpen, User, Home, GraduationCap, Briefcase, Plus, KeyRound, UserCog,
} from "lucide-react";
import DatePicker from "@/components/shared/DatePicker";
import PageHeader from "@/components/admin/PageHeader";

interface TeacherExtended {
  nik?: string; nuptk?: string; certNo?: string;
  maritalStatus?: string; spouseName?: string;
  kecamatan?: string; kabupaten?: string; province?: string;
  workUnit?: string; subjectFull?: string;
  workStatus?: string; certStatus?: string;
  entryYear?: string; exitDate?: string; exitReason?: string;
  teacherNotes?: string;
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

function Field({ label, value, onChange, type = "text", wide = false, options, min, max, readOnly }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; wide?: boolean; options?: string[]; min?: number; max?: number; readOnly?: boolean;
}) {
  const cls = `${CLS} ${readOnly ? "bg-gray-50 text-gray-500 cursor-default" : ""}`;
  return (
    <div className={wide ? "col-span-2" : ""}>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {options ? (
        <select className={cls} value={value} onChange={ev => onChange(ev.target.value)} disabled={readOnly}>
          <option value="">— Pilih —</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : type === "textarea" ? (
        <textarea className={`${cls} resize-none`} rows={2} value={value}
          onChange={ev => onChange(ev.target.value)} readOnly={readOnly} />
      ) : type === "tel" ? (
        <input className={cls} type="tel" inputMode="numeric" pattern="[0-9]*"
          value={value} onChange={ev => onChange(ev.target.value.replace(/\D/g, ""))} readOnly={readOnly} />
      ) : type === "nik" ? (
        <input className={cls} type="text" inputMode="numeric" pattern="[0-9]{16}"
          maxLength={16} placeholder="16 digit" value={value}
          onChange={ev => onChange(ev.target.value.replace(/\D/g, ""))} readOnly={readOnly} />
      ) : type === "number" ? (
        <input className={cls} type="number" min={min} max={max} value={value}
          onChange={ev => onChange(ev.target.value)} readOnly={readOnly} />
      ) : type === "date" ? (
        <DatePicker value={value} onChange={onChange} disabled={readOnly} />
      ) : (
        <input className={cls} type={type} value={value}
          onChange={ev => onChange(ev.target.value)} readOnly={readOnly} />
      )}
    </div>
  );
}

function Section({ title, icon: Icon, open, onToggle, children, accent }: {
  title: string; icon: React.ElementType; open: boolean;
  onToggle: () => void; children: React.ReactNode; accent?: string;
}) {
  return (
    <div className="border border-primary-100 rounded-xl overflow-hidden shadow-sm">
      <button type="button"
        className="w-full flex items-center justify-between px-4 py-3 transition-colors"
        style={{ background: open ? "linear-gradient(135deg, #0F1A45 0%, #1B2B6B 100%)" : "linear-gradient(135deg, rgba(15,26,69,0.05) 0%, rgba(27,43,107,0.03) 100%)" }}
        onClick={onToggle}>
        <span className={`flex items-center gap-2 font-semibold text-sm ${open ? "text-white" : "text-primary-800"}`}>
          <Icon size={15} className={open ? "text-gold" : (accent ?? "text-primary-600")} />{title}
        </span>
        {open ? <ChevronUp size={15} className="text-white/60" /> : <ChevronDown size={15} className="text-primary-400" />}
      </button>
      {open && <div className="p-4 grid grid-cols-2 gap-3 bg-white">{children}</div>}
    </div>
  );
}

const EMPTY_FORM: Partial<Teacher> = {
  phone: "", birthPlace: "", birthDate: "", gender: "", religion: "", address: "",
  education: "", position: "", startDate: "", teacherStatus: "AKTIF", teacherNotes: "",
};
const EMPTY_ACCOUNT = { name: "", email: "", password: "", nip: "", subject: "" };

export default function BukuIndukGuruPage() {
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
  const [sections, setSections] = useState<Record<string, boolean>>({ personal: true });
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
    setSections({ personal: true, akun: true });
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
    setSections({ personal: true });
    setSaveError("");
  }

  async function handleSave() {
    setSaveError("");
    if (isNew) {
      if (!accountForm.name || !accountForm.email || !accountForm.password || !accountForm.nip || !accountForm.subject) {
        setSaveError("Nama, email, password, NIP, dan mata pelajaran wajib diisi di Section Akun & Login");
        setSections(p => ({ ...p, akun: true }));
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
      await fetch(`/api/admin/buku-induk/guru/${selected.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setSaving(false); setSelected(null); fetchTeachers();
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
  const toggleSection = (k: string) => setSections(p => ({ ...p, [k]: !p[k] }));

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
        <select className="input-field w-auto"
          value={statusFilter} onChange={ev => setStatusFilter(ev.target.value)}>
          <option value="ALL">Semua Status</option>
          <option value="AKTIF">Aktif</option>
          <option value="PENSIUN">Pensiun</option>
          <option value="KELUAR">Keluar</option>
        </select>
        <button onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary-700 text-white rounded-xl text-sm font-semibold hover:bg-primary-900 transition-colors">
          <Plus size={16} /> Tambah Guru
        </button>
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
        <div className={`mb-4 p-3 rounded-lg text-sm ${importResult.errors.length > 0 ? "bg-yellow-50 border border-yellow-200" : "bg-green-50 border border-green-200"}`}>
          <p className="font-semibold">Hasil import: {importResult.created} dibuat, {importResult.updated} diperbarui</p>
          {importResult.errors.length > 0 && (
            <ul className="mt-1 text-red-600 text-xs list-disc list-inside">
              {importResult.errors.slice(0, 5).map((err, i) => <li key={i}>{err}</li>)}
              {importResult.errors.length > 5 && <li>...dan {importResult.errors.length - 5} error lainnya</li>}
            </ul>
          )}
        </div>
      )}

      {/* Tabel */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              {["NIP","Nama Guru","Mata Pelajaran","Jabatan","Wali Kelas","Status","Aksi"].map(h => (
                <th key={h} className={h === "Aksi" ? "text-center" : ""}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">Memuat data...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">Tidak ada data guru</td></tr>
            ) : filtered.map((t) => (
              <tr key={t.id}>
                <td className="font-mono text-xs text-gray-600">{t.nip}</td>
                <td className="font-semibold text-primary-900">{t.user.name}</td>
                <td className="text-gray-600">{t.subject}</td>
                <td className="text-gray-500 text-xs">{t.position ?? "-"}</td>
                <td className="text-gray-600">
                  {t.homeroomOf.length > 0
                    ? t.homeroomOf.map(c => (
                        <span key={c.name} className="inline-flex bg-primary-50 text-primary-600 font-semibold px-2 py-0.5 rounded-full text-xs border border-primary-100 mr-1">{c.name}</span>
                      ))
                    : <span className="text-gray-300 text-xs">—</span>}
                </td>
                <td>
                  <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold ${STATUS_COLOR[t.teacherStatus ?? "AKTIF"] ?? "bg-gray-50 text-gray-600 border border-gray-200"}`}>
                    {t.teacherStatus ?? "AKTIF"}
                  </span>
                </td>
                <td className="text-center">
                  <button onClick={() => openEdit(t)}
                    className="px-2.5 py-1 text-xs font-semibold bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100 border border-primary-100 transition-colors">
                    Lihat/Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && (
          <div className="px-4 py-3 border-t border-gray-50 text-xs text-gray-400">
            Menampilkan {filtered.length} dari {teachers.length} guru
          </div>
        )}
      </div>

      {/* Modal Edit / Tambah */}
      {selected !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4"
              style={{ background: "linear-gradient(135deg, #0A1030 0%, #0F1A45 40%, #1B2B6B 100%)" }}>
              <div>
                <h2 className="font-heading font-bold text-white">
                  {isNew ? "Tambah Guru Baru" : "Buku Induk Guru"}
                </h2>
                <p className="text-xs text-white/50 mt-0.5">
                  {isNew ? "Isi data guru baru dan akun login" : `${selected.user.name} — NIP ${selected.nip}`}
                </p>
              </div>
              <button onClick={() => setSelected(null)} className="p-2 text-white/60 hover:text-white rounded-lg transition-colors"><X size={20} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-3">

              {saveError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                  {saveError}
                </div>
              )}

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
                <Field label="Alamat Lengkap" value={String(form.address ?? "")} type="textarea" wide
                  onChange={v => setForm(p => ({...p, address: v}))} />
                <Field label="Kecamatan" value={e("kecamatan")} onChange={setE("kecamatan")} />
                <Field label="Kabupaten/Kota" value={e("kabupaten")} onChange={setE("kabupaten")} />
                <Field label="Provinsi" value={e("province")} onChange={setE("province")} />
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
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                  <select className={CLS} value={String(form.teacherStatus ?? "AKTIF")}
                    onChange={ev => setForm(p => ({...p, teacherStatus: ev.target.value}))}>
                    <option value="AKTIF">AKTIF</option>
                    <option value="PENSIUN">PENSIUN</option>
                    <option value="KELUAR">KELUAR</option>
                  </select>
                </div>
                <Field label="Tanggal Keluar" value={e("exitDate")} type="date" onChange={setE("exitDate")} />
                <Field label="Alasan Keluar/Pensiun" value={e("exitReason")} wide onChange={setE("exitReason")} />
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
                <Field label="Kecamatan" value={e("kecamatan")} onChange={setE("kecamatan")} />
                <Field label="Kabupaten/Kota" value={e("kabupaten")} onChange={setE("kabupaten")} />
                <Field label="Provinsi" value={e("province")} onChange={setE("province")} />
              </Section>

              {/* E: Akun & Login */}
              <Section title="E. Akun & Login" icon={KeyRound} open={!!sections.akun} onToggle={() => toggleSection("akun")} accent="text-indigo-600">
                {isNew ? (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Nama Lengkap <span className="text-red-500">*</span>
                      </label>
                      <input className={CLS} type="text" placeholder="Nama guru" value={accountForm.name}
                        onChange={ev => setAccountForm(p => ({ ...p, name: ev.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        NIP <span className="text-red-500">*</span>
                      </label>
                      <input className={CLS} type="text" placeholder="Nomor Induk Pegawai" value={accountForm.nip}
                        onChange={ev => setAccountForm(p => ({ ...p, nip: ev.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Email Login <span className="text-red-500">*</span>
                      </label>
                      <input className={CLS} type="email" placeholder="email@contoh.com" value={accountForm.email}
                        onChange={ev => setAccountForm(p => ({ ...p, email: ev.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Password <span className="text-red-500">*</span>
                      </label>
                      <input className={CLS} type="password" placeholder="Minimal 8 karakter" value={accountForm.password}
                        onChange={ev => setAccountForm(p => ({ ...p, password: ev.target.value }))} />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-500 mb-1">
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
                      <label className="block text-xs font-medium text-gray-500 mb-1">Email Login</label>
                      <input className={`${CLS} bg-gray-50 text-gray-500`} type="email"
                        value={selected?.user.email ?? ""} readOnly />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Password Baru <span className="text-gray-400">(kosongkan jika tidak ingin mengubah)</span>
                      </label>
                      <input className={CLS} type="password" placeholder="Isi untuk reset password"
                        value={accountForm.password}
                        onChange={ev => setAccountForm(p => ({ ...p, password: ev.target.value }))} />
                    </div>
                  </>
                )}
              </Section>

            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-50">
              <button onClick={() => setSelected(null)} className="btn-modal-cancel">Batal</button>
              <button onClick={handleSave} disabled={saving} className="btn-modal-save flex items-center gap-2">
                <Save size={16} />
                {saving ? "Menyimpan..." : (isNew ? "Buat Guru" : "Simpan")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
