"use client";
import { useEffect, useState } from "react";
import { Award, Loader2, Users, TrendingUp, CheckCircle2, FileCheck } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import Link from "next/link";
import PageHeader from "@/components/admin/PageHeader";

interface ClassStat { className: string; avg: number | null; attPct: number | null; studentCount: number }
interface MajorSummary {
  majorId: string; majorName: string; majorCode: string;
  classStats: ClassStat[]; pklByStatus: { ONGOING: number; COMPLETED: number; CANCELLED: number };
  totalStudents: number;
}
interface Summary { majors: MajorSummary[]; semester: string }

const PKL_COLORS: Record<string, string> = { ONGOING: "#2563eb", COMPLETED: "#059669", CANCELLED: "#dc2626" };
const PKL_LABEL: Record<string, string> = { ONGOING: "Sedang PKL", COMPLETED: "Selesai", CANCELLED: "Dibatalkan" };

export default function KaprogliDashboard() {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeMajor, setActiveMajor] = useState(0);

  useEffect(() => {
    fetch("/api/teacher/wakasek/kaprogli/summary").then(async r => {
      if (!r.ok) { const d = await r.json(); setError(d.error || "Gagal memuat data"); setLoading(false); return; }
      setData(await r.json());
      setLoading(false);
    }).catch(() => { setError("Gagal memuat data"); setLoading(false); });
  }, []);

  if (loading) return <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh] text-gray-400"><Loader2 size={24} className="animate-spin" /></div>;
  if (error || !data || data.majors.length === 0) return <div className="p-6 lg:p-8 text-center text-gray-400 py-20">{error || "Data tidak tersedia."}</div>;

  const major = data.majors[activeMajor];
  const pklData = (["ONGOING", "COMPLETED", "CANCELLED"] as const).map(k => ({ key: k, name: PKL_LABEL[k], value: major.pklByStatus[k] }));
  const totalPkl = pklData.reduce((a, b) => a + b.value, 0);

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        icon={<Award size={22} />}
        title={`Dashboard Kaprogli — ${major.majorName}`}
        description={`Ringkasan capaian jurusan — Semester ${data.semester}`}
      />

      <div className="flex justify-end mb-5">
        <Link href="/dashboard/teacher/wakasek/kaprogli/ukk"
          className="inline-flex items-center gap-2 bg-gold hover:bg-gold/90 text-primary-900 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap">
          <FileCheck size={15} /> Rekap UKK
        </Link>
      </div>

      {data.majors.length > 1 && (
        <div className="flex items-center gap-2 mb-5">
          {data.majors.map((m, i) => (
            <button key={m.majorId} onClick={() => setActiveMajor(i)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${i === activeMajor ? "bg-primary-700 text-white" : "bg-white text-gray-500 border border-gray-200 hover:border-primary-200"}`}>
              {m.majorCode}
            </button>
          ))}
        </div>
      )}

      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <div className="group relative overflow-hidden rounded-2xl p-4 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all bg-gradient-to-br from-primary-500 to-primary-700 ring-1 ring-primary-100">
          <div className="absolute -right-3 -bottom-3 opacity-15 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6"><Users size={56} className="text-white" /></div>
          <div className="relative">
            <p className="text-white/70 text-xs font-medium mb-1">Total Siswa Aktif</p>
            <p className="font-heading font-bold text-3xl text-white">{major.totalStudents}</p>
          </div>
        </div>
        <div className="group relative overflow-hidden rounded-2xl p-4 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all bg-gradient-to-br from-emerald-500 to-emerald-600 ring-1 ring-emerald-100">
          <div className="absolute -right-3 -bottom-3 opacity-15 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6"><TrendingUp size={56} className="text-white" /></div>
          <div className="relative">
            <p className="text-white/70 text-xs font-medium mb-1">Rata-rata Nilai Jurusan</p>
            <p className="font-heading font-bold text-3xl text-white">
              {major.classStats.some(c => c.avg !== null)
                ? Math.round((major.classStats.filter(c => c.avg !== null).reduce((a, c) => a + (c.avg ?? 0), 0) / major.classStats.filter(c => c.avg !== null).length) * 10) / 10
                : "—"}
            </p>
          </div>
        </div>
        <div className="group relative overflow-hidden rounded-2xl p-4 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all bg-gradient-to-br from-blue-500 to-blue-600 ring-1 ring-blue-100">
          <div className="absolute -right-3 -bottom-3 opacity-15 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6"><CheckCircle2 size={56} className="text-white" /></div>
          <div className="relative">
            <p className="text-white/70 text-xs font-medium mb-1">Siswa Sedang PKL</p>
            <p className="font-heading font-bold text-3xl text-white">{major.pklByStatus.ONGOING}</p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-heading font-semibold text-navy text-sm mb-3">Nilai & Kehadiran per Kelas</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-primary-100" style={{ background: "linear-gradient(135deg, rgba(15,26,69,0.05) 0%, rgba(27,43,107,0.03) 100%)" }}>
                  <th className="text-left px-4 py-2.5 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Kelas</th>
                  <th className="text-center px-4 py-2.5 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Siswa</th>
                  <th className="text-center px-4 py-2.5 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Rata Nilai</th>
                  <th className="text-center px-4 py-2.5 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Kehadiran</th>
                </tr>
              </thead>
              <tbody>
                {major.classStats.map(c => (
                  <tr key={c.className} className="border-b border-gray-50 last:border-0">
                    <td className="px-4 py-2.5 font-semibold text-primary-900">{c.className}</td>
                    <td className="px-4 py-2.5 text-center text-gray-500">{c.studentCount}</td>
                    <td className="px-4 py-2.5 text-center font-bold text-primary-700">{c.avg ?? "—"}</td>
                    <td className="px-4 py-2.5 text-center font-bold text-emerald-600">{c.attPct !== null ? `${c.attPct}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-heading font-semibold text-navy text-sm mb-3">Status PKL Jurusan</h3>
          {totalPkl === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">Belum ada data PKL.</p>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={pklData} dataKey="value" nameKey="name" innerRadius={44} outerRadius={70} paddingAngle={2} strokeWidth={0}>
                    {pklData.map(d => <Cell key={d.key} fill={PKL_COLORS[d.key]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => [`${v} siswa`, ""]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 text-xs shrink-0">
                {pklData.map(d => (
                  <div key={d.key} className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: PKL_COLORS[d.key] }} />
                    <span className="text-gray-500">{d.name}</span>
                    <span className="font-bold text-primary-900 ml-1">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
