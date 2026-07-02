"use client";
import { useEffect, useState, useTransition } from "react";
import { Plus, Edit2, Trash2, X, Save, Users, BookOpen, Loader2, ChevronDown, ChevronUp, School } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";

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
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader
        icon={<School size={22} />}
        title="Kelola Kelas"
        description="Buat dan atur kelas, jurusan, dan wali kelas"
        actions={
          <button onClick={openCreate} className="btn-gold flex items-center gap-2 text-sm">
            <Plus size={16} /> Tambah Kelas
          </button>
        }
      />

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
        <div className="space-y-8">
          {byGrade.map(({ grade, items }) => (
            <div key={grade}>
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px flex-1" style={{ background: "linear-gradient(to right, rgba(15,26,69,0.15), transparent)" }} />
                <span className="text-xs font-bold uppercase tracking-widest text-primary-500 px-3 py-1.5 bg-primary-50 border border-primary-100 rounded-full">
                  Tingkat {grade}
                </span>
                <div className="h-px flex-1" style={{ background: "linear-gradient(to left, rgba(15,26,69,0.15), transparent)" }} />
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map(cls => (
                  <div key={cls.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all">
                    <div className="px-5 py-3 flex items-center justify-between"
                      style={{ background: "linear-gradient(135deg, #0F1A45 0%, #1B2B6B 100%)" }}>
                      <h3 className="font-heading font-bold text-white text-sm">{cls.name}</h3>
                      <span className="text-xs font-bold text-gold bg-white/10 border border-white/20 px-2.5 py-1 rounded-full flex items-center gap-1">
                        <Users size={10} /> {cls.students.length}
                      </span>
                    </div>
                    <div className="p-5">
                      <p className="text-xs text-gray-400 mb-1">{cls.major.name}</p>
                      <p className="text-xs text-gray-500 mb-4">
                        Wali: <span className={`font-semibold ${cls.homeroom ? "text-primary-700" : "text-amber-500"}`}>
                          {cls.homeroom?.user.name ?? "Belum ditentukan"}
                        </span>
                      </p>
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(cls)}
                          className="flex-1 flex items-center justify-center gap-1.5 bg-primary-50 hover:bg-primary-100 text-primary-700 border border-primary-100 hover:border-primary-200 text-xs font-semibold py-2 rounded-xl transition-colors">
                          <Edit2 size={13} /> Edit
                        </button>
                        <button onClick={() => handleDelete(cls.id, cls.name)}
                          className="flex items-center justify-center gap-1.5 px-3 bg-red-50 hover:bg-red-100 text-red-500 border border-red-100 text-xs font-semibold py-2 rounded-xl transition-colors">
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4"
              style={{ background: "linear-gradient(135deg, #0A1030 0%, #0F1A45 40%, #1B2B6B 100%)" }}>
              <h2 className="font-heading font-semibold text-white">
                {form.id ? "Edit Kelas" : "Tambah Kelas"}
              </h2>
              <button onClick={() => setModal(false)} className="text-white/60 hover:text-white transition-colors"><X size={20} /></button>
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
              {error && <p className="error-msg">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModal(false)} className="btn-modal-cancel flex-1">Batal</button>
                <button type="submit" disabled={isPending} className="btn-modal-save flex-1">
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
