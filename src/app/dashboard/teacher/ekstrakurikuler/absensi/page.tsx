"use client";
import { useEffect, useState, useTransition } from "react";
import { CheckSquare } from "lucide-react";
import DatePicker from "@/components/shared/DatePicker";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import { PageSkeleton } from "@/components/shared/Skeleton";

interface EkskulOption { id: string; name: string }
interface Row { studentId: string; nis: string; name: string; className: string; status: string }

type AttendanceStatus = "HADIR" | "IZIN" | "SAKIT" | "ALPHA";
const STATUSES: AttendanceStatus[] = ["HADIR", "IZIN", "SAKIT", "ALPHA"];

const STATUS_COLOR: Record<AttendanceStatus, string> = {
  HADIR: "bg-emerald-50 text-emerald-700 border-emerald-200",
  IZIN: "bg-blue-50 text-blue-700 border-blue-200",
  SAKIT: "bg-amber-50 text-amber-700 border-amber-200",
  ALPHA: "bg-red-50 text-red-600 border-red-200",
};

/** Absen Ekstra (mis. Pramuka) — khusus Pembina ekstrakurikuler ybs (jabatan "Pembina <Nama>"
 * atau "Koordinator Ekstrakurikuler"), TERPISAH dari Attendance resmi harian sekolah. Roster
 * dari anggota ekskul (ExtracurricularMember), bukan kelas. Status wajib diisi semua sebelum
 * simpan — TIDAK boleh default "HADIR" (konvensi wajib no.10 CLAUDE.md). */
