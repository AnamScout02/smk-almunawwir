"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Gauge, Loader2, CheckCircle2, Briefcase, TrendingUp, Building2, FileCheck, ChevronRight } from "lucide-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import PageHeader from "@/components/admin/PageHeader";

interface Summary {
  attendancePct: number;
  attendanceTrend: { date: string; pct: number }[];
  pklByStatus: { ONGOING: number; COMPLETED: number; CANCELLED: number };
  topCompanies: { company: string; count: number }[];
  academicByMajor: { major: string; avg: number }[];
  semester: string;
}

const PKL_COLORS: Record<string, string> = { ONGOING: "#2563eb", COMPLETED: "#059669", CANCELLED: "#dc2626" };
const PKL_LABEL: Record<string, string> = { ONGOING: "Sedang PKL", COMPLETED: "Selesai", CANCELLED: "Dibatalkan" };

export default function KepalaSekolahDashboard() {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [pendingRapor, setPendingRapor] = useState<number | null>(null);
  const [mitraAttention, setMitraAttention] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/teacher/kepala-sekolah/summary").then(async r => {
      if (!r.ok) { const d = await r.json(); setError(d.error || "Gagal memuat data"); setLoading(false); return; }
      setData(await r.json());
      setLoading(false);
    });
    fetch("/api/teacher/kepala-sekolah/rapor-approvals").then(r => r.json()).then(d => {
      if (Array.isArray(d)) setPendingRapor(d.filter(r => !r.approved).length);
    }).catch(() => {});
    fetch("/api/teacher/kepala-sekolah/industry-partners").then(r => r.json()).then(d => {
      if (Array.isArray(d)) setMitraAttention(d.filter((p: { status: string }) => p.status === "AKAN_KEDALUWARSA" || p.status === "KEDALUWARSA").length);
    }).catch(() => {});
  }, []);

  if (loading) {
    return <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh] text-gray-400"><Loader2 size={24} className="animate-spin" /></div>;
  }
  if (error || !data) {
    return <div className="p-6 lg:p-8 text-center text-gray-400 py-20">{error || "Data tidak tersedia."}</div>;
  }

  const pklData = (["ONGOING", "COMPLETED", "CANCELLED"] as const).map(k => ({ key: k, name: PKL_LABEL[k], value: data.pklByStatus[k] }));
  const totalPkl = pklData.reduce((a, b) => a + b.value, 0);

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        icon={<Gauge size={22} />}
        title="Dashboard Kepala Sekolah"
        description={`Ringkasan kesehatan sekolah secara real-time — Semester ${data.semester}`}
      />

      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <Link href="/dashboard/teacher/kepala-sekolah/rapor"
          className="group flex items-center gap-4 bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:border-primary-200 hover:shadow-md transition-all">
          <div className="w-12 h-12 rounded-xl bg-primary-50 border border-primary-100 flex items-center justify-center shrink-0">
            <FileCheck size={22} className="text-primary-700" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-heading font-bold text-primary-900">Pengesahan Rapor</p>
            <p className="text-gray-400 text-sm">
              {pendingRapor === null ? "Memuat..." : pendingRapor > 0 ? `${pendingRapor} kelas·semester menunggu pengesahan` : "Semua rapor sudah disahkan"}
            </p>
          </div>
          {pendingRapor !== null && pendingRapor > 0 && (
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 shrink-0">{pendingRapor}</span>
          )}
          <ChevronRight size={18} className="text-gray-300 group-hover:text-primary-500 transition-colors shrink-0" />
        </Link>

        <Link href="/dashboard/teacher/kepala-sekolah/mitra"
          className="group flex items-center gap-4 bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:border-primary-200 hover:shadow-md transition-all">
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
            <Building2 size={22} className="text-blue-700" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-heading font-bold text-primary-900">Peta Kemitraan Industri</p>
            <p className="text-gray-400 text-sm">
              {mitraAttention === null ? "Memuat..." : mitraAttention > 0 ? `${mitraAttention} mitra perlu perhatian (MoU)` : "Semua MoU mitra aktif"}
            </p>
          </div>
          {mitraAttention !== null && mitraAttention > 0 && (
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 shrink-0">{mitraAttention}</span>
          )}
          <ChevronRight size={18} className="text-gray-300 group-hover:text-primary-500 transition-colors shrink-0" />
        </Link>
      </div>

      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <div className="group relative overflow-hidden rounded-2xl p-4 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all bg-gradient-to-br from-emerald-500 to-emerald-600 ring-1 ring-emerald-100">
          <div className="absolute -right-3 -bottom-3 opacity-15 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6"><CheckCircle2 size={56} className="text-white" /></div>
          <div className="relative">
            <p className="text-white/70 text-xs font-medium mb-1">Kehadiran Siswa (30 hari)</p>
            <p className="font-heading font-bold text-3xl text-white">{data.attendancePct}%</p>
            <div className="mt-2 h-1.5 bg-white/25 rounded-full overflow-hidden segmented-bar">
              <div className="h-full bg-white rounded-full transition-all duration-700" style={{ width: `${Math.min(data.attendancePct, 100)}%` }} />
            </div>
          </div>
        </div>
        <div className="group relative overflow-hidden rounded-2xl p-4 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all bg-gradient-to-br from-blue-500 to-blue-600 ring-1 ring-blue-100">
          <div className="absolute -right-3 -bottom-3 opacity-15 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6"><Briefcase size={56} className="text-white" /></div>
          <div className="relative">
            <p className="text-white/70 text-xs font-medium mb-1">Siswa Sedang PKL</p>
            <p className="font-heading font-bold text-3xl text-white">{data.pklByStatus.ONGOING}</p>
          </div>
        </div>
        <div className="group relative overflow-hidden rounded-2xl p-4 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all bg-gradient-to-br from-primary-500 to-primary-700 ring-1 ring-primary-100">
          <div className="absolute -right-3 -bottom-3 opacity-15 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6"><TrendingUp size={56} className="text-white" /></div>
          <div className="relative">
            <p className="text-white/70 text-xs font-medium mb-1">Rata-rata Nilai Tertinggi</p>
            <p className="font-heading font-bold text-3xl text-white">
              {data.academicByMajor[0] ? `${data.academicByMajor[0].avg}` : "—"}
            </p>
            {data.academicByMajor[0] && <p className="text-xs text-white/80 mt-0.5">{data.academicByMajor[0].major}</p>}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5 mb-5">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-heading font-semibold text-navy text-sm mb-3">Tren Kehadiran Siswa</h3>
          {data.attendanceTrend.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">Belum ada data absensi 30 hari terakhir.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.attendanceTrend} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={{ stroke: "#e5e7eb" }} tickLine={false}
                  tickFormatter={d => new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit" })} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => [`${v}%`, "Kehadiran"]} labelFormatter={d => new Date(d as string).toLocaleDateString("id-ID", { day: "numeric", month: "long" })} />
                <Bar dataKey="pct" radius={[6, 6, 0, 0]} maxBarSize={28} fill="#059669" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-heading font-semibold text-navy text-sm mb-3">Status PKL Siswa</h3>
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

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-heading font-semibold text-navy text-sm mb-3">Rata-rata Nilai per Jurusan — {data.semester}</h3>
          {data.academicByMajor.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">Belum ada nilai tercatat semester ini.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.academicByMajor} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="major" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={{ stroke: "#e5e7eb" }} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => [v, "Rata-rata"]} />
                <Bar dataKey="avg" radius={[6, 6, 0, 0]} maxBarSize={44} fill="#1B2B6B" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-heading font-semibold text-navy text-sm mb-3 flex items-center gap-1.5">
            <Building2 size={14} className="text-primary-700" /> Perusahaan Mitra PKL Terbanyak
          </h3>
          {data.topCompanies.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">Belum ada data perusahaan PKL.</p>
          ) : (
            <div className="space-y-2">
              {data.topCompanies.map(c => (
                <div key={c.company} className="flex items-center justify-between text-sm border-b border-gray-50 last:border-0 pb-2 last:pb-0">
                  <span className="text-gray-700 truncate">{c.company}</span>
                  <span className="font-bold text-primary-900 shrink-0 ml-2">{c.count} siswa</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <p className="text-xs text-gray-400 mt-6 text-center">
        Iterasi pertama — data kehadiran guru, MoU kemitraan DU/DI, tracer study/BKK, kelulusan UKK, dan inventaris aset belum tersedia di sistem.
      </p>
    </div>
  );
}
