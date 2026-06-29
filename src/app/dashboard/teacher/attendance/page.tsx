"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckSquare, ChevronRight, Users, Calendar, Loader2, BarChart2, Download } from "lucide-react";

interface ClassInfo {
  id: string;
  name: string;
  grade: number;
  major: { name: string; code: string };
  students: { id: string }[];
}

interface AttendanceRecord {
  id: string;
  date: string;
  status: string;
  student: { id: string; nis: string; user: { name: string }; class: { name: string } | null };
}

const STATUS_COLOR: Record<string, string> = {
  HADIR: "bg-emerald-100 text-emerald-700",
  IZIN:  "bg-blue-100 text-blue-700",
  SAKIT: "bg-amber-100 text-amber-700",
  ALPHA: "bg-red-100 text-red-600",
};

export default function AttendancePage() {
  const today = new Date().toISOString().split("T")[0];
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>("ALL");
  const [date, setDate] = useState(today);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingRecords, setLoadingRecords] = useState(false);

  useEffect(() => {
    fetch("/api/teacher/classes")
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setClasses(data);
        setLoadingClasses(false);
      });
  }, []);

  useEffect(() => {
    setLoadingRecords(true);
    const params = new URLSearchParams({ date });
    if (selectedClass !== "ALL") params.set("classId", selectedClass);
    fetch(`/api/teacher/attendance?${params}`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setRecords(data);
        setLoadingRecords(false);
      });
  }, [date, selectedClass]);

  const summary = ["HADIR", "IZIN", "SAKIT", "ALPHA"].map(s => ({
    status: s,
    count: records.filter(r => r.status === s).length,
  }));

  const totalStudents = selectedClass === "ALL"
    ? classes.reduce((acc, c) => acc + c.students.length, 0)
    : classes.find(c => c.id === selectedClass)?.students.length ?? 0;

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-primary-900">Absensi Siswa</h1>
          <p className="text-gray-500 text-sm mt-1">Pilih kelas untuk input absensi, atau lihat rekap per tanggal.</p>
        </div>
        <Link href="/dashboard/teacher/attendance/summary"
          className="shrink-0 inline-flex items-center gap-2 border border-primary-200 text-primary-700 hover:bg-primary-50 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
          <BarChart2 size={15} />
          Rekap per Siswa
        </Link>
      </div>

      {/* Kelas wali — akses cepat input */}
      <div className="mb-8">
        <h2 className="font-heading font-semibold text-lg text-primary-800 mb-4">Input Absensi per Kelas</h2>
        {loadingClasses ? (
          <div className="flex items-center justify-center py-10 text-gray-400">
            <Loader2 size={20} className="animate-spin mr-2" /> Memuat kelas...
          </div>
        ) : classes.length ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {classes.map((cls) => (
              <Link key={cls.id} href={`/dashboard/teacher/attendance/${cls.id}`}
                className="group bg-white rounded-2xl border shadow-sm p-5 hover:border-primary-300 hover:shadow-md transition-all flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                  <CheckSquare size={20} className="text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-heading font-bold text-primary-900">{cls.name}</p>
                  <p className="text-gray-400 text-xs truncate">{cls.major.name}</p>
                  <p className="text-gray-500 text-xs mt-0.5 flex items-center gap-1">
                    <Users size={11} /> {cls.students.length} siswa
                  </p>
                </div>
                <ChevronRight size={18} className="text-gray-300 group-hover:text-emerald-500 transition-colors shrink-0" />
              </Link>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border p-8 text-center text-gray-400 text-sm">
            Anda belum menjadi wali kelas manapun.
          </div>
        )}
      </div>

      {/* Rekap absensi per tanggal */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading font-semibold text-lg text-primary-800">
            <Calendar size={18} className="inline mr-2 text-primary-700" />
            Rekap Absensi per Tanggal
          </h2>
          <a href={`/api/teacher/export/attendance?month=${date.slice(0, 7)}${selectedClass !== "ALL" ? `&classId=${selectedClass}` : ""}`}
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-colors">
            <Download size={13} /> Export Bulan Ini
          </a>
        </div>

        <div className="bg-white rounded-2xl border shadow-sm p-4 mb-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center flex-wrap">
          <div className="flex items-center gap-3">
            <label className="text-sm font-semibold text-gray-600 whitespace-nowrap">Tanggal:</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-primary-500 outline-none" />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm font-semibold text-gray-600">Kelas:</label>
            <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-primary-500 outline-none">
              <option value="ALL">Semua Kelas</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex gap-2 flex-wrap sm:ml-auto">
            {summary.map(s => (
              <span key={s.status} className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_COLOR[s.status]}`}>
                {s.status}: {s.count}
              </span>
            ))}
            {totalStudents > 0 && records.length === 0 && !loadingRecords && (
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
                Belum diisi ({totalStudents} siswa)
              </span>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
          {loadingRecords ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <Loader2 size={20} className="animate-spin mr-2" /> Memuat data...
            </div>
          ) : records.length === 0 ? (
            <div className="py-16 text-center text-gray-400">
              <CheckSquare size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Tidak ada data absensi untuk tanggal ini.</p>
              <p className="text-xs mt-1 text-gray-300">Input absensi melalui halaman kelas di atas.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-5 py-3 text-gray-500 font-medium w-8">#</th>
                  <th className="text-left px-5 py-3 text-gray-500 font-medium">Nama Siswa</th>
                  <th className="text-left px-5 py-3 text-gray-500 font-medium">Kelas</th>
                  <th className="text-center px-5 py-3 text-gray-500 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r, i) => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-5 py-3 text-gray-400 text-xs">{i + 1}</td>
                    <td className="px-5 py-3 font-medium text-primary-900">{r.student.user.name}</td>
                    <td className="px-5 py-3 text-gray-500 text-xs">{r.student.class?.name ?? "—"}</td>
                    <td className="px-5 py-3 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_COLOR[r.status] ?? "bg-gray-100 text-gray-500"}`}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
