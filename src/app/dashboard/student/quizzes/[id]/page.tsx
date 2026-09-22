"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, HelpCircle, Loader2, Send, Trophy, CheckCircle2, XCircle, Clock, Timer } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import { useConfirm } from "@/components/shared/ConfirmProvider";

interface QuestionView { id: string; question: string; optionA: string; optionB: string; optionC: string; optionD: string; correctAnswer?: string }
interface QuizDetail {
  id: string; title: string; description: string | null; subject: string; duration: number | null;
  teacher: { user: { name: string } };
  alreadyAttempted: boolean;
  deadline: string | null;
  myAttempt: { answers: Record<string, string>; score: number | null; submittedAt: string | null } | null;
  questions: QuestionView[];
}

function fmtClock(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const s = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function StudentQuizPage() {
  const { id } = useParams<{ id: string }>();
  const confirmDialog = useConfirm();
  const [quiz, setQuiz] = useState<QuizDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const submittingRef = useRef(false);

  useEffect(() => {
    fetch(`/api/student/quizzes/${id}`).then(async r => {
      if (!r.ok) { const d = await r.json(); setError(d.error || "Kuis tidak ditemukan"); setLoading(false); return; }
      const d: QuizDetail = await r.json();
      setQuiz(d);
      if (d.myAttempt?.answers) setAnswers(d.myAttempt.answers);
      if (d.deadline && !d.alreadyAttempted) {
        setRemaining(Math.max(0, Math.floor((new Date(d.deadline).getTime() - Date.now()) / 1000)));
      }
      setLoading(false);
    }).catch(() => { setError("Gagal memuat kuis"); setLoading(false); });
  }, [id]);

  function pick(questionId: string, option: string) {
    setAnswers(prev => ({ ...prev, [questionId]: option }));
  }

  const handleSubmit = useRef<(auto?: boolean) => void>(() => {});
  handleSubmit.current = async (auto = false) => {
    if (!quiz || submittingRef.current || quiz.alreadyAttempted) return;
    if (!auto) {
      const unanswered = quiz.questions.filter(q => !answers[q.id]).length;
      if (unanswered > 0 && !(await confirmDialog(`Masih ada ${unanswered} soal belum dijawab. Tetap kumpulkan?`))) return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/student/quizzes/${id}/submit`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || "Gagal mengumpulkan kuis"); return; }
      const r = await fetch(`/api/student/quizzes/${id}`);
      setQuiz(await r.json());
    } catch {
      setError("Koneksi bermasalah saat mengumpulkan kuis. Coba lagi.");
    } finally {
      setSubmitting(false);
      submittingRef.current = false;
    }
  };

  useEffect(() => {
    if (remaining === null || !quiz || quiz.alreadyAttempted) return;
    if (remaining <= 0) { handleSubmit.current(true); return; }
    const t = setInterval(() => setRemaining(r => {
      if (r === null) return r;
      if (r <= 1) { clearInterval(t); handleSubmit.current(true); return 0; }
      return r - 1;
    }), 1000);
    return () => clearInterval(t);
  }, [quiz, remaining]);

  if (loading) {
    return <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh] text-gray-400"><Loader2 size={24} className="animate-spin" /></div>;
  }
  if (error || !quiz) {
    return (
      <div className="p-6 lg:p-8">
        <div className="bg-red-50 border border-red-100 text-red-600 rounded-xl p-4 text-sm">{error || "Kuis tidak ditemukan"}</div>
      </div>
    );
  }

  const answeredCount = Object.keys(answers).length;

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader
        icon={<HelpCircle size={22} />}
        title={quiz.title}
        description={`${quiz.subject} · ${quiz.teacher.user.name}${quiz.duration ? ` · ${quiz.duration} menit` : ""}`}
      />

      <div className="flex items-center gap-3 mb-5">
        {remaining !== null && !quiz.alreadyAttempted && (
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold ${remaining < 60 ? "bg-red-50 text-red-600 border border-red-200" : "bg-primary-50 text-primary-700 border border-primary-100"}`}>
            <Timer size={14} /> {fmtClock(remaining)}
          </div>
        )}
        <Link href="/dashboard/student/materials" className="btn-modal-cancel">
          <ArrowLeft size={18} /> Kembali
        </Link>
      </div>

      {quiz.description && (
        <div className="panel p-5 mb-5 text-sm text-gray-600">{quiz.description}</div>
      )}

      {quiz.alreadyAttempted && quiz.myAttempt && (
        <div className="rounded-2xl border p-5 mb-6 flex items-center gap-4"
          style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(16,185,129,0.03) 100%)", borderColor: "rgba(16,185,129,0.25)" }}>
          <Trophy size={28} className="text-emerald-600 shrink-0" />
          <div>
            <p className="font-heading font-bold text-emerald-800 text-lg">Nilai Anda: {quiz.myAttempt.score ?? "-"}</p>
            <p className="text-xs text-emerald-600">Dikerjakan {quiz.myAttempt.submittedAt ? new Date(quiz.myAttempt.submittedAt).toLocaleString("id-ID") : "-"}. Jawaban benar ditandai hijau di bawah.</p>
          </div>
        </div>
      )}

      {error && <p className="error-msg mb-4">{error}</p>}

      <div className="space-y-4 mb-6">
        {quiz.questions.map((q, i) => (
          <div key={q.id} className="panel p-5">
            <p className="font-semibold text-primary-900 text-sm mb-3">{i + 1}. {q.question}</p>
            <div className="space-y-2">
              {(["A", "B", "C", "D"] as const).map(opt => {
                const optionText = q[`option${opt}` as "optionA"];
                const isSelected = answers[q.id] === opt;
                const isCorrect = quiz.alreadyAttempted && q.correctAnswer === opt;
                const isWrongPick = quiz.alreadyAttempted && isSelected && q.correctAnswer !== opt;
                return (
                  <button
                    key={opt}
                    disabled={quiz.alreadyAttempted}
                    onClick={() => pick(q.id, opt)}
                    className={`w-full flex items-center gap-3 text-left px-4 py-2.5 rounded-xl border text-sm transition-colors ${
                      isCorrect ? "bg-emerald-50 border-emerald-300 text-emerald-800" :
                      isWrongPick ? "bg-red-50 border-red-300 text-red-700" :
                      isSelected ? "bg-primary-50 border-primary-300 text-primary-900" :
                      "bg-white border-gray-200 text-gray-600 hover:border-primary-100"
                    } ${quiz.alreadyAttempted ? "cursor-default" : "cursor-pointer"}`}
                  >
                    <span className={`w-6 h-6 shrink-0 rounded-full text-xs font-bold flex items-center justify-center border ${
                      isCorrect ? "bg-emerald-500 border-emerald-500 text-white" :
                      isWrongPick ? "bg-red-500 border-red-500 text-white" :
                      isSelected ? "bg-primary-700 border-primary-700 text-white" : "border-gray-300 text-gray-400"
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

      {!quiz.alreadyAttempted && (
        <div className="flex items-center justify-end gap-4">
          <p className="text-xs text-gray-400 flex items-center gap-1"><Clock size={12} /> {answeredCount}/{quiz.questions.length} terjawab</p>
          <button onClick={() => handleSubmit.current(false)} disabled={submitting} className="btn-modal-save">
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Kumpulkan Kuis
          </button>
        </div>
      )}
    </div>
  );
}
