"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileQuestion, Loader2, Plus, Save, Trash2, Eye, EyeOff, KeyRound, BookMarked, Users2, Clock, CheckCircle2, PlayCircle } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import { useToast } from "@/components/shared/ToastProvider";
import DatePicker from "@/components/shared/DatePicker";

interface QuestionForm { id?: string; question: string; optionA: string; optionB: string; optionC: string; optionD: string; correctAnswer: string }
interface BankItem { id: string; question: string; optionA: string; optionB: string; optionC: string; optionD: string; correctAnswer: string }
interface MonitorRow {
  student: { id: string; nis: string; user: { name: string } };
  status: "BELUM_MULAI" | "SEDANG_MENGERJAKAN" | "SELESAI";
  score: number | null; startedAt: string | null; submittedAt: string | null;
}
interface ExamDetail {
  id: string; title: string; description: string | null; duration: number; startTime: string; endTime: string; isPublished: boolean; token: string;
  class: { name: string; students: { id: string }[] };
  questions: QuestionForm[];
  monitoring: MonitorRow[];
}

const EMPTY_QUESTION: QuestionForm = { question: "", optionA: "", optionB: "", optionC: "", optionD: "", correctAnswer: "A" };

function toLocalDateStr(d: Date) { return d.toISOString().slice(0, 10); }
function toLocalTimeStr(d: Date) { return d.toTimeString().slice(0, 5); }

