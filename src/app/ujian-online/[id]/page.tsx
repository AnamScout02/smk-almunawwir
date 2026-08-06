"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileQuestion, Loader2, Send, Trophy, CheckCircle2, XCircle, Timer } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";

interface QuestionView { id: string; question: string; optionA: string; optionB: string; optionC: string; optionD: string; correctAnswer?: string }
interface ExamDetail {
  id: string; title: string; description: string | null; subject: string; duration: number;
  teacher: { user: { name: string } };
  deadline: string; submitted: boolean; score: number | null;
  answers?: Record<string, string>;
  questions: QuestionView[];
}

function fmtClock(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const s = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function StudentExamPage() {
  const { id } = useParams<{ id: string }>();
  const [exam, setExam] = useState<ExamDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [remaining, setRemaining] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    fetch(`/api/student/exams/${id}`).then(async r => {
      if (!r.ok) { const d = await r.json(); setError(d.error || "Ujian tidak ditemukan"); setLoading(false); return; }
      const d: ExamDetail = await r.json();
      setExam(d);
      if (d.answers) setAnswers(d.answers);
      setRemaining(Math.max(0, Math.floor((new Date(d.deadline).getTime() - Date.now()) / 1000)));
      setLoading(false);
    }).catch(() => { setError("Gagal memuat ujian"); setLoading(false); });
  }, [id]);

  const handleSubmit = useRef<() => void>(() => {});
  handleSubmit.current = async () => {
    if (submittingRef.current || !exam || exam.submitted) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/student/exams/${id}/submit`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || "Gagal mengumpulkan ujian"); return; }
      const r = await fetch(`/api/student/exams/${id}`);
      setExam(await r.json());
    } catch {
      setError("Koneksi bermasalah saat mengumpulkan ujian. Coba lagi.");
    } finally {
      setSubmitting(false);
      submittingRef.current = false;
    }
  };

  useEffect(() => {
    if (!exam || exam.submitted) return;
    if (remaining <= 0) { handleSubmit.current(); return; }
    const t = setInterval(() => setRemaining(r => {
      if (r <= 1) { clearInterval(t); handleSubmit.current(); return 0; }
      return r - 1;
    }), 1000);
    return () => clearInterval(t);
  }, [exam, remaining]);

  function pick(questionId: string, option: string) {
    setAnswers(prev => ({ ...prev, [questionId]: option }));
  }

  if (loading) {
    return <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh] text-gray-400"><Loader2 size={24} className="animate-spin" /></div>;
  }
  if (error || !exam) {
    return (
      <div className="p-6 lg:p-8">
        <div className="bg-red-50 border border-red-100 text-red-600 rounded-xl p-4 text-sm">{error || "Ujian tidak ditemukan"}</div>
      </div>
    );
  }

  const isUrgent = remaining < 300;

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader
        icon={<FileQuestion size={22} />}
        title={exam.title}
        description={`${exam.subject} · ${exam.teacher.user.name}`}
        actions={
          !exam.submitted ? (
            <span className={`flex items-center gap-2 font-mono font-bold text-lg px-3 py-1.5 rounded-xl ${isUrgent ? "bg-red-500/20 text-red-200" : "bg-white/10 text-white"}`}>
              <Timer size={16} /> {fmtClock(remaining)}
            </span>
          ) : (
            <Link href="/ujian-online" className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition">
              <ArrowLeft size={18} />
            </Link>
          )
        }
      />

      {exam.description && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5 text-sm text-gray-600">{exam.description}</div>
      )}

      {exam.submitted && exam.score !== null && (
        <div className="rounded-2xl border p-5 mb-6 flex items-center gap-4"
          style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(16,185,129,0.03) 100%)", borderColor: "rgba(16,185,129,0.25)" }}>
          <Trophy size={28} className="text-emerald-600 shrink-0" />
          <div>
            <p className="font-heading font-bold text-emerald-800 text-lg">Nilai Anda: {exam.score}</p>
            <p className="text-xs text-emerald-600">Ujian selesai. Jawaban benar ditandai hijau di bawah.</p>
          </div>
        </div>
      )}

      {error && <p className="error-msg mb-4">{error}</p>}

      <div className="space-y-4 mb-6">
        {exam.questions.map((q, i) => (
          <div key={q.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="font-semibold text-primary-900 text-sm mb-3">{i + 1}. {q.question}</p>
            <div className="space-y-2">
              {(["A", "B", "C", "D"] as const).map(opt => {
                const optionText = q[`option${opt}` as "optionA"];
                const isSelected = answers[q.id] === opt;
                const isCorrect = exam.submitted && q.correctAnswer === opt;
                const isWrongPick = exam.submitted && isSelected && q.correctAnswer !== opt;
                return (
                  <button
                    key={opt}
                    disabled={exam.submitted}
                    onClick={() => pick(q.id, opt)}
                    className={`w-full flex items-center gap-3 text-left px-4 py-2.5 rounded-xl border text-sm transition-colors ${
                      isCorrect ? "bg-emerald-50 border-emerald-300 text-emerald-800" :
                      isWrongPick ? "bg-red-50 border-red-300 text-red-700" :
                      isSelected ? "bg-primary-50 border-primary-300 text-primary-800" :
                      "bg-white border-gray-200 text-gray-600 hover:border-primary-200"
                    } ${exam.submitted ? "cursor-default" : "cursor-pointer"}`}
                  >
                    <span className={`w-6 h-6 shrink-0 rounded-full text-xs font-bold flex items-center justify-center border ${
                      isCorrect ? "bg-emerald-500 border-emerald-500 text-white" :
                      isWrongPick ? "bg-red-500 border-red-500 text-white" :
                      isSelected ? "bg-primary-600 border-primary-600 text-white" : "border-gray-300 text-gray-400"
                    }`}>{opt}</span>
                    <span className="flex-1">{optionText}</span>
                    {isCorrect && <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />}
                    {isWrongPick && <XCircle size={16} className="text-red-500 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {!exam.submitted && (
        <div className="flex items-center justify-end gap-4">
          <p className="text-xs text-gray-400">{Object.keys(answers).length}/{exam.questions.length} terjawab</p>
          <button onClick={() => handleSubmit.current()} disabled={submitting} className="btn-gold flex items-center gap-2 text-sm">
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Kumpulkan Ujian
          </button>
        </div>
      )}
    </div>
  );
}
