"use client";
import { useState, useEffect } from "react";
import { Download, FileSpreadsheet, ClipboardList, Users, CalendarDays, BookOpen, Loader2, Briefcase, BarChart2, Calendar } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import Alert from "@/components/admin/Alert";
import MonthPicker from "@/components/shared/MonthPicker";

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
  const [scheduleClass, setScheduleClass] = useState("");
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

  function scheduleUrl() {
    const params = new URLSearchParams();
    if (scheduleClass) params.set("classId", scheduleClass);
    return `/api/admin/export/schedules?${params}`;
  }

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader
        icon={<BarChart2 size={22} />}
        title="Laporan & Ekspor"
        description="Unduh data sebagai berkas Excel (.xlsx) — langsung rapi per kolom, siap diolah"
      />

      <div className="space-y-4">
        {/* Rekapitulasi Jumlah Siswa */}
        <div className="panel p-5 flex items-start gap-4 hover:shadow-md hover:-translate-y-0.5 transition-all">
          <div className="w-11 h-11 rounded-xl bg-primary-50 border border-primary-100 flex items-center justify-center shrink-0">
            <BarChart2 size={20} className="text-primary-700" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-heading font-bold text-primary-900">Rekapitulasi Jumlah Siswa</h3>
            <p className="text-gray-400 text-sm mt-0.5">Jumlah rombel dan peserta didik menurut jenis kelamin, per jurusan dan tingkat — siap cetak.</p>
          </div>
          <a href="/dashboard/admin/reports/rekap-siswa"
            className="btn-modal-cancel shrink-0">
            Lihat
          </a>
        </div>

        {/* Ekspor Pendaftaran */}
        <div className="panel p-5 flex items-start gap-4 hover:shadow-md hover:-translate-y-0.5 transition-all">
          <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0">
            <ClipboardList size={20} className="text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-heading font-bold text-primary-900">Data Pendaftaran (SPMB)</h3>
            <p className="text-gray-400 text-sm mt-0.5">Semua data formulir pendaftaran calon siswa baru — nama, asal sekolah, jurusan, status, dan catatan admin.</p>
            <p className="text-xs text-gray-300 mt-1">16 kolom · semua status (Menunggu, Wawancara, Diterima, Ditolak)</p>
          </div>
          <a href="/api/admin/export/admissions"
            className="shrink-0 inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
            <Download size={15} /> Excel
          </a>
        </div>

        {/* Ekspor Siswa */}
        <div className="panel p-5 flex items-start gap-4 hover:shadow-md hover:-translate-y-0.5 transition-all">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
            <Users size={20} className="text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-heading font-bold text-primary-900">Data Siswa Aktif</h3>
            <p className="text-gray-400 text-sm mt-0.5">Daftar seluruh siswa — NIS, NISN, nama, email, kelas, tingkat, dan jurusan.</p>
            <p className="text-xs text-gray-300 mt-1">9 kolom · diurutkan berdasarkan tingkat kelas</p>
          </div>
          <a href="/api/admin/export/students"
            className="btn-modal-cancel shrink-0">
            <Download size={15} /> Excel
          </a>
        </div>

        {/* Ekspor Absensi */}
        <div className="panel p-5 flex items-start gap-4 hover:shadow-md hover:-translate-y-0.5 transition-all">
          <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
            <CalendarDays size={20} className="text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-heading font-bold text-primary-900">Data Absensi</h3>
            <p className="text-gray-400 text-sm mt-0.5">Rekap absensi harian seluruh siswa — tanggal, nama, kelas, dan status kehadiran.</p>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <div>
                <label className="label-field">Filter bulan (opsional):</label>
                <MonthPicker value={attMonth} onChange={setAttMonth} />
              </div>
              <button onClick={() => { window.location.href = "/api/admin/export/attendance"; }}
                className="text-xs text-gray-500 hover:text-primary-700 border border-gray-200 hover:border-primary-100 rounded-xl px-3 py-2 transition-colors">
                Semua Bulan
              </button>
            </div>
            <p className="text-xs text-gray-300 mt-2">7 kolom · semua status (Hadir, Izin, Sakit, Alpha)</p>
          </div>
          <a href={`/api/admin/export/attendance?month=${attMonth}`}
            className="btn-modal-cancel shrink-0 self-start">
            <Download size={15} /> Excel
          </a>
        </div>

        {/* Ekspor Nilai */}
        <div className="panel p-5 flex items-start gap-4 hover:shadow-md hover:-translate-y-0.5 transition-all">
          <div className="w-11 h-11 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center shrink-0">
            <BookOpen size={20} className="text-purple-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-heading font-bold text-primary-900">Data Nilai Siswa</h3>
            <p className="text-gray-400 text-sm mt-0.5">Semua nilai per siswa — NIS, nama, kelas, mata pelajaran, tipe nilai, skor, dan guru pengampu.</p>
            {loadingClasses ? (
              <div className="mt-3 flex items-center gap-2 text-gray-400 text-xs">
                <Loader2 size={12} className="animate-spin" /> Memuat daftar kelas...
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap gap-3">
                <div>
                  <label className="label-field">Filter kelas (opsional):</label>
                  <Select
                    className="w-auto"
                    value={gradeClass}
                    onChange={v => setGradeClass(v)}
                    options={[{ value: "", label: "Semua Kelas" }, ...classes.map(c => ({ value: c.id, label: c.name }))]}
                  />
                </div>
                <div>
                  <label className="label-field">Filter semester (opsional):</label>
                  <Select
                    className="w-auto"
                    value={gradeSemester}
                    onChange={v => setGradeSemester(v)}
                    options={[{ value: "", label: "Semua Semester" }, ...SEMESTERS.map(s => ({ value: s, label: s }))]}
                  />
                </div>
              </div>
            )}
            <p className="text-xs text-gray-300 mt-2">11 kolom · Tugas, Ulangan Harian, UTS, UAS</p>
          </div>
          <a href={gradesUrl()}
            className="shrink-0 self-start inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
            <Download size={15} /> Excel
          </a>
        </div>

        {/* Ekspor Jadwal Pelajaran */}
        <div className="panel p-5 flex items-start gap-4 hover:shadow-md hover:-translate-y-0.5 transition-all">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
            <Calendar size={20} className="text-indigo-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-heading font-bold text-primary-900">Data Jadwal Pelajaran</h3>
            <p className="text-gray-400 text-sm mt-0.5">Jadwal mengajar seluruh kelas — hari, jam, mata pelajaran, guru pengampu, dan ruang.</p>
            {loadingClasses ? (
              <div className="mt-3 flex items-center gap-2 text-gray-400 text-xs">
                <Loader2 size={12} className="animate-spin" /> Memuat daftar kelas...
              </div>
            ) : (
              <div className="mt-3">
                <label className="label-field">Filter kelas (opsional):</label>
                <Select
                  className="w-auto"
                  value={scheduleClass}
                  onChange={v => setScheduleClass(v)}
                  options={[{ value: "", label: "Semua Kelas" }, ...classes.map(c => ({ value: c.id, label: c.name }))]}
                />
              </div>
            )}
            <p className="text-xs text-gray-300 mt-2">9 kolom · diurutkan per kelas, hari, dan jam</p>
          </div>
          <a href={scheduleUrl()}
            className="shrink-0 self-start inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
            <Download size={15} /> Excel
          </a>
        </div>

        {/* Ekspor PKL */}
        <div className="panel p-5 flex items-start gap-4 hover:shadow-md hover:-translate-y-0.5 transition-all">
          <div className="w-11 h-11 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center shrink-0">
            <Briefcase size={20} className="text-rose-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-heading font-bold text-primary-900">Data PKL Siswa</h3>
            <p className="text-gray-400 text-sm mt-0.5">Status PKL seluruh siswa — nama, kelas, perusahaan, posisi, supervisor, dan tanggal PKL.</p>
            <p className="text-xs text-gray-300 mt-1">12 kolom · termasuk siswa yang belum/sudah/sedang PKL</p>
          </div>
          <a href="/api/admin/export/pkl"
            className="shrink-0 inline-flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
            <Download size={15} /> Excel
          </a>
        </div>

        {/* Info */}
        <Alert variant="warning" icon={FileSpreadsheet} title="Kompatibel dengan Excel">
          Semua unduhan berupa berkas Excel (.xlsx) sungguhan, bukan CSV — begitu dibuka, datanya sudah terpisah per kolom (tidak lagi menumpuk di satu kolom), angka tetap terbaca sebagai angka, dan saringan per kolom sudah aktif.
        </Alert>
      </div>
    </div>
  );
}
