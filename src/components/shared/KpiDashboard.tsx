"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { Award, TrendingUp, Upload, CheckCircle2, XCircle, Clock, Loader2, Users, ClipboardCheck, Trophy, Crown, Sparkles, Maximize2, Minimize2, Search } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import Select from "@/components/admin/Select";
import Modal from "@/components/admin/Modal";
import FileUpload from "@/components/shared/FileUpload";
import { useToast } from "@/components/shared/ToastProvider";

interface BreakdownItem { indicatorId: string; name: string; weight: number; source: string; score: number }
interface ScoreData { finalScore: number; breakdown: BreakdownItem[]; period: string }
interface Submission {
  id: string; period: string; description: string; fileUrl: string | null; status: string;
  reviewNote: string | null; indicator: { name: string };
  user?: { name: string };
}
interface LeaderRow { userId: string; name: string; nip: string; finalScore: number; breakdown: BreakdownItem[] }

function currentPeriod() { return new Date().toISOString().slice(0, 7); }
function periodLabel(period: string) {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
}
const STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-700 border-amber-200",
  APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  REJECTED: "bg-red-50 text-red-600 border-red-200",
};
const RANK_BADGE = ["🥇", "🥈", "🥉"];
const RANK_GLOW = [
  "ring-2 ring-gold/60 bg-gradient-to-r from-gold/[0.14] via-gold/5 to-transparent",
  "ring-1 ring-gray-300/70 bg-gradient-to-r from-gray-100/70 via-transparent to-transparent",
  "ring-1 ring-amber-700/25 bg-gradient-to-r from-amber-50/80 via-transparent to-transparent",
];
const RANK_BAR = ["bg-gradient-to-r from-gold to-amber-400", "bg-gradient-to-r from-gray-300 to-gray-400", "bg-gradient-to-r from-amber-600 to-amber-700"];
const CONFETTI_COLORS = ["#E8A020", "#0F1A45", "#22c55e", "#ef4444", "#a855f7"];

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
const JABATAN_OPTIONS = [
  { value: "ALL", label: "Semua Jabatan (Gabungan)" },
  { value: "GURU", label: "Guru" },
  { value: "WALI KELAS", label: "Wali Kelas" },
  { value: "Wakil Kepala Kurikulum", label: "Waka Kurikulum" },
  { value: "Wakil Kepala Kesiswaan", label: "Waka Kesiswaan" },
  { value: "Wakil Kepala Humas", label: "Waka Humas" },
  { value: "Wakil Kepala Sarana Prasarana", label: "Waka Sarpras" },
  { value: "Guru BK", label: "Guru BK" },
  { value: "Pustakawan", label: "Pustakawan" },
  { value: "Laboran", label: "Laboran" },
  { value: "Kaprogli", label: "Kaprogli" },
  { value: "Kepala UKS", label: "Kepala UKS" },
  { value: "Koordinator Ekstrakurikuler", label: "Koord. Ekstrakurikuler" },
  { value: "Koordinator BKK", label: "Koord. BKK" },
  { value: "Koordinator Business Center", label: "Koord. Business Center" },
  { value: "Koordinator Branding & Publikasi", label: "Koord. Branding" },
  { value: "Pembina OSIS", label: "Pembina OSIS" },
  { value: "Pembina Pramuka", label: "Pembina Pramuka" },
  { value: "Pengelola Jaringan Sekolah", label: "Pengelola Jaringan" },
  { value: "Security", label: "Security" },
  { value: "Kebersihan", label: "Kebersihan" },
  { value: "Tenaga Administrasi Sekolah", label: "TU" },
  { value: "Operator Sekolah", label: "Operator" },
  { value: "Bendahara", label: "Bendahara" },
];

