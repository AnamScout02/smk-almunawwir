"use client";
import { useEffect, useState } from "react";
import { UserCheck, Loader2, Users, Briefcase, AlertTriangle } from "lucide-react";
import Link from "next/link";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";

interface Company { company: string; count: number }
interface UnplacedRow { studentId: string; nis: string; name: string; className: string }
interface Summary {
  totalTwelve: number; placedCount: number; unplacedCount: number;
  statusCount: { ONGOING: number; COMPLETED: number; CANCELLED: number };
  topCompanies: Company[]; unplacedList: UnplacedRow[];
}

export default function BkkDashboard() {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/teacher/bkk/summary").then(async r => {
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
        icon={<UserCheck size={22} />}
        title="Dashboard BKK"
        description="Bursa Kerja Khusus — pemantauan penempatan PKL siswa kelas XII"
        actions={
          <Link href="/dashboard/teacher/bkk/tracer-study"
            className="inline-flex items-center gap-2 bg-gold hover:bg-gold/90 text-primary-900 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap">
            <UserCheck size={15} /> Tracer Study
          </Link>
        }
      />

      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <div className="group relative overflow-hidden rounded-2xl p-4 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all bg-gradient-to-br from-primary-500 to-primary-700 ring-1 ring-primary-100">
          <div className="absolute -right-3 -bottom-3 opacity-15 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6"><Users size={56} className="text-white" /></div>
          <div className="relative">
            <p className="text-white/70 text-xs font-medium mb-1">Total Siswa Kelas XII</p>
            <p className="font-heading font-bold text-3xl text-white">{data.totalTwelve}</p>
          </div>
        </div>
        <div className="group relative overflow-hidden rounded-2xl p-4 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all bg-gradient-to-br from-emerald-500 to-emerald-600 ring-1 ring-emerald-100">
          <div className="absolute -right-3 -bottom-3 opacity-15 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6"><Briefcase size={56} className="text-white" /></div>
          <div className="relative">
            <p className="text-white/70 text-xs font-medium mb-1">Sudah PKL</p>
            <p className="font-heading font-bold text-3xl text-white">{data.placedCount}</p>
          </div>
        </div>
        <div className="group relative overflow-hidden rounded-2xl p-4 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all bg-gradient-to-br from-red-500 to-red-600 ring-1 ring-red-100">
          <div className="absolute -right-3 -bottom-3 opacity-15 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6"><AlertTriangle size={56} className="text-white" /></div>
          <div className="relative">
            <p className="text-white/70 text-xs font-medium mb-1">Belum PKL</p>
            <p className="font-heading font-bold text-3xl text-white">{data.unplacedCount}</p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-heading font-semibold text-navy text-sm mb-3">Perusahaan Mitra Teratas</h3>
          {data.topCompanies.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">Belum ada data penempatan PKL.</p>
          ) : (
            <div className="space-y-2">
              {data.topCompanies.map((c, i) => (
                <div key={i} className="flex items-center justify-between text-sm border-b border-gray-50 last:border-0 pb-2 last:pb-0">
                  <span className="text-primary-900 font-medium truncate">{c.company}</span>
                  <span className="font-bold text-primary-700 shrink-0 ml-2">{c.count} siswa</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 flex items-center justify-between" style={{ background: "linear-gradient(135deg, #0F1A45 0%, #1B2B6B 100%)" }}>
            <p className="text-sm text-white font-semibold">Belum Ditempatkan PKL</p>
            <span className="text-xs text-gold font-bold">{data.unplacedList.length} siswa</span>
          </div>
          {data.unplacedList.length === 0 ? (
            <EmptyState icon={UserCheck} title="Semua Sudah Ditempatkan" description="Seluruh siswa kelas XII sudah memiliki data PKL." />
          ) : (
            <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
              {data.unplacedList.map(s => (
                <div key={s.studentId} className="px-5 py-3 text-sm">
                  <p className="font-semibold text-primary-900">{s.name}</p>
                  <p className="text-gray-400 text-xs">{s.className} · {s.nis}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