export default function UjianBuilderManager({ basePath }: { basePath: string }) {
  const { id } = useParams<{ id: string }>();
  const isNew = id === "new";
  const router = useRouter();
  const searchParams = useSearchParams();
  const confirmDialog = useConfirm();
  const toast = useToast();

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<ExamDetail | null>(null);
  const [bankItems, setBankItems] = useState<BankItem[]>([]);
  const [showBank, setShowBank] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("60");
  const now = new Date();
  const [startDate, setStartDate] = useState(toLocalDateStr(now));
  const [startTimeStr, setStartTimeStr] = useState(toLocalTimeStr(now));
  const [endDate, setEndDate] = useState(toLocalDateStr(now));
  const [endTimeStr, setEndTimeStr] = useState(toLocalTimeStr(new Date(now.getTime() + 3600000)));
  const [questions, setQuestions] = useState<QuestionForm[]>([{ ...EMPTY_QUESTION }]);

  const classId = searchParams.get("classId") ?? "";
  const subject = searchParams.get("subject") ?? "";

  useEffect(() => {
    if (subject) fetch(`/api/teacher/exam-bank?subject=${encodeURIComponent(subject)}`).then(r => r.json()).then(d => setBankItems(Array.isArray(d) ? d : [])).catch(() => {});
  }, [subject]);

  useEffect(() => {
    if (isNew) return;
    fetch(`/api/teacher/exams/${id}`).then(async r => {
      if (!r.ok) { setError("Ujian tidak ditemukan"); setLoading(false); return; }
      const d: ExamDetail = await r.json();
      setDetail(d);
      setTitle(d.title); setDescription(d.description ?? ""); setDuration(String(d.duration));
      const st = new Date(d.startTime), et = new Date(d.endTime);
      setStartDate(toLocalDateStr(st)); setStartTimeStr(toLocalTimeStr(st));
      setEndDate(toLocalDateStr(et)); setEndTimeStr(toLocalTimeStr(et));
      setQuestions(d.questions.length > 0 ? d.questions : [{ ...EMPTY_QUESTION }]);
      setLoading(false);
    }).catch(() => { setError("Gagal memuat ujian"); setLoading(false); });
  }, [id, isNew]);

  function addQuestion() { setQuestions(qs => [...qs, { ...EMPTY_QUESTION }]); }
  function removeQuestion(i: number) { setQuestions(qs => qs.filter((_, idx) => idx !== i)); }
  function updateQuestion(i: number, patch: Partial<QuestionForm>) {
    setQuestions(qs => qs.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  }
  function insertFromBank(b: BankItem) {
    setQuestions(qs => {
      const base = qs.length === 1 && !qs[0].question.trim() ? [] : qs;
      return [...base, { question: b.question, optionA: b.optionA, optionB: b.optionB, optionC: b.optionC, optionD: b.optionD, correctAnswer: b.correctAnswer }];
    });
    toast.success("Soal ditambahkan dari bank soal");
  }

  async function handleSave() {
    if (!title.trim()) { setError("Judul ujian wajib diisi."); return; }
    if (questions.length === 0 || questions.some(q => !q.question.trim() || !q.optionA.trim() || !q.optionB.trim() || !q.optionC.trim() || !q.optionD.trim())) {
      setError("Semua soal dan pilihan jawaban wajib diisi."); return;
    }
    const startTime = new Date(`${startDate}T${startTimeStr}:00`).toISOString();
    const endTime = new Date(`${endDate}T${endTimeStr}:00`).toISOString();
    setError("");
    setSaving(true);
    const body = isNew
      ? { classId, subject, title, description, duration, startTime, endTime, questions }
      : { title, description, duration, startTime, endTime, questions };
    try {
      const res = await fetch(isNew ? "/api/teacher/exams" : `/api/teacher/exams/${id}`, {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || "Gagal menyimpan"); return; }
      const saved = await res.json();
      toast.success("Ujian berhasil disimpan");
      router.push(`${basePath}/${saved.id}`);
      router.refresh();
    } catch {
      setError("Koneksi bermasalah, coba lagi.");
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish() {
    if (!detail) return;
    const res = await fetch(`/api/teacher/exams/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isPublished: !detail.isPublished }),
    });
    if (res.ok) {
      setDetail(d => (d ? { ...d, isPublished: !d.isPublished } : d));
      toast.success(!detail.isPublished ? "Ujian dipublikasikan — token bisa dibagikan ke siswa" : "Ujian disembunyikan");
    }
  }

  async function handleDelete() {
    if (!(await confirmDialog("Hapus ujian ini beserta semua hasil pengerjaan siswa?"))) return;
    await fetch(`/api/teacher/exams/${id}`, { method: "DELETE" });
    router.push(basePath);
  }

  function copyToken() {
    if (!detail) return;
    navigator.clipboard?.writeText(detail.token);
    toast.success(`Token ${detail.token} disalin`);
  }

  if (loading) {
    return <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh] text-gray-400"><Loader2 size={24} className="animate-spin" /></div>;
  }

  const STATUS_LABEL = { BELUM_MULAI: "Belum Mulai", SEDANG_MENGERJAKAN: "Sedang Mengerjakan", SELESAI: "Selesai" };
  const STATUS_COLOR = {
    BELUM_MULAI: "bg-gray-50 text-gray-400 border-gray-200",
    SEDANG_MENGERJAKAN: "bg-amber-50 text-amber-700 border-amber-200",
    SELESAI: "bg-emerald-50 text-emerald-700 border-emerald-200",
  };
  const STATUS_ICON = { BELUM_MULAI: Clock, SEDANG_MENGERJAKAN: PlayCircle, SELESAI: CheckCircle2 };

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        icon={<FileQuestion size={22} />}
        title={isNew ? "Buat Ujian Baru" : "Edit Ujian"}
        description={detail ? detail.class.name : "Ujian online — dinilai otomatis"}
      />

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
        <Link href={basePath} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition sm:ml-auto">
          <ArrowLeft size={18} />
        </Link>
      </div>

      {error && <p className="error-msg mb-4">{error}</p>}

      {!isNew && detail && (
        <div className="bg-primary-50 border border-primary-100 rounded-2xl p-4 mb-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs text-primary-600 font-semibold mb-1">Token Ujian</p>
            <p className="font-mono font-bold text-2xl text-primary-900 tracking-widest">{detail.token}</p>
          </div>
          <button onClick={copyToken} className="flex items-center gap-2 bg-white border border-primary-200 text-primary-700 text-sm font-semibold px-4 py-2 rounded-xl hover:bg-primary-50 transition">
            <KeyRound size={14} /> Salin Token
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6 space-y-3">
        <div>
          <label className="label-field">Judul Ujian</label>
          <input value={title} onChange={e => setTitle(e.target.value)} className="input-field" placeholder="cth: Ujian Tengah Semester — Jaringan Komputer Dasar" />
        </div>
        <div>
          <label className="label-field">Deskripsi (opsional)</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="input-field" />
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className="label-field">Durasi (menit)</label>
            <input type="number" min={1} value={duration} onChange={e => setDuration(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="label-field">Mulai</label>
            <div className="flex gap-2">
              <DatePicker value={startDate} onChange={setStartDate} />
              <input type="time" value={startTimeStr} onChange={e => setStartTimeStr(e.target.value)} className="input-field" />
            </div>
          </div>
          <div>
            <label className="label-field">Selesai</label>
            <div className="flex gap-2">
              <DatePicker value={endDate} onChange={setEndDate} />
              <input type="time" value={endTimeStr} onChange={e => setEndTimeStr(e.target.value)} className="input-field" />
            </div>
          </div>
        </div>
        <p className="text-[11px] text-gray-400">Siswa hanya bisa masuk pakai token di antara waktu mulai &amp; selesai. Durasi membatasi waktu pengerjaan sejak siswa membuka ujian.</p>
      </div>

      {bankItems.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
          <button onClick={() => setShowBank(s => !s)} className="flex items-center gap-2 text-sm font-semibold text-primary-700">
            <BookMarked size={15} /> Ambil dari Bank Soal ({bankItems.length}) {showBank ? "▲" : "▼"}
          </button>
          {showBank && (
            <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
              {bankItems.map(b => (
                <button key={b.id} onClick={() => insertFromBank(b)}
                  className="w-full text-left px-3 py-2 rounded-lg border border-gray-100 hover:border-primary-200 hover:bg-primary-50/30 text-xs text-gray-600 transition-colors flex items-center justify-between gap-2">
                  <span className="truncate">{b.question}</span>
                  <Plus size={13} className="text-primary-500 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="space-y-4 mb-6">
        {questions.map((q, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
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
          </div>
        ))}
        <button onClick={addQuestion} className="w-full py-3 rounded-xl border-2 border-dashed border-gray-200 text-gray-400 hover:border-primary-300 hover:text-primary-600 transition-colors flex items-center justify-center gap-2 text-sm font-semibold">
          <Plus size={16} /> Tambah Soal
        </button>
      </div>

      <div className="flex justify-end mb-8">
        <button onClick={handleSave} disabled={saving} className="btn-gold flex items-center gap-2 text-sm">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Simpan Ujian
        </button>
      </div>

      {!isNew && detail && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3"
            style={{ background: "linear-gradient(135deg, #0F1A45 0%, #1B2B6B 100%)" }}>
            <p className="text-sm font-semibold text-white flex items-center gap-2"><Users2 size={15} className="text-gold" /> Monitoring Peserta</p>
            <p className="text-xs text-white/60">
              {detail.monitoring.filter(m => m.status === "SELESAI").length} selesai dari {detail.class.students.length} siswa
            </p>
          </div>
          {detail.monitoring.length === 0 ? (
            <div className="py-10 text-center text-gray-400 text-sm">Belum ada siswa di kelas ini.</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {detail.monitoring.map(m => {
                const Icon = STATUS_ICON[m.status];
                return (
                  <div key={m.student.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="font-semibold text-primary-900 text-sm">{m.student.user.name}</p>
                      <p className="text-xs text-gray-400 font-mono">{m.student.nis}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full border flex items-center gap-1 ${STATUS_COLOR[m.status]}`}>
                        <Icon size={11} /> {STATUS_LABEL[m.status]}
                      </span>
                      {m.score !== null && (
                        <span className="text-sm font-bold text-primary-700 w-10 text-right">{m.score}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
