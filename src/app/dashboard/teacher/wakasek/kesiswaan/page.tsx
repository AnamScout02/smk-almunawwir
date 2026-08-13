"use client";
import { useEffect, useState } from "react";
import { ShieldCheck, Loader2, CalendarCheck, AlertOctagon, Users } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import StatTile from "@/components/admin/StatTile";

interface ClassRank { className: string; rate: number }
interface WatchRow { studentId: string; nis: string; name: string; className: string; alphaCount: number }
interface Summary {
  attendanceRate: number | null; totalAlpha: number; watchListCount: number;
  statusCount: { HADIR: number; IZIN: number; SAKIT: number; ALPHA: number };
  classRanking: ClassRank[]; watchList: WatchRow[];
}

export default function WakasekKesiswaanDashboard() {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/teacher/wakasek/kesiswaan/summary").then(async r => {
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
        icon={<ShieldCheck size={22} />}
        title="Dashboard Kesiswaan"
        description="Pemantauan kehadiran & kedisiplinan siswa — 30 hari terakhir"
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatTile color="primary" icon={CalendarCheck} label="Kehadiran Sekolah"
          value={data.attendanceRate !== null ? `${data.attendanceRate}%` : "—"}>
          {data.attendanceRate !== null && (
            <div className="mt-2 h-1.5 bg-white/25 rounded-full overflow-hidden segmented-bar">
              <div className="h-full bg-white rounded-full transition-all duration-700" style={{ width: `${Math.min(data.attendanceRate, 100)}%` }} />
            </div>
          )}
        </StatTile>
        <StatTile color="red" icon={AlertOctagon} label="Total Alpha (30 hari)" value={data.totalAlpha} />
        <StatTile color="amber" icon={Users} label="Siswa Perlu Perhatian" value={data.watchListCount} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-heading font-semibold text-navy text-sm mb-3">Kehadiran per Kelas (Terendah Dulu)</h3>
          {data.classRanking.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">Belum ada data absensi 30 hari terakhir.</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(220, data.classRanking.length * 28)}>
              <BarChart data={data.classRanking} layout="vertical" margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="className" width={90} tick={{ fontSize: 11, fill: "#374151" }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => [`${v}%`, "Kehadiran"]} />
                <Bar dataKey="rate" radius={[0, 6, 6, 0]} maxBarSize={18}>
                  {data.classRanking.map((c, i) => <Cell key={i} fill={c.rate < 75 ? "#dc2626" : "#1B2B6B"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 flex items-center justify-between" style={{ background: "linear-gradient(135deg, #0F1A45 0%, #1B2B6B 100%)" }}>
            <p className="text-sm text-white font-semibold">Watch-list Kedisiplinan</p>
            <span className="text-xs text-gold font-bold">{data.watchList.length} siswa</span>
          </div>
          {data.watchList.length === 0 ? (
            <EmptyState icon={ShieldCheck} title="Tidak Ada Catatan" description="Tidak ada siswa dengan Alpha berlebih dalam 30 hari terakhir." />
          ) : (
            <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
              {data.watchList.map(s => (
                <div key={s.studentId} className="px-5 py-3 flex items-center justify-between text-sm">
                  <div className="min-w-0">
                    <p className="font-semibold text-primary-900 truncate">{s.name}</p>
                    <p className="text-gray-400 text-xs">{s.className} · {s.nis}</p>
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200 whitespace-nowrap">
                    {s.alphaCount}x Alpha
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
