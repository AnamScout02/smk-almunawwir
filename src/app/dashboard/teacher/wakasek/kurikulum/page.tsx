"use client";
import { useEffect, useState } from "react";
import { GraduationCap, Loader2, AlertTriangle, BookOpen, School } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";

interface Summary {
  missingJournal: { teacherName: string; className: string; subject: string }[];
  avgBySubject: { subject: string; avg: number }[];
  schoolAvg: number | null;
  classesWithoutSchedule: { id: string; name: string; grade: number }[];
  totalAssignments: number;
  semester: string;
}

export default function WakasekKurikulumDashboard() {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/teacher/wakasek/kurikulum/summary").then(async r => {
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
        icon={<GraduationCap size={22} />}
        title="Dashboard Kurikulum"
        description={`Pemantauan kelengkapan jurnal, jadwal, dan capaian akademik — Semester ${data.semester}`}
      />

      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <div className="group relative overflow-hidden rounded-2xl p-4 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all bg-gradient-to-br from-amber-500 to-amber-600 ring-1 ring-amber-100">
          <div className="absolute -right-3 -bottom-3 opacity-15 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6"><AlertTriangle size={56} className="text-white" /></div>
          <div className="relative">
            <p className="text-white/70 text-xs font-medium mb-1">Belum Isi Jurnal (7 hari)</p>
            <p className="font-heading font-bold text-3xl text-white">{data.missingJournal.length}</p>
          </div>
        </div>
        <div className="group relative overflow-hidden rounded-2xl p-4 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all bg-gradient-to-br from-primary-500 to-primary-700 ring-1 ring-primary-100">
          <div className="absolute -right-3 -bottom-3 opacity-15 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6"><BookOpen size={56} className="text-white" /></div>
          <div className="relative">
            <p className="text-white/70 text-xs font-medium mb-1">Rata-rata Nilai Sekolah</p>
            <p className="font-heading font-bold text-3xl text-white">{data.schoolAvg ?? "—"}</p>
          </div>
        </div>
        <div className="group relative overflow-hidden rounded-2xl p-4 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all bg-gradient-to-br from-red-500 to-red-600 ring-1 ring-red-100">
          <div className="absolute -right-3 -bottom-3 opacity-15 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6"><School size={56} className="text-white" /></div>
          <div className="relative">
            <p className="text-white/70 text-xs font-medium mb-1">Kelas Tanpa Jadwal</p>
            <p className="font-heading font-bold text-3xl text-white">{data.classesWithoutSchedule.length}</p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-heading font-semibold text-navy text-sm mb-3">Rata-rata Nilai per Mata Pelajaran</h3>
          {data.avgBySubject.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">Belum ada nilai tercatat semester ini.</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(220, data.avgBySubject.length * 28)}>
              <BarChart data={data.avgBySubject} layout="vertical" margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="subject" width={140} tick={{ fontSize: 11, fill: "#374151" }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => [v, "Rata-rata"]} />
                <Bar dataKey="avg" radius={[0, 6, 6, 0]} fill="#1B2B6B" maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-heading font-semibold text-navy text-sm mb-3">Guru Belum Isi Jurnal (7 hari terakhir)</h3>
          {data.missingJournal.length === 0 ? (
            <EmptyState icon={AlertTriangle} title="Semua Sudah Lengkap" description="Tidak ada guru yang tertunda mengisi jurnal mengajar." />
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {data.missingJournal.map((m, i) => (
                <div key={i} className="flex items-center justify-between text-sm border-b border-gray-50 last:border-0 pb-2 last:pb-0">
                  <div className="min-w-0">
                    <p className="font-semibold text-primary-900 truncate">{m.teacherName}</p>
                    <p className="text-gray-400 text-xs">{m.className} · {m.subject}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {data.classesWithoutSchedule.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mt-5">
          <h3 className="font-heading font-semibold text-navy text-sm mb-3">Kelas Tanpa Jadwal Sama Sekali</h3>
          <div className="flex flex-wrap gap-2">
            {data.classesWithoutSchedule.map(c => (
              <span key={c.id} className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-2.5 py-1 rounded-full">{c.name}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
