"use client";
import { Calendar, Loader2 } from "lucide-react";
import EmptyState from "@/components/admin/EmptyState";

export interface CalendarRow { id: string; nis: string; name: string; cells: Record<number, string>; SAKIT: number; IZIN: number; ALPHA: number }

const CELL_COLOR: Record<string, string> = {
  H: "text-emerald-600 font-bold",
  I: "text-blue-600",
  S: "text-amber-600",
  A: "text-red-600 font-bold",
};

/** Tabel jurnal absensi 1 bulan (kolom = tanggal, Minggu diwarnai, rekap S/I/A di ujung) — data
 * dari /api/teacher/attendance/monthly-grid. Dipakai di tab "Kalender Bulanan" AbsensiSiswaManager
 * (read-only, lintas kelas) DAN di panel kanan halaman Input Absensi wali kelas (live, refresh
 * begitu wali kelas simpan absensi hari itu di panel kiri) — satu komponen, dua pemakai, no.14
 * CLAUDE.md (reuse lintas halaman).
 *
 * `viewMonth` ("YYYY-MM") dipakai buat bedain sel kosong yg WAJAR (hari sekolah belum lewat /
 * hari Minggu, tetap titik abu-abu polos) vs sel kosong yg PATUT DICURIGAI (hari sekolah SUDAH
 * lewat tapi datanya nihil — kemungkinan wali kelas lupa absen) — yg terakhir diberi latar kuning
 * supaya kelihatan beda tanpa harus scroll manual satu-satu. */
export default function MonthlyAttendanceCalendar({ rows, days, sundays, loading, compact = false, viewMonth }: {
  rows: CalendarRow[]; days: number; sundays: number[]; loading: boolean; compact?: boolean; viewMonth?: string;
}) {
  if (loading) return <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-400"><Loader2 size={18} className="animate-spin" /> Memuat...</div>;
  if (rows.length === 0) {
    return <EmptyState icon={Calendar} title="Belum Ada Data" description="Belum ada data absensi untuk kelas & bulan ini." />;
  }
  const dayList = Array.from({ length: days }, (_, i) => i + 1);

  const [vy, vm] = (viewMonth ?? "").split("-").map(Number);
  const todayUTC = new Date(); todayUTC.setUTCHours(0, 0, 0, 0);
  function isPastSchoolDay(day: number): boolean {
    if (!vy || !vm) return false;
    const d = new Date(Date.UTC(vy, vm - 1, day));
    return d.getTime() <= todayUTC.getTime();
  }
  return (
    // Pola v2 (15 Sep 2026): kepala terang seperti .data-table, judul MENEMPEL saat digulir ke bawah (wadah setinggi layar) dan kolom
    // nama menempel saat digeser ke samping. Freeze-nya ditulis sendiri di sini (bukan PembekuTabel) karena kolom nama selebar
    // itu di HP melebihi batas 55% PembekuTabel. Huruf 11px = pengecualian matriks padat (DESIGN_SYSTEM §17.4).
    <div className="overflow-auto max-h-[max(18rem,calc(100dvh-13rem))] overscroll-x-contain">
      <table className={`w-full border-separate border-spacing-0 ${compact ? "text-[11px]" : "text-xs"}`}>
        <thead>
          <tr>
            <th className="sticky left-0 top-0 z-30 whitespace-nowrap border-b border-r border-gray-100 bg-[#f5f6fa] px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-primary-900/60 shadow-[6px_0_8px_-6px_rgba(15,26,69,0.2)]">Siswa</th>
            {dayList.map(d => (
              <th key={d} className={`sticky top-0 z-20 w-7 border-b border-gray-100 px-1.5 py-2 text-center text-[11px] font-bold ${sundays.includes(d) ? "bg-red-50 text-red-700" : "bg-[#f5f6fa] text-primary-900/60"}`}>
                {d}
              </th>
            ))}
            <th className="sticky top-0 z-20 w-8 border-b border-gray-100 bg-amber-50 px-2 py-2 text-center text-[11px] font-bold text-amber-700">S</th>
            <th className="sticky top-0 z-20 w-8 border-b border-gray-100 bg-blue-50 px-2 py-2 text-center text-[11px] font-bold text-blue-700">I</th>
            <th className="sticky top-0 z-20 w-8 border-b border-gray-100 bg-red-50 px-2 py-2 text-center text-[11px] font-bold text-red-700">A</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.id} className="group/baris">
              <td className="sticky left-0 z-10 whitespace-nowrap border-b border-r border-gray-100 bg-white px-3 py-1.5 font-semibold text-primary-900 shadow-[6px_0_8px_-6px_rgba(15,26,69,0.2)] group-hover/baris:bg-[#f8f9fc]">
                {row.name} <span className="font-mono text-[11px] text-gray-400">({row.nis})</span>
              </td>
              {dayList.map(d => {
                const empty = !row.cells[d];
                const suspicious = empty && !sundays.includes(d) && isPastSchoolDay(d);
                return (
                  <td key={d} className={`border-b border-gray-50 px-1.5 py-1.5 text-center ${sundays.includes(d) ? "bg-red-50" : suspicious ? "bg-amber-100" : "group-hover/baris:bg-[#f8f9fc]"} ${CELL_COLOR[row.cells[d] ?? ""] ?? (suspicious ? "text-amber-500 font-bold" : "text-gray-200")}`}
                    title={suspicious ? "Belum ada data absensi — kemungkinan wali kelas belum mengisi" : undefined}>
                    {row.cells[d] === "H" ? "•" : (row.cells[d] ?? "·")}
                  </td>
                );
              })}
              <td className="border-b border-gray-50 bg-amber-50/50 px-2 py-1.5 text-center font-bold text-amber-700">{row.SAKIT}</td>
              <td className="border-b border-gray-50 bg-blue-50/50 px-2 py-1.5 text-center font-bold text-blue-700">{row.IZIN}</td>
              <td className="border-b border-gray-50 bg-red-50/50 px-2 py-1.5 text-center font-bold text-red-700">{row.ALPHA}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
