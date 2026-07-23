"use client";
import { useState, useEffect, useCallback } from "react";
import { BookMarked, Plus, Pencil, Trash2, Loader2, Save, CheckCircle2, AlertTriangle } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import Modal from "@/components/admin/Modal";
import Alert from "@/components/admin/Alert";
import GroupedSection from "@/components/admin/GroupedSection";
import EmptyState from "@/components/admin/EmptyState";

interface MajorOption { id: string; name: string; code: string }
interface Subject {
  id: string; code: number; name: string; category: string; grade: number;
  majorId: string | null; major: MajorOption | null; order: number; hoursPerWeek: number; weekGroup: string; maxSharedTeacher: number;
}

const GRADE_LABEL: Record<number, string> = { 10: "Kelas X", 11: "Kelas XI", 12: "Kelas XII" };
const TARGET_JP: Record<number, number> = { 10: 56, 11: 56, 12: 48 };
const EMPTY_FORM = { code: "", name: "", category: "", grade: "10", majorId: "", order: "", hoursPerWeek: "2", weekGroup: "UMUM", maxSharedTeacher: "1" };

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [majors, setMajors] = useState<MajorOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<10 | 11 | 12>(10);
  const [selected, setSelected] = useState<Subject | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const fetchSubjects = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/subjects");
      const data = await res.json();
      setSubjects(Array.isArray(data) ? data : []);
    } catch {
      setSubjects([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubjects();
    fetch("/api/admin/majors").then(r => r.json()).then(setMajors).catch(() => {});
  }, [fetchSubjects]);

  function openCreate() {
    setIsNew(true);
    setSelected({ id: "", code: 0, name: "", category: "", grade: scope, majorId: null, major: null, order: 0, hoursPerWeek: 2, weekGroup: "UMUM", maxSharedTeacher: 1 });
    setForm({ ...EMPTY_FORM, grade: String(scope) });
    setSaveError("");
  }

  function openEdit(s: Subject) {
    setIsNew(false);
    setSelected(s);
    setForm({
      code: String(s.code), name: s.name, category: s.category,
      grade: String(s.grade), majorId: s.majorId ?? "", order: String(s.order),
      hoursPerWeek: String(s.hoursPerWeek), weekGroup: s.weekGroup, maxSharedTeacher: String(s.maxSharedTeacher),
    });
    setSaveError("");
  }

  async function handleSave() {
    setSaveError("");
    if (!form.name || !form.category) { setSaveError("Nama dan kategori wajib diisi"); return; }
    setSaving(true);
    try {
      const url = isNew ? "/api/admin/subjects" : `/api/admin/subjects/${selected!.id}`;
      const method = isNew ? "POST" : "PUT";
      const res = await fetch(url, {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setSaveError(d.error ?? "Gagal menyimpan"); return; }
      setSelected(null);
      await fetchSubjects();
    } catch {
      setSaveError("Gagal menyimpan — periksa koneksi internet Anda dan coba lagi.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Hapus mata pelajaran "${name}"?`)) return;
    await fetch(`/api/admin/subjects/${id}`, { method: "DELETE" });
    fetchSubjects();
  }

  const filtered = subjects.filter(s => s.grade === scope);
  const categories = Array.from(new Set(filtered.map(s => s.category)));
  const grouped = categories.map(cat => {
    const items = filtered.filter(s => s.category === cat);
    return { category: cat, items, variesByMajor: items.some(s => s.majorId !== null) };
  });

  const target = TARGET_JP[scope];
  const majorTotals = majors.map(m => ({
    major: m,
    total: filtered.filter(s => !s.majorId || s.majorId === m.id).reduce((sum, s) => sum + s.hoursPerWeek, 0),
  }));

  // Mapel Umum/Diniyah/dll tidak beda per jurusan (majorId selalu null) — jumlahnya tetap
  // berapa pun jurusannya. Cuma kategori yang punya mapel spesifik jurusan (mis. Kejuruan,
  // isinya Dasar Program Keahlian/Konsentrasi Keahlian) yang beda-beda tiap jurusan, jadi
  // targetnya dihitung otomatis: total target dikurangi jumlah kategori yang sudah tetap.
  const fixedCategoriesTotal = grouped
    .filter(g => !g.variesByMajor)
    .reduce((sum, g) => sum + g.items.reduce((s2, s) => s2 + s.hoursPerWeek, 0), 0);
  const variesTarget = target - fixedCategoriesTotal;

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader
        icon={<BookMarked size={22} />}
        title="Kode Mata Pelajaran"
        description="Daftar kode mapel Kurikulum Merdeka — tiap tingkat (X/XI/XII) bisa punya mapel & jam berbeda"
        actions={
          <button onClick={openCreate} className="btn-gold flex items-center gap-2 text-sm">
            <Plus size={15} /> Tambah Mapel
          </button>
        }
      />

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-5">
        {([10, 11, 12] as const).map(g => (
          <button key={g} onClick={() => setScope(g)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${scope === g ? "bg-white shadow text-primary-700" : "text-gray-500 hover:text-gray-700"}`}>
            {GRADE_LABEL[g]}
          </button>
        ))}
      </div>

      {majorTotals.length > 0 && (
        <>
          {majorTotals.some(({ total }) => total !== target) && (
            <Alert variant="warning" className="mb-3">
              Total jam {GRADE_LABEL[scope]} belum pas {target} JP untuk:{" "}
              {majorTotals.filter(({ total }) => total !== target).map(({ major, total }) =>
                `${major.code} (${total < target ? `kurang ${target - total}` : `lebih ${total - target}`})`
              ).join(", ")}. Cek kembali jam per mapel di bawah.
            </Alert>
          )}
          <div className="flex flex-wrap gap-2 mb-5">
            {majorTotals.map(({ major, total }) => (
              <span key={major.id}
                className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full ${
                  total === target ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                }`}>
                {total === target ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                {major.code}: {total}/{target} JP
                {total !== target && ` (${total < target ? `kurang ${target - total}` : `lebih ${total - target}`})`}
              </span>
            ))}
          </div>
        </>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-primary-500" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={BookMarked} title="Belum ada kode mapel untuk tingkat ini" />
      ) : (
        <div className="space-y-6">
          {grouped.map(({ category, items, variesByMajor }) => {
            const categoryTotal = items.reduce((sum, s) => sum + s.hoursPerWeek, 0);
            const headerActions = variesByMajor ? (
              <div className="flex flex-wrap gap-1.5 justify-end">
                {majors.map(m => {
                  const majorTotal = items.filter(s => !s.majorId || s.majorId === m.id).reduce((sum, s) => sum + s.hoursPerWeek, 0);
                  const ok = majorTotal === variesTarget;
                  return (
                    <span key={m.id}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ok ? "text-emerald-300 bg-emerald-900/40" : "text-amber-300 bg-amber-900/40"}`}>
                      {m.code}: {majorTotal}/{variesTarget}
                      {!ok && ` (${majorTotal < variesTarget ? `-${variesTarget - majorTotal}` : `+${majorTotal - variesTarget}`})`}
                    </span>
                  );
                })}
              </div>
            ) : (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white/70 bg-white/10">
                Total {categoryTotal} jam (sama semua jurusan)
              </span>
            );
            return (
              <GroupedSection key={category} title={category} count={items.length} icon={BookMarked} headerActions={headerActions}>
                <SubjectTable items={items} onEdit={openEdit} onDelete={handleDelete} />
              </GroupedSection>
            );
          })}
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
              <label className="label-field">Tingkat</label>
              <Select
                value={form.grade}
                onChange={v => setForm(f => ({ ...f, grade: v }))}
                options={[
                  { value: "10", label: "Kelas X" },
                  { value: "11", label: "Kelas XI" },
                  { value: "12", label: "Kelas XII" },
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
          <div>
            <label className="label-field">Jam per Minggu</label>
            <input className="input-field" type="number" min={1} value={form.hoursPerWeek}
              onChange={e => setForm(f => ({ ...f, hoursPerWeek: e.target.value }))} />
            <p className="text-xs text-gray-400 mt-1">Dipakai oleh Generate Jadwal Otomatis untuk menghitung jumlah jam yang perlu dijadwalkan.</p>
          </div>
          {(form.grade === "10" || form.grade === "11") && (
            <div>
              <label className="label-field">Kelompok Minggu (rotasi jadwal 2 minggu)</label>
              <Select
                value={form.weekGroup}
                onChange={v => setForm(f => ({ ...f, weekGroup: v }))}
                options={[
                  { value: "UMUM", label: "Umum / Diniyah" },
                  { value: "PRODUKTIF", label: "Produktif" },
                ]}
              />
              <p className="text-xs text-gray-400 mt-1">Mapel Produktif dijadwalkan padat (jam ganda) di minggu produktif kelas ini; mapel Umum di minggu satunya.</p>
            </div>
          )}
          <div>
            <label className="label-field">Maksimal Kelas Bareng 1 Guru di Jam Sama</label>
            <input className="input-field" type="number" min={1} max={9} value={form.maxSharedTeacher}
              onChange={e => setForm(f => ({ ...f, maxSharedTeacher: e.target.value }))} />
            <p className="text-xs text-gray-400 mt-1">Normalnya 1 (tidak boleh bentrok). Isi 2 kalau mapel ini memang boleh 1 guru pegang 2 kelas sekaligus di jam sama (mis. Penjasorkes).</p>
          </div>
          <div>
            <label className="label-field">Jurusan (khusus mapel konsentrasi keahlian)</label>
            <Select
              value={form.majorId}
              onChange={v => setForm(f => ({ ...f, majorId: v }))}
              options={majors.map(m => ({ value: m.id, label: `${m.name} (${m.code})` }))}
              placeholder="— Berlaku untuk semua jurusan —"
            />
          </div>
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
            <th className="text-center px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Jam/Minggu</th>
            <th className="text-center px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Minggu</th>
            <th className="text-right px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {items.map(s => (
            <tr key={s.id} className="border-b border-gray-50 last:border-0 hover:bg-primary-50/30 transition-colors">
              <td className="px-5 py-3.5 font-mono text-xs text-gray-500">{s.code}</td>
              <td className="px-5 py-3.5 font-semibold text-primary-900">
                {s.name}
                {s.maxSharedTeacher > 1 && (
                  <span className="ml-2 text-[10px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded-full align-middle">
                    max {s.maxSharedTeacher} kelas/guru
                  </span>
                )}
              </td>
              <td className="px-5 py-3.5 text-xs">
                {s.major
                  ? <span className="bg-gray-50 text-gray-600 font-semibold px-2 py-0.5 rounded-full border border-gray-200">{s.major.code}</span>
                  : <span className="text-gray-300">Semua jurusan</span>}
              </td>
              <td className="px-5 py-3.5 text-center">
                <span className="text-xs font-semibold text-primary-700 bg-primary-50 px-2 py-0.5 rounded-full">{s.hoursPerWeek} jam</span>
              </td>
              <td className="px-5 py-3.5 text-center">
                {(s.grade === 10 || s.grade === 11) && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    s.weekGroup === "PRODUKTIF" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"
                  }`}>
                    {s.weekGroup === "PRODUKTIF" ? "Produktif" : "Umum"}
                  </span>
                )}
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
