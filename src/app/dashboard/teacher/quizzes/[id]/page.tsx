"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, HelpCircle, Loader2, Plus, Save, Trash2, Trophy, Eye, EyeOff } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import { useToast } from "@/components/shared/ToastProvider";
import TombolKembali from "@/components/shared/TombolKembali";

interface QuestionForm { id?: string; question: string; optionA: string; optionB: string; optionC: string; optionD: string; correctAnswer: string }
interface AttemptRow { id: string; score: number; submittedAt: string; student: { user: { name: string } } }
interface QuizDetail {
  id: string; title: string; description: string | null; duration: number | null; isPublished: boolean;
  class: { name: string; students: { id: string }[] };
  questions: QuestionForm[];
  attempts: AttemptRow[];
}

const EMPTY_QUESTION: QuestionForm = { question: "", optionA: "", optionB: "", optionC: "", optionD: "", correctAnswer: "A" };

export default function TeacherQuizBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === "new";
  const router = useRouter();
  const searchParams = useSearchParams();
  const confirmDialog = useConfirm();
  const toast = useToast();

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<QuizDetail | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("");
  const [questions, setQuestions] = useState<QuestionForm[]>([{ ...EMPTY_QUESTION }]);

  const classId = searchParams.get("classId") ?? "";
  const subject = searchParams.get("subject") ?? "";

  useEffect(() => {
    if (isNew) return;
    fetch(`/api/teacher/quizzes/${id}`).then(async r => {
      if (!r.ok) { setError("Kuis tidak ditemukan"); setLoading(false); return; }
      const d: QuizDetail = await r.json();
      setDetail(d);
      setTitle(d.title);
      setDescription(d.description ?? "");
      setDuration(d.duration ? String(d.duration) : "");
      setQuestions(d.questions.length > 0 ? d.questions : [{ ...EMPTY_QUESTION }]);
      setLoading(false);
    }).catch(() => { setError("Gagal memuat kuis"); setLoading(false); });
  }, [id, isNew]);

  function addQuestion() { setQuestions(qs => [...qs, { ...EMPTY_QUESTION }]); }
  function removeQuestion(i: number) { setQuestions(qs => qs.filter((_, idx) => idx !== i)); }
  function updateQuestion(i: number, patch: Partial<QuestionForm>) {
    setQuestions(qs => qs.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  }

  async function handleSave() {
    if (!title.trim()) { setError("Judul kuis wajib diisi."); return; }
    if (questions.length === 0 || questions.some(q => !q.question.trim() || !q.optionA.trim() || !q.optionB.trim() || !q.optionC.trim() || !q.optionD.trim())) {
      setError("Semua soal dan pilihan jawaban wajib diisi."); return;
    }
    setError("");
    setSaving(true);
    const body = isNew
      ? { classId, subject, title, description, duration: duration || null, questions }
      : { title, description, duration: duration || null, questions };
    try {
      const res = await fetch(isNew ? "/api/teacher/quizzes" : `/api/teacher/quizzes/${id}`, {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || "Gagal menyimpan"); return; }
      const saved = await res.json();
      toast.success("Kuis berhasil disimpan");
      router.push(isNew ? `/dashboard/teacher/quizzes/${saved.id}` : `/dashboard/teacher/quizzes/${id}`);
      router.refresh();
    } catch {
      setError("Koneksi bermasalah, coba lagi.");
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish() {
    if (!detail) return;
    const res = await fetch(`/api/teacher/quizzes/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isPublished: !detail.isPublished }),
    });
    if (res.ok) {
      setDetail(d => (d ? { ...d, isPublished: !d.isPublished } : d));
      toast.success(!detail.isPublished ? "Kuis dipublikasikan ke siswa" : "Kuis disembunyikan dari siswa");
    }
  }

  async function handleDelete() {
    if (!(await confirmDialog("Hapus kuis ini beserta semua hasil pengerjaan siswa?"))) return;
    await fetch(`/api/teacher/quizzes/${id}`, { method: "DELETE" });
    router.push("/dashboard/teacher/materials");
  }

  if (loading) {
    return <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh] text-gray-400"><Loader2 size={24} className="animate-spin" /></div>;
  }

  const fmt = (d: string) => new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader
        icon={<HelpCircle size={22} />}
        title={isNew ? "Buat Kuis Baru" : "Edit Kuis"}
        description={detail ? `${detail.class.name}` : "Kuis pilihan ganda — dinilai otomatis"}
      />

      {/* Aksi di baris terpisah (bukan actions PageHeader) — header cukup ikon+judul+keterangan saja. */}
      <div className="flex items-center gap-2 mb-5">
        {!isNew && detail && (
          <button onClick={togglePublish}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
              detail.isPublished ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-gray-50 text-gray-600 border border-gray-200"
            }`}>
            {detail.isPublished ? <Eye size={14} /> : <EyeOff size={14} />} {detail.isPublished ? "Dipublikasikan" : "Draft"}
          </button>
        )}
        {!isNew && (
          <button onClick={handleDelete} className="p-2 rounded-lg hover:bg-red-50 text-red-500 transition">
            <Trash2 size={18} />
          </button>
        )}
        <TombolKembali href={"/dashboard/teacher/materials"} />
      </div>

      {error && <p className="error-msg mb-4">{error}</p>}

      <div className="panel p-5 mb-6 space-y-3">
        <div>
          <label className="label-field">Judul Kuis</label>
          <input value={title} onChange={e => setTitle(e.target.value)} className="input-field" placeholder="cth: Kuis Bab 3 — Jurnal Umum" />
        </div>
        <div>
          <label className="label-field">Deskripsi (opsional)</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="input-field" />
        </div>
        <div className="max-w-[220px]">
          <label className="label-field">Durasi (menit, opsional)</label>
          <input type="number" min={1} value={duration} onChange={e => setDuration(e.target.value)} className="input-field" placeholder="cth: 30" />
        </div>
      </div>

      <div className="space-y-4 mb-6">
        {questions.map((q, i) => (
          <div key={i} className="panel p-5">
            <div className="flex items-start justify-between mb-3">
              <p className="font-heading font-bold text-primary-900 text-sm">Soal #{i + 1}</p>
              {questions.length > 1 && (
                <button onClick={() => removeQuestion(i)} className="p-1 text-gray-300 hover:text-red-500 transition-colors">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
            <textarea value={q.question} onChange={e => updateQuestion(i, { question: e.target.value })} rows={2}
              className="input-field mb-3" placeholder="Tulis pertanyaan..." />
            <div className="space-y-2">
              {(["A", "B", "C", "D"] as const).map(opt => (
                <div key={opt} className="flex items-center gap-2">
                  <button onClick={() => updateQuestion(i, { correctAnswer: opt })}
                    className={`w-7 h-7 shrink-0 rounded-full text-xs font-bold border-2 transition-colors ${
                      q.correctAnswer === opt ? "bg-emerald-500 border-emerald-500 text-white" : "border-gray-200 text-gray-400 hover:border-emerald-300"
                    }`} title="Tandai sebagai kunci jawaban">
                    {opt}
                  </button>
                  <input value={q[`option${opt}` as "optionA"]} onChange={e => updateQuestion(i, { [`option${opt}`]: e.target.value } as Partial<QuestionForm>)}
                    className="input-field flex-1" placeholder={`Pilihan ${opt}`} />
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">Klik huruf di samping pilihan untuk menandai kunci jawaban (sekarang: {q.correctAnswer}).</p>
          </div>
        ))}
        <button onClick={addQuestion} className="w-full py-3 rounded-xl border-2 border-dashed border-gray-200 text-gray-400 hover:border-primary-300 hover:text-primary-700 transition-colors flex items-center justify-center gap-2 text-sm font-semibold">
          <Plus size={16} /> Tambah Soal
        </button>
      </div>

      <div className="alat-aksi alat-teks justify-end mb-8">
        <button onClick={handleSave} disabled={saving} className="btn-modal-save">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Simpan Kuis
        </button>
      </div>

      {!isNew && detail && (
        <div className="panel overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-white">
            <p className="text-sm font-semibold text-primary-900 flex items-center gap-2"><Trophy size={15} className="text-primary-700" /> Hasil Pengerjaan</p>
            <p className="text-xs text-gray-500">{detail.attempts.length} dari {detail.class.students.length} siswa</p>
          </div>
          {detail.attempts.length === 0 ? (
            <div className="py-10 text-center text-gray-400 text-sm">Belum ada siswa yang mengerjakan.</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {detail.attempts.map(a => (
                <div key={a.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="font-semibold text-primary-900 text-sm">{a.student.user.name}</p>
                    <p className="text-xs text-gray-400">{fmt(a.submittedAt)}</p>
                  </div>
                  <span className={`text-sm font-bold px-3 py-1 rounded-full border ${
                    a.score >= 75 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : a.score >= 50 ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-red-50 text-red-600 border-red-200"
                  }`}>
                    {a.score}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
