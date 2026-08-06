"use client";
import { useEffect, useState } from "react";
import { BadgeCheck, Loader2, BookOpen, CalendarCheck, Briefcase, AlertTriangle } from "lucide-react";
import Link from "next/link";
import PageHeader from "@/components/admin/PageHeader";

interface DataGap { label: string; count: number; href: string }
interface Summary {
  schoolAvg: number | null; attendanceRate: number | null; pklRate: number | null;
  totalGaps: number; dataGaps: DataGap[]; semester: string;
}

export default function WakasekPenjaminMutuDashboard() {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/teacher/wakasek/penjamin-mutu/summary").then(async r => {
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
        icon={<BadgeCheck size={22} />}
        title="Dashboard Penjamin Mutu"
        description={`Ringkasan KPI lintas-bidang sekolah — Semester ${data.semester}`}
      />

      <div className="grid sm:grid-cols-4 gap-4 mb-6">
        <div className="group relative overflow-hidden rounded-2xl p-4 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all bg-gradient-to-br from-primary-500 to-primary-700 ring-1 ring-primary-100">
          <div className="absolute -right-3 -bottom-3 opacity-15 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6"><BookOpen size={56} className="text-white" /></div>
          <div className="relative">
            <p className="text-white/70 text-xs font-medium mb-1">Rata-rata Nilai Sekolah</p>
            <p className="font-heading font-bold text-3xl text-white">{data.schoolAvg ?? "—"}</p>
          </div>
        </div>
        <div className="group relative overflow-hidden rounded-2xl p-4 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all bg-gradient-to-br from-blue-500 to-blue-600 ring-1 ring-blue-100">
          <div className="absolute -right-3 -bottom-3 opacity-15 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6"><CalendarCheck size={56} className="text-white" /></div>
          <div className="relative">
            <p className="text-white/70 text-xs font-medium mb-1">Kehadiran Sekolah (30 hari)</p>
            <p className="font-heading font-bold text-3xl text-white">{data.attendanceRate !== null ? `${data.attendanceRate}%` : "—"}</p>
            {data.attendanceRate !== null && (
              <div className="mt-2 h-1.5 bg-white/25 rounded-full overflow-hidden segmented-bar">
                <div className="h-full bg-white rounded-full transition-all duration-700" style={{ width: `${Math.min(data.attendanceRate, 100)}%` }} />
              </div>
            )}
          </div>
        </div>
        <div className="group relative overflow-hidden rounded-2xl p-4 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all bg-gradient-to-br from-emerald-500 to-emerald-600 ring-1 ring-emerald-100">
          <div className="absolute -right-3 -bottom-3 opacity-15 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6"><Briefcase size={56} className="text-white" /></div>
          <div className="relative">
            <p className="text-white/70 text-xs font-medium mb-1">Penempatan PKL Kelas XII</p>
            <p className="font-heading font-bold text-3xl text-white">{data.pklRate !== null ? `${data.pklRate}%` : "—"}</p>
            {data.pklRate !== null && (
              <div className="mt-2 h-1.5 bg-white/25 rounded-full overflow-hidden segmented-bar">
                <div className="h-full bg-white rounded-full transition-all duration-700" style={{ width: `${Math.min(data.pklRate, 100)}%` }} />
              </div>
            )}
          </div>
        </div>
        <div className="group relative overflow-hidden rounded-2xl p-4 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all bg-gradient-to-br from-amber-500 to-amber-600 ring-1 ring-amber-100">
          <div className="absolute -right-3 -bottom-3 opacity-15 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6"><AlertTriangle size={56} className="text-white" /></div>
          <div className="relative">
            <p className="text-white/70 text-xs font-medium mb-1">Total Data Belum Lengkap</p>
            <p className="font-heading font-bold text-3xl text-white">{data.totalGaps}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-heading font-semibold text-navy text-sm mb-3">Area Perlu Perhatian</h3>
        {data.dataGaps.length === 0 ? (
          <p className="text-sm text-emerald-600 font-medium text-center py-8">Semua data sudah lengkap ✓</p>
        ) : (
          <div className="space-y-1.5">
            {data.dataGaps.map((g, i) => (
              <Link key={i} href={g.href}
                className="flex items-center gap-2 text-sm group hover:bg-amber-50/60 -mx-1 px-3 py-2 rounded-lg transition-colors">
                <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                <span className="text-gray-600 flex-1 group-hover:text-navy">{g.label}</span>
                <span className="font-bold text-amber-600">{g.count}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
