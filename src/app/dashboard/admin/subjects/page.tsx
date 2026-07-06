"use client";
import { useState, useEffect, useCallback } from "react";
import { BookMarked, Plus, Pencil, Trash2, Loader2, Save } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import Modal from "@/components/admin/Modal";
import Alert from "@/components/admin/Alert";
import GroupedSection from "@/components/admin/GroupedSection";
import EmptyState from "@/components/admin/EmptyState";

interface MajorOption { id: string; name: string; code: string }
interface Subject {
  id: string; code: number; name: string; category: string; gradeScope: string;
  majorId: string | null; major: MajorOption | null; order: number;
}

const EMPTY_FORM = { code: "", name: "", category: "", gradeScope: "X_XI", majorId: "", order: "" };

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [majors, setMajors] = useState<MajorOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<"X_XI" | "XII">("X_XI");
  const [selected, setSelected] = useState<Subject | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const fetchSubjects = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/subjects");
    const data = await res.json();
    setSubjects(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSubjects();
    fetch("/api/admin/majors").then(r => r.json()).then(setMajors).catch(() => {});
  }, [fetchSubjects]);

  function openCreate() {
    setIsNew(true);
    setSelected({ id: "", code: 0, name: "", category: "", gradeScope: scope, majorId: null, major: null, order: 0 });
    setForm({ ...EMPTY_FORM, gradeScope: scope });
    setSaveError("");
  }

  function openEdit(s: Subject) {
    setIsNew(false);
    setSelected(s);
    setForm({
      code: String(s.code), name: s.name, category: s.category,
      gradeScope: s.gradeScope, majorId: s.majorId ?? "", order: String(s.order),
    });
    setSaveError("");
  }

  async function handleSave() {
    setSaveError("");
    if (!form.name || !form.category) { setSaveError("Nama dan kategori wajib diisi"); return; }
    setSaving(true);
    const url = isNew ? "/api/admin/subjects" : `/api/admin/subjects/${selected!.id}`;
    const method = isNew ? "POST" : "PUT";
    const res = await fetch(url, {
      method, headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (!res.ok) { const d = await res.json().catch(() => ({})); setSaveError(d.error ?? "Gagal menyimpan"); return; }
    setSelected(null); fetchSubjects();
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Hapus mata pelajaran "${name}"?`)) return;
    await fetch(`/api/admin/subjects/${id}`, { method: "DELETE" });
    fetchSubjects();
  }

  const filtered = subjects.filter(s => s.gradeScope === scope);
  const categories = Array.from(new Set(filtered.map(s => s.category)));
  const grouped = categories.map(cat => ({ category: cat, items: filtered.filter(s => s.category === cat) }));

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader
        icon={<BookMarked size={22} />}
        title="Kode Mata Pelajaran"
        description="Daftar kode mapel Kurikulum Merdeka — dipakai sebagai referensi di Jadwal Pelajaran"
        actions={
          <button onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary-700 text-white rounded-xl text-sm font-semibold hover:bg-primary-900 transition-colors">
            <Plus size={15} /> Tambah Mapel
          </button>
        }
      />

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-5">
        {(["X_XI", "XII"] as const).map(g => (
          <button key={g} onClick={() => setScope(g)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${scope === g ? "bg-white shadow text-primary-700" : "text-gray-500 hover:text-gray-700"}`}>
            {g === "X_XI" ? "Kelas X & XI" : "Kelas XII"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-primary-500" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={BookMarked} title="Belum ada kode mapel untuk jenjang ini" />
      ) : (
        <div className="space-y-6">
          {grouped.map(({ category, items }) => (
            <GroupedSection key={category} title={category} count={items.length} icon={BookMarked}>
              <SubjectTable items={items} onEdit={openEdit} onDelete={handleDelete} />
            </GroupedSection>
          ))}
        </div>
      )}

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={isNew ? "Tambah Kode Mapel" : "Edit Kode Mapel"}
        footer={
          <>
            <button onClick={() => setSelected(null)} className="btn-modal-cancel flex-1">Batal</button>
            <button onClick={handleSave} disabled={saving} className="btn-modal-save flex-1 flex items-center justify-center gap-2">
              <Save size={14} />
              {saving ? "Menyimpan..." : "Simpan"}
            </button>
          </>
        }
      >
        {saveError && <Alert variant="error">{saveError}</Alert>}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-field">Kode</label>
              <input className="input-field" type="number" value={form.code}
                onChange={e => setForm(f => ({ ...f, code: e.target.value }))} />
            </div>
            <div>
              <label className="label-field">Jenjang</label>
              <Select
                value={form.gradeScope}
                onChange={v => setForm(f => ({ ...f, gradeScope: v, majorId: v === "X_XI" ? "" : f.majorId }))}
                options={[
                  { value: "X_XI", label: "Kelas X & XI" },
                  { value: "XII", label: "Kelas XII" },
                ]}
              />
            </div>
          </div>
          <div>
            <label className="label-field">Nama Mata Pelajaran</label>
            <input className="input-field" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="label-field">Kategori</label>
            <input className="input-field" value={form.category} list="subject-categories"
              placeholder="Contoh: Kelompok Mata Pelajaran Umum"
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
            <datalist id="subject-categories">
              {Array.from(new Set(subjects.map(s => s.category))).map(c => <option key={c} value={c} />)}
            </datalist>
          </div>
          {form.gradeScope === "XII" && (
            <div>
              <label className="label-field">Jurusan (khusus mapel konsentrasi keahlian)</label>
              <Select
                value={form.majorId}
                onChange={v => setForm(f => ({ ...f, majorId: v }))}
                options={majors.map(m => ({ value: m.id, label: `${m.name} (${m.code})` }))}
                placeholder="— Berlaku untuk semua jurusan —"
              />
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

function SubjectTable({ items, onEdit, onDelete }: { items: Subject[]; onEdit: (s: Subject) => void; onDelete: (id: string, name: string) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-primary-100"
            style={{ background: "linear-gradient(135deg, rgba(15,26,69,0.05) 0%, rgba(27,43,107,0.03) 100%)" }}>
            <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70 w-16">Kode</th>
            <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Mata Pelajaran</th>
            <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Jurusan</th>
            <th className="text-right px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {items.map(s => (
            <tr key={s.id} className="border-b border-gray-50 last:border-0 hover:bg-primary-50/30 transition-colors">
              <td className="px-5 py-3.5 font-mono text-xs text-gray-500">{s.code}</td>
              <td className="px-5 py-3.5 font-semibold text-primary-900">{s.name}</td>
              <td className="px-5 py-3.5 text-xs">
                {s.major
                  ? <span className="bg-gray-50 text-gray-600 font-semibold px-2 py-0.5 rounded-full border border-gray-200">{s.major.code}</span>
                  : <span className="text-gray-300">Semua jurusan</span>}
              </td>
              <td className="px-5 py-3.5 text-right">
                <div className="flex items-center justify-end gap-1">
                  <button onClick={() => onEdit(s)} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 transition"><Pencil size={14} /></button>
                  <button onClick={() => onDelete(s.id, s.name)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition"><Trash2 size={14} /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
