"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckSquare, Loader2, Calendar, Users, Printer } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import Select from "@/components/admin/Select";
import StatTile from "@/components/admin/StatTile";
import DatePicker from "@/components/shared/DatePicker";
import MonthlyAttendanceCalendar, { type CalendarRow } from "@/components/shared/MonthlyAttendanceCalendar";

interface ClassOption { id: string; name: string; grade: number; major: { name: string } }
interface AttendanceRecord { id: string; date: string; status: string; student: { id: string; nis: string; user: { name: string } } }
interface SummaryRow { id: string; nis: string; name: string; total: number; HADIR: number; IZIN: number; SAKIT: number; ALPHA: number; pct: number }

const STATUS_COLOR: Record<string, string> = {
  HADIR: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  IZIN: "bg-blue-50 text-blue-700 border border-blue-200",
  SAKIT: "bg-amber-50 text-amber-700 border border-amber-200",
  ALPHA: "bg-red-50 text-red-600 border border-red-200",
};

/** Rekap absensi siswa (semua kelas) — dipakai Admin/TAS DAN guru berjabatan Wakasek
 * Kesiswaan/Guru BK (lihat src/lib/kesiswaan-guard.ts, pola komponen manager lintas portal no.14
 * CLAUDE.md). Read-only murni — tidak ada tombol input/ubah di sini, input absensi resmi tetap
 * khusus wali kelas lewat halaman terpisah. */
