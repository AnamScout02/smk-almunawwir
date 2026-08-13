"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Briefcase, Loader2, Building2, Calendar, MessageSquare, Save, Star } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";

interface JournalEntry { id: string; date: string; activity: string; photoUrl: string | null; teacherNote: string | null }

interface InternshipDetail {
  id: string;
  company: string;
  position: string;
  supervisor: string;
  startDate: string;
  endDate: string;
  status: string;
  journal: JournalEntry[];
  pklGrade: number | null;
  student: {
    nis: string;
    user: { name: string };
    class: { name: string } | null;
    major: { name: string } | null;
  };
}

const STATUS_LABEL: Record<string, { label: string; badge: string }> = {
  ONGOING: { label: "Sedang PKL", badge: "bg-blue-50 text-blue-700 border border-blue-200" },
  COMPLETED: { label: "Selesai", badge: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
  CANCELLED: { label: "Dibatalkan", badge: "bg-red-50 text-red-600 border border-red-200" },
};

export default function TeacherPklDetailPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const [data, setData] = useState<InternshipDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [score, setScore] = useState("");
  const [savingScore, setSavingScore] = useState(false);
  const [scoreSaved, setScoreSaved] = useState(false);

  function load() {
    fetch(`/api/teacher/pkl/${studentId}`).then(r => r.json()).then((d: InternshipDetail) => {
      setData(d);
      setNotes(Object.fromEntries(d.journal.map(e => [e.id, e.teacherNote ?? ""])));
      setScore(d.pklGrade !== null ? String(d.pklGrade) : "");
      setLoading(false);
    }).catch(() => setLoading(false));
  }
  useEffect(() => { load(); }, [studentId]);

  async function saveNote(entryId: string) {
    setSavingId(entryId);
    try {
      await fetch(`/api/teacher/pkl/${studentId}/journal/${entryId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherNote: notes[entryId] || "" }),
      });
    } catch {
      // biarkan reset di finally, biar bisa dicoba lagi
    } finally {
      setSavingId(null);
    }
  }

  async function saveScore() {
    const val = Number(score);
    if (!score || isNaN(val) || val < 0 || val > 100) return;
    setSavingScore(true);
    try {
      const res = await fetch(`/api/teacher/pkl/${studentId}/grade`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score: val }),
      });
      if (res.ok) { setScoreSaved(true); setTimeout(() => setScoreSaved(false), 3000); }
    } catch {
      // koneksi bermasalah — biarkan guru coba lagi
    } finally {
      setSavingScore(false);
    }
  }

  const fmt = (d: string) => new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

  if (loading || !data) {
    return <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh] text-gray-400"><Loader2 size={24} className="animate-spin" /></div>;
  }

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        icon={<Briefcase size={22} />}
        title={data.student.user.name}
        description={`${data.student.class?.name ?? "—"} · ${data.student.major?.name ?? "—"} · NIS ${data.student.nis}`}
      />

      <div className="flex justify-end mb-5">
        <Link href="/dashboard/teacher/pkl" className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition">
          <ArrowLeft size={18} />
        </Link>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Building2 size={16} className="text-primary-600" />
          <h3 className="font-heading font-semibold text-navy">Informasi PKL</h3>
          <span className={`ml-auto text-xs font-bold px-2.5 py-1 rounded-full ${STATUS_LABEL[data.status]?.badge ?? ""}`}>
            {STATUS_LABEL[data.status]?.label ?? data.status}
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div><span className="text-gray-400 text-xs">Perusahaan</span><p className="font-semibold text-navy">{data.company}</p></div>
          <div><span className="text-gray-400 text-xs">Posisi</span><p className="font-semibold text-navy">{data.position}</p></div>
          <div><span className="text-gray-400 text-xs">Pembimbing Industri</span><p className="font-semibold text-navy">{data.supervisor}</p></div>
          <div><span className="text-gray-400 text-xs">Periode</span><p className="font-semibold text-navy">{fmt(data.startDate)} — {fmt(data.endDate)}</p></div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Star size={16} className="text-gold" />
          <h3 className="font-heading font-semibold text-navy">Nilai PKL</h3>
        </div>
        <div className="flex items-end gap-3">
          <div className="flex-1 max-w-[160px]">
            <label className="label-field">Nilai (0-100)</label>
            <input type="number" min={0} max={100} value={score} onChange={e => setScore(e.target.value)}
              placeholder="—" className="input-field" />
          </div>
          <button onClick={saveScore} disabled={savingScore} className="btn-gold flex items-center gap-2 text-sm">
            {savingScore ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Simpan Nilai
          </button>
          {scoreSaved && <p className="text-emerald-600 text-sm font-semibold self-center">✓ Tersimpan</p>}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-heading font-semibold text-navy mb-4">Jurnal Harian</h3>
        {data.journal.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">Siswa belum mengisi jurnal harian.</p>
        ) : (
          <div className="space-y-3">
            {data.journal.map(entry => (
              <div key={entry.id} className="border border-gray-100 rounded-xl p-4 flex gap-4">
                {entry.photoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={entry.photoUrl} alt="Bukti kegiatan" className="w-20 h-20 rounded-lg object-cover shrink-0 border border-gray-100" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
                    <Calendar size={12} /> {fmt(entry.date)}
                  </div>
                  <p className="text-sm text-gray-700 mb-2">{entry.activity}</p>
                  <div className="flex gap-2">
                    <input value={notes[entry.id] ?? ""} onChange={e => setNotes(p => ({ ...p, [entry.id]: e.target.value }))}
                      placeholder="Tulis catatan untuk siswa..." className="input-field text-xs flex-1" />
                    <button onClick={() => saveNote(entry.id)} disabled={savingId === entry.id}
                      className="px-3 py-1.5 rounded-lg bg-primary-50 hover:bg-primary-100 text-primary-700 text-xs font-semibold flex items-center gap-1 shrink-0">
                      {savingId === entry.id ? <Loader2 size={12} className="animate-spin" /> : <MessageSquare size={12} />} Simpan
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
