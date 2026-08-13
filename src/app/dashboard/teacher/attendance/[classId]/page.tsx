"use client";
import { useEffect, useState, useTransition } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Save, CheckSquare } from "lucide-react";
import Link from "next/link";
import DatePicker from "@/components/shared/DatePicker";
import PageHeader from "@/components/admin/PageHeader";
import MonthlyAttendanceCalendar, { type CalendarRow } from "@/components/shared/MonthlyAttendanceCalendar";

interface Student {
  id: string;
  nis: string;
  user: { name: string };
}

interface ClassInfo {
  id: string;
  name: string;
  grade: number;
  major: { name: string };
}

type AttendanceStatus = "HADIR" | "IZIN" | "SAKIT" | "ALPHA";
const STATUSES: AttendanceStatus[] = ["HADIR", "IZIN", "SAKIT", "ALPHA"];

const STATUS_COLOR: Record<AttendanceStatus, string> = {
  HADIR: "bg-emerald-50 text-emerald-700 border-emerald-200",
  IZIN: "bg-blue-50 text-blue-700 border-blue-200",
  SAKIT: "bg-amber-50 text-amber-700 border-amber-200",
  ALPHA: "bg-red-50 text-red-600 border-red-200",
};

export default function AbsensiPage() {
  const { classId } = useParams<{ classId: string }>();
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [cls, setCls] = useState<ClassInfo | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Panel kanan "live" — jurnal kalender bulan berjalan, refresh sendiri begitu absensi hari ini
  // disimpan di panel kiri (lihat handleSave). Bulan mengikuti `date` yang dipilih di kiri supaya
  // tetap konsisten kalau wali kelas isi absensi utk tanggal mundur.
  const month = date.slice(0, 7);
  const [calDays, setCalDays] = useState(0);
  const [calSundays, setCalSundays] = useState<number[]>([]);
  const [calRows, setCalRows] = useState<CalendarRow[]>([]);
  const [loadingCal, setLoadingCal] = useState(true);
  const [calRefresh, setCalRefresh] = useState(0);

  useEffect(() => {
    setLoadingCal(true);
    fetch(`/api/teacher/attendance/monthly-grid?classId=${classId}&month=${month}`)
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d.students)) {
          setCalRows(d.students);
          setCalDays(d.daysInMonth ?? 0);
          setCalSundays(d.sundays ?? []);
        }
      })
      .catch(() => {}).finally(() => setLoadingCal(false));
  }, [classId, month, calRefresh]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/teacher/students?classId=${classId}`).then(r => r.json()).catch(() => {}),
      fetch("/api/teacher/classes?scope=homeroom").then(r => r.json()).catch(() => {}),
      // Muat absensi yang SUDAH tersimpan untuk tanggal ini — tanpa ini status lama (mis. ALPHA)
      // tidak pernah kelihatan saat halaman dibuka ulang, dan tombol Simpan bisa menimpa data lama
      // jadi HADIR semua tanpa sengaja.
      fetch(`/api/teacher/attendance?classId=${classId}&date=${date}`).then(r => r.json()).catch(() => {}),
    ]).then(([students, classes, existing]) => {
      if (Array.isArray(students)) {
        setStudents(students);
        // JANGAN pre-fill "HADIR" — biarkan kosong (belum dipilih) sampai guru benar2 klik salah
        // satu status per siswa (atau pakai "Tandai Semua Hadir" scr sengaja). Kalau di-pre-fill,
        // guru yang klik Simpan tanpa mengecek satu-satu bakal nyimpen semua siswa HADIR walau
        // ada yg sebenarnya alpha/izin/sakit — data absensi jadi tidak bisa dipercaya.
        const init: Record<string, AttendanceStatus> = {};
        if (Array.isArray(existing)) {
          existing.forEach((r: { studentId: string; status: AttendanceStatus }) => { init[r.studentId] = r.status; });
        }
        setAttendance(init);
      }
      if (Array.isArray(classes)) {
        const found = classes.find((c: ClassInfo) => c.id === classId);
        if (found) setCls(found);
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [classId, date]);

  function setStatus(studentId: string, status: AttendanceStatus) {
    setAttendance(prev => ({ ...prev, [studentId]: status }));
    setSaved(false);
  }

  function setAllHadir() {
    const all: Record<string, AttendanceStatus> = {};
    students.forEach(s => { all[s.id] = "HADIR"; });
    setAttendance(all);
    setSaved(false);
  }

  async function handleSave() {
    const missing = students.filter(s => !attendance[s.id]);
    if (missing.length > 0) {
      setSaveError(`${missing.length} siswa belum diisi statusnya: ${missing.slice(0, 3).map(s => s.user.name).join(", ")}${missing.length > 3 ? ", dst." : ""}`);
      return;
    }
    setSaveError("");
    startTransition(async () => {
      const records = students.map(s => ({ studentId: s.id, date, status: attendance[s.id] }));
      const res = await fetch("/api/teacher/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records }),
      });
      if (res.ok) {
        setSaved(true);
        setCalRefresh(v => v + 1); // langsung refresh panel jurnal kanan, biar kelihatan "live"
        setTimeout(() => setSaved(false), 3000);
      }
    });
  }

  const summary = STATUSES.map(s => ({ label: s, count: Object.values(attendance).filter(v => v === s).length }));

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        icon={<CheckSquare size={22} />}
        title="Input Absensi"
        description={cls ? `${cls.name} — ${cls.major.name}` : "Memuat..."}
      />

      <div className="flex justify-end mb-5">
        <Link href="/dashboard/teacher/attendance" className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition">
          <ArrowLeft size={18} />
        </Link>
      </div>

      {/* Kiri: form input hari ini — Kanan: jurnal kalender bulan berjalan (live, refresh begitu disimpan) */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_1.4fr] gap-5 items-start">
        <div>
          {/* Tanggal + summary */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <label className="label-field mb-0 whitespace-nowrap">Tanggal:</label>
              <DatePicker value={date} onChange={setDate} />
            </div>
            <div className="flex gap-3 text-sm flex-wrap">
              {summary.map(s => (
                <div key={s.label} className={`px-3 py-1 rounded-full border text-xs font-semibold ${STATUS_COLOR[s.label as AttendanceStatus]}`}>
                  {s.label}: {s.count}
                </div>
              ))}
              {students.length - Object.keys(attendance).length > 0 && (
                <div className="px-3 py-1 rounded-full border text-xs font-semibold bg-gray-50 text-gray-400 border-gray-200">
                  Belum Diisi: {students.length - Object.keys(attendance).length}
                </div>
              )}
            </div>
          </div>

          {/* Tabel absensi */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-5">
            <div className="flex items-center justify-between px-5 py-3"
              style={{ background: "linear-gradient(135deg, #0F1A45 0%, #1B2B6B 100%)" }}>
              <p className="text-sm font-semibold text-white">{students.length} Siswa</p>
              <button onClick={setAllHadir} className="text-xs text-gold font-semibold hover:text-white transition">
                Tandai Semua Hadir
              </button>
            </div>
            {loading ? (
              <div className="py-16 text-center text-gray-400 text-sm">Memuat daftar siswa...</div>
            ) : students.length === 0 ? (
              <div className="py-16 text-center text-gray-400">Tidak ada siswa di kelas ini.</div>
            ) : (
              <div className="divide-y">
                {students.map((s, i) => (
                  <div key={s.id} className="flex items-center gap-4 px-5 py-3">
                    <span className="text-gray-300 text-sm w-6 shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-primary-900 text-sm">{s.user.name}</p>
                      <p className="text-gray-400 text-xs font-mono">{s.nis}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {STATUSES.map(status => (
                        <button
                          key={status}
                          onClick={() => setStatus(s.id, status)}
                          className={`px-2.5 py-1 rounded-lg border text-xs font-semibold transition ${
                            attendance[s.id] === status ? STATUS_COLOR[status] + " shadow-sm" : "bg-white border-gray-200 text-gray-400 hover:border-gray-300"
                          }`}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-4">
            {saveError && <p className="text-red-600 text-sm font-semibold">{saveError}</p>}
            {saved && <p className="text-emerald-600 text-sm font-semibold">✓ Absensi berhasil disimpan!</p>}
            <button onClick={handleSave} disabled={isPending} className="btn-gold flex items-center gap-2 text-sm">
              <Save size={16} /> {isPending ? "Menyimpan..." : "Simpan Absensi"}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden xl:sticky xl:top-6">
          <div className="px-5 py-3" style={{ background: "linear-gradient(135deg, #0F1A45 0%, #1B2B6B 100%)" }}>
            <p className="text-sm font-semibold text-white">Jurnal Absensi Bulan Ini</p>
            <p className="text-white/50 text-xs">Live — otomatis update begitu absensi disimpan</p>
          </div>
          <MonthlyAttendanceCalendar rows={calRows} days={calDays} sundays={calSundays} loading={loadingCal} viewMonth={month} compact />
        </div>
      </div>
    </div>
  );
}
