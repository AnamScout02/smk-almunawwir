"use client";
import { useEffect, useState, useTransition } from "react";
import { Search, Edit2, Save, Users, Loader2, GraduationCap, Download, Eye } from "lucide-react";
import Link from "next/link";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import StatTile from "@/components/admin/StatTile";
import Modal from "@/components/admin/Modal";
import EmptyState from "@/components/admin/EmptyState";

interface Major { id: string; name: string; code: string }
interface ClassItem { id: string; name: string; grade: number; major: { code: string } }
interface Student {
  id: string;
  nis: string;
  nisn: string | null;
  user: { id: string; name: string; email: string };
  class: ClassItem | null;
  major: Major;
}

interface FormState {
  id: string;
  nis: string;
  nisn: string;
  majorId: string;
  classId: string;
}

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [majors, setMajors] = useState<Major[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterClass, setFilterClass] = useState("ALL");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<FormState>({ id: "", nis: "", nisn: "", majorId: "", classId: "" });
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const [sRes, optRes] = await Promise.all([
      fetch("/api/admin/students"),
      fetch("/api/admin/classes/options"),
    ]);
    const [clsRes] = await Promise.all([fetch("/api/admin/classes")]);
    if (sRes.ok) setStudents(await sRes.json());
    if (optRes.ok) { const { majors: m } = await optRes.json(); setMajors(m); }
    if (clsRes.ok) setClasses(await clsRes.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openEdit(s: Student) {
    setForm({ id: s.id, nis: s.nis, nisn: s.nisn ?? "", majorId: s.major.id, classId: s.class?.id ?? "" });
    setError("");
    setModal(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nis || !form.majorId) { setError("NIS dan jurusan wajib diisi."); return; }
    setError("");
    startTransition(async () => {
      const res = await fetch(`/api/admin/students/${form.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || "Gagal"); return; }
      setModal(false);
      load();
    });
  }

  const filtered = students.filter(s => {
    const q = search.toLowerCase();
    const matchSearch = !q || s.user.name.toLowerCase().includes(q) || s.nis.includes(q) || (s.nisn ?? "").includes(q);
    const matchClass = filterClass === "ALL" || s.class?.id === filterClass || (filterClass === "NONE" && !s.class);
    return matchSearch && matchClass;
  });

  // group by class
  const grouped = classes
    .sort((a, b) => a.grade - b.grade || a.name.localeCompare(b.name))
    .map(cls => ({ cls, items: filtered.filter(s => s.class?.id === cls.id) }))
    .filter(g => g.items.length > 0);

  const unclassed = filtered.filter(s => !s.class);

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader
        icon={<Users size={22} />}
        title="Kelola Siswa"
        description="Atur NIS, jurusan, dan kelas setiap siswa"
        actions={
          <a href="/api/admin/export/students"
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
            <Download size={15} />
            Export CSV
          </a>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        <StatTile color="primary" value={students.length} label="Total Siswa" />
        <StatTile color="emerald" value={students.filter(s => s.class).length} label="Sudah Berkelas" />
        <StatTile color="amber" value={students.filter(s => !s.class).length} label="Belum Berkelas" />
      </div>

      {/* Filter & Search */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Cari nama, NIS, atau NISN..."
            className="input-field pl-10" />
        </div>
        <Select
          className="sm:w-48"
          value={filterClass}
          onChange={v => setFilterClass(v)}
          options={[
            { value: "ALL", label: "Semua Kelas" },
            ...classes.map(c => ({ value: c.id, label: c.name })),
            { value: "NONE", label: "Belum Ada Kelas" },
          ]}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-primary-500" /></div>
      ) : (
        <div className="space-y-6">
          {/* Per kelas */}
          {grouped.map(({ cls, items }) => (
            <div key={cls.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 flex items-center justify-between"
                style={{ background: "linear-gradient(135deg, #0F1A45 0%, #1B2B6B 100%)" }}>
                <div className="flex items-center gap-2">
                  <GraduationCap size={15} className="text-gold" />
                  <span className="font-heading font-bold text-white text-sm">{cls.name}</span>
                  <span className="text-white/40 text-xs">· {cls.major.code}</span>
                </div>
                <span className="text-xs font-semibold text-gold bg-white/10 border border-white/20 px-2.5 py-1 rounded-full flex items-center gap-1">
                  <Users size={10} /> {items.length}
                </span>
              </div>
              <StudentTable items={items} onEdit={openEdit} />
            </div>
          ))}

          {/* Tanpa kelas */}
          {unclassed.length > 0 && (
            <div className="bg-white rounded-2xl border border-amber-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 bg-amber-500 flex items-center justify-between">
                <span className="font-heading font-bold text-white flex items-center gap-2 text-sm">
                  <Users size={15} /> Belum Ada Kelas
                </span>
                <span className="text-xs font-bold text-white bg-white/20 px-2.5 py-1 rounded-full">{unclassed.length}</span>
              </div>
              <StudentTable items={unclassed} onEdit={openEdit} />
            </div>
          )}

          {filtered.length === 0 && (
            <EmptyState icon={Users} title="Tidak ada siswa ditemukan" />
          )}
        </div>
      )}

      {/* Modal edit profil siswa */}
      <Modal
        open={!!modal}
        onClose={() => setModal(false)}
        title="Edit Profil Siswa"
        footer={
          <>
            <button type="button" onClick={() => setModal(false)} className="btn-modal-cancel flex-1">Batal</button>
            <button type="submit" form="editSiswaForm" disabled={isPending} className="btn-modal-save flex-1">
              {isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {isPending ? "Menyimpan..." : "Simpan"}
            </button>
          </>
        }
      >
        <form id="editSiswaForm" onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-field">NIS</label>
              <input value={form.nis} onChange={e => setForm(f => ({ ...f, nis: e.target.value }))}
                className="input-field font-mono" required placeholder="Contoh: 2024001" />
            </div>
            <div>
              <label className="label-field">NISN</label>
              <input value={form.nisn} onChange={e => setForm(f => ({ ...f, nisn: e.target.value }))}
                className="input-field font-mono" placeholder="10 digit" maxLength={10} />
            </div>
          </div>
          <div>
            <label className="label-field">Konsentrasi / Jurusan</label>
            <Select
              value={form.majorId}
              onChange={v => setForm(f => ({ ...f, majorId: v }))}
              options={majors.map(m => ({ value: m.id, label: `${m.code} — ${m.name}` }))}
              placeholder="Pilih jurusan"
            />
          </div>
          <div>
            <label className="label-field">Kelas</label>
            <Select
              value={form.classId}
              onChange={v => setForm(f => ({ ...f, classId: v }))}
              options={classes.map(c => ({ value: c.id, label: c.name }))}
              placeholder="— Belum ditentukan —"
            />
          </div>
          {error && <p className="error-msg">{error}</p>}
        </form>
      </Modal>
    </div>
  );
}

function StudentTable({ items, onEdit }: { items: Student[]; onEdit: (s: Student) => void }) {
  return (
    <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-primary-100"
          style={{ background: "linear-gradient(135deg, rgba(15,26,69,0.05) 0%, rgba(27,43,107,0.03) 100%)" }}>
          <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70 w-8">#</th>
          <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">NIS</th>
          <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Nama Siswa</th>
          <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70 hidden md:table-cell">NISN</th>
          <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70 hidden lg:table-cell">Jurusan</th>
          <th className="text-right px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Aksi</th>
        </tr>
      </thead>
      <tbody>
        {items.map((s, i) => (
          <tr key={s.id} className="border-b border-gray-50 last:border-0 hover:bg-primary-50/30 transition-colors">
            <td className="px-5 py-3.5 text-gray-300 text-xs">{i + 1}</td>
            <td className="px-5 py-3.5 font-mono text-xs text-gray-500 font-medium">{s.nis}</td>
            <td className="px-5 py-3.5 font-semibold text-primary-900">{s.user.name}</td>
            <td className="px-5 py-3.5 font-mono text-xs text-gray-400 hidden md:table-cell">{s.nisn ?? "—"}</td>
            <td className="px-5 py-3.5 text-xs hidden lg:table-cell">
              <span className="bg-primary-50 text-primary-600 border border-primary-100 font-semibold px-2 py-0.5 rounded-full">{s.major.code}</span>
            </td>
            <td className="px-5 py-3.5 text-right">
              <div className="flex items-center justify-end gap-1">
                <Link href={`/dashboard/admin/students/${s.id}`}
                  className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600 transition" title="Lihat detail">
                  <Eye size={14} />
                </Link>
                <button onClick={() => onEdit(s)}
                  className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 transition" title="Edit">
                  <Edit2 size={14} />
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
