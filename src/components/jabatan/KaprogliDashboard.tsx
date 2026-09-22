"use client";
import { useEffect, useState } from "react";
import { Award, Loader2, Users, TrendingUp, CheckCircle2, FileCheck, Briefcase } from "lucide-react";
import EmptyState from "@/components/admin/EmptyState";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import Link from "next/link";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/StatTile";

interface ClassStat { className: string; avg: number | null; attPct: number | null; studentCount: number }
interface MajorSummary {
  majorId: string; majorName: string; majorCode: string;
  classStats: ClassStat[]; pklByStatus: { ONGOING: number; COMPLETED: number; CANCELLED: number };
  totalStudents: number;
}
interface Summary { majors: MajorSummary[]; semester: string }

const PKL_COLORS: Record<string, string> = { ONGOING: "#2563eb", COMPLETED: "#059669", CANCELLED: "#dc2626" };
const PKL_LABEL: Record<string, string> = { ONGOING: "Sedang PKL", COMPLETED: "Selesai", CANCELLED: "Dibatalkan" };

/** Dipakai portal GURU (pemegang jabatannya) dan portal ADMIN (superadmin, lewat grup menu
 * "Dashboard Jabatan") — keputusan user 19 September 2026: "superadmin sifatnya full akses ke
 * semuanya ... karena si superadmin bukan pegawai dan bukan guru di situ", jadi ia tidak boleh
 * dilempar ke shell portal guru untuk melihat dashboard ini. */
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
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader
        icon={<Award size={22} />}
        title={`Dashboard Kaprogli — ${major.majorName}`}
        description={`Ringkasan capaian jurusan — Semester ${data.semester}`}
      />

      <div className="alat-aksi justify-end mb-5">
        <Link href="/dashboard/teacher/wakasek/kaprogli/ukk"
          className="btn-modal-cancel btn-teks">
          <FileCheck size={15} /> Rekap UKK
        </Link>
      </div>

      {data.majors.length > 1 && (
        <div className="flex items-center gap-2 mb-5">
          {data.majors.map((m, i) => (
            <button key={m.majorId} onClick={() => setActiveMajor(i)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${i === activeMajor ? "bg-primary-700 text-white" : "bg-white text-gray-500 border border-gray-200 hover:border-primary-100"}`}>
              {m.majorCode}
            </button>
          ))}
        </div>
      )}

      <div className="kisi-kartu kisi-kartu-3 mb-6">
        <StatTile color="primary" icon={Users} label="Total Siswa Aktif" value={major.totalStudents} />
        <StatTile color="emerald" icon={TrendingUp} label="Rata-rata Nilai Jurusan"
          value={major.classStats.some(c => c.avg !== null)
            ? Math.round((major.classStats.filter(c => c.avg !== null).reduce((a, c) => a + (c.avg ?? 0), 0) / major.classStats.filter(c => c.avg !== null).length) * 10) / 10
            : "—"} />
        <StatTile color="blue" icon={CheckCircle2} label="Siswa Sedang PKL" value={major.pklByStatus.ONGOING} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="panel p-5">
          <h3 className="font-heading font-semibold text-navy text-sm mb-3">Nilai & Kehadiran per Kelas</h3>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Kelas</th>
                  <th className="text-center">Siswa</th>
                  <th className="text-center">Rata Nilai</th>
                  <th className="text-center">Kehadiran</th>
                </tr>
              </thead>
              <tbody>
                {major.classStats.map(c => (
                  <tr key={c.className}>
                    <td className="py-2.5 font-semibold text-primary-900">{c.className}</td>
                    <td className="py-2.5 text-center text-gray-500">{c.studentCount}</td>
                    <td className="py-2.5 text-center font-bold text-primary-700">{c.avg ?? "—"}</td>
                    <td className="py-2.5 text-center font-bold text-emerald-600">{c.attPct !== null ? `${c.attPct}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel p-5">
          <h3 className="font-heading font-semibold text-navy text-sm mb-3">Status PKL Jurusan</h3>
          {totalPkl === 0 ? (
            <EmptyState icon={Briefcase} title="Belum Ada Data PKL" />
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
