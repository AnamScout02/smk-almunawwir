"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { Trophy, AlertTriangle, Maximize2, Minimize2, Medal, Loader2, Sparkles, Crown, Star, ChevronLeft, ChevronRight, CalendarDays, Users2 } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";

interface TeacherRow {
  userId: string; teacherName: string; teacherNip: string;
  totalPoin: number; skorRataRata: number; totalBlokSeharusnya: number; totalBlokTercatat: number; persentaseHadir: number;
  countHadir: number; countTerlambat: number; countIzin: number; countSakit: number; countAlpha: number;
}
interface LeaderboardData { topDisiplin: TeacherRow[]; perluPerhatian: TeacherRow[]; periodLabel: string }

type Period = "week" | "month";

function todayStr() { return new Date().toISOString().slice(0, 10); }

function shiftDate(dateStr: string, period: Period, dir: 1 | -1): string {
  const d = new Date(dateStr);
  if (period === "week") {
    d.setUTCDate(d.getUTCDate() + dir * 7);
  } else {
    d.setUTCDate(1); // hindari overflow tanggal (mis. 31 Jan + 1 bulan = 3 Mar kalau tidak di-set ke 1 dulu)
    d.setUTCMonth(d.getUTCMonth() + dir);
  }
  return d.toISOString().slice(0, 10);
}

const RANK_BADGE = ["🥇", "🥈", "🥉"];
const RANK_GLOW = [
  "ring-2 ring-gold/60 bg-gradient-to-r from-gold/[0.14] via-gold/5 to-transparent",
  "ring-1 ring-gray-300/70 bg-gradient-to-r from-gray-100/70 via-transparent to-transparent",
  "ring-1 ring-amber-700/25 bg-gradient-to-r from-amber-50/80 via-transparent to-transparent",
];
const RANK_BAR = ["bg-gradient-to-r from-gold to-amber-400", "bg-gradient-to-r from-gray-300 to-gray-400", "bg-gradient-to-r from-amber-600 to-amber-700"];
const CONFETTI_COLORS = ["#E8A020", "#0F1A45", "#22c55e", "#ef4444", "#a855f7"];

/** Angka "menghitung naik" dari 0 ke `target` tiap kali `target` berubah (bukan cuma sekali saat
 * mount) — memberi kesan hidup/real-time tiap 30 detik papan ini refresh, bukan cuma statis. */
function useCountUp(target: number, durationMs = 700) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf: number;
    const start = performance.now();
    const from = 0;
    function tick(now: number) {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(from + (target - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return value;
}

function ScoreValue({ value, decimals = 2, className = "" }: { value: number; decimals?: number; className?: string }) {
  const animated = useCountUp(value);
  return <span className={className}>{animated.toFixed(decimals)}</span>;
}

function ProgressBar({ percent, colorClass }: { percent: number; colorClass: string }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(percent), 80);
    return () => clearTimeout(t);
  }, [percent]);
  return (
    <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden mt-1.5">
      <div className={`h-full rounded-full transition-all duration-700 ease-out ${colorClass}`} style={{ width: `${width}%` }} />
    </div>
  );
}

/** Confetti kecil yang terus "naik" di belakang baris juara #1 — efek perayaan ringan, tidak
 * mengganggu keterbacaan (opacity rendah, di belakang teks via z-index/absolute). */
function Confetti() {
  return (
    <>
      {[...Array(10)].map((_, i) => (
        <span key={i} className="confetti-piece"
          style={{
            left: `${4 + i * 9.5}%`, bottom: 0, width: 4, height: 4,
            background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            borderRadius: i % 2 === 0 ? "9999px" : "2px",
            animationDelay: `${i * 0.22}s`,
          }} />
      ))}
    </>
  );
}

