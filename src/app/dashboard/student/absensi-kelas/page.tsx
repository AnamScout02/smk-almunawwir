"use client";
import { useEffect, useState, useTransition } from "react";
import { CheckSquare } from "lucide-react";
import DatePicker from "@/components/shared/DatePicker";
import PageHeader from "@/components/admin/PageHeader";
import { PageSkeleton } from "@/components/shared/Skeleton";

interface Student {
  id: string;
  nis: string;
  user: { name: string };
}
interface AttendanceRecord { studentId: string; status: string }

type AttendanceStatus = "HADIR" | "IZIN" | "SAKIT" | "ALPHA";
const STATUSES: AttendanceStatus[] = ["HADIR", "IZIN", "SAKIT", "ALPHA"];

const STATUS_COLOR: Record<AttendanceStatus, string> = {
  HADIR: "bg-emerald-50 text-emerald-700 border-emerald-200",
  IZIN: "bg-blue-50 text-blue-700 border-blue-200",
  SAKIT: "bg-amber-50 text-amber-700 border-amber-200",
  ALPHA: "bg-red-50 text-red-600 border-red-200",
};

export default function AbsensiKelasPage() {
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [className, setClassName] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    fetch(`/api/student/attendance?date=${date}`).then(async r => {
      if (!r.ok) { const d = await r.json(); setError(d.error || "Gagal memuat data"); setLoading(false); return; }
      const d = await r.json();
      setClassName(d.className);
      setStudents(d.students ?? []);
      // JANGAN pre-fill "HADIR" — biarkan kosong sampai Ketua Kelas/Sekretaris benar2 pilih status
      // per siswa (atau pakai "Tandai Semua Hadir" scr sengaja), supaya klik Simpan tanpa
      // ngecek satu-satu tidak diam-diam nyatet semua orang hadir.
      const init: Record<string, AttendanceStatus> = {};
      (d.existing ?? []).forEach((r: AttendanceRecord) => { init[r.studentId] = r.status as AttendanceStatus; });
      setAttendance(init);
      setLoading(false);
    }).catch(() => { setError("Gagal memuat data"); setLoading(false); });
  }, [date]);

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
      const records = students.map(s => ({ studentId: s.id, status: attendance[s.id] }));
      const res = await fetch("/api/student/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, records }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        const d = await res.json();
        setSaveError(d.error || "Gagal menyimpan absensi");
      }
    });
  }

  if (error) {
    return (
      <div className="p-6 lg:p-8 pt-16 lg:pt-8">
        <div className="bg-red-50 border border-red-100 text-red-600 rounded-xl p-4 text-sm">{error}</div>
      </div>
    );
  }

  const summary = STATUSES.map(s => ({ label: s, count: Object.values(attendance).filter(v => v === s).length }));

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader
        icon={<CheckSquare size={22} />}
        title="Absensi Kelas"
        description={className ? `${className} — diinput oleh Ketua Kelas/Sekretaris` : "Memuat..."}
      />

      {loading ? (
        <PageSkeleton />
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
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

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-5">
            <div className="flex items-center justify-between px-5 py-3"
              style={{ background: "linear-gradient(135deg, #0F1A45 0%, #1B2B6B 100%)" }}>
              <p className="text-sm font-semibold text-white">{students.length} Siswa</p>
              <button onClick={setAllHadir} className="text-xs text-gold font-semibold hover:text-white transition">
                Tandai Semua Hadir
              </button>
            </div>
            {students.length === 0 ? (
              <div className="py-16 text-center text-gray-400">Tidak ada siswa di kelas ini.</div>
            ) : (
              <div className="divide-y">
                {students.map((s, i) => (
                  <div key={s.id} className="flex items-center gap-4 px-5 py-3">
                    <span className="text-gray-300 text-sm w-6 shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-primary-900 text-sm truncate">{s.user.name}</p>
                      <p className="text-gray-400 text-xs font-mono">{s.nis}</p>
                    </div>
                    {/* Desktop/tablet: tombol langsung-klik. Mobile (<sm): dropdown — 4 tombol
                        berdampingan bikin nama siswa kepepet/kepotong di layar sempit. */}
                    <div className="hidden sm:flex gap-2 shrink-0">
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
                    <select
                      value={attendance[s.id] ?? ""}
                      onChange={e => setStatus(s.id, e.target.value as AttendanceStatus)}
                      className={`sm:hidden shrink-0 text-xs font-semibold rounded-lg border pl-2 pr-6 py-1.5 outline-none ${
                        attendance[s.id] ? STATUS_COLOR[attendance[s.id]] : "bg-white border-gray-200 text-gray-400"
                      }`}
                    >
                      <option value="" disabled>— Pilih —</option>
                      {STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-4">
            {saveError && <p className="text-red-600 text-sm font-semibold">{saveError}</p>}
            {saved && <p className="text-emerald-600 text-sm font-semibold">✓ Absensi berhasil disimpan!</p>}
            <button onClick={handleSave} disabled={isPending} className="btn-gold flex items-center gap-2 text-sm">
              <CheckSquare size={16} /> {isPending ? "Menyimpan..." : "Simpan Absensi"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
