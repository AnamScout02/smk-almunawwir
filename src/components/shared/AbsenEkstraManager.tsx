"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { CheckSquare, ClipboardList, Pencil, BarChart3, Plus } from "lucide-react";
import DatePicker from "@/components/shared/DatePicker";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import EmptyState from "@/components/admin/EmptyState";
import { PageSkeleton } from "@/components/shared/Skeleton";

interface EkskulOption { id: string; name: string }
interface Row { studentId: string; nis: string; name: string; className: string; status: string }
interface HistoryRow { id: string; date: string; materi: string | null; totalPeserta: number; hadir: number; izin: number; sakit: number; alpha: number }
interface RekapRow { studentId: string; nis: string; name: string; className: string; total: number; hadir: number; izin: number; sakit: number; alpha: number; pct: number }

type AttendanceStatus = "HADIR" | "IZIN" | "SAKIT" | "ALPHA";
const STATUSES: AttendanceStatus[] = ["HADIR", "IZIN", "SAKIT", "ALPHA"];

const STATUS_COLOR: Record<AttendanceStatus, string> = {
  HADIR: "bg-emerald-50 text-emerald-700 border-emerald-200",
  IZIN: "bg-blue-50 text-blue-700 border-blue-200",
  SAKIT: "bg-amber-50 text-amber-700 border-amber-200",
  ALPHA: "bg-red-50 text-red-600 border-red-200",
};

/** Absen Ekstra (Pramuka, dst) — khusus Pembina ekstrakurikuler ybs (jabatan "Pembina <Nama>"
 * atau "Koordinator Ekstrakurikuler"), TERPISAH dari Attendance resmi harian sekolah. Roster dari
 * anggota ekskul (ExtracurricularMember), bukan kelas. Status wajib diisi semua sebelum simpan —
 * TIDAK boleh default "HADIR" (konvensi wajib no.10 CLAUDE.md).
 *
 * Dipakai bareng portal Admin & Guru (pola komponen manager lintas portal, no.14 CLAUDE.md) —
 * banyak Pembina ekskul ternyata role TAS bukan TEACHER (kasus nyata: Muhammad Abdul Rokeb,
 * Security yg merangkap Pembina Pramuka), jadi HARUS bisa diakses dari kedua portal supaya
 * mereka benar-benar bisa mencatat, bukan cuma guru-role yang bisa. Generik utk ekskul manapun —
 * tidak ada logic khusus Pramuka, otomatis berlaku begitu Pembina ekskul lain mulai mencatat. */
