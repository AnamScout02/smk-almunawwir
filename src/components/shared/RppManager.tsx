"use client";
import { useEffect, useState } from "react";
import { NotebookPen, Loader2, Plus, Edit2, Trash2, Save, BookOpen, Download, Search } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import Modal from "@/components/admin/Modal";
import Select from "@/components/admin/Select";
import StatTile from "@/components/admin/StatTile";
import FileUpload from "@/components/shared/FileUpload";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import { PageSkeleton } from "@/components/shared/Skeleton";

interface SubjectOption { id: string; name: string; grade: number }
interface Plan {
  id: string; title: string; grade: number | null; semester: string | null;
  objectives: string | null; material: string | null; activities: string | null; assessment: string | null;
  fileUrl: string | null; updatedAt: string;
  teacher: { id: string; user: { name: string } };
  subject: { name: string } | null;
}

const EMPTY_FORM = { title: "", subjectId: "", grade: "", semester: "", objectives: "", material: "", activities: "", assessment: "", fileUrl: "" };
const GRADE_OPTIONS = [{ value: "10", label: "Kelas X" }, { value: "11", label: "Kelas XI" }, { value: "12", label: "Kelas XII" }];

function fmt(d: string) {
  return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export default function RppManager() {
  const confirmDialog = useConfirm();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [myTeacherId, setMyTeacherId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  function load() {
    setLoading(true);
    setError("");
    fetch("/api/teacher/rpp").then(async r => {
      if (!r.ok) { const d = await r.json(); setError(d.error || "Gagal memuat data"); setLoading(false); return; }
      const d = await r.json();
      setPlans(d.plans ?? []);
      setSubjects(d.subjects ?? []);
      setMyTeacherId(d.myTeacherId ?? null);
      setLoading(false);
    }).catch(() => { setError("Gagal memuat data"); setLoading(false); });
  }
  useEffect(() => { load(); }, []);

  function openAdd() { setEditing(null); setForm(EMPTY_FORM); setFormError(""); setModal(true); }
  function openEdit(p: Plan) {
    setEditing(p);
    setForm({
      title: p.title, subjectId: subjects.find(s => s.name === p.subject?.name)?.id ?? "",
      grade: p.grade ? String(p.grade) : "", semester: p.semester ?? "",
      objectives: p.objectives ?? "", material: p.material ?? "", activities: p.activities ?? "", assessment: p.assessment ?? "",
      fileUrl: p.fileUrl ?? "",
    });
    setFormError(""); setModal(true);
  }

  async function handleSave() {
    if (!form.title.trim()) { setFormError("Judul RPP wajib diisi."); return; }
    setSaving(true);
    const res = editing
      ? await fetch(`/api/teacher/rpp/${editing.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) })
      : await fetch("/api/teacher/rpp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setSaving(false);
    if (!res.ok) { const d = await res.json(); setFormError(d.error || "Gagal menyimpan"); return; }
    setModal(false);
    load();
  }

  async function handleDelete(p: Plan) {
    if (!(await confirmDialog(`Hapus RPP "${p.title}"?`))) return;
    await fetch(`/api/teacher/rpp/${p.id}`, { method: "DELETE" });
    load();
  }

  if (error) {
    return (
      <div className="p-6 lg:p-8 pt-16 lg:pt-8">
        <div className="bg-red-50 border border-red-100 text-red-600 rounded-xl p-4 text-sm">{error}</div>
      </div>
    );
  }

  const myPlans = plans.filter(p => p.teacher.id === myTeacherId).length;
  const q = search.toLowerCase();
  const filteredPlans = plans.filter(p =>
    !q || p.title.toLowerCase().includes(q) || p.teacher.user.name.toLowerCase().includes(q) || (p.subject?.name ?? "").toLowerCase().includes(q)
  );

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader
        icon={<NotebookPen size={22} />}
        title="Bank RPP"
        description="Rencana Pelaksanaan Pembelajaran — kelola RPP Anda, lihat referensi RPP guru lain"
      />

      {loading ? (
        <PageSkeleton />
      ) : (
        <>
          <div className="kisi-kartu mb-6">
            <StatTile color="primary" value={myPlans} label="RPP Saya" icon={NotebookPen} />
            <StatTile color="blue" value={plans.length} label="Total di Bank RPP" icon={BookOpen} />
          </div>
          {/* Baris alat: kotak cari & tombol aksi bersanding (permintaan user 15 Sep 2026). */}
          <div className="baris-alat mb-5">
            {plans.length > 0 && (
              <div className="alat-cari">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Cari judul, guru, atau mapel..." className="input-field pl-10" />
              </div>
            )}
            <div className="alat-aksi">
              <button onClick={openAdd} className="btn-modal-save">
                <Plus size={15} /> Tambah RPP
              </button>
            </div>
          </div>
          {plans.length === 0 ? (
            <EmptyState icon={NotebookPen} title="Belum Ada RPP" description="Tambahkan RPP Anda ke bank bersama." />
          ) : filteredPlans.length === 0 ? (
            <EmptyState icon={Search} title="Tidak Ditemukan" description="Tidak ada RPP yang cocok dengan pencarian." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredPlans.map(p => {
                const isMine = p.teacher.id === myTeacherId;
                return (
                  <div key={p.id} className="panel p-5">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <p className="font-heading font-bold text-primary-900 truncate">{p.title}</p>
                        <p className="text-gray-400 text-xs">{p.teacher.user.name}{p.subject && ` · ${p.subject.name}`}</p>
                      </div>
                      {isMine && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg hover:bg-primary-50 text-primary-700 transition"><Edit2 size={14} /></button>
                          <button onClick={() => handleDelete(p)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition"><Trash2 size={14} /></button>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      {p.grade && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 border border-primary-100">Kelas {p.grade}</span>}
                      {p.semester && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200">Semester {p.semester}</span>}
                    </div>
                    {p.objectives && <p className="text-xs text-gray-500 line-clamp-2 mb-2">{p.objectives}</p>}
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span>Diperbarui {fmt(p.updatedAt)}</span>
                      {p.fileUrl && (
                        <a href={p.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary-700 hover:text-primary-900 font-semibold">
                          <Download size={12} /> Dokumen
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editing ? "Ubah RPP" : "Tambah RPP"}
        size="lg"
        scrollBody
        footer={
          <>
            <button type="button" onClick={() => setModal(false)} className="btn-modal-cancel flex-1">Batal</button>
            <button type="button" onClick={handleSave} disabled={saving} className="btn-modal-save flex-1">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Simpan
            </button>
          </>
        }
      >
        {formError && <p className="error-msg mb-3">{formError}</p>}
        <div className="space-y-3">
          <div>
            <label className="label-field">Judul RPP</label>
            <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className="input-field" placeholder="cth: RPP Jaringan Komputer Dasar - Bab 1" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label-field">Mata Pelajaran</label>
              <Select value={form.subjectId} onChange={v => setForm(p => ({ ...p, subjectId: v }))}
                options={subjects.map(s => ({ value: s.id, label: s.name }))} placeholder="— Pilih —" />
            </div>
            <div>
              <label className="label-field">Kelas</label>
              <Select value={form.grade} onChange={v => setForm(p => ({ ...p, grade: v }))} options={GRADE_OPTIONS} placeholder="— Pilih —" />
            </div>
            <div>
              <label className="label-field">Semester</label>
              <input value={form.semester} onChange={e => setForm(p => ({ ...p, semester: e.target.value }))} className="input-field" placeholder="cth: Ganjil 2026/2027" />
            </div>
          </div>
          <div>
            <label className="label-field">Tujuan Pembelajaran (opsional)</label>
            <textarea value={form.objectives} onChange={e => setForm(p => ({ ...p, objectives: e.target.value }))} rows={2} className="input-field resize-none" />
          </div>
          <div>
            <label className="label-field">Materi Pokok (opsional)</label>
            <textarea value={form.material} onChange={e => setForm(p => ({ ...p, material: e.target.value }))} rows={2} className="input-field resize-none" />
          </div>
          <div>
            <label className="label-field">Kegiatan Pembelajaran (opsional)</label>
            <textarea value={form.activities} onChange={e => setForm(p => ({ ...p, activities: e.target.value }))} rows={3} className="input-field resize-none" />
          </div>
          <div>
            <label className="label-field">Penilaian (opsional)</label>
            <textarea value={form.assessment} onChange={e => setForm(p => ({ ...p, assessment: e.target.value }))} rows={2} className="input-field resize-none" />
          </div>
          <FileUpload value={form.fileUrl} onChange={v => setForm(p => ({ ...p, fileUrl: v }))}
            folder="rpp" label="Dokumen RPP (opsional)" accept="application/pdf,.doc,.docx" hint="PDF/Word — maks. 5MB, kalau sudah punya file RPP lengkap" />
        </div>
      </Modal>
    </div>
  );
}
