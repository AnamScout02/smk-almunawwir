"use client";
import { useEffect, useState, useTransition } from "react";
import { Search, Edit2, X, Save, Users, Loader2, GraduationCap, Download, Eye } from "lucide-react";
import Link from "next/link";

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
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 max-w-5xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-primary-900">Kelola Siswa</h1>
          <p className="text-gray-400 text-sm mt-0.5">Atur NIS, jurusan, dan kelas setiap siswa</p>
        </div>
        <a href="/api/admin/export/students"
          className="shrink-0 inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
          <Download size={15} />
          Export CSV
        </a>
      </div>

      {/* Filter & Search */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Cari nama, NIS, atau NISN..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-primary-500 outline-none" />
        </div>
        <select value={filterClass} onChange={e => setFilterClass(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-primary-500 outline-none">
          <option value="ALL">Semua Kelas</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          <option value="NONE">Belum Ada Kelas</option>
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white rounded-xl border p-3 text-center">
          <p className="text-2xl font-heading font-bold text-primary-700">{students.length}</p>
          <p className="text-xs text-gray-400">Total Siswa</p>
        </div>
        <div className="bg-white rounded-xl border p-3 text-center">
          <p className="text-2xl font-heading font-bold text-emerald-600">{students.filter(s => s.class).length}</p>
          <p className="text-xs text-gray-400">Sudah Ada Kelas</p>
        </div>
        <div className="bg-white rounded-xl border p-3 text-center">
          <p className="text-2xl font-heading font-bold text-amber-500">{students.filter(s => !s.class).length}</p>
          <p className="text-xs text-gray-400">Belum Ada Kelas</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-primary-500" /></div>
      ) : (
        <div className="space-y-6">
          {/* Per kelas */}
          {grouped.map(({ cls, items }) => (
            <div key={cls.id} className="bg-white rounded-2xl border shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 bg-gray-50 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GraduationCap size={16} className="text-primary-700" />
                  <span className="font-heading font-bold text-primary-900">{cls.name}</span>
                  <span className="text-gray-400 text-xs">· {cls.major.code}</span>
                </div>
                <span className="text-xs font-semibold text-primary-600 bg-primary-50 px-2.5 py-1 rounded-full flex items-center gap-1">
                  <Users size={11} /> {items.length}
                </span>
              </div>
              <StudentTable items={items} onEdit={openEdit} />
            </div>
          ))}

          {/* Tanpa kelas */}
          {unclassed.length > 0 && (
            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 bg-amber-50 border-b flex items-center justify-between">
                <span className="font-heading font-bold text-amber-700 flex items-center gap-2">
                  <Users size={16} /> Belum Ada Kelas
                </span>
                <span className="text-xs font-semibold text-amber-600 bg-amber-100 px-2.5 py-1 rounded-full">{unclassed.length}</span>
              </div>
              <StudentTable items={unclassed} onEdit={openEdit} />
            </div>
          )}

          {filtered.length === 0 && (
            <div className="bg-white rounded-2xl border p-12 text-center text-gray-400">
              <Users size={36} className="mx-auto mb-3 opacity-30" />
              <p className="font-semibold text-navy">Tidak ada siswa ditemukan</p>
            </div>
          )}
        </div>
      )}

      {/* Modal edit profil siswa */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-heading font-semibold text-primary-900">Edit Profil Siswa</h2>
              <button onClick={() => setModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
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
                <select value={form.majorId} onChange={e => setForm(f => ({ ...f, majorId: e.target.value }))}
                  className="input-field" required>
                  <option value="">Pilih jurusan</option>
                  {majors.map(m => <option key={m.id} value={m.id}>{m.code} — {m.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label-field">Kelas</label>
                <select value={form.classId} onChange={e => setForm(f => ({ ...f, classId: e.target.value }))}
                  className="input-field">
                  <option value="">— Belum ditentukan —</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              {error && <p className="text-red-500 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModal(false)} className="flex-1 btn-outline text-sm">Batal</button>
                <button type="submit" disabled={isPending} className="flex-1 btn-gold text-sm flex items-center justify-center gap-2">
                  {isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  {isPending ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function StudentTable({ items, onEdit }: { items: Student[]; onEdit: (s: Student) => void }) {
  return (
    <table className="w-full text-sm">
      <thead className="border-b">
        <tr>
          <th className="text-left px-5 py-3 text-gray-400 font-medium w-8">#</th>
          <th className="text-left px-5 py-3 text-gray-400 font-medium">NIS</th>
          <th className="text-left px-5 py-3 text-gray-400 font-medium">Nama Siswa</th>
          <th className="text-left px-5 py-3 text-gray-400 font-medium hidden md:table-cell">NISN</th>
          <th className="text-left px-5 py-3 text-gray-400 font-medium hidden lg:table-cell">Jurusan</th>
          <th className="text-right px-5 py-3 text-gray-400 font-medium">Aksi</th>
        </tr>
      </thead>
      <tbody>
        {items.map((s, i) => (
          <tr key={s.id} className="border-b last:border-0 hover:bg-gray-50">
            <td className="px-5 py-3 text-gray-300 text-xs">{i + 1}</td>
            <td className="px-5 py-3 font-mono text-xs text-gray-600">{s.nis}</td>
            <td className="px-5 py-3 font-semibold text-primary-900">{s.user.name}</td>
            <td className="px-5 py-3 font-mono text-xs text-gray-400 hidden md:table-cell">{s.nisn ?? "—"}</td>
            <td className="px-5 py-3 text-xs text-gray-500 hidden lg:table-cell">{s.major.code}</td>
            <td className="px-5 py-3 text-right">
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
  );
}
