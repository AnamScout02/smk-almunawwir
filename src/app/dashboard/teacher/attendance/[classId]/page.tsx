"use client";
import { useEffect, useState, useTransition } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";

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
  HADIR: "bg-emerald-100 text-emerald-700 border-emerald-200",
  IZIN: "bg-blue-100 text-blue-700 border-blue-200",
  SAKIT: "bg-amber-100 text-amber-700 border-amber-200",
  ALPHA: "bg-red-100 text-red-600 border-red-200",
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

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/teacher/students?classId=${classId}`).then(r => r.json()),
      fetch("/api/teacher/classes").then(r => r.json()),
    ]).then(([students, classes]) => {
      if (Array.isArray(students)) {
        setStudents(students);
        const init: Record<string, AttendanceStatus> = {};
        students.forEach((s: Student) => { init[s.id] = "HADIR"; });
        setAttendance(init);
      }
      if (Array.isArray(classes)) {
        const found = classes.find((c: ClassInfo) => c.id === classId);
        if (found) setCls(found);
      }
      setLoading(false);
    });
  }, [classId]);

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
    startTransition(async () => {
      const records = students.map(s => ({ studentId: s.id, date, status: attendance[s.id] ?? "HADIR" }));
      const res = await fetch("/api/teacher/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    });
  }

  const summary = STATUSES.map(s => ({ label: s, count: Object.values(attendance).filter(v => v === s).length }));

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/teacher/attendance" className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="font-heading text-2xl font-bold text-primary-900">Input Absensi</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {cls ? `${cls.name} — ${cls.major.name}` : "Memuat..."}
          </p>
        </div>
      </div>

      {/* Tanggal + summary */}
      <div className="bg-white rounded-2xl shadow-sm border p-5 mb-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <label className="label-field mb-0 whitespace-nowrap">Tanggal:</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input-field !w-auto" />
        </div>
        <div className="flex gap-3 text-sm">
          {summary.map(s => (
            <div key={s.label} className={`px-3 py-1 rounded-full border text-xs font-semibold ${STATUS_COLOR[s.label as AttendanceStatus]}`}>
              {s.label}: {s.count}
            </div>
          ))}
        </div>
      </div>

      {/* Tabel absensi */}
      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden mb-5">
        <div className="flex items-center justify-between px-5 py-3 border-b bg-gray-50">
          <p className="text-sm font-medium text-gray-600">{students.length} Siswa</p>
          <button onClick={setAllHadir} className="text-xs text-primary-700 font-semibold hover:text-gold transition">
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
        {saved && <p className="text-emerald-600 text-sm font-semibold">✓ Absensi berhasil disimpan!</p>}
        <button onClick={handleSave} disabled={isPending} className="btn-gold flex items-center gap-2 text-sm">
          <Save size={16} /> {isPending ? "Menyimpan..." : "Simpan Absensi"}
        </button>
      </div>
    </div>
  );
}