export default function KpiDashboard({ mode, onSwitchTab }: { mode: "personal" | "leadership"; onSwitchTab?: () => void }) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [score, setScore] = useState<ScoreData | null>(null);
  const [mySubmissions, setMySubmissions] = useState<Submission[]>([]);
  const [reviewQueue, setReviewQueue] = useState<Submission[]>([]);
  const [leaders, setLeaders] = useState<LeaderRow[]>([]);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  // Default "GURU" (bukan JABATAN_OPTIONS[0]) — opsi "Semua Jabatan (Gabungan)" sengaja
  // ditaruh paling atas di dropdown biar gampang ditemukan, tapi TIDAK dijadikan default awal
  // karena mode itu jauh lebih berat (resolve+hitung skor SEMUA pegawai sekaligus), jangan otomatis
  // jalan tiap kali halaman ini dibuka kalau usernya cuma mau lihat Guru seperti biasa.
  const [jabatanFilter, setJabatanFilter] = useState("GURU");
  const [sortBy, setSortBy] = useState("final");
  const [search, setSearch] = useState("");
  const [fullscreen, setFullscreen] = useState(false);
  const fullscreenRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onFsChange() { setFullscreen(!!document.fullscreenElement); }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else fullscreenRef.current?.requestFullscreen();
  }

  const [modalIndicator, setModalIndicator] = useState<BreakdownItem | null>(null);
  const [description, setDescription] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    if (mode === "personal") {
      Promise.all([
        fetch("/api/kpi/score").then(r => r.json()).catch(() => {}),
        fetch("/api/kpi/submissions").then(r => r.json()).catch(() => {}),
      ]).then(([s, subs]) => {
        setScore(s.finalScore !== undefined ? s : null);
        setMySubmissions(Array.isArray(subs) ? subs : []);
      }).catch(() => {}).finally(() => setLoading(false));
    } else {
      Promise.all([
        fetch(`/api/kpi/leaderboard?jabatanName=${encodeURIComponent(jabatanFilter)}&sortBy=${encodeURIComponent(sortBy)}`).then(r => r.json()).catch(() => {}),
        fetch("/api/kpi/submissions?scope=review").then(r => r.json()).catch(() => {}),
      ]).then(([lb, subs]) => {
        setLeaders(Array.isArray(lb.list) ? lb.list : []);
        setReviewQueue(Array.isArray(subs) ? subs : []);
      }).catch(() => {}).finally(() => setLoading(false));
    }
  }, [mode, jabatanFilter, sortBy]);

  useEffect(() => { load(); }, [load]);

  function openSubmitModal(item: BreakdownItem) {
    setModalIndicator(item); setDescription(""); setFileUrl("");
  }

  async function handleSubmitBukti() {
    if (!modalIndicator || !description.trim()) return;
    setSaving(true);
    const res = await fetch("/api/kpi/submissions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ indicatorId: modalIndicator.indicatorId, description, fileUrl: fileUrl || undefined, period: currentPeriod() }),
    });
    setSaving(false);
    if (res.ok) { toast.success("Bukti diajukan, menunggu verifikasi."); setModalIndicator(null); load(); }
    else { const d = await res.json().catch(() => ({})); toast.error(d.error || "Gagal mengajukan bukti"); }
  }

  async function decide(id: string, decision: "APPROVED" | "REJECTED") {
    const res = await fetch(`/api/kpi/submissions/${id}/decide`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision }),
    });
    if (res.ok) { toast.success(decision === "APPROVED" ? "Disetujui" : "Ditolak"); load(); }
    else toast.error("Gagal memproses keputusan");
  }

  if (loading) {
    return <div className="p-6 lg:p-8 pt-16 lg:pt-8 flex justify-center py-16"><Loader2 className="animate-spin text-primary-400" size={28} /></div>;
  }

  if (mode === "personal") {
    return (
      <div className="p-6 lg:p-8 pt-16 lg:pt-8">
        <PageHeader icon={<Award size={22} />} title="Kinerja Saya" description={score ? `Periode ${periodLabel(score.period)}` : "Belum ada data KPI"} />

        {!score ? (
          <EmptyState icon={Award} title="Belum Ada KPI" description="Belum ada indikator kinerja yang ditetapkan untuk jabatan Anda." />
        ) : (
          <>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-5 text-center">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Skor Akhir</p>
              <p className="font-heading text-5xl font-bold text-primary-900">{score.finalScore.toFixed(1)}</p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-50">
                <h3 className="font-heading font-bold text-primary-900">Rincian per Indikator</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {score.breakdown.map(b => (
                  <div key={b.indicatorId} className="px-5 py-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="font-semibold text-primary-900 text-sm">{b.name} <span className="text-gray-400 font-normal">({b.weight}%)</span></p>
                      <p className="font-heading font-bold text-primary-900">{b.score.toFixed(1)}</p>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-primary-500 to-primary-700" style={{ width: `${b.score}%` }} />
                    </div>
                    {b.source === "MANUAL" && (
                      <button onClick={() => openSubmitModal(b)} className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-primary-700 hover:text-gold transition">
                        <Upload size={12} /> Ajukan Bukti
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {mySubmissions.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mt-5">
                <div className="px-5 py-4 border-b border-gray-50"><h3 className="font-heading font-bold text-primary-900">Riwayat Pengajuan</h3></div>
                <div className="divide-y divide-gray-50">
                  {mySubmissions.map(s => (
                    <div key={s.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-primary-900">{s.indicator.name} · {periodLabel(s.period)}</p>
                        <p className="text-xs text-gray-400 truncate">{s.description}</p>
                        {s.reviewNote && <p className="text-xs text-gray-500 mt-0.5">Catatan: {s.reviewNote}</p>}
                      </div>
                      <span className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-full border ${STATUS_BADGE[s.status]}`}>{s.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <Modal open={!!modalIndicator} onClose={() => setModalIndicator(null)} title={`Ajukan Bukti — ${modalIndicator?.name ?? ""}`}
          footer={
            <>
              <button type="button" onClick={() => setModalIndicator(null)} className="btn-modal-cancel flex-1">Batal</button>
              <button type="button" onClick={handleSubmitBukti} disabled={saving || !description.trim()} className="btn-modal-save flex-1 flex items-center justify-center gap-2">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Ajukan
              </button>
            </>
          }>
          <div className="space-y-3">
            <div>
              <label className="label-field">Deskripsi</label>
              <textarea className="input-field resize-none" rows={3} value={description} onChange={e => setDescription(e.target.value)}
                placeholder="Jelaskan kontribusi/kegiatan yang diajukan..." />
            </div>
            <FileUpload value={fileUrl} onChange={setFileUrl} folder="kpi-submissions" label="Bukti (opsional)" />
          </div>
        </Modal>
      </div>
    );
  }

  // ===== mode: leadership =====
  return (
    <div ref={fullscreenRef} className="[&:fullscreen]:bg-[#f0f2f7] [&:fullscreen]:overflow-y-auto">
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      {/* Saat layar penuh, header+filter+antrean verifikasi disembunyikan — biar cuma papan
          ranking-nya yang terlihat (dipasang utk tampilan TV/monitor umum, sama seperti Kedisiplinan). */}
      {!fullscreen && (
      <>
      <PageHeader icon={<Users size={22} className="wiggle-loop" />} title="Kinerja Pegawai" description="Ranking kinerja pegawai berdasarkan KPI bulan berjalan" />
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {onSwitchTab && (
          <button onClick={onSwitchTab}
            className="shrink-0 inline-flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl border border-primary-100 bg-primary-50 text-primary-700 hover:bg-primary-100 transition-all whitespace-nowrap">
            <Trophy size={15} /> Kedisiplinan
          </button>
        )}
        <button onClick={toggleFullscreen}
          className="shrink-0 inline-flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl border border-primary-100 bg-primary-50 text-primary-700 hover:bg-primary-100 transition-all whitespace-nowrap">
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

      {!fullscreen && (
      <>
      <div className="mb-5 -mt-2 flex items-center gap-2">
        <label className="text-xs text-gray-400 font-semibold shrink-0">Jabatan</label>
        <Select value={jabatanFilter} onChange={setJabatanFilter} options={JABATAN_OPTIONS} className="w-auto min-w-[12rem]"
          buttonClassName="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 text-primary-900 font-medium bg-white shadow-sm flex items-center justify-between gap-2 cursor-pointer" />
      </div>

      {reviewQueue.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-5">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
            <ClipboardCheck size={16} className="text-amber-600" />
            <h3 className="font-heading font-bold text-primary-900">Menunggu Verifikasi ({reviewQueue.length})</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {reviewQueue.map(s => (
              <div key={s.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-primary-900">{s.user?.name} — {s.indicator.name}</p>
                  <p className="text-xs text-gray-400 truncate">{s.description}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => decide(s.id, "APPROVED")} className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600 transition" title="Setujui"><CheckCircle2 size={16} /></button>
                  <button onClick={() => decide(s.id, "REJECTED")} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition" title="Tolak"><XCircle size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      </>
      )}

      {leaders.length === 0 ? (
        <EmptyState icon={TrendingUp} title="Belum Ada Data" description="Belum ada guru dengan skor KPI bulan ini." />
      ) : (
        <>
          {!fullscreen && (
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <label className="text-xs text-gray-400 font-semibold shrink-0">Urutkan berdasarkan</label>
            <Select value={sortBy} onChange={setSortBy} className="w-auto min-w-[10rem]"
              options={[{ value: "final", label: "Skor Total" }, ...leaders[0].breakdown.map(b => ({ value: b.name, label: b.name }))]}
              buttonClassName="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 text-primary-900 font-medium bg-white flex items-center justify-between gap-2 cursor-pointer" />
            <div className="relative flex-1 min-w-48 ml-auto">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Cari nama atau NIP..." className="input-field pl-9 text-sm" />
            </div>
          </div>
          )}
          {(() => {
            const q = search.toLowerCase();
            const filteredLeaders = fullscreen ? leaders : leaders.filter(l =>
              !q || l.name.toLowerCase().includes(q) || l.nip.toLowerCase().includes(q)
            );
            if (filteredLeaders.length === 0) {
              return <EmptyState icon={Search} title="Tidak Ditemukan" description="Tidak ada pegawai yang cocok dengan pencarian." />;
            }
            return (
          <div className="relative bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          <div className="px-5 py-4 flex items-center gap-2 border-b border-gray-50"
            style={{ background: "linear-gradient(135deg, rgba(217,164,65,0.16) 0%, rgba(217,164,65,0.03) 100%)" }}>
            <Trophy size={18} className="text-gold" />
            <h3 className="font-heading font-bold text-primary-900">Ranking Kinerja</h3>
            <span className="ml-auto text-[10px] font-bold text-gold/80 uppercase tracking-widest">
              {periodLabel(currentPeriod())}
            </span>
          </div>
          <div className="divide-y divide-gray-50">
            {filteredLeaders.map(l => {
              // Rank badge (emas/perak/perunggu, mahkota) ikut posisi ASLI di ranking penuh, bukan
              // posisi di hasil pencarian — supaya pencarian tidak salah menampilkan "TERBAIK BULAN
              // INI" untuk orang yang sebenarnya bukan peringkat 1.
              const i = leaders.indexOf(l);
              const displayScore = sortBy === "final" ? l.finalScore : (l.breakdown.find(b => b.name === sortBy)?.score ?? 0);
              return (
              <div key={l.userId}
                className={`relative overflow-hidden card-fade-up transition-all hover:-translate-y-0.5 hover:shadow-md hover:z-10 ${i < 3 ? RANK_GLOW[i] : ""}`}
                style={{ animationDelay: `${Math.min(i, 20) * 40}ms` }}>
                {i === 0 && <Confetti />}
                <button onClick={() => setExpandedUserId(expandedUserId === l.userId ? null : l.userId)}
                  className={`w-full flex items-center gap-3 px-5 hover:bg-gray-50/50 transition text-left ${i === 0 ? "py-4" : "py-3.5"}`}>
                  <span className="w-9 text-center font-heading font-bold shrink-0 relative">
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
                  </span>
                  <div className="min-w-0 flex-1 relative">
                    <p className={`font-semibold text-primary-900 truncate ${i === 0 ? "text-base" : "text-sm"}`}>
                      {l.name}
                      {i === 0 && <span className="ml-2 text-[10px] font-bold text-gold/90 bg-gold/10 px-1.5 py-0.5 rounded-full align-middle">TERBAIK BULAN INI</span>}
                    </p>
                    <p className="text-xs text-gray-400">{l.nip}</p>
                    {i < 3 && (
                      <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden mt-1.5">
                        <div className={`h-full rounded-full ${RANK_BAR[i]}`} style={{ width: `${Math.min(100, Math.max(0, displayScore))}%` }} />
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0 relative">
                    <p className={`font-heading font-bold ${i === 0 ? "text-2xl text-gold" : "text-lg text-primary-900"}`}>{displayScore.toFixed(1)}</p>
                    {sortBy !== "final" && <p className="text-[0.65rem] text-gray-400">total {l.finalScore.toFixed(1)}</p>}
                  </div>
                </button>
                {expandedUserId === l.userId && (
                  <div className="px-5 pb-4 pt-1 bg-gray-50/40 space-y-2">
                    {l.breakdown.map(b => (
                      <div key={b.indicatorId} className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">{b.name} ({b.weight}%)</span>
                        <span className="font-semibold text-primary-900">{b.score.toFixed(1)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              );
            })}
          </div>
          </div>
            );
          })()}
        </>
      )}
    </div>
    </div>
  );
}