export default function DisciplineLeaderboard({ onSwitchTab }: { onSwitchTab?: () => void } = {}) {
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [period, setPeriod] = useState<Period>("week");
  const [refDate, setRefDate] = useState(todayStr());
  const fullscreenRef = useRef<HTMLDivElement>(null);

  const isNow = refDate === todayStr();

  const load = useCallback(() => {
    fetch(`/api/kedisiplinan/leaderboard?period=${period}&date=${refDate}`)
      .then(r => r.json())
      .then(d => { setData(d); setRefreshTick(n => n + 1); })
      .catch(() => {}).finally(() => setLoading(false));
  }, [period, refDate]);

  useEffect(() => {
    setLoading(true);
    load();
    // Auto-refresh cuma relevan kalau sedang lihat periode SEKARANG (live) — kalau sedang lihat
    // minggu/bulan yang sudah lewat, datanya sudah final, tidak perlu polling terus-menerus.
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
    // Fullscreen-kan WRAPPER LUAR TANPA PADDING (fullscreenRef) — bukan document.documentElement
    // (supaya sidebar/navbar aplikasi tidak ikut tampil) DAN bukan div konten yang masih ber-padding
    // (itu penyebab celah putih di atas: padding milik div itu sendiri ikut jadi bagian dari area
    // fullscreen, sementara PageHeader di dalamnya menghitung bleed-nya relatif ke padding TERSEBUT
    // — begitu jadi elemen fullscreen, browser mengukur ulang dari 0 sehingga sisa ~padding jadi
    // celah kosong di tepi atas). Padding sekarang dipindah ke div ANAK, wrapper luar polos.
    if (document.fullscreenElement) document.exitFullscreen();
    else fullscreenRef.current?.requestFullscreen();
  }

  return (
    <div ref={fullscreenRef} className="[&:fullscreen]:bg-[#f0f2f7] [&:fullscreen]:overflow-y-auto">
      <div className="p-6 lg:p-8 pt-16 lg:pt-8">
        {/* Saat layar penuh, header+filter+navigasi disembunyikan — permintaan user supaya benar2
            cuma tabel/papan yang terlihat (dipasang utk tampilan TV/monitor umum). Tombol keluar
            layar penuh dipindah jadi tombol mengambang kecil di pojok, satu2nya kontrol yg tersisa. */}
        {!fullscreen && (
          <>
          <PageHeader
            icon={<Trophy size={22} className="wiggle-loop" />}
            title="Papan Peringkat Kedisiplinan Guru"
            description={
              data ? (
                <span key={refreshTick} className="inline-flex items-center gap-2 num-flash">
                  {isNow && <span className="live-dot text-emerald-400" />}
                  {period === "week" ? "Minggu" : "Bulan"}: {data.periodLabel}
                  {isNow ? " — update otomatis tiap 30 detik" : " (riwayat)"}
                </span>
              ) : "Memuat..."
            }
          />
          <div className="flex flex-wrap items-center gap-2 mb-5">
            {onSwitchTab && (
              <button onClick={onSwitchTab}
                className="btn-modal-cancel whitespace-nowrap">
                <Users2 size={15} /> Kinerja Pegawai
              </button>
            )}
            <div className="flex items-center rounded-xl border border-gray-200 overflow-hidden">
              <button onClick={() => setPeriod("week")}
                className={`px-3 py-2 text-xs font-semibold transition-colors ${period === "week" ? "bg-primary-900 text-white" : "text-gray-500 hover:bg-gray-50"}`}>
                Minggu
              </button>
              <button onClick={() => setPeriod("month")}
                className={`px-3 py-2 text-xs font-semibold transition-colors ${period === "month" ? "bg-primary-900 text-white" : "text-gray-500 hover:bg-gray-50"}`}>
                Bulan
              </button>
            </div>
            <div className="flex items-center rounded-xl border border-gray-200 overflow-hidden">
              <button onClick={() => setRefDate(d => shiftDate(d, period, -1))} className="p-2.5 text-gray-500 hover:bg-gray-50 transition-colors" title="Sebelumnya">
                <ChevronLeft size={15} />
              </button>
              {!isNow && (
                <button onClick={() => setRefDate(todayStr())} className="px-2.5 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-50 transition-colors flex items-center gap-1 border-x border-gray-200" title="Kembali ke sekarang">
                  <CalendarDays size={13} /> Sekarang
                </button>
              )}
              <button onClick={() => setRefDate(d => shiftDate(d, period, 1))} disabled={isNow} className="p-2.5 text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed" title="Berikutnya">
                <ChevronRight size={15} />
              </button>
            </div>
            <button onClick={toggleFullscreen} className="btn-modal-cancel whitespace-nowrap sm:ml-auto">
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
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-400" size={28} /></div>
        ) : !data || (data.topDisiplin.length === 0 && data.perluPerhatian.length === 0) ? (
          <EmptyState icon={Trophy} title="Belum Ada Data Periode Ini" description="Papan peringkat akan terisi begitu Buku Piket mulai dicatat pada periode ini." />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="panel relative overflow-hidden card-fade-up podium-glow">
              <div className="relative px-5 py-4 flex items-center gap-2 border-b border-gray-50 overflow-hidden" style={{ background: "linear-gradient(135deg, rgba(217,164,65,0.16) 0%, rgba(217,164,65,0.03) 100%)" }}>
                {/* Partikel mengambang halus di header — hidup tapi tidak mengganggu keterbacaan */}
                {[...Array(6)].map((_, p) => (
                  <span key={p} className="absolute rounded-full bg-gold/40 pointer-events-none"
                    style={{
                      width: 3 + (p % 3), height: 3 + (p % 3), left: `${8 + p * 16}%`, bottom: "-6px",
                      animation: `floatParticle ${5 + p}s ease-in-out ${p * 0.6}s infinite`,
                    }} />
                ))}
                <div className="absolute inset-0 opacity-40 pointer-events-none"
                  style={{ backgroundImage: "linear-gradient(120deg, transparent 30%, rgba(217,164,65,0.25) 50%, transparent 70%)", backgroundSize: "200% 100%", animation: "shimmer 4s ease-in-out infinite" }} />
                <Trophy size={18} className="text-gold relative" />
                <h3 className="font-heading font-semibold text-primary-900 relative">Paling Disiplin</h3>
                <span className="relative ml-auto text-xs font-bold text-gold/80 uppercase tracking-widest hidden sm:inline-flex items-center gap-1">
                  <Star size={11} className="spin-slow" /> Live Ranking
                </span>
              </div>
              {data.topDisiplin.length === 0 ? (
                <p className="text-center py-10 text-gray-400 text-sm">Belum ada data.</p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {data.topDisiplin.map((t, i) => (
                    <div key={t.userId}
                      className={`relative flex items-center gap-3 px-5 py-3.5 overflow-hidden card-fade-up transition-all hover:-translate-y-0.5 hover:shadow-md hover:z-10 hover:bg-gray-50/50 ${i < 3 ? RANK_GLOW[i] : ""} ${i === 0 ? "py-4" : ""}`}
                      style={{ animationDelay: `${Math.min(i, 20) * 40}ms` }}>
                      {i === 0 && <Confetti />}
                      <div className="w-9 text-center font-heading font-bold shrink-0 relative">
                        {i === 0 && (
                          <>
                            <span className="absolute -inset-2 rounded-full pointer-events-none overflow-hidden" style={{ opacity: 0.35 }}>
                              <span className="block w-full h-full rounded-full spin-slow"
                                style={{ background: "conic-gradient(from 0deg, #E8A020, transparent, #E8A020)" }} />
                            </span>
                            <Crown size={16} className="absolute -top-4 left-1/2 -translate-x-1/2 text-gold drop-shadow-sm" style={{ animation: "float 3s ease-in-out infinite" }} />
                            <Sparkles size={13} className="absolute -top-1.5 -right-2 text-gold animate-pulse" />
                          </>
                        )}
                        {i < 3
                          ? <span className={`inline-block text-2xl bounce-in hover:scale-125 transition-transform relative ${i === 0 ? "rank-pulse" : ""}`}>{RANK_BADGE[i]}</span>
                          : <span className="text-gray-300 text-lg">{i + 1}</span>}
                      </div>
                      <div className="min-w-0 flex-1 relative">
                        <p className={`font-semibold text-primary-900 truncate ${i === 0 ? "text-base" : "text-sm"}`}>
                          {t.teacherName}
                          {i === 0 && <span className="ml-2 text-xs font-bold text-gold/90 bg-gold/10 px-1.5 py-0.5 rounded-full align-middle">JUARA MINGGU INI</span>}
                        </p>
                        <p className="text-xs text-gray-400">{t.totalBlokTercatat}/{t.totalBlokSeharusnya} blok tercatat · {t.persentaseHadir}% hadir · {t.totalPoin} poin total</p>
                        {i < 3 && <ProgressBar percent={t.persentaseHadir} colorClass={RANK_BAR[i]} />}
                      </div>
                      <div className="text-right shrink-0 relative">
                        <p className={`font-heading font-bold ${i === 0 ? "text-2xl text-gold" : "text-lg text-primary-900"}`}>
                          <ScoreValue key={refreshTick} value={t.skorRataRata} />
                        </p>
                        <p className="text-xs text-gray-400 uppercase tracking-wide">skor/blok</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="panel overflow-hidden card-fade-up" style={{ animationDelay: "80ms" }}>
              <div className="px-5 py-4 flex items-center gap-2 border-b border-gray-50" style={{ background: "linear-gradient(135deg, rgba(220,38,38,0.08) 0%, rgba(220,38,38,0.02) 100%)" }}>
                <AlertTriangle size={18} className="text-red-500" />
                <h3 className="font-heading font-semibold text-primary-900">Perlu Perhatian</h3>
              </div>
              {data.perluPerhatian.length === 0 ? (
                <p className="text-center py-10 text-gray-400 text-sm">Tidak ada guru yang perlu perhatian khusus minggu ini. 🎉</p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {data.perluPerhatian.map((t, i) => (
                    <div key={t.userId} className="flex items-center gap-3 px-5 py-3.5 card-fade-up transition-all hover:-translate-y-0.5 hover:shadow-sm hover:bg-red-50/30"
                      style={{ animationDelay: `${Math.min(i, 20) * 40}ms` }}>
                      <Medal size={16} className="text-gray-300 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-primary-900 truncate">{t.teacherName}</p>
                        <p className="text-xs text-gray-400">
                          {t.countAlpha > 0 && <span className="text-red-500 font-medium">{t.countAlpha}x Alpha </span>}
                          {t.countTerlambat > 0 && <span className="text-amber-600 font-medium">{t.countTerlambat}x Terlambat</span>}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-heading font-bold text-red-500 text-lg"><ScoreValue key={refreshTick} value={t.totalPoin} decimals={0} /></p>
                        <p className="text-xs text-gray-400 uppercase tracking-wide">poin</p>
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
