"use client";
import { useEffect, useState, useTransition } from "react";
import { Plus, Edit2, Trash2, Save, Users, BookOpen, Loader2, School, Search } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import EmptyState from "@/components/admin/EmptyState";
import GroupedSection from "@/components/admin/GroupedSection";
import Modal from "@/components/admin/Modal";
import { withAlpha } from "@/lib/color";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import { useToast } from "@/components/shared/ToastProvider";

interface Major { id: string; name: string; code: string; themeColor: string | null }
interface Teacher { id: string; user: { name: string } }
interface StudentOption { id: string; nis: string; user: { name: string } }
interface ClassItem {
  id: string;
  name: string;
  grade: number;
  major: Major;
  homeroom: Teacher | null;
  students: StudentOption[];
  ketuaKelas: { id: string; user: { name: string } } | null;
  sekretaris: { id: string; user: { name: string } } | null;
}

interface FormState {
  id?: string;
  name: string;
  grade: string;
  majorId: string;
  homeroomId: string;
  ketuaKelasId: string;
  sekretarisId: string;
}

const emptyForm: FormState = { name: "", grade: "10", majorId: "", homeroomId: "", ketuaKelasId: "", sekretarisId: "" };

const GRADE_OPTIONS = ["10", "11", "12"];

export default function AdminClassesPage() {
  const confirmDialog = useConfirm();
  const toast = useToast();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [majors, setMajors] = useState<Major[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [majorFilter, setMajorFilter] = useState("");
  const [editingStudents, setEditingStudents] = useState<StudentOption[]>([]);

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
    setEditingStudents([]);
    setError("");
    setModal(true);
  }

  function openEdit(cls: ClassItem) {
    setForm({
      id: cls.id, name: cls.name, grade: String(cls.grade), majorId: cls.major.id, homeroomId: cls.homeroom?.id ?? "",
      ketuaKelasId: cls.ketuaKelas?.id ?? "", sekretarisId: cls.sekretaris?.id ?? "",
    });
    setEditingStudents(cls.students);
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
    if (!(await confirmDialog(`Hapus kelas "${name}"? Siswa di kelas ini tidak akan ikut terhapus.`))) return;
    const res = await fetch(`/api/admin/classes/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json();
      toast.error(d.error || "Gagal menghapus");
      return;
    }
    load();
  }

  const filtered = classes
    .filter(c =>
      (!search.trim() || c.name.toLowerCase().includes(search.trim().toLowerCase())) &&
      (!majorFilter || c.major.id === majorFilter)
    )
    .sort((a, b) => a.grade - b.grade || a.name.localeCompare(b.name));

  const grouped = [10, 11, 12]
    .map(grade => ({ grade, items: filtered.filter(c => c.grade === grade) }))
    .filter(g => g.items.length > 0);

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
        <>
          {/* Pencarian & Filter */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Cari nama kelas..."
                className="input-field pl-10"
              />
            </div>
            <div className="sm:w-56">
              <Select
                value={majorFilter}
                onChange={setMajorFilter}
                options={majors.map(m => ({ value: m.id, label: `${m.code} — ${m.name}` }))}
                placeholder="Semua Jurusan"
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState icon={Search} title="Tidak ada kelas ditemukan" />
          ) : (
            <div className="space-y-6">
              {grouped.map(({ grade, items }) => (
                <GroupedSection key={grade} title={`Kelas ${grade}`} count={items.length} icon={School}>
                  <ClassTable items={items} onEdit={openEdit} onDelete={handleDelete} />
                </GroupedSection>
              ))}
            </div>
          )}
        </>
      )}

      {/* Modal */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={form.id ? "Edit Kelas" : "Tambah Kelas"}
        footer={
          <>
            <button type="button" onClick={() => setModal(false)} className="btn-modal-cancel flex-1">Batal</button>
            <button type="submit" form="classForm" disabled={isPending} className="btn-modal-save flex-1">
              {isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {isPending ? "Menyimpan..." : "Simpan"}
            </button>
          </>
        }
      >
        <form id="classForm" onSubmit={handleSubmit} className="space-y-4">
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
              <Select
                value={form.grade}
                onChange={v => setForm(f => ({ ...f, grade: v }))}
                options={GRADE_OPTIONS.map(g => ({ value: g, label: `Kelas ${g}` }))}
              />
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
          </div>
          <div>
            <label className="label-field">Wali Kelas</label>
            <Select
              value={form.homeroomId}
              onChange={v => setForm(f => ({ ...f, homeroomId: v }))}
              options={teachers.map(t => ({ value: t.id, label: t.user.name }))}
              placeholder="— Belum ditentukan —"
            />
          </div>
          {form.id && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label-field">Ketua Kelas</label>
                <Select
                  value={form.ketuaKelasId}
                  onChange={v => setForm(f => ({ ...f, ketuaKelasId: v }))}
                  options={editingStudents.map(s => ({ value: s.id, label: `${s.user.name} (${s.nis})` }))}
                  placeholder="— Belum ditentukan —"
                />
                <p className="text-[11px] text-gray-400 mt-1">Bisa input absensi kelas ini.</p>
              </div>
              <div>
                <label className="label-field">Sekretaris</label>
                <Select
                  value={form.sekretarisId}
                  onChange={v => setForm(f => ({ ...f, sekretarisId: v }))}
                  options={editingStudents.map(s => ({ value: s.id, label: `${s.user.name} (${s.nis})` }))}
                  placeholder="— Belum ditentukan —"
                />
                <p className="text-[11px] text-gray-400 mt-1">Bisa input absensi kelas ini.</p>
              </div>
            </div>
          )}
          {error && <p className="error-msg">{error}</p>}
        </form>
      </Modal>
    </div>
  );
}

function ClassTable({ items, onEdit, onDelete }: {
  items: ClassItem[]; onEdit: (c: ClassItem) => void; onDelete: (id: string, name: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-primary-100"
            style={{ background: "linear-gradient(135deg, rgba(15,26,69,0.05) 0%, rgba(27,43,107,0.03) 100%)" }}>
            <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Kelas</th>
            <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Jurusan</th>
            <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Wali Kelas</th>
            <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Siswa</th>
            <th className="text-right px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {items.map(cls => (
            <tr key={cls.id} className="border-b border-gray-50 last:border-0 hover:bg-primary-50/30 transition-colors">
              <td className="px-5 py-3.5 font-semibold text-navy">{cls.name}</td>
              <td className="px-5 py-3.5">
                <span
                  className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${
                    cls.major.themeColor ? "" : "bg-primary-50 text-primary-700 border-primary-200"
                  }`}
                  style={cls.major.themeColor
                    ? { color: cls.major.themeColor, borderColor: withAlpha(cls.major.themeColor, 25), background: withAlpha(cls.major.themeColor, 6) }
                    : undefined}
                >
                  {cls.major.themeColor && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: cls.major.themeColor }} />}
                  {cls.major.code}
                </span>
              </td>
              <td className={`px-5 py-3.5 ${cls.homeroom ? "text-primary-700 font-medium" : "text-amber-500"}`}>
                {cls.homeroom?.user.name ?? "Belum ditentukan"}
              </td>
              <td className="px-5 py-3.5">
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700">
                  <Users size={12} /> {cls.students.length}
                </span>
              </td>
              <td className="px-5 py-3.5 text-right">
                <div className="flex items-center justify-end gap-1.5">
                  <button onClick={() => onEdit(cls)}
                    className="p-1.5 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors" title="Edit">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => onDelete(cls.id, cls.name)}
                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Hapus">
                    <Trash2 size={14} />
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
