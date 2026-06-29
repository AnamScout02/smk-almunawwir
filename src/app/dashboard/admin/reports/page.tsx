"use client";
import { useState, useEffect } from "react";
import { Download, FileSpreadsheet, ClipboardList, Users, CalendarDays, BookOpen, Loader2, Briefcase } from "lucide-react";

interface ClassItem { id: string; name: string; grade: number }

function generateSemesters(): string[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const current = month >= 7 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
  const prev = month >= 7 ? `${year - 1}/${year}` : `${year - 2}/${year - 1}`;
  return [
    `Ganjil ${prev}`, `Genap ${prev}`,
    `Ganjil ${current}`, `Genap ${current}`,
  ];
}

export default function AdminReportsPage() {
  const [attMonth, setAttMonth] = useState(new Date().toISOString().slice(0, 7));
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [gradeClass, setGradeClass] = useState("");
  const [gradeSemester, setGradeSemester] = useState("");
  const [loadingClasses, setLoadingClasses] = useState(true);

  const SEMESTERS = generateSemesters();

  useEffect(() => {
    fetch("/api/admin/classes")
      .then(r => r.ok ? r.json() : [])
      .then((data: ClassItem[]) => {
        setClasses(Array.isArray(data) ? data.sort((a, b) => a.grade - b.grade || a.name.localeCompare(b.name)) : []);
        setLoadingClasses(false);
      })
      .catch(() => setLoadingClasses(false));
  }, []);

  function gradesUrl() {
    const params = new URLSearchParams();
    if (gradeClass) params.set("classId", gradeClass);
    if (gradeSemester) params.set("semester", gradeSemester);
    return `/api/admin/export/grades?${params}`;
  }

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold text-primary-900">Laporan & Ekspor</h1>
        <p className="text-gray-400 text-sm mt-0.5">Unduh data dalam format CSV untuk diolah di Excel atau Google Sheets</p>
      </div>

      <div className="space-y-4">
        {/* Ekspor Pendaftaran */}
        <div className="bg-white rounded-2xl border shadow-sm p-5 flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
            <ClipboardList size={20} className="text-amber-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-heading font-bold text-primary-900">Data Pendaftaran (PPDB)</h3>
            <p className="text-gray-400 text-sm mt-0.5">Semua data formulir pendaftaran calon siswa baru — nama, asal sekolah, jurusan, status, dan catatan admin.</p>
            <p className="text-xs text-gray-300 mt-1">16 kolom · semua status (Menunggu, Wawancara, Diterima, Ditolak)</p>
          </div>
          <a href="/api/admin/export/admissions"
            className="shrink-0 inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
            <Download size={15} /> CSV
          </a>
        </div>

        {/* Ekspor Siswa */}
        <div className="bg-white rounded-2xl border shadow-sm p-5 flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
            <Users size={20} className="text-emerald-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-heading font-bold text-primary-900">Data Siswa Aktif</h3>
            <p className="text-gray-400 text-sm mt-0.5">Daftar seluruh siswa — NIS, NISN, nama, email, kelas, tingkat, dan jurusan.</p>
            <p className="text-xs text-gray-300 mt-1">9 kolom · diurutkan berdasarkan tingkat kelas</p>
          </div>
          <a href="/api/admin/export/students"
            className="shrink-0 inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
            <Download size={15} /> CSV
          </a>
        </div>

        {/* Ekspor Absensi */}
        <div className="bg-white rounded-2xl border shadow-sm p-5 flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
            <CalendarDays size={20} className="text-blue-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-heading font-bold text-primary-900">Data Absensi</h3>
            <p className="text-gray-400 text-sm mt-0.5">Rekap absensi harian seluruh siswa — tanggal, nama, kelas, dan status kehadiran.</p>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Filter bulan (opsional):</label>
                <input type="month" value={attMonth} onChange={e => setAttMonth(e.target.value)}
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-primary-500 outline-none" />
              </div>
              <button onClick={() => { window.location.href = "/api/admin/export/attendance"; }}
                className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-xl px-3 py-2 transition">
                Semua Bulan
              </button>
            </div>
            <p className="text-xs text-gray-300 mt-2">7 kolom · semua status (Hadir, Izin, Sakit, Alpha)</p>
          </div>
          <a href={`/api/admin/export/attendance?month=${attMonth}`}
            className="shrink-0 self-start inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
            <Download size={15} /> CSV
          </a>
        </div>

        {/* Ekspor Nilai */}
        <div className="bg-white rounded-2xl border shadow-sm p-5 flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
            <BookOpen size={20} className="text-purple-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-heading font-bold text-primary-900">Data Nilai Siswa</h3>
            <p className="text-gray-400 text-sm mt-0.5">Semua nilai per siswa — NIS, nama, kelas, mata pelajaran, tipe nilai, skor, dan guru pengampu.</p>
            {loadingClasses ? (
              <div className="mt-3 flex items-center gap-2 text-gray-400 text-xs">
                <Loader2 size={12} className="animate-spin" /> Memuat daftar kelas...
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Filter kelas (opsional):</label>
                  <select value={gradeClass} onChange={e => setGradeClass(e.target.value)}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-primary-500 outline-none">
                    <option value="">Semua Kelas</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Filter semester (opsional):</label>
                  <select value={gradeSemester} onChange={e => setGradeSemester(e.target.value)}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-primary-500 outline-none">
                    <option value="">Semua Semester</option>
                    {SEMESTERS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            )}
            <p className="text-xs text-gray-300 mt-2">11 kolom · Tugas, Ulangan Harian, UTS, UAS</p>
          </div>
          <a href={gradesUrl()}
            className="shrink-0 self-start inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
            <Download size={15} /> CSV
          </a>
        </div>

        {/* Ekspor PKL */}
        <div className="bg-white rounded-2xl border shadow-sm p-5 flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-rose-50 flex items-center justify-center shrink-0">
            <Briefcase size={20} className="text-rose-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-heading font-bold text-primary-900">Data PKL Siswa</h3>
            <p className="text-gray-400 text-sm mt-0.5">Status PKL seluruh siswa — nama, kelas, perusahaan, posisi, supervisor, dan tanggal PKL.</p>
            <p className="text-xs text-gray-300 mt-1">12 kolom · termasuk siswa yang belum/sudah/sedang PKL</p>
          </div>
          <a href="/api/admin/export/pkl"
            className="shrink-0 inline-flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
            <Download size={15} /> CSV
          </a>
        </div>

        {/* Info */}
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex gap-3">
          <FileSpreadsheet size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-700">
            <p className="font-semibold mb-0.5">Kompatibel dengan Excel</p>
            <p className="text-amber-600">Semua file CSV menggunakan format UTF-8 BOM sehingga karakter Indonesia (huruf beraksara) tampil dengan benar saat dibuka di Microsoft Excel atau Google Sheets.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
