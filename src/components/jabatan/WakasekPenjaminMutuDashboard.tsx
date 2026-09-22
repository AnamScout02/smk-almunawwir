"use client";
import { useEffect, useState } from "react";
import { BadgeCheck, Loader2, BookOpen, CalendarCheck, Briefcase, AlertTriangle } from "lucide-react";
import Link from "next/link";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/StatTile";
import AnimatedBar from "@/components/shared/AnimatedBar";

interface DataGap { label: string; count: number; href: string }
interface Summary {
  schoolAvg: number | null; attendanceRate: number | null; pklRate: number | null;
  totalGaps: number; dataGaps: DataGap[]; semester: string;
}

/** Dipakai portal GURU (pemegang jabatannya) dan portal ADMIN (superadmin, lewat grup menu
 * "Dashboard Jabatan") — keputusan user 19 September 2026: "superadmin sifatnya full akses ke
 * semuanya ... karena si superadmin bukan pegawai dan bukan guru di situ", jadi ia tidak boleh
 * dilempar ke shell portal guru untuk melihat dashboard ini. */
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
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader
        icon={<BadgeCheck size={22} />}
        title="Dashboard Penjamin Mutu"
        description={`Ringkasan KPI lintas-bidang sekolah — Semester ${data.semester}`}
      />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <StatTile color="primary" icon={BookOpen} label="Rata-rata Nilai Sekolah" value={data.schoolAvg ?? "—"} />
        <StatTile color="blue" icon={CalendarCheck} label="Kehadiran Sekolah (30 hari)"
          value={data.attendanceRate !== null ? `${data.attendanceRate}%` : "—"}>
          {data.attendanceRate !== null && <AnimatedBar pct={data.attendanceRate} className="mt-2" />}
        </StatTile>
        <StatTile color="emerald" icon={Briefcase} label="Penempatan PKL Kelas XII"
          value={data.pklRate !== null ? `${data.pklRate}%` : "—"}>
          {data.pklRate !== null && <AnimatedBar pct={data.pklRate} className="mt-2" />}
        </StatTile>
        <StatTile color="amber" icon={AlertTriangle} label="Total Data Belum Lengkap" value={data.totalGaps} />
      </div>

      <div className="panel p-5">
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
