"use client";
import { useEffect, useState } from "react";
import { HeartHandshake, Loader2, Clock, TrendingDown, AlertOctagon } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import StatTile from "@/components/admin/StatTile";

interface StudentRow {
  studentId: string; nis: string; name: string; className: string;
  attPct: number | null; avgScore: number | null; reasons: string[];
}
interface Summary {
  students: StudentRow[]; lowAttendanceCount: number; lowGradeCount: number; bothCount: number; semester: string;
}

export default function BkDashboard() {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/teacher/bk/summary").then(async r => {
      if (!r.ok) { const d = await r.json(); setError(d.error || "Gagal memuat data"); setLoading(false); return; }
      setData(await r.json());
      setLoading(false);
    }).catch(() => { setError("Gagal memuat data"); setLoading(false); });
  }, []);

  if (loading) return <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh] text-gray-400"><Loader2 size={24} className="animate-spin" /></div>;
  if (error || !data) return <div className="p-6 lg:p-8 text-center text-gray-400 py-20">{error || "Data tidak tersedia."}</div>;

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        icon={<HeartHandshake size={22} />}
        title="Dashboard Bimbingan Konseling"
        description={`Siswa yang perlu perhatian berdasarkan kehadiran & nilai — Semester ${data.semester}`}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatTile color="amber" icon={Clock} label="Kehadiran Rendah (<75%)" value={data.lowAttendanceCount} />
        <StatTile color="red" icon={TrendingDown} label="Nilai Rendah (<75)" value={data.lowGradeCount} />
        <StatTile color="purple" icon={AlertOctagon} label="Kedua-duanya" value={data.bothCount} />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 flex items-center justify-between" style={{ background: "linear-gradient(135deg, #0F1A45 0%, #1B2B6B 100%)" }}>
          <p className="text-sm text-white font-semibold">Siswa Perlu Perhatian</p>
          <span className="text-xs text-gold font-bold">{data.students.length} siswa</span>
        </div>
        {data.students.length === 0 ? (
          <EmptyState icon={HeartHandshake} title="Tidak Ada yang Perlu Perhatian Khusus" description="Semua siswa memenuhi ambang kehadiran & nilai minimum." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-primary-100" style={{ background: "linear-gradient(135deg, rgba(15,26,69,0.05) 0%, rgba(27,43,107,0.03) 100%)" }}>
                  <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Siswa</th>
                  <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Kelas</th>
                  <th className="text-center px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Kehadiran</th>
                  <th className="text-center px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Rata Nilai</th>
                  <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Alasan</th>
                </tr>
              </thead>
              <tbody>
                {data.students.map(s => (
                  <tr key={s.studentId} className="border-b border-gray-50 last:border-0 hover:bg-primary-50/30 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-primary-900">{s.name}</p>
                      <p className="text-gray-400 text-xs font-mono">{s.nis}</p>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600">{s.className}</td>
                    <td className="px-5 py-3.5 text-center font-bold text-amber-600">{s.attPct !== null ? `${s.attPct}%` : "—"}</td>
                    <td className="px-5 py-3.5 text-center font-bold text-red-500">{s.avgScore ?? "—"}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {s.reasons.map(r => (
                          <span key={r} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">{r}</span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
