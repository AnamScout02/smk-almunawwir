"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { Trophy, AlertTriangle, Maximize2, Minimize2, Medal, Loader2, ChevronLeft, ChevronRight, CalendarDays, BookMarked, Footprints } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";

interface AktifRow { userId: string; name: string; role: string; className: string | null; visitCount: number; loanCount: number; score: number }
interface PerhatianRow { userId: string; name: string; role: string; className: string | null; count: number; totalDaysLate: number }
interface LeaderboardData { topAktif: AktifRow[]; perluPerhatian: PerhatianRow[]; periodLabel: string }

type Period = "week" | "month" | "all";

const ROLE_LABEL: Record<string, string> = { STUDENT: "Siswa", TEACHER: "Guru", TAS: "Pegawai", ADMIN: "Admin" };
const RANK_BADGE = ["🥇", "🥈", "🥉"];
const RANK_GLOW = [
  "ring-2 ring-gold/60 bg-gradient-to-r from-gold/[0.14] via-gold/5 to-transparent",
  "ring-1 ring-gray-300/70 bg-gradient-to-r from-gray-100/70 via-transparent to-transparent",
  "ring-1 ring-amber-700/25 bg-gradient-to-r from-amber-50/80 via-transparent to-transparent",
];

function todayStr() { return new Date().toISOString().slice(0, 10); }

function shiftDate(dateStr: string, period: Period, dir: 1 | -1): string {
  const d = new Date(dateStr);
  if (period === "month") {
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + dir);
  } else {
    d.setUTCDate(d.getUTCDate() + dir * 7);
  }
  return d.toISOString().slice(0, 10);
}

function roleLine(row: { role: string; className: string | null }) {
  return row.role === "STUDENT" && row.className ? `Siswa · ${row.className}` : ROLE_LABEL[row.role] ?? row.role;
}

/** Papan Peringkat Perpustakaan — siapa yang paling sering berkunjung/meminjam (track record baik)
 * vs siapa yang punya buku terlambat dikembalikan (perlu perhatian). Pola visual & fullscreen sama
 * dengan DisciplineLeaderboard supaya konsisten sebagai "papan" yang bisa dipasang di layar umum. */
