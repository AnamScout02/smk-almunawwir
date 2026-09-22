"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckSquare, Loader2, Calendar, Users, Printer, ScanLine } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import Select from "@/components/admin/Select";
import StatTile from "@/components/admin/StatTile";
import DatePicker from "@/components/shared/DatePicker";
import MonthPicker from "@/components/shared/MonthPicker";

interface ClassOption { id: string; name: string; grade: number; major: { name: string } }
interface AttendanceRecord { id: string; date: string; status: string; student: { id: string; nis: string; user: { name: string } } }
interface SummaryRow { id: string; nis: string; name: string; total: number; HADIR: number; IZIN: number; SAKIT: number; ALPHA: number; pct: number }

const STATUS_COLOR: Record<string, string> = {
  HADIR: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  IZIN: "bg-blue-50 text-blue-700 border border-blue-200",
  SAKIT: "bg-amber-50 text-amber-700 border border-amber-200",
  ALPHA: "bg-red-50 text-red-600 border border-red-200",
};

/** Rekap absensi siswa — dipakai Admin/TAS, guru berjabatan Wakasek Kesiswaan/Guru BK (akses semua
 * kelas, lihat src/lib/kesiswaan-guard.ts), DAN sekarang juga wali kelas biasa (akses kelas walinya
 * saja) — pola komponen manager lintas portal no.14 CLAUDE.md. Read-only murni — tidak ada tombol
 * input/ubah di sini, input absensi resmi tetap khusus wali kelas lewat halaman terpisah.
 *
 * `classesEndpoint` menentukan cakupan: default `/api/admin/classes` (Admin/TAS/Kesiswaan/BK —
 * bebas kelas manapun). Wali kelas biasa pakai `/api/teacher/classes?scope=homeroom` (dikirim dari
 * wrapper page-nya sendiri) karena `/api/admin/classes` menolak guru tanpa jabatan relevan.
 * `scanHref` opsional — tombol "Scan Absensi" ke stasiun scan QR/barcode (src/components/shared/
 * AbsensiScanStation.tsx), cuma dikirim dari wrapper Admin (belum ada halaman scan versi guru). */
