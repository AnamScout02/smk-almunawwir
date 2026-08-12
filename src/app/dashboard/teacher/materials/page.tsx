"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, Loader2, Plus, Trash2, FileText, Link2, Calendar, Users, ChevronRight, ClipboardList, HelpCircle, Trophy, Eye, EyeOff } from "lucide-react";
import Select from "@/components/admin/Select";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import FileUpload from "@/components/shared/FileUpload";
import DatePicker from "@/components/shared/DatePicker";
import { useConfirm } from "@/components/shared/ConfirmProvider";

interface TeachClass { classId: string; className: string; grade: number; subjectId: string; subjectName: string }
interface MaterialItem {
  id: string; title: string; description: string | null; fileUrl: string | null; linkUrl: string | null; createdAt: string;
  class: { name: string };
}
interface AssignmentItem {
  id: string; title: string; description: string | null; fileUrl: string | null; dueDate: string | null; createdAt: string;
  class: { name: string }; _count: { submissions: number };
}
interface QuizItem {
  id: string; title: string; description: string | null; isPublished: boolean; createdAt: string;
  class: { name: string }; _count: { questions: number; attempts: number };
}

export default function TeacherMaterialsPage() {
  const confirmDialog = useConfirm();
  const [classes, setClasses] = useState<TeachClass[]>([]);
  const [classKey, setClassKey] = useState("");
  const [tab, setTab] = useState<"materi" | "tugas" | "kuis">("materi");
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [quizzes, setQuizzes] = useState<QuizItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [dueDate, setDueDate] = useState("");

  useEffect(() => {
    fetch("/api/teacher/journal-classes").then(r => r.json()).then((d: TeachClass[]) => {
      setClasses(d);
      if (d.length > 0) setClassKey(`${d[0].classId}::${d[0].subjectName}`);
    }).catch(() => {});
  }, []);

  const selected = useMemo(() => {
    const [classId, subjectName] = classKey.split("::");
    return classes.find(c => c.classId === classId && c.subjectName === subjectName) ?? null;
  }, [classKey, classes]);

  function resetForm() {
    setTitle(""); setDescription(""); setFileUrl(""); setLinkUrl(""); setDueDate(""); setError(""); setShowForm(false);
  }

  function loadList() {
    if (!selected) return;
    setLoadingList(true);
    const qs = `classId=${selected.classId}&subject=${encodeURIComponent(selected.subjectName)}`;
    if (tab === "materi") {
      fetch(`/api/teacher/materials?${qs}`).then(r => r.json()).then(d => setMaterials(Array.isArray(d) ? d : [])).catch(() => {}).finally(() => setLoadingList(false));
    } else if (tab === "tugas") {
      fetch(`/api/teacher/assignments?${qs}`).then(r => r.json()).then(d => setAssignments(Array.isArray(d) ? d : [])).catch(() => {}).finally(() => setLoadingList(false));
    } else {
      fetch(`/api/teacher/quizzes?${qs}`).then(r => r.json()).then(d => setQuizzes(Array.isArray(d) ? d : [])).catch(() => {}).finally(() => setLoadingList(false));
    }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { resetForm(); loadList(); }, [selected, tab]);

  async function handleCreate() {
    if (!selected) return;
    if (!title.trim()) { setError("Judul wajib diisi."); return; }
    setError("");
    setSaving(true);
    const endpoint = tab === "materi" ? "/api/teacher/materials" : "/api/teacher/assignments";
    const body = tab === "materi"
      ? { classId: selected.classId, subject: selected.subjectName, title, description, fileUrl, linkUrl }
      : { classId: selected.classId, subject: selected.subjectName, title, description, fileUrl, dueDate: dueDate || null };
    const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setSaving(false);
    if (!res.ok) { const d = await res.json(); setError(d.error || "Gagal menyimpan"); return; }
    resetForm();
    loadList();
  }

  async function handleDelete(id: string) {
    if (!(await confirmDialog(`Hapus ${tab === "materi" ? "materi" : "tugas"} ini?`))) return;
    const endpoint = tab === "materi" ? `/api/teacher/materials/${id}` : `/api/teacher/assignments/${id}`;
    await fetch(endpoint, { method: "DELETE" });
    loadList();
  }

  const fmt = (d: string) => new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        icon={<BookOpen size={22} />}
        title="Materi & Tugas"
        description="Unggah materi pembelajaran dan buat tugas untuk kelas yang Anda ajar"
      />

      {classes.length === 0 ? (
        <EmptyState icon={Users} title="Belum Ada Penugasan Mengajar" description="Hubungi admin untuk ditugaskan mengajar kelas/mapel terlebih dahulu." />
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
            <label className="label-field">Kelas & Mapel</label>
            <Select value={classKey} onChange={setClassKey}
              options={classes.map(c => ({ value: `${c.classId}::${c.subjectName}`, label: `${c.className} — ${c.subjectName}` }))} />
          </div>

          <div className="flex items-center gap-2 mb-5">
            <button onClick={() => setTab("materi")}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${tab === "materi" ? "bg-primary-700 text-white" : "bg-white text-gray-500 border border-gray-200 hover:border-primary-200"}`}>
              Materi
            </button>
            <button onClick={() => setTab("tugas")}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${tab === "tugas" ? "bg-primary-700 text-white" : "bg-white text-gray-500 border border-gray-200 hover:border-primary-200"}`}>
              Tugas
            </button>
            <button onClick={() => setTab("kuis")}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${tab === "kuis" ? "bg-primary-700 text-white" : "bg-white text-gray-500 border border-gray-200 hover:border-primary-200"}`}>
              Kuis
            </button>
            {tab === "kuis" ? (
              <Link href={`/dashboard/teacher/quizzes/new?classId=${selected?.classId ?? ""}&subject=${encodeURIComponent(selected?.subjectName ?? "")}`}
                className="ml-auto btn-gold flex items-center gap-1.5 text-xs">
                <Plus size={14} /> Buat Kuis
              </Link>
            ) : (
              <button onClick={() => setShowForm(s => !s)} className="ml-auto btn-gold flex items-center gap-1.5 text-xs">
                <Plus size={14} /> {tab === "materi" ? "Tambah Materi" : "Buat Tugas"}
              </button>
            )}
          </div>

          {showForm && tab !== "kuis" && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6 space-y-3">
              {error && <p className="error-msg">{error}</p>}
              <div>
                <label className="label-field">Judul</label>
                <input value={title} onChange={e => setTitle(e.target.value)} className="input-field"
                  placeholder={tab === "materi" ? "cth: Bab 3 — Jurnal Umum" : "cth: Latihan Soal Bab 3"} />
              </div>
              <div>
                <label className="label-field">Deskripsi (opsional)</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="input-field" />
              </div>
              {tab === "tugas" && (
                <div className="max-w-[220px]">
                  <label className="label-field">Batas Waktu (opsional)</label>
                  <DatePicker value={dueDate} onChange={setDueDate} />
                </div>
              )}
              <FileUpload value={fileUrl} onChange={setFileUrl} folder={tab === "materi" ? "materi" : "tugas"}
                label={`Lampiran (opsional)`} />
              {tab === "materi" && (
                <div>
                  <label className="label-field">Link Eksternal (opsional)</label>
                  <input value={linkUrl} onChange={e => setLinkUrl(e.target.value)} className="input-field" placeholder="https://..." />
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button onClick={resetForm} className="btn-modal-cancel text-sm px-4">Batal</button>
                <button onClick={handleCreate} disabled={saving} className="btn-gold flex items-center gap-2 text-sm">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Simpan
                </button>
              </div>
            </div>
          )}

          {loadingList ? (
            <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-primary-500" /></div>
          ) : tab === "kuis" ? (
            quizzes.length === 0 ? (
              <EmptyState icon={HelpCircle} title="Belum Ada Kuis" description="Buat kuis pilihan ganda untuk kelas ini — dinilai otomatis." />
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {quizzes.map(q => (
                  <Link key={q.id} href={`/dashboard/teacher/quizzes/${q.id}`}
                    className="group bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:border-primary-200 hover:shadow-md transition-all">
                    <div className="flex items-start justify-between mb-2">
                      <p className="font-heading font-bold text-primary-900">{q.title}</p>
                      <ChevronRight size={16} className="text-gray-300 group-hover:text-primary-500 transition-colors shrink-0" />
                    </div>
                    {q.description && <p className="text-sm text-gray-500 mb-2 line-clamp-2">{q.description}</p>}
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span className="flex items-center gap-1"><HelpCircle size={12} /> {q._count.questions} soal</span>
                      <span className="flex items-center gap-1"><Trophy size={12} /> {q._count.attempts} mengerjakan</span>
                      <span className={`ml-auto flex items-center gap-1 font-semibold ${q.isPublished ? "text-emerald-600" : "text-gray-400"}`}>
                        {q.isPublished ? <Eye size={12} /> : <EyeOff size={12} />} {q.isPublished ? "Terbit" : "Draft"}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )
          ) : tab === "materi" ? (
            materials.length === 0 ? (
              <EmptyState icon={FileText} title="Belum Ada Materi" description="Tambahkan materi pembelajaran untuk kelas ini." />
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {materials.map(m => (
                  <div key={m.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <div className="flex items-start justify-between mb-2">
                      <p className="font-heading font-bold text-primary-900">{m.title}</p>
                      <button onClick={() => handleDelete(m.id)} className="p-1 text-gray-300 hover:text-red-500 transition-colors shrink-0">
                        <Trash2 size={14} />
                      </button>
                    </div>
                    {m.description && <p className="text-sm text-gray-500 mb-2">{m.description}</p>}
                    <div className="flex items-center gap-3 text-xs">
                      {m.fileUrl && (
                        <a href={m.fileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary-600 hover:text-primary-800 font-semibold">
                          <FileText size={12} /> Lampiran
                        </a>
                      )}
                      {m.linkUrl && (
                        <a href={m.linkUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary-600 hover:text-primary-800 font-semibold">
                          <Link2 size={12} /> Link
                        </a>
                      )}
                      <span className="text-gray-300 ml-auto">{fmt(m.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : assignments.length === 0 ? (
            <EmptyState icon={ClipboardList} title="Belum Ada Tugas" description="Buat tugas untuk kelas ini." />
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {assignments.map(a => (
                <Link key={a.id} href={`/dashboard/teacher/assignments/${a.id}`}
                  className="group bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:border-primary-200 hover:shadow-md transition-all">
                  <div className="flex items-start justify-between mb-2">
                    <p className="font-heading font-bold text-primary-900">{a.title}</p>
                    <ChevronRight size={16} className="text-gray-300 group-hover:text-primary-500 transition-colors shrink-0" />
                  </div>
                  {a.description && <p className="text-sm text-gray-500 mb-2 line-clamp-2">{a.description}</p>}
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    {a.dueDate && <span className="flex items-center gap-1"><Calendar size={12} /> {fmt(a.dueDate)}</span>}
                    <span className="flex items-center gap-1 ml-auto text-primary-600 font-semibold">
                      <Users size={12} /> {a._count.submissions} terkumpul
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