export default function LibraryLeaderboard() {
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [period, setPeriod] = useState<Period>("week");
  const [refDate, setRefDate] = useState(todayStr());
  const fullscreenRef = useRef<HTMLDivElement>(null);

  const isNow = refDate === todayStr();

  const load = useCallback(() => {
    fetch(`/api/perpustakaan/leaderboard?period=${period}&date=${refDate}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => {}).finally(() => setLoading(false));
  }, [period, refDate]);

  useEffect(() => {
    setLoading(true);
    load();
    if (!isNow) return;
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, isNow]);

  useEffect(() => {
    function onFsChange() { setFullscreen(!!document.fullscreenElement); }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else fullscreenRef.current?.requestFullscreen();
  }

  return (
    <div ref={fullscreenRef} className="[&:fullscreen]:bg-[#f0f2f7] [&:fullscreen]:overflow-y-auto">
      <div className="p-6 lg:p-8 pt-16 lg:pt-8">
        {!fullscreen && (
          <>
            <PageHeader icon={<Trophy size={22} />} title="Papan Peringkat Perpustakaan"
              description={data ? `${period === "all" ? "Sepanjang waktu" : period === "week" ? "Minggu" : "Bulan"}: ${data.periodLabel}` : "Memuat..."} />
            <div className="flex flex-wrap items-center gap-2 mb-5">
              <div className="flex items-center rounded-xl border border-gray-200 overflow-hidden">
                <button onClick={() => setPeriod("week")} className={`px-3 py-2 text-xs font-semibold transition-colors ${period === "week" ? "bg-gold text-primary-900" : "text-gray-500 hover:bg-gray-50"}`}>Minggu</button>
                <button onClick={() => setPeriod("month")} className={`px-3 py-2 text-xs font-semibold transition-colors ${period === "month" ? "bg-gold text-primary-900" : "text-gray-500 hover:bg-gray-50"}`}>Bulan</button>
                <button onClick={() => setPeriod("all")} className={`px-3 py-2 text-xs font-semibold transition-colors ${period === "all" ? "bg-gold text-primary-900" : "text-gray-500 hover:bg-gray-50"}`}>Semua</button>
              </div>
              {period !== "all" && (
                <div className="flex items-center rounded-xl border border-gray-200 overflow-hidden">
                  <button onClick={() => setRefDate(d => shiftDate(d, period, -1))} className="p-2.5 text-gray-500 hover:bg-gray-50 transition-colors" title="Sebelumnya"><ChevronLeft size={15} /></button>
                  {!isNow && (
                    <button onClick={() => setRefDate(todayStr())} className="px-2.5 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-50 transition-colors flex items-center gap-1 border-x border-gray-200" title="Kembali ke sekarang">
                      <CalendarDays size={13} /> Sekarang
                    </button>
                  )}
                  <button onClick={() => setRefDate(d => shiftDate(d, period, 1))} disabled={isNow} className="p-2.5 text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed" title="Berikutnya"><ChevronRight size={15} /></button>
                </div>
              )}
              <button onClick={toggleFullscreen} className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl border border-primary-100 bg-primary-50 text-primary-700 hover:bg-primary-100 transition-all whitespace-nowrap sm:ml-auto">
                <Maximize2 size={15} /> Layar Penuh
              </button>
            </div>
          </>
        )}

        {fullscreen && (
          <button onClick={toggleFullscreen}
            className="fixed top-4 right-4 z-50 inline-flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl bg-primary-900/90 text-white shadow-lg hover:bg-primary-900 transition-all">
            <Minimize2 size={15} /> Keluar Layar Penuh
          </button>
        )}

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-primary-400" size={28} /></div>
        ) : !data || (data.topAktif.length === 0 && data.perluPerhatian.length === 0) ? (
          <EmptyState icon={Trophy} title="Belum Ada Data Periode Ini" description="Papan peringkat akan terisi begitu ada kunjungan/peminjaman tercatat." />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 flex items-center gap-2 border-b border-gray-50" style={{ background: "linear-gradient(135deg, rgba(217,164,65,0.16) 0%, rgba(217,164,65,0.03) 100%)" }}>
                <Trophy size={18} className="text-gold" />
                <h3 className="font-heading font-bold text-primary-900">Paling Aktif</h3>
              </div>
              {data.topAktif.length === 0 ? (
                <p className="text-center py-10 text-gray-400 text-sm">Belum ada data.</p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {data.topAktif.map((t, i) => (
                    <div key={t.userId} className={`flex items-center gap-3 px-5 py-3.5 transition-all hover:bg-gray-50/50 ${i < 3 ? RANK_GLOW[i] : ""}`}>
                      <div className="w-9 text-center font-heading font-bold shrink-0">
                        {i < 3 ? <span className="inline-block text-2xl">{RANK_BADGE[i]}</span> : <span className="text-gray-300 text-lg">{i + 1}</span>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-primary-900 truncate text-sm">{t.name}</p>
                        <p className="text-xs text-gray-400">{roleLine(t)}</p>
                      </div>
                      <div className="text-right shrink-0 flex items-center gap-3">
                        <span className="flex items-center gap-1 text-xs text-gray-500" title="Kunjungan"><Footprints size={13} /> {t.visitCount}</span>
                        <span className="flex items-center gap-1 text-xs text-gray-500" title="Peminjaman"><BookMarked size={13} /> {t.loanCount}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 flex items-center gap-2 border-b border-gray-50" style={{ background: "linear-gradient(135deg, rgba(220,38,38,0.08) 0%, rgba(220,38,38,0.02) 100%)" }}>
                <AlertTriangle size={18} className="text-red-500" />
                <h3 className="font-heading font-bold text-primary-900">Perlu Perhatian</h3>
                <span className="ml-auto text-[10px] text-gray-400">buku terlambat saat ini</span>
              </div>
              {data.perluPerhatian.length === 0 ? (
                <p className="text-center py-10 text-gray-400 text-sm">Tidak ada buku yang terlambat dikembalikan. 🎉</p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {data.perluPerhatian.map(t => (
                    <div key={t.userId} className="flex items-center gap-3 px-5 py-3.5 transition-all hover:bg-red-50/30">
                      <Medal size={16} className="text-gray-300 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-primary-900 truncate text-sm">{t.name}</p>
                        <p className="text-xs text-gray-400">{roleLine(t)} · {t.count} buku terlambat</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-heading font-bold text-red-500 text-lg">{t.totalDaysLate}</p>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">total hari</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
