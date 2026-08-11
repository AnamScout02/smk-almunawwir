"use client";
import { Calendar } from "lucide-react";
import EmptyState from "@/components/admin/EmptyState";

export interface CalendarRow { id: string; nis: string; name: string; cells: Record<number, string>; SAKIT: number; IZIN: number; ALPHA: number }

const CELL_COLOR: Record<string, string> = {
  H: "text-emerald-600",
  I: "text-blue-600",
  S: "text-amber-600",
  A: "text-red-600 font-bold",
};

/** Tabel jurnal absensi 1 bulan (kolom = tanggal, Minggu diwarnai, rekap S/I/A di ujung) — data
 * dari /api/teacher/attendance/monthly-grid. Dipakai di tab "Kalender Bulanan" AbsensiSiswaManager
 * (read-only, lintas kelas) DAN di panel kanan halaman Input Absensi wali kelas (live, refresh
 * begitu wali kelas simpan absensi hari itu di panel kiri) — satu komponen, dua pemakai, no.14
 * CLAUDE.md (reuse lintas halaman). */
export default function MonthlyAttendanceCalendar({ rows, days, sundays, loading, compact = false }: {
  rows: CalendarRow[]; days: number; sundays: number[]; loading: boolean; compact?: boolean;
}) {
  if (loading) return <div className="py-16 text-center text-gray-400 text-sm">Memuat...</div>;
  if (rows.length === 0) {
    return <EmptyState icon={Calendar} title="Belum Ada Data" description="Belum ada data absensi untuk kelas & bulan ini." />;
  }
  const dayList = Array.from({ length: days }, (_, i) => i + 1);
  return (
    <div className="overflow-x-auto">
      <table className={`w-full border-collapse ${compact ? "text-[10px]" : "text-xs"}`}>
        <thead>
          <tr style={{ background: "linear-gradient(135deg, rgba(15,26,69,0.05) 0%, rgba(27,43,107,0.03) 100%)" }}>
            <th className="text-left px-3 py-2 text-[0.65rem] font-bold uppercase tracking-wide text-primary-500/70 whitespace-nowrap sticky left-0 bg-white z-10">Siswa</th>
            {dayList.map(d => (
              <th key={d} className={`px-1.5 py-2 text-[0.65rem] font-bold text-center w-7 ${sundays.includes(d) ? "bg-red-100 text-red-700" : "text-primary-500/70"}`}>
                {d}
              </th>
            ))}
            <th className="px-2 py-2 text-[0.65rem] font-bold text-center text-amber-700 bg-amber-50 w-8">S</th>
            <th className="px-2 py-2 text-[0.65rem] font-bold text-center text-blue-700 bg-blue-50 w-8">I</th>
            <th className="px-2 py-2 text-[0.65rem] font-bold text-center text-red-700 bg-red-50 w-8">A</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.id} className="border-b border-gray-50 last:border-0 hover:bg-primary-50/30 transition-colors">
              <td className="px-3 py-1.5 font-semibold text-primary-900 whitespace-nowrap sticky left-0 bg-white z-10">
                {row.name} <span className="text-gray-400 font-mono text-[0.65rem]">({row.nis})</span>
              </td>
              {dayList.map(d => (
                <td key={d} className={`px-1.5 py-1.5 text-center font-semibold ${sundays.includes(d) ? "bg-red-50" : ""} ${CELL_COLOR[row.cells[d] ?? ""] ?? "text-gray-200"}`}>
                  {row.cells[d] ?? "·"}
                </td>
              ))}
              <td className="px-2 py-1.5 text-center font-bold text-amber-700 bg-amber-50/50">{row.SAKIT}</td>
              <td className="px-2 py-1.5 text-center font-bold text-blue-700 bg-blue-50/50">{row.IZIN}</td>
              <td className="px-2 py-1.5 text-center font-bold text-red-700 bg-red-50/50">{row.ALPHA}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
