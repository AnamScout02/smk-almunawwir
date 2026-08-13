"use client";
import { useEffect, useState } from "react";
import { FileCheck, Loader2, ArrowLeft, Users, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/StatTile";
import EmptyState from "@/components/admin/EmptyState";

interface StudentRow { studentId: string; nis: string; name: string; className: string; score: number | null }
interface MajorUkk {
  majorId: string; majorName: string; majorCode: string;
  students: StudentRow[]; classAvg: number | null; completedCount: number; totalCount: number;
}
interface Summary { majors: MajorUkk[]; semester: string }

export default function RekapUkkPage() {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeMajor, setActiveMajor] = useState(0);

  useEffect(() => {
    fetch("/api/teacher/wakasek/kaprogli/ukk").then(async r => {
      if (!r.ok) { const d = await r.json(); setError(d.error || "Gagal memuat data"); setLoading(false); return; }
      setData(await r.json());
      setLoading(false);
    }).catch(() => { setError("Gagal memuat data"); setLoading(false); });
  }, []);

  if (loading) return <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh] text-gray-400"><Loader2 size={24} className="animate-spin" /></div>;
  if (error || !data || data.majors.length === 0) return <div className="p-6 lg:p-8 text-center text-gray-400 py-20">{error || "Data tidak tersedia."}</div>;

  const major = data.majors[activeMajor];

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        icon={<FileCheck size={22} />}
        title={`Rekap UKK — ${major.majorName}`}
        description={`Uji Kompetensi Keahlian kelas XII — Semester ${data.semester}`}
      />

      <div className="flex justify-end mb-5">
        <Link href="/dashboard/teacher/wakasek/kaprogli" className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition">
          <ArrowLeft size={18} />
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatTile color="primary" icon={Users} label="Total Siswa Kelas XII" value={major.totalCount} />
        <StatTile color="emerald" icon={CheckCircle2} label="Sudah Ada Nilai UKK" value={major.completedCount} />
        <StatTile color="blue" icon={FileCheck} label="Rata-rata UKK Jurusan" value={major.classAvg ?? "—"} />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3" style={{ background: "linear-gradient(135deg, #0F1A45 0%, #1B2B6B 100%)" }}>
          <p className="text-sm text-white font-semibold">Nilai UKK per Siswa</p>
        </div>
        {major.students.length === 0 ? (
          <EmptyState icon={FileCheck} title="Belum Ada Siswa Kelas XII" description="Tidak ada siswa aktif kelas XII di jurusan ini." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-primary-100" style={{ background: "linear-gradient(135deg, rgba(15,26,69,0.05) 0%, rgba(27,43,107,0.03) 100%)" }}>
                  <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Siswa</th>
                  <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Kelas</th>
                  <th className="text-center px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Nilai UKK</th>
                </tr>
              </thead>
              <tbody>
                {major.students.map(s => (
                  <tr key={s.studentId} className="border-b border-gray-50 last:border-0 hover:bg-primary-50/30 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-primary-900">{s.name}</p>
                      <p className="text-gray-400 text-xs font-mono">{s.nis}</p>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600">{s.className}</td>
                    <td className="px-5 py-3.5 text-center font-bold text-primary-700">{s.score ?? "—"}</td>
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