export default function AbsensiSiswaManager({ classesEndpoint = "/api/admin/classes", scanHref, kalenderHref = "/dashboard/admin/absensi-siswa/cetak-kalender" }: {
  classesEndpoint?: string; scanHref?: string;
  /** Halaman kalender bulanan di portal pembuka — guru tidak bisa membuka halaman Admin (temuan user 17 Sep 2026). */
  kalenderHref?: string;
} = {}) {
  const [tab, setTab] = useState<"tanggal" | "siswa">("tanggal");
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

  useEffect(() => {
    fetch(classesEndpoint).then(r => r.json()).then((d: ClassOption[]) => {
      if (Array.isArray(d)) {
        setClasses(d);
        if (d.length > 0) setClassId(d[0].id);
      }
    }).catch(() => {}).finally(() => setLoadingClasses(false));
  }, [classesEndpoint]);

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
      />

      {loadingClasses ? (
        <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-primary-500" /></div>
      ) : classes.length === 0 ? (
        <EmptyState icon={CheckSquare} title="Belum Ada Kelas" description="Tambahkan kelas terlebih dahulu." />
      ) : (
        <>
          {/* Satu baris alat: kelas + tab + aksi (§4.1) — sebelumnya tiga baris terpisah yang boros
              ruang di HP (temuan user 18 Sep 2026: "tatanannya bisa dibenahi agar tidak menghabiskan ruang"). */}
          <div className="panel p-4 mb-5 baris-alat items-end">
            <div className="alat-saring">
              <label className="label-field">Kelas</label>
              <Select value={classId} onChange={setClassId}
                options={classes.map(c => ({ value: c.id, label: `${c.name} — ${c.major.name}` }))} />
            </div>
            <div className="alat-tab flex gap-1 rounded-xl bg-gray-100 p-1">
              <button onClick={() => setTab("tanggal")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${tab === "tanggal" ? "bg-primary-900 text-white" : "text-gray-500 hover:bg-gray-50"}`}>
                <Calendar size={14} /> Per Tanggal
              </button>
              <button onClick={() => setTab("siswa")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${tab === "siswa" ? "bg-primary-900 text-white" : "text-gray-500 hover:bg-gray-50"}`}>
                <Users size={14} /> Per Siswa
              </button>
            </div>
            <div className="alat-aksi">
              {/* Kalender Bulanan SENGAJA bukan tab (2026-08-12) — halaman tersendiri yang sudah WYSIWYG. */}
              <Link href={classId ? `${kalenderHref}?classId=${classId}` : "#"} className="btn-modal-cancel btn-teks">
                <Printer size={15} /> Kalender Bulanan
              </Link>
              {scanHref && <Link href={scanHref} className="btn-modal-save btn-teks"><ScanLine size={15} /> Scan QR/Barcode</Link>}
            </div>
          </div>

          {tab === "tanggal" ? (
            <>
              <div className="panel p-5 mb-5 flex flex-col sm:flex-row items-start sm:items-center [&>*]:max-w-full justify-between gap-4">
                <div className="flex w-full min-w-0 items-center gap-3 sm:w-auto">
                  <label className="label-field mb-0 whitespace-nowrap">Tanggal:</label>
                  <div className="min-w-0 flex-1"><DatePicker value={date} onChange={setDate} /></div>
                </div>
                <div className="flex flex-wrap gap-2 text-sm">
                  {dailySummary.map(s => (
                    <div key={s.status} className={`px-3 py-1 rounded-full border text-xs font-semibold ${STATUS_COLOR[s.status]}`}>
                      {s.status}: {s.count}
                    </div>
                  ))}
                </div>
              </div>
              <div className="panel overflow-hidden">
                {loadingRecords ? (
                  <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-400"><Loader2 size={18} className="animate-spin" /> Memuat...</div>
                ) : records.length === 0 ? (
                  <EmptyState icon={CheckSquare} title="Belum Ada Absensi" description="Belum ada data absensi untuk kelas & tanggal ini." />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="data-table">
                      <thead>
                        <tr>
                          {["Siswa", "NIS", "Status"].map(h => (
                            <th key={h} className="whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {records.map(r => (
                          <tr key={r.id}>
                            <td className="font-semibold text-primary-900">{r.student.user.name}</td>
                            <td className="text-gray-400 text-xs font-mono">{r.student.nis}</td>
                            <td>
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_COLOR[r.status]}`}>{r.status}</span>
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
              <div className="panel p-5 mb-5 flex items-end gap-3 flex-wrap">
                <div>
                  <label className="label-field">Filter bulan (opsional)</label>
                  <MonthPicker value={summaryMonth} onChange={v => { setSummaryMonth(v); setSummaryFrom(""); setSummaryTo(""); }} />
                </div>
                <div>
                  <label className="label-field">Dari Tanggal</label>
                  <DatePicker value={summaryFrom} onChange={v => { setSummaryFrom(v); setSummaryMonth(""); }} />
                </div>
                <div>
                  <label className="label-field">Sampai Tanggal</label>
                  <DatePicker value={summaryTo} onChange={v => { setSummaryTo(v); setSummaryMonth(""); }} />
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
                <div className="kisi-kartu kisi-kartu-4 mb-5">
                  <StatTile color="emerald" ikon="centang" value={summary.reduce((a, s) => a + s.HADIR, 0)} label="Total Hadir" />
                  <StatTile color="blue" ikon="izin" value={summary.reduce((a, s) => a + s.IZIN, 0)} label="Total Izin" />
                  <StatTile color="amber" ikon="sakit" value={summary.reduce((a, s) => a + s.SAKIT, 0)} label="Total Sakit" />
                  <StatTile color="red" ikon="alpha" value={summary.reduce((a, s) => a + s.ALPHA, 0)} label="Total Alpha" />
                </div>
              )}
              <div className="panel overflow-hidden">
                {loadingSummary ? (
                  <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-400"><Loader2 size={18} className="animate-spin" /> Memuat...</div>
                ) : summary.length === 0 ? (
                  <EmptyState icon={Users} title="Belum Ada Data" description="Belum ada data absensi untuk kelas ini." />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="data-table">
                      <thead>
                        <tr>
                          {["Siswa", "NIS", "Hadir", "Izin", "Sakit", "Alpha", "% Kehadiran"].map(h => (
                            <th key={h} className="whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {summary.map(s => (
                          <tr key={s.id}>
                            <td className="font-semibold text-primary-900">{s.name}</td>
                            <td className="text-gray-400 text-xs font-mono">{s.nis}</td>
                            <td className="text-emerald-600 font-semibold">{s.HADIR}</td>
                            <td className="text-blue-600 font-semibold">{s.IZIN}</td>
                            <td className="text-amber-600 font-semibold">{s.SAKIT}</td>
                            <td className="text-red-600 font-semibold">{s.ALPHA}</td>
                            <td className="font-semibold text-primary-900">{s.pct}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