export default function AbsensiSiswaManager() {
  const [tab, setTab] = useState<"tanggal" | "siswa" | "kalender">("tanggal");
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [classId, setClassId] = useState("");
  const [loadingClasses, setLoadingClasses] = useState(true);

  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);

  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryMonth, setSummaryMonth] = useState(""); // kosong = sepanjang waktu (perilaku lama)
  const [summaryFrom, setSummaryFrom] = useState(""); // rentang custom (mis. per minggu) — mengalahkan summaryMonth kalau diisi
  const [summaryTo, setSummaryTo] = useState("");

  const [calMonth, setCalMonth] = useState(today.slice(0, 7));
  const [calDays, setCalDays] = useState(0);
  const [calSundays, setCalSundays] = useState<number[]>([]);
  const [calRows, setCalRows] = useState<CalendarRow[]>([]);
  const [loadingCal, setLoadingCal] = useState(false);

  useEffect(() => {
    fetch("/api/admin/classes").then(r => r.json()).then((d: ClassOption[]) => {
      if (Array.isArray(d)) {
        setClasses(d);
        if (d.length > 0) setClassId(d[0].id);
      }
    }).catch(() => {}).finally(() => setLoadingClasses(false));
  }, []);

  useEffect(() => {
    if (!classId || tab !== "tanggal") return;
    setLoadingRecords(true);
    fetch(`/api/teacher/attendance?classId=${classId}&date=${date}`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setRecords(d); })
      .catch(() => {}).finally(() => setLoadingRecords(false));
  }, [classId, date, tab]);

  useEffect(() => {
    if (!classId || tab !== "siswa") return;
    setLoadingSummary(true);
    const params = new URLSearchParams({ classId });
    if (summaryFrom || summaryTo) {
      if (summaryFrom) params.set("from", summaryFrom);
      if (summaryTo) params.set("to", summaryTo);
    } else if (summaryMonth) {
      params.set("month", summaryMonth);
    }
    fetch(`/api/teacher/attendance/summary?${params.toString()}`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.students)) setSummary(d.students); })
      .catch(() => {}).finally(() => setLoadingSummary(false));
  }, [classId, tab, summaryMonth, summaryFrom, summaryTo]);

  useEffect(() => {
    if (!classId || tab !== "kalender") return;
    setLoadingCal(true);
    fetch(`/api/teacher/attendance/monthly-grid?classId=${classId}&month=${calMonth}`)
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d.students)) {
          setCalRows(d.students);
          setCalDays(d.daysInMonth ?? 0);
          setCalSundays(d.sundays ?? []);
        }
      })
      .catch(() => {}).finally(() => setLoadingCal(false));
  }, [classId, tab, calMonth]);

  function startOfWeekISO(): string {
    const now = new Date();
    const day = now.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    return monday.toISOString().slice(0, 10);
  }

  const dailySummary = ["HADIR", "IZIN", "SAKIT", "ALPHA"].map(s => ({
    status: s, count: records.filter(r => r.status === s).length,
  }));

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader
        icon={<CheckSquare size={22} />}
        title="Rekap Absensi Siswa"
        description="Lihat rekap absensi digital yang diinput guru — per tanggal maupun per siswa, semua kelas"
        actions={
          <Link href={classId ? `/dashboard/admin/absensi-siswa/cetak-form?classId=${classId}` : "/dashboard/admin/absensi-siswa/cetak-form"} target="_blank"
            className="flex items-center gap-1.5 text-sm font-semibold text-white/80 hover:text-white bg-white/10 hover:bg-white/15 px-4 py-2.5 rounded-xl transition">
            <Printer size={15} /> Cetak Form Absensi
          </Link>
        }
      />

      {loadingClasses ? (
        <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-primary-500" /></div>
      ) : classes.length === 0 ? (
        <EmptyState icon={CheckSquare} title="Belum Ada Kelas" description="Tambahkan kelas terlebih dahulu." />
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1 min-w-0">
              <label className="label-field">Kelas</label>
              <Select value={classId} onChange={setClassId}
                options={classes.map(c => ({ value: c.id, label: `${c.name} — ${c.major.name}` }))} />
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => setTab("tanggal")}
                className={`flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-xl transition ${tab === "tanggal" ? "bg-primary-900 text-white" : "bg-gray-50 text-gray-500 hover:bg-gray-100"}`}>
                <Calendar size={14} /> Per Tanggal
              </button>
              <button onClick={() => setTab("siswa")}
                className={`flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-xl transition ${tab === "siswa" ? "bg-primary-900 text-white" : "bg-gray-50 text-gray-500 hover:bg-gray-100"}`}>
                <Users size={14} /> Per Siswa
              </button>
              <button onClick={() => setTab("kalender")}
                className={`flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-xl transition ${tab === "kalender" ? "bg-primary-900 text-white" : "bg-gray-50 text-gray-500 hover:bg-gray-100"}`}>
                <Calendar size={14} /> Kalender Bulanan
              </button>
            </div>
          </div>

          {tab === "tanggal" ? (
            <>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <label className="label-field mb-0 whitespace-nowrap">Tanggal:</label>
                  <DatePicker value={date} onChange={setDate} />
                </div>
                <div className="flex gap-3 text-sm">
                  {dailySummary.map(s => (
                    <div key={s.status} className={`px-3 py-1 rounded-full border text-xs font-semibold ${STATUS_COLOR[s.status]}`}>
                      {s.status}: {s.count}
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {loadingRecords ? (
                  <div className="py-16 text-center text-gray-400 text-sm">Memuat...</div>
                ) : records.length === 0 ? (
                  <EmptyState icon={CheckSquare} title="Belum Ada Absensi" description="Belum ada data absensi untuk kelas & tanggal ini." />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-primary-100" style={{ background: "linear-gradient(135deg, rgba(15,26,69,0.05) 0%, rgba(27,43,107,0.03) 100%)" }}>
                          {["Siswa", "NIS", "Status"].map(h => (
                            <th key={h} className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {records.map(r => (
                          <tr key={r.id} className="border-b border-gray-50 last:border-0 hover:bg-primary-50/30 transition-colors">
                            <td className="px-5 py-3.5 font-semibold text-primary-900">{r.student.user.name}</td>
                            <td className="px-5 py-3.5 text-gray-400 text-xs font-mono">{r.student.nis}</td>
                            <td className="px-5 py-3.5">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_COLOR[r.status]}`}>{r.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : tab === "siswa" ? (
            <>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5 flex items-end gap-3 flex-wrap">
                <div>
                  <label className="label-field">Filter bulan (opsional)</label>
                  <input type="month" value={summaryMonth} onChange={e => { setSummaryMonth(e.target.value); setSummaryFrom(""); setSummaryTo(""); }} className="input-field w-auto" />
                </div>
                <div>
                  <label className="label-field">Dari Tanggal</label>
                  <input type="date" value={summaryFrom} onChange={e => { setSummaryFrom(e.target.value); setSummaryMonth(""); }} className="input-field w-auto" />
                </div>
                <div>
                  <label className="label-field">Sampai Tanggal</label>
                  <input type="date" value={summaryTo} onChange={e => { setSummaryTo(e.target.value); setSummaryMonth(""); }} className="input-field w-auto" />
                </div>
                <button onClick={() => { setSummaryFrom(startOfWeekISO()); setSummaryTo(today); setSummaryMonth(""); }}
                  className="text-xs font-semibold text-primary-700 bg-primary-50 hover:bg-primary-100 px-3 py-2.5 rounded-xl transition">Minggu Ini</button>
                {(summaryMonth || summaryFrom || summaryTo) && (
                  <button onClick={() => { setSummaryMonth(""); setSummaryFrom(""); setSummaryTo(""); }} className="text-xs font-semibold text-gray-400 hover:text-gray-600 pb-2.5">
                    Reset ke sepanjang waktu
                  </button>
                )}
                <span className="text-xs text-gray-400 pb-2.5">
                  {summaryFrom || summaryTo ? "Rekap dipersempit ke rentang tanggal yang dipilih." : summaryMonth ? "Rekap dipersempit ke bulan yang dipilih." : "Belum difilter — total sepanjang waktu tercatat."}
                </span>
              </div>
              {!loadingSummary && summary.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
                  <StatTile color="emerald" value={summary.reduce((a, s) => a + s.HADIR, 0)} label="Total Hadir" />
                  <StatTile color="blue" value={summary.reduce((a, s) => a + s.IZIN, 0)} label="Total Izin" />
                  <StatTile color="amber" value={summary.reduce((a, s) => a + s.SAKIT, 0)} label="Total Sakit" />
                  <StatTile color="red" value={summary.reduce((a, s) => a + s.ALPHA, 0)} label="Total Alpha" />
                </div>
              )}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {loadingSummary ? (
                  <div className="py-16 text-center text-gray-400 text-sm">Memuat...</div>
                ) : summary.length === 0 ? (
                  <EmptyState icon={Users} title="Belum Ada Data" description="Belum ada data absensi untuk kelas ini." />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-primary-100" style={{ background: "linear-gradient(135deg, rgba(15,26,69,0.05) 0%, rgba(27,43,107,0.03) 100%)" }}>
                          {["Siswa", "NIS", "Hadir", "Izin", "Sakit", "Alpha", "% Kehadiran"].map(h => (
                            <th key={h} className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {summary.map(s => (
                          <tr key={s.id} className="border-b border-gray-50 last:border-0 hover:bg-primary-50/30 transition-colors">
                            <td className="px-5 py-3.5 font-semibold text-primary-900">{s.name}</td>
                            <td className="px-5 py-3.5 text-gray-400 text-xs font-mono">{s.nis}</td>
                            <td className="px-5 py-3.5 text-emerald-600 font-semibold">{s.HADIR}</td>
                            <td className="px-5 py-3.5 text-blue-600 font-semibold">{s.IZIN}</td>
                            <td className="px-5 py-3.5 text-amber-600 font-semibold">{s.SAKIT}</td>
                            <td className="px-5 py-3.5 text-red-600 font-semibold">{s.ALPHA}</td>
                            <td className="px-5 py-3.5 font-semibold text-primary-900">{s.pct}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <label className="label-field mb-0 whitespace-nowrap">Bulan:</label>
                  <input type="month" value={calMonth} onChange={e => setCalMonth(e.target.value)} className="input-field w-auto" />
                </div>
                <Link href={classId ? `/dashboard/admin/absensi-siswa/cetak-kalender?classId=${classId}&month=${calMonth}` : "#"} target="_blank"
                  className="flex items-center gap-1.5 text-xs font-semibold text-primary-700 bg-primary-50 hover:bg-primary-100 px-3 py-2.5 rounded-xl transition">
                  <Printer size={14} /> Cetak Kalender Ini
                </Link>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <MonthlyAttendanceCalendar rows={calRows} days={calDays} sundays={calSundays} loading={loadingCal} />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
