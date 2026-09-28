"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Loader2, FileText, Link2, Calendar, CheckCircle2, Clock, Save, HelpCircle, ChevronRight, Trophy } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import FileUpload from "@/components/shared/FileUpload";

interface MaterialItem {
  id: string; title: string; description: string | null; fileUrl: string | null; linkUrl: string | null; subject: string; createdAt: string;
  teacher: { user: { name: string } };
}
interface AssignmentItem {
  id: string; title: string; description: string | null; fileUrl: string | null; subject: string; dueDate: string | null; createdAt: string;
  teacher: { user: { name: string } };
  mySubmission: { id: string; fileUrl: string | null; note: string | null; submittedAt: string; score: number | null; feedback: string | null } | null;
}
interface QuizItem {
  id: string; title: string; description: string | null; subject: string; questionCount: number; createdAt: string;
  teacher: { user: { name: string } };
  myAttempt: { score: number; submittedAt: string } | null;
}

export default function StudentMaterialsPage() {
  const [tab, setTab] = useState<"materi" | "tugas" | "kuis">("materi");
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [quizzes, setQuizzes] = useState<QuizItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [openSubmit, setOpenSubmit] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [saving, setSaving] = useState(false);

  function loadMaterials() {
    setLoading(true);
    fetch("/api/student/materials").then(r => r.json()).then(d => { setMaterials(Array.isArray(d) ? d : []); setLoading(false); }).catch(() => setLoading(false));
  }
  function loadAssignments() {
    setLoading(true);
    fetch("/api/student/assignments").then(r => r.json()).then(d => { setAssignments(Array.isArray(d) ? d : []); setLoading(false); }).catch(() => setLoading(false));
  }
  function loadQuizzes() {
    setLoading(true);
    fetch("/api/student/quizzes").then(r => r.json()).then(d => { setQuizzes(Array.isArray(d) ? d : []); setLoading(false); }).catch(() => setLoading(false));
  }
  useEffect(() => { if (tab === "materi") loadMaterials(); else if (tab === "tugas") loadAssignments(); else loadQuizzes(); }, [tab]);

  function startSubmit(a: AssignmentItem) {
    setOpenSubmit(a.id);
    setNote(a.mySubmission?.note ?? "");
    setFileUrl(a.mySubmission?.fileUrl ?? "");
  }

  async function handleSubmit(assignmentId: string) {
    setSaving(true);
    const res = await fetch(`/api/student/assignments/${assignmentId}/submit`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note, fileUrl }),
    });
    setSaving(false);
    if (res.ok) { setOpenSubmit(null); loadAssignments(); }
  }

  const fmt = (d: string) => new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader
        icon={<BookOpen size={22} />}
        title="Materi & Tugas"
        description="Materi pembelajaran dan tugas dari guru untuk kelasmu"
      />

      <div className="flex items-center gap-2 mb-5">
        <button onClick={() => setTab("materi")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${tab === "materi" ? "bg-primary-700 text-white" : "bg-white text-gray-500 border border-gray-200 hover:border-primary-100"}`}>
          Materi
        </button>
        <button onClick={() => setTab("tugas")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${tab === "tugas" ? "bg-primary-700 text-white" : "bg-white text-gray-500 border border-gray-200 hover:border-primary-100"}`}>
          Tugas
        </button>
        <button onClick={() => setTab("kuis")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${tab === "kuis" ? "bg-primary-700 text-white" : "bg-white text-gray-500 border border-gray-200 hover:border-primary-100"}`}>
          Kuis
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-gray-400" /></div>
      ) : tab === "kuis" ? (
        quizzes.length === 0 ? (
          <EmptyState icon={HelpCircle} title="Belum Ada Kuis" description="Kuis dari guru akan muncul di sini." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {quizzes.map(q => (
              <Link key={q.id} href={`/dashboard/student/quizzes/${q.id}`}
                className="panel group p-5 hover:border-primary-100 hover:shadow-md transition-all">
                <div className="flex items-start justify-between mb-1">
                  <div>
                    <p className="text-xs text-primary-700 font-semibold">{q.subject}</p>
                    <p className="font-heading font-bold text-primary-900">{q.title}</p>
                  </div>
                  <ChevronRight size={16} className="text-gray-300 group-hover:text-primary-500 transition-colors shrink-0" />
                </div>
                {q.description && <p className="text-sm text-gray-500 mb-2 line-clamp-2">{q.description}</p>}
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span className="flex items-center gap-1"><HelpCircle size={12} /> {q.questionCount} soal</span>
                  {q.myAttempt ? (
                    <span className="ml-auto flex items-center gap-1 font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <Trophy size={11} /> Nilai: {q.myAttempt.score}
                    </span>
                  ) : (
                    <span className="ml-auto font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Belum dikerjakan</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )
      ) : tab === "materi" ? (
        materials.length === 0 ? (
          <EmptyState icon={FileText} title="Belum Ada Materi" description="Materi pembelajaran dari guru akan muncul di sini." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {materials.map(m => (
              <div key={m.id} className="panel p-5">
                <p className="text-xs text-primary-700 font-semibold mb-1">{m.subject}</p>
                <p className="font-heading font-bold text-primary-900 mb-1">{m.title}</p>
                {m.description && <p className="text-sm text-gray-500 mb-2">{m.description}</p>}
                <div className="flex items-center gap-3 text-xs">
                  {m.fileUrl && (
                    <a href={m.fileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary-700 hover:text-primary-900 font-semibold">
                      <FileText size={12} /> Lampiran
                    </a>
                  )}
                  {m.linkUrl && (
                    <a href={m.linkUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary-700 hover:text-primary-900 font-semibold">
                      <Link2 size={12} /> Link
                    </a>
                  )}
                  <span className="text-gray-300 ml-auto">{m.teacher.user.name} · {fmt(m.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )
      ) : assignments.length === 0 ? (
        <EmptyState icon={CheckCircle2} title="Belum Ada Tugas" description="Tugas dari guru akan muncul di sini." />
      ) : (
        <div className="space-y-4">
          {assignments.map(a => (
            <div key={a.id} className="panel p-5">
              <div className="flex items-start justify-between mb-1">
                <div>
                  <p className="text-xs text-primary-700 font-semibold">{a.subject}</p>
                  <p className="font-heading font-bold text-primary-900">{a.title}</p>
                </div>
                {a.mySubmission ? (
                  a.mySubmission.score !== null ? (
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Dinilai: {a.mySubmission.score}
                    </span>
                  ) : (
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                      <CheckCircle2 size={11} /> Sudah dikumpulkan
                    </span>
                  )
                ) : (
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                    <Clock size={11} /> Belum dikumpulkan
                  </span>
                )}
              </div>
              {a.description && <p className="text-sm text-gray-500 mt-2">{a.description}</p>}
              <div className="flex items-center gap-3 text-xs text-gray-400 mt-2">
                {a.dueDate && <span className="flex items-center gap-1"><Calendar size={12} /> Batas: {fmt(a.dueDate)}</span>}
                {a.fileUrl && (
                  <a href={a.fileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary-700 hover:text-primary-900 font-semibold">
                    <FileText size={12} /> Lihat soal
                  </a>
                )}
                <span className="ml-auto">{a.teacher.user.name}</span>
              </div>

              {a.mySubmission?.feedback && (
                <div className="mt-3 bg-primary-50 border border-primary-100 rounded-lg px-3 py-2 text-xs text-primary-700">
                  <span className="font-semibold">Feedback guru:</span> {a.mySubmission.feedback}
                </div>
              )}

              {openSubmit === a.id ? (
                <div className="mt-3 border border-gray-100 rounded-xl p-4 space-y-3 bg-gray-50/50">
                  <div>
                    <label className="label-field">Catatan (opsional)</label>
                    <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} className="input-field" />
                  </div>
                  <FileUpload value={fileUrl} onChange={setFileUrl} folder="tugas-jawaban" label="Lampiran Jawaban (opsional)" />
                  <div className="alat-aksi justify-end">
                    <button onClick={() => setOpenSubmit(null)} className="btn-modal-cancel">Batal</button>
                    <button onClick={() => handleSubmit(a.id)} disabled={saving} className="btn-modal-save">
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Kumpulkan
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => startSubmit(a)} className="mt-3 text-xs text-primary-700 hover:text-primary-900 font-semibold">
                  {a.mySubmission ? "Ubah pengumpulan" : "Kumpulkan tugas"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
