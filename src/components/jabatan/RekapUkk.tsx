"use client";
import { useEffect, useState } from "react";
import { FileCheck, Loader2, ArrowLeft, Users, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/StatTile";
import EmptyState from "@/components/admin/EmptyState";
import { tautanJabatan, BASE_GURU } from "@/lib/rute-jabatan";

interface StudentRow { studentId: string; nis: string; name: string; className: string; score: number | null }
interface MajorUkk {
  majorId: string; majorName: string; majorCode: string;
  students: StudentRow[]; classAvg: number | null; completedCount: number; totalCount: number;
}
interface Summary { majors: MajorUkk[]; semester: string }

/** Dipakai portal GURU (pemegang tugasnya) dan portal ADMIN (superadmin — akses penuh tanpa
 * dilempar ke shell portal guru, keputusan user 19 September 2026). */
/** Dipakai portal GURU (Kaprogli) dan portal ADMIN (superadmin). Tautannya WAJIB mengikuti portal
 *  pemanggil — menautkan /dashboard/teacher/* dari portal admin membuat sidebarnya nyaris kosong
 *  (CLAUDE.md #45). */
export default function RekapUkk({ basePath = BASE_GURU }: { basePath?: string }) {
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
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader
        icon={<FileCheck size={22} />}
        title={`Rekap UKK — ${major.majorName}`}
        description={`Uji Kompetensi Keahlian kelas XII — Semester ${data.semester}`}
      />
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

      <div className="kisi-kartu kisi-kartu-3 mb-5">
        <StatTile color="primary" icon={Users} label="Total Siswa Kelas XII" value={major.totalCount} />
        <StatTile color="emerald" icon={CheckCircle2} label="Sudah Ada Nilai UKK" value={major.completedCount} />
        <StatTile color="blue" icon={FileCheck} label="Rata-rata UKK Jurusan" value={major.classAvg ?? "—"} />
      </div>

      <div className="alat-aksi justify-end mb-5">
        <Link href={tautanJabatan(basePath, "wakasek/kaprogli")} className="btn-modal-cancel">
          <ArrowLeft size={18} /> Kembali
        </Link>
      </div>

      <div className="panel overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-white">
          <p className="text-sm text-primary-900 font-semibold">Nilai UKK per Siswa</p>
        </div>
        {major.students.length === 0 ? (
          <EmptyState icon={FileCheck} title="Belum Ada Siswa Kelas XII" description="Tidak ada siswa aktif kelas XII di jurusan ini." />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Siswa</th>
                  <th>Kelas</th>
                  <th className="text-center">Nilai UKK</th>
                </tr>
              </thead>
              <tbody>
                {major.students.map(s => (
                  <tr key={s.studentId}>
                    <td>
                      <p className="font-semibold text-primary-900">{s.name}</p>
                      <p className="text-gray-400 text-xs font-mono">{s.nis}</p>
                    </td>
                    <td className="text-gray-600">{s.className}</td>
                    <td className="text-center font-bold text-primary-700">{s.score ?? "—"}</td>
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