export default function AbsenEkstraManager() {
  const [tab, setTab] = useState<"catat" | "riwayat" | "rekap">("catat");
  const today = new Date().toISOString().split("T")[0];
  const [ekskulList, setEkskulList] = useState<EkskulOption[]>([]);
  const [ekskulId, setEkskulId] = useState("");
  const [loadingEkskul, setLoadingEkskul] = useState(true);
  const [date, setDate] = useState(today);
  const [materi, setMateri] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [classFilter, setClassFilter] = useState(""); // "" = semua kelas — anggota ekskul biasanya lintas kelas (mis. Pramuka 112 siswa dari 5 kelas)
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/teacher/ekstrakurikuler-jurnal/my-ekskul").then(r => r.json()).then((d: EkskulOption[]) => {
      if (Array.isArray(d)) {
        setEkskulList(d);
        if (d.length > 0) setEkskulId(d[0].id);
      }
    }).catch(() => {}).finally(() => setLoadingEkskul(false));
  }, []);

  function loadHistory() {
    if (!ekskulId) return;
    setLoadingHistory(true);
    fetch(`/api/teacher/ekstrakurikuler-jurnal/history?extracurricularId=${ekskulId}`)
      .then(r => r.json()).then(d => { if (Array.isArray(d)) setHistory(d); })
      .catch(() => {}).finally(() => setLoadingHistory(false));
  }
  useEffect(() => { loadHistory(); }, [ekskulId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setClassFilter(""); }, [ekskulId]); // reset — daftar kelas beda per ekskul

  function editHistoryRow(h: HistoryRow) {
    setDate(new Date(h.date).toISOString().slice(0, 10));
    setTab("catat");
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  useEffect(() => {
    if (!ekskulId || tab !== "catat") return;
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
  }, [ekskulId, date, tab]);

  function setStatus(studentId: string, status: AttendanceStatus) {
    setAttendance(prev => ({ ...prev, [studentId]: status }));
    setSaved(false);
  }

  function setAllHadir() {
    // Cuma tandai baris yg lagi ditampilkan (kalau filter kelas aktif) — status siswa di kelas
    // lain yg sudah diisi manual TIDAK ikut ditimpa.
    setAttendance(prev => {
      const next = { ...prev };
      displayRows.forEach(r => { next[r.studentId] = "HADIR"; });
      return next;
    });
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
        loadHistory();
        setTimeout(() => setSaved(false), 3000);
      } else {
        const d = await res.json();
        setSaveError(d.error || "Gagal menyimpan absen");
      }
    });
  }

  const currentEkskul = ekskulList.find(e => e.id === ekskulId);
  const summary = STATUSES.map(s => ({ label: s, count: Object.values(attendance).filter(v => v === s).length }));
  const classOptions = Array.from(new Set(rows.map(r => r.className))).sort();
  const displayRows = classFilter ? rows.filter(r => r.className === classFilter) : rows;

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
          <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
            <div className="flex gap-2 flex-wrap">
              {([["catat", "Catat Absen", Plus], ["riwayat", "Riwayat", ClipboardList], ["rekap", "Rekap", BarChart3]] as const).map(([v, label, Icon]) => (
                <button key={v} onClick={() => setTab(v)}
                  className={`flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-xl transition ${tab === v ? "bg-primary-900 text-white" : "bg-gray-50 text-gray-500 hover:bg-gray-100"}`}>
                  <Icon size={14} /> {label}
                </button>
              ))}
            </div>
            {ekskulList.length > 1 && (
              <div className="w-56">
                <Select value={ekskulId} onChange={setEkskulId} options={ekskulList.map(e => ({ value: e.id, label: e.name }))} />
              </div>
            )}
          </div>

          {tab === "catat" && (
            <div ref={formRef} className="scroll-mt-6">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5 flex flex-wrap items-center gap-3">
                <label className="label-field mb-0 whitespace-nowrap">Tanggal:</label>
                <DatePicker value={date} onChange={setDate} />
                {classOptions.length > 1 && (
                  <div className="w-48">
                    <Select value={classFilter} onChange={setClassFilter}
                      options={[{ value: "", label: "Semua Kelas" }, ...classOptions.map(c => ({ value: c, label: c }))]} />
                  </div>
                )}
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
                      <p className="text-sm font-semibold text-white">
                        {displayRows.length}{classFilter ? ` dari ${rows.length}` : ""} Peserta
                      </p>
                      <button onClick={setAllHadir} className="text-xs text-gold font-semibold hover:text-white transition">
                        Tandai {classFilter ? "Kelas Ini" : "Semua"} Hadir
                      </button>
                    </div>
                    {displayRows.length === 0 ? (
                      <div className="py-16 text-center text-gray-400">
                        {rows.length === 0 ? "Belum ada anggota terdaftar di ekstrakurikuler ini." : "Tidak ada peserta di kelas ini."}
                      </div>
                    ) : (
                      <div className="divide-y">
                        {displayRows.map((r, i) => (
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
                            <div className="sm:hidden shrink-0 w-28">
                              <Select value={attendance[r.studentId] ?? ""} onChange={v => setStatus(r.studentId, v as AttendanceStatus)}
                                placeholder="— Pilih —"
                                options={STATUSES.map(status => ({ value: status, label: status }))}
                                buttonClassName={`w-full flex items-center justify-between gap-1 text-xs font-semibold rounded-lg border pl-2 pr-2 py-1.5 outline-none cursor-pointer ${
                                  attendance[r.studentId] ? STATUS_COLOR[attendance[r.studentId]] : "bg-white border-gray-200 text-gray-400"
                                }`} />
                            </div>
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
            </div>
          )}

          {tab === "riwayat" && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {loadingHistory ? (
                <div className="py-10 text-center text-gray-400 text-sm">Memuat...</div>
              ) : history.length === 0 ? (
                <EmptyState icon={ClipboardList} title="Belum Ada Riwayat" description="Belum ada pertemuan yang tercatat untuk ekstrakurikuler ini." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-primary-100 text-left text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">
                        <th className="px-4 py-3">Tanggal</th><th className="px-4 py-3">Kegiatan/Materi</th>
                        <th className="px-4 py-3">Peserta</th><th className="px-4 py-3">H/I/S/A</th><th className="px-4 py-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map(h => (
                        <tr key={h.id} className="border-b border-gray-50 last:border-0 hover:bg-primary-50/30">
                          <td className="px-4 py-2.5 whitespace-nowrap">{new Date(h.date).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}</td>
                          <td className="px-4 py-2.5 max-w-xs truncate text-gray-600">{h.materi || "—"}</td>
                          <td className="px-4 py-2.5">{h.totalPeserta}</td>
                          <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">{h.hadir}/{h.izin}/{h.sakit}/{h.alpha}</td>
                          <td className="px-4 py-2.5 text-right">
                            <button onClick={() => editHistoryRow(h)} className="p-1.5 text-primary-600 hover:bg-primary-50 rounded-lg transition"><Pencil size={14} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === "rekap" && <RekapTab ekskulId={ekskulId} />}
        </>
      )}
    </div>
  );
}

// ── Tab: Rekap ────────────────────────────────────────────────────────────────
/** Rekap kehadiran per anggota (H/I/S/A + %), generik utk ekskul manapun (parameterized by
 * ekskulId, tidak ada logic khusus Pramuka) — otomatis berlaku begitu Pembina ekskul lain mulai
 * mencatat. Filter rentang tanggal opsional (mis. per bulan/semester). */
function RekapTab({ ekskulId }: { ekskulId: string }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [students, setStudents] = useState<RekapRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ekskulId) return;
    setLoading(true);
    setClassFilter("");
    const params = new URLSearchParams({ extracurricularId: ekskulId });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    fetch(`/api/teacher/ekstrakurikuler-jurnal/rekap?${params.toString()}`)
      .then(r => r.json()).then(d => { if (Array.isArray(d.students)) setStudents(d.students); })
      .catch(() => {}).finally(() => setLoading(false));
  }, [ekskulId, from, to]);

  const classOptions = Array.from(new Set(students.map(s => s.className))).sort();
  const displayStudents = classFilter ? students.filter(s => s.className === classFilter) : students;

  return (
    <div>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5 flex flex-wrap items-end gap-3">
        <div>
          <label className="label-field">Dari Tanggal</label>
          <DatePicker value={from} onChange={setFrom} />
        </div>
        <div>
          <label className="label-field">Sampai Tanggal</label>
          <DatePicker value={to} onChange={setTo} />
        </div>
        {classOptions.length > 1 && (
          <div className="w-48">
            <label className="label-field">Kelas</label>
            <Select value={classFilter} onChange={setClassFilter}
              options={[{ value: "", label: "Semua Kelas" }, ...classOptions.map(c => ({ value: c, label: c }))]} />
          </div>
        )}
        {(from || to) && (
          <button onClick={() => { setFrom(""); setTo(""); }} className="text-xs font-semibold text-gray-400 hover:text-gray-600 pb-2.5">Reset Tanggal</button>
        )}
        <span className="text-xs text-gray-400 pb-2.5">{from || to ? "Rekap dipersempit ke rentang tanggal." : "Belum difilter — total sepanjang waktu tercatat."}</span>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-gray-400 text-sm">Memuat...</div>
        ) : displayStudents.length === 0 ? (
          <EmptyState icon={BarChart3} title="Belum Ada Data" description="Belum ada anggota atau catatan absen." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-primary-100 text-left text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">
                  <th className="px-4 py-3">Siswa</th><th className="px-4 py-3">Hadir</th><th className="px-4 py-3">Izin</th>
                  <th className="px-4 py-3">Sakit</th><th className="px-4 py-3">Alpha</th><th className="px-4 py-3">% Kehadiran</th>
                </tr>
              </thead>
              <tbody>
                {displayStudents.map(s => (
                  <tr key={s.studentId} className="border-b border-gray-50 last:border-0 hover:bg-primary-50/30">
                    <td className="px-4 py-2.5">
                      <p className="font-semibold text-primary-900">{s.name}</p>
                      <p className="text-xs text-gray-400">{s.nis} · {s.className}</p>
                    </td>
                    <td className="px-4 py-2.5 text-emerald-600 font-semibold">{s.hadir}</td>
                    <td className="px-4 py-2.5 text-blue-600 font-semibold">{s.izin}</td>
                    <td className="px-4 py-2.5 text-amber-600 font-semibold">{s.sakit}</td>
                    <td className="px-4 py-2.5 text-red-600 font-semibold">{s.alpha}</td>
                    <td className="px-4 py-2.5 font-semibold text-primary-900">{s.pct}%</td>
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
