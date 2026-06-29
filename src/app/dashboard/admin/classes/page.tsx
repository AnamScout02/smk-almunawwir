"use client";
import { useEffect, useState, useTransition } from "react";
import { Plus, Edit2, Trash2, X, Save, Users, BookOpen, Loader2, ChevronDown, ChevronUp } from "lucide-react";

interface Major { id: string; name: string; code: string }
interface Teacher { id: string; user: { name: string } }
interface ClassItem {
  id: string;
  name: string;
  grade: number;
  major: Major;
  homeroom: Teacher | null;
  students: { id: string }[];
}

interface FormState {
  id?: string;
  name: string;
  grade: string;
  majorId: string;
  homeroomId: string;
}

const emptyForm: FormState = { name: "", grade: "10", majorId: "", homeroomId: "" };

const GRADE_OPTIONS = ["10", "11", "12"];

export default function AdminClassesPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [majors, setMajors] = useState<Major[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [clsRes, optRes] = await Promise.all([
      fetch("/api/admin/classes"),
      fetch("/api/admin/classes/options"),
    ]);
    if (clsRes.ok) setClasses(await clsRes.json());
    if (optRes.ok) {
      const { majors: m, teachers: t } = await optRes.json();
      setMajors(m);
      setTeachers(t);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setForm({ ...emptyForm, majorId: majors[0]?.id ?? "" });
    setError("");
    setModal(true);
  }

  function openEdit(cls: ClassItem) {
    setForm({ id: cls.id, name: cls.name, grade: String(cls.grade), majorId: cls.major.id, homeroomId: cls.homeroom?.id ?? "" });
    setError("");
    setModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.majorId) { setError("Nama kelas dan jurusan wajib diisi."); return; }
    setError("");
    startTransition(async () => {
      const url = form.id ? `/api/admin/classes/${form.id}` : "/api/admin/classes";
      const method = form.id ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || "Gagal menyimpan");
        return;
      }
      setModal(false);
      load();
    });
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Hapus kelas "${name}"? Siswa di kelas ini tidak akan ikut terhapus.`)) return;
    const res = await fetch(`/api/admin/classes/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json();
      alert(d.error || "Gagal menghapus");
      return;
    }
    load();
  }

  const byGrade = GRADE_OPTIONS.map(g => ({
    grade: g,
    items: classes.filter(c => String(c.grade) === g),
  })).filter(g => g.items.length > 0);

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl font-bold text-primary-900">Kelola Kelas</h1>
          <p className="text-gray-400 text-sm mt-0.5">Buat dan atur kelas, jurusan, dan wali kelas</p>
        </div>
        <button onClick={openCreate} className="btn-gold flex items-center gap-2 text-sm">
          <Plus size={16} /> Tambah Kelas
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-primary-500" /></div>
      ) : classes.length === 0 ? (
        <div className="bg-white rounded-2xl border p-16 text-center text-gray-400">
          <BookOpen size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-semibold text-navy mb-1">Belum Ada Kelas</p>
          <p className="text-sm mb-4">Tambahkan kelas untuk mulai mengelola siswa dan nilai.</p>
          <button onClick={openCreate} className="btn-gold text-sm">Tambah Kelas Pertama</button>
        </div>
      ) : (
        <div className="space-y-6">
          {byGrade.map(({ grade, items }) => (
            <div key={grade}>
              <h2 className="font-heading font-semibold text-primary-800 text-base mb-3">Kelas {grade}</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map(cls => (
                  <div key={cls.id} className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div>
                          <h3 className="font-heading font-bold text-primary-900">{cls.name}</h3>
                          <p className="text-xs text-gray-400 mt-0.5">{cls.major.name}</p>
                        </div>
                        <span className="text-xs bg-primary-50 text-primary-700 px-2.5 py-1 rounded-full font-semibold flex items-center gap-1 shrink-0">
                          <Users size={11} /> {cls.students.length}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mb-4">
                        Wali Kelas: <span className="font-semibold text-navy">{cls.homeroom?.user.name ?? "Belum ditentukan"}</span>
                      </p>
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(cls)}
                          className="flex-1 flex items-center justify-center gap-1.5 border border-gray-200 hover:border-primary-300 text-gray-600 hover:text-primary-700 text-xs font-semibold py-2 rounded-xl transition">
                          <Edit2 size={13} /> Edit
                        </button>
                        <button onClick={() => handleDelete(cls.id, cls.name)}
                          className="flex items-center justify-center gap-1.5 px-3 border border-gray-200 hover:border-red-200 text-gray-400 hover:text-red-500 text-xs font-semibold py-2 rounded-xl transition">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-heading font-semibold text-primary-900">
                {form.id ? "Edit Kelas" : "Tambah Kelas"}
              </h2>
              <button onClick={() => setModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="label-field">Nama Kelas</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Contoh: XII TKJ 1"
                  className="input-field"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-field">Tingkat</label>
                  <select value={form.grade} onChange={e => setForm(f => ({ ...f, grade: e.target.value }))} className="input-field">
                    {GRADE_OPTIONS.map(g => <option key={g} value={g}>Kelas {g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label-field">Konsentrasi / Jurusan</label>
                  <select value={form.majorId} onChange={e => setForm(f => ({ ...f, majorId: e.target.value }))} className="input-field" required>
                    <option value="">Pilih jurusan</option>
                    {majors.map(m => <option key={m.id} value={m.id}>{m.code} — {m.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label-field">Wali Kelas</label>
                <select value={form.homeroomId} onChange={e => setForm(f => ({ ...f, homeroomId: e.target.value }))} className="input-field">
                  <option value="">— Belum ditentukan —</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.user.name}</option>)}
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
