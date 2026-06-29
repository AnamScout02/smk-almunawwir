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
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
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
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-primary-500 outline-none">
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 size={22} className="animate-spin mr-2" /> Memuat data...
        </div>
      ) : !data || data.students.length === 0 ? (
        <div className="bg-white rounded-2xl border p-12 text-center text-gray-400">
          <p>Tidak ada data absensi untuk kelas ini.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b flex items-center justify-between">
            <p className="text-sm text-gray-500 font-medium">{data.students.length} siswa · total {data.students[0]?.total ?? 0} hari tercatat</p>
            <div className="flex gap-3 text-xs font-semibold">
              <span className="text-emerald-600">Hadir</span>
              <span className="text-blue-600">Izin</span>
              <span className="text-amber-600">Sakit</span>
              <span className="text-red-500">Alpha</span>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead className="border-b bg-gray-50/50">
              <tr>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">#</th>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">Nama Siswa</th>
                <th className="text-center px-4 py-3 text-emerald-600 font-medium">H</th>
                <th className="text-center px-4 py-3 text-blue-600 font-medium">I</th>
                <th className="text-center px-4 py-3 text-amber-600 font-medium">S</th>
                <th className="text-center px-4 py-3 text-red-500 font-medium">A</th>
                <th className="text-center px-5 py-3 text-gray-500 font-medium">%</th>
                <th className="text-center px-5 py-3 text-gray-500 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.students.map((s, i) => (
                <tr key={s.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-5 py-3 text-gray-400 text-xs">{i + 1}</td>
                  <td className="px-5 py-3">
                    <p className="font-semibold text-primary-900">{s.name}</p>
                    <p className="text-gray-400 text-xs font-mono">{s.nis}</p>
                  </td>
                  <td className="px-4 py-3 text-center font-bold text-emerald-600">{s.HADIR}</td>
                  <td className="px-4 py-3 text-center font-bold text-blue-600">{s.IZIN}</td>
                  <td className="px-4 py-3 text-center font-bold text-amber-600">{s.SAKIT}</td>
                  <td className="px-4 py-3 text-center font-bold text-red-500">{s.ALPHA}</td>
                  <td className="px-5 py-3 text-center">
                    <span className={`font-bold ${s.pct >= 80 ? "text-emerald-600" : s.pct >= 70 ? "text-amber-600" : "text-red-500"}`}>
                      {s.pct}%
                    </span>
                  </td>
                  <td className="px-5 py-3 text-center">
                    {s.pct >= 80 ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-semibold">
                        <CheckCircle2 size={12} /> Baik
                      </span>
                    ) : s.pct >= 70 ? (
                      <span className="text-xs text-amber-600 font-semibold">Perhatikan</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-red-500 font-semibold">
                        <AlertTriangle size={12} /> Rendah
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