export default function AbsenEkstraPage() {
  const today = new Date().toISOString().split("T")[0];
  const [ekskulList, setEkskulList] = useState<EkskulOption[]>([]);
  const [ekskulId, setEkskulId] = useState("");
  const [loadingEkskul, setLoadingEkskul] = useState(true);
  const [date, setDate] = useState(today);
  const [materi, setMateri] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    fetch("/api/teacher/ekstrakurikuler-jurnal/my-ekskul").then(r => r.json()).then((d: EkskulOption[]) => {
      if (Array.isArray(d)) {
        setEkskulList(d);
        if (d.length > 0) setEkskulId(d[0].id);
      }
    }).catch(() => {}).finally(() => setLoadingEkskul(false));
  }, []);

  useEffect(() => {
    if (!ekskulId) return;
    setLoading(true);
    setError("");
    fetch(`/api/teacher/ekstrakurikuler-jurnal?extracurricularId=${ekskulId}&date=${date}`).then(async r => {
      if (!r.ok) { const d = await r.json(); setError(d.error || "Gagal memuat data"); setLoading(false); return; }
      const d = await r.json();
      setRows(d.rows ?? []);
      setMateri(d.materi ?? "");
      const init: Record<string, AttendanceStatus> = {};
      (d.rows ?? []).forEach((r: Row) => { if (r.status) init[r.studentId] = r.status as AttendanceStatus; });
      setAttendance(init);
      setLoading(false);
    }).catch(() => { setError("Gagal memuat data"); setLoading(false); });
  }, [ekskulId, date]);

  function setStatus(studentId: string, status: AttendanceStatus) {
    setAttendance(prev => ({ ...prev, [studentId]: status }));
    setSaved(false);
  }

  function setAllHadir() {
    const all: Record<string, AttendanceStatus> = {};
    rows.forEach(r => { all[r.studentId] = "HADIR"; });
    setAttendance(all);
    setSaved(false);
  }

  async function handleSave() {
    const missing = rows.filter(r => !attendance[r.studentId]);
    if (missing.length > 0) {
      setSaveError(`${missing.length} peserta belum diisi statusnya: ${missing.slice(0, 3).map(r => r.name).join(", ")}${missing.length > 3 ? ", dst." : ""}`);
      return;
    }
    setSaveError("");
    startTransition(async () => {
      const body = {
        extracurricularId: ekskulId, date, materi,
        rows: rows.map(r => ({ studentId: r.studentId, status: attendance[r.studentId] })),
      };
      const res = await fetch("/api/teacher/ekstrakurikuler-jurnal", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        const d = await res.json();
        setSaveError(d.error || "Gagal menyimpan absen");
      }
    });
  }

  const currentEkskul = ekskulList.find(e => e.id === ekskulId);
  const summary = STATUSES.map(s => ({ label: s, count: Object.values(attendance).filter(v => v === s).length }));

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<CheckSquare size={22} />} title="Absen Ekstra"
        description={currentEkskul ? `${currentEkskul.name} — terpisah dari absensi harian sekolah` : "Absensi khusus kegiatan ekstrakurikuler"} />

      {loadingEkskul ? (
        <PageSkeleton />
      ) : ekskulList.length === 0 ? (
        <div className="bg-amber-50 border border-amber-100 text-amber-700 rounded-xl p-4 text-sm">
          Anda belum terdaftar sebagai Pembina ekstrakurikuler manapun.
        </div>
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {ekskulList.length > 1 && (
              <div className="flex-1 min-w-0">
                <label className="label-field">Ekstrakurikuler</label>
                <Select value={ekskulId} onChange={setEkskulId} options={ekskulList.map(e => ({ value: e.id, label: e.name }))} />
              </div>
            )}
            <div className="flex items-center gap-3">
              <label className="label-field mb-0 whitespace-nowrap">Tanggal:</label>
              <DatePicker value={date} onChange={setDate} />
            </div>
          </div>

          {error ? (
            <div className="bg-red-50 border border-red-100 text-red-600 rounded-xl p-4 text-sm">{error}</div>
          ) : loading ? (
            <PageSkeleton />
          ) : (
            <>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
                <label className="label-field">Kegiatan / Materi (opsional)</label>
                <textarea value={materi} onChange={e => setMateri(e.target.value)} rows={2} className="input-field" placeholder="Kegiatan hari ini..." />
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5 flex flex-wrap items-center justify-between gap-4">
                <div className="flex gap-3 text-sm flex-wrap">
                  {summary.map(s => (
                    <div key={s.label} className={`px-3 py-1 rounded-full border text-xs font-semibold ${STATUS_COLOR[s.label as AttendanceStatus]}`}>
                      {s.label}: {s.count}
                    </div>
                  ))}
                  {rows.length - Object.keys(attendance).length > 0 && (
                    <div className="px-3 py-1 rounded-full border text-xs font-semibold bg-gray-50 text-gray-400 border-gray-200">
                      Belum Diisi: {rows.length - Object.keys(attendance).length}
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-5">
                <div className="flex items-center justify-between px-5 py-3"
                  style={{ background: "linear-gradient(135deg, #0F1A45 0%, #1B2B6B 100%)" }}>
                  <p className="text-sm font-semibold text-white">{rows.length} Peserta</p>
                  <button onClick={setAllHadir} className="text-xs text-gold font-semibold hover:text-white transition">
                    Tandai Semua Hadir
                  </button>
                </div>
                {rows.length === 0 ? (
                  <div className="py-16 text-center text-gray-400">Belum ada anggota terdaftar di ekstrakurikuler ini.</div>
                ) : (
                  <div className="divide-y">
                    {rows.map((r, i) => (
                      <div key={r.studentId} className="flex items-center gap-4 px-5 py-3">
                        <span className="text-gray-300 text-sm w-6 shrink-0">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-primary-900 text-sm truncate">{r.name}</p>
                          <p className="text-gray-400 text-xs font-mono">{r.nis} · {r.className}</p>
                        </div>
                        <div className="hidden sm:flex gap-2 shrink-0">
                          {STATUSES.map(status => (
                            <button key={status} onClick={() => setStatus(r.studentId, status)}
                              className={`px-2.5 py-1 rounded-lg border text-xs font-semibold transition ${
                                attendance[r.studentId] === status ? STATUS_COLOR[status] + " shadow-sm" : "bg-white border-gray-200 text-gray-400 hover:border-gray-300"
                              }`}>
                              {status}
                            </button>
                          ))}
                        </div>
                        <select value={attendance[r.studentId] ?? ""} onChange={e => setStatus(r.studentId, e.target.value as AttendanceStatus)}
                          className={`sm:hidden shrink-0 text-xs font-semibold rounded-lg border pl-2 pr-6 py-1.5 outline-none ${
                            attendance[r.studentId] ? STATUS_COLOR[attendance[r.studentId]] : "bg-white border-gray-200 text-gray-400"
                          }`}>
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
                {saved && <p className="text-emerald-600 text-sm font-semibold">✓ Absen berhasil disimpan!</p>}
                <button onClick={handleSave} disabled={isPending || rows.length === 0} className="btn-gold flex items-center gap-2 text-sm">
                  <CheckSquare size={16} /> {isPending ? "Menyimpan..." : "Simpan Absen"}
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
