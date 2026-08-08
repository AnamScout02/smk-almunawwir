"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ClipboardList, Loader2, FileText, Save, Trash2, Calendar, CheckCircle2 } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import { useConfirm } from "@/components/shared/ConfirmProvider";

interface Submission {
  id: string; studentId: string; fileUrl: string | null; note: string | null; submittedAt: string;
  score: number | null; feedback: string | null;
  student: { user: { name: string } };
}
interface StudentRow { id: string; user: { name: string } }
interface AssignmentDetail {
  id: string; title: string; description: string | null; fileUrl: string | null; dueDate: string | null;
  class: { name: string; students: StudentRow[] };
  submissions: Submission[];
}

export default function TeacherAssignmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const confirmDialog = useConfirm();
  const [data, setData] = useState<AssignmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [scores, setScores] = useState<Record<string, string>>({});
  const [feedbacks, setFeedbacks] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  function load() {
    fetch(`/api/teacher/assignments/${id}`).then(r => r.json()).then((d: AssignmentDetail) => {
      setData(d);
      setScores(Object.fromEntries(d.submissions.map(s => [s.id, s.score !== null ? String(s.score) : ""])));
      setFeedbacks(Object.fromEntries(d.submissions.map(s => [s.id, s.feedback ?? ""])));
      setLoading(false);
    }).catch(() => setLoading(false));
  }
  useEffect(() => { load(); }, [id]);

  async function saveGrade(submissionId: string) {
    setSavingId(submissionId);
    try {
      await fetch(`/api/teacher/assignments/${id}/submissions/${submissionId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score: scores[submissionId] === "" ? null : Number(scores[submissionId]), feedback: feedbacks[submissionId] }),
      });
      load();
    } catch {
      // koneksi bermasalah — biarkan guru coba lagi
    } finally {
      setSavingId(null);
    }
  }

  async function handleDeleteAssignment() {
    if (!(await confirmDialog("Hapus tugas ini beserta semua pengumpulan siswa?"))) return;
    await fetch(`/api/teacher/assignments/${id}`, { method: "DELETE" });
    router.push("/dashboard/teacher/materials");
  }

  const fmt = (d: string) => new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

  if (loading || !data) {
    return <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh] text-gray-400"><Loader2 size={24} className="animate-spin" /></div>;
  }

  const submissionByStudent = Object.fromEntries(data.submissions.map(s => [s.studentId, s]));

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        icon={<ClipboardList size={22} />}
        title={data.title}
        description={`${data.class.name} · ${data.submissions.length} dari ${data.class.students.length} siswa terkumpul`}
      />

      <div className="flex items-center gap-2 mb-5">
        <button onClick={handleDeleteAssignment} className="p-2 rounded-lg hover:bg-red-50 text-red-500 transition">
          <Trash2 size={18} />
        </button>
        <Link href="/dashboard/teacher/materials" className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition sm:ml-auto">
          <ArrowLeft size={18} />
        </Link>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
        {data.description && <p className="text-sm text-gray-600 mb-3">{data.description}</p>}
        <div className="flex items-center gap-4 text-xs text-gray-400">
          {data.dueDate && <span className="flex items-center gap-1"><Calendar size={12} /> Batas waktu: {fmt(data.dueDate)}</span>}
          {data.fileUrl && (
            <a href={data.fileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary-600 hover:text-primary-800 font-semibold">
              <FileText size={12} /> Lihat lampiran soal
            </a>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="divide-y divide-gray-50">
          {data.class.students.map(student => {
            const sub = submissionByStudent[student.id];
            return (
              <div key={student.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="sm:w-48 shrink-0">
                  <p className="font-semibold text-primary-900 text-sm">{student.user.name}</p>
                  {sub ? (
                    <p className="text-xs text-emerald-600 flex items-center gap-1 mt-0.5"><CheckCircle2 size={11} /> Terkumpul {fmt(sub.submittedAt)}</p>
                  ) : (
                    <p className="text-xs text-gray-300 mt-0.5">Belum mengumpulkan</p>
                  )}
                </div>
                {sub ? (
                  <>
                    <div className="flex-1 min-w-0 text-xs text-gray-500">
                      {sub.note && <p className="mb-1">{sub.note}</p>}
                      {sub.fileUrl && (
                        <a href={sub.fileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary-600 hover:text-primary-800 font-semibold">
                          <FileText size={12} /> Lihat file
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <input type="number" min={0} max={100} value={scores[sub.id] ?? ""} placeholder="Nilai"
                        onChange={e => setScores(p => ({ ...p, [sub.id]: e.target.value }))}
                        className="input-field w-20 text-center" />
                      <input value={feedbacks[sub.id] ?? ""} placeholder="Feedback (opsional)"
                        onChange={e => setFeedbacks(p => ({ ...p, [sub.id]: e.target.value }))}
                        className="input-field w-44" />
                      <button onClick={() => saveGrade(sub.id)} disabled={savingId === sub.id}
                        className="px-3 py-1.5 rounded-lg bg-primary-50 hover:bg-primary-100 text-primary-700 text-xs font-semibold flex items-center gap-1 shrink-0">
                        {savingId === sub.id ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Simpan
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 text-xs text-gray-300 italic">—</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
