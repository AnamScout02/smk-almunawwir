"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";

interface StudentSummary {
  id: string;
  nis: string;
  name: string;
  total: number;
  HADIR: number;
  IZIN: number;
  SAKIT: number;
  ALPHA: number;
  pct: number;
}

interface SummaryData {
  classId: string;
  students: StudentSummary[];
}

export default function AttendanceSummaryPage() {
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>("");

  useEffect(() => {
    fetch("/api/teacher/classes")
      .then(r => r.json())
      .then(cls => {
        if (Array.isArray(cls) && cls.length > 0) {
          setClasses(cls.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })));
          setSelectedClass(cls[0].id);
        } else {
          setLoading(false);
        }
      });
  }, []);

  useEffect(() => {
    if (!selectedClass) return;
    setLoading(true);
    fetch(`/api/teacher/attendance/summary?classId=${selectedClass}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); });
  }, [selectedClass]);

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/teacher/attendance" className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="font-heading text-2xl font-bold text-primary-900">Rekap Absensi per Siswa</h1>
          <p className="text-gray-400 text-sm mt-0.5">Total kehadiran masing-masing siswa dari semua catatan absensi</p>
        </div>
      </div>

      {classes.length > 1 && (
        <div className="mb-4 flex items-center gap-3">
          <label className="text-sm font-semibold text-gray-600">Kelas:</label>
          <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}
            className="input-field w-auto">
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 size={22} className="animate-spin mr-2" /> Memuat data...
        </div>
      ) : !data || data.students.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400">
          <p>Tidak ada data absensi untuk kelas ini.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 flex items-center justify-between"
            style={{ background: "linear-gradient(135deg, #0F1A45 0%, #1B2B6B 100%)" }}>
            <p className="text-sm text-white font-semibold">{data.students.length} siswa · {data.students[0]?.total ?? 0} hari tercatat</p>
            <div className="flex gap-3 text-xs font-semibold">
              <span className="text-emerald-300">Hadir</span>
              <span className="text-blue-300">Izin</span>
              <span className="text-amber-300">Sakit</span>
              <span className="text-red-300">Alpha</span>
            </div>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Nama Siswa</th>
                <th className="text-center">H</th>
                <th className="text-center">I</th>
                <th className="text-center">S</th>
                <th className="text-center">A</th>
                <th className="text-center">%</th>
                <th className="text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.students.map((s, i) => (
                <tr key={s.id}>
                  <td className="text-gray-400 text-xs">{i + 1}</td>
                  <td>
                    <p className="font-semibold text-primary-900">{s.name}</p>
                    <p className="text-gray-400 text-xs font-mono">{s.nis}</p>
                  </td>
                  <td className="text-center font-bold text-emerald-600">{s.HADIR}</td>
                  <td className="text-center font-bold text-blue-600">{s.IZIN}</td>
                  <td className="text-center font-bold text-amber-600">{s.SAKIT}</td>
                  <td className="text-center font-bold text-red-500">{s.ALPHA}</td>
                  <td className="text-center">
                    <span className={`font-bold ${s.pct >= 80 ? "text-emerald-600" : s.pct >= 70 ? "text-amber-600" : "text-red-500"}`}>
                      {s.pct}%
                    </span>
                  </td>
                  <td className="text-center">
                    {s.pct >= 80 ? (
                      <span className="inline-flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold">
                        <CheckCircle2 size={11} /> Baik
                      </span>
                    ) : s.pct >= 70 ? (
                      <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-semibold">Perhatikan</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-full font-semibold">
                        <AlertTriangle size={11} /> Rendah
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
