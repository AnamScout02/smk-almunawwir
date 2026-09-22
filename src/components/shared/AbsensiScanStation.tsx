"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ScanLine, Play, ArrowLeft, CheckCircle2, Info, XCircle, User, Camera, CameraOff } from "lucide-react";
import { usePindaiKamera } from "@/lib/pindai-kamera";
import { unlockScanAudio, playScanSuccess, playScanInfo, playScanError } from "@/lib/scan-beep";

interface ScanStudent { name: string; avatar: string | null; nis: string; className: string }
interface LogRow { id: string; time: string; name: string; className: string; kind: "success" | "info" | "error"; message: string }

const STATUS_LABEL: Record<string, string> = { HADIR: "Hadir", IZIN: "Izin", SAKIT: "Sakit", ALPHA: "Alfa", DINAS_LUAR: "Dinas luar", CUTI: "Cuti", MASUK: "Jam masuk", PULANG: "Jam pulang" };

/** Stasiun scan absensi fisik (QR/barcode kartu tanda) — mode kiosk full-screen, dibiarkan terbuka
 * di perangkat dekat gerbang/pintu masuk. Scanner USB/laser umum berlaku sbg keyboard (ketik NIS
 * lalu kirim Enter) — sama seperti input "Scan Kartu Anggota" di Perpustakaan. Dipakai lintas
 * portal (Admin & Guru) lewat wrapper tipis, pola no.14 CLAUDE.md — `backHref` beda per portal. */
export default function AbsensiScanStation({ backHref }: { backHref: string }) {
  const [started, setStarted] = useState(false);
  const [now, setNow] = useState(new Date());
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "success" | "info" | "error"; title: string; sub: string; student?: ScanStudent } | null>(null);
  const [log, setLog] = useState<LogRow[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Mode kamera (HP/laptop) — isi QR kartu pelajar = NIS, dikirim lewat alur yang sama dengan scanner USB.
  const [kamera, setKamera] = useState(false);
  const submitRef = useRef<(raw: string) => void>(() => {});
  const { videoRef, status: statusKamera } = usePindaiKamera({ aktif: started && kamera, onKode: kode => submitRef.current(kode) });

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Kiosk: input harus selalu fokus supaya scanner (yg "mengetik" ke elemen aktif) tidak pernah
  // salah sasaran — refokus tiap kali halaman diklik di luar input, dan sesaat setelah tiap scan.
  useEffect(() => {
    if (!started) return;
    function refocus() { inputRef.current?.focus(); }
    refocus();
    document.addEventListener("click", refocus);
    return () => document.removeEventListener("click", refocus);
  }, [started]);

  function handleStart() {
    unlockScanAudio();
    setStarted(true);
  }

  async function submitScan(raw: string) {
    const trimmed = raw.trim();
    setCode("");
    if (!trimmed || loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/absensi-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed }),
      });
      const d = await res.json();
      const time = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

      if (!res.ok) {
        playScanError();
        setFeedback({ kind: "error", title: "Tidak Dikenali", sub: d.error || "Gagal memproses scan" });
        setLog(l => [{ id: crypto.randomUUID(), time, name: trimmed, className: "—", kind: "error" as const, message: d.error || "Gagal" }, ...l].slice(0, 15));
      } else if (d.result === "already") {
        playScanInfo();
        // Kartu pegawai: balasannya memuat jam masuk/pulang, bukan sekadar status absensi siswa.
        const rinci = d.jenis === "PEGAWAI" && d.jamMasuk ? `Masuk ${d.jamMasuk}${d.jamPulang ? ` · pulang ${d.jamPulang}` : ""}` : `Status hari ini: ${STATUS_LABEL[d.status] ?? d.status}`;
        setFeedback({ kind: "info", title: "Sudah Tercatat", sub: rinci, student: d.student });
        setLog(l => [{ id: crypto.randomUUID(), time, name: d.student.name, className: d.student.className, kind: "info" as const, message: rinci }, ...l].slice(0, 15));
      } else if (d.jenis === "PEGAWAI") {
        playScanSuccess();
        const judul = d.status === "PULANG" ? `Jam pulang ${d.jam}` : `Jam masuk ${d.jam}`;
        setFeedback({ kind: "success", title: judul, sub: d.student.className, student: d.student });
        setLog(l => [{ id: crypto.randomUUID(), time, name: d.student.name, className: d.student.className, kind: "success" as const, message: judul }, ...l].slice(0, 15));
      } else {
        playScanSuccess();
        setFeedback({ kind: "success", title: "Berhasil — Hadir", sub: d.student.className, student: d.student });
        setLog(l => [{ id: crypto.randomUUID(), time, name: d.student.name, className: d.student.className, kind: "success" as const, message: "Hadir" }, ...l].slice(0, 15));
      }
    } catch {
      playScanError();
      setFeedback({ kind: "error", title: "Gagal Terhubung", sub: "Periksa koneksi internet perangkat ini." });
    } finally {
      setLoading(false);
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
      feedbackTimer.current = setTimeout(() => setFeedback(null), 4000);
      inputRef.current?.focus();
    }
  }

  submitRef.current = submitScan;

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    submitScan(code);
  }

  if (!started) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8"
        style={{ background: "linear-gradient(135deg, #0A1030 0%, #0F1A45 40%, #1B2B6B 100%)" }}>
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-3xl bg-gold/20 text-gold flex items-center justify-center mx-auto mb-6">
            <ScanLine size={40} />
          </div>
          <h1 className="font-heading text-2xl font-bold text-white mb-2">Absensi Scan QR/Barcode</h1>
          <p className="text-white/60 text-sm mb-8">
            Klik tombol di bawah untuk mengaktifkan stasiun scan, lalu biarkan halaman ini terbuka
            di layar penuh dekat gerbang/pintu masuk. Arahkan scanner ke kartu tanda siswa —
            sistem otomatis menandai hadir.
          </p>
          <button onClick={handleStart} className="btn-modal-save text-base mx-auto px-8 py-3.5">
            <Play size={18} /> Aktifkan Stasiun Scan
          </button>
          <Link href={backHref} className="flex items-center justify-center gap-1.5 text-white/40 hover:text-white/70 text-xs mt-8 transition">
            <ArrowLeft size={13} /> Kembali
          </Link>
        </div>
      </div>
    );
  }

  const feedbackStyle = feedback?.kind === "success"
    ? { ring: "ring-emerald-400/40", bg: "bg-emerald-500/15", text: "text-emerald-300", Icon: CheckCircle2 }
    : feedback?.kind === "info"
    ? { ring: "ring-amber-400/40", bg: "bg-amber-500/15", text: "text-amber-300", Icon: Info }
    : { ring: "ring-red-400/40", bg: "bg-red-500/15", text: "text-red-300", Icon: XCircle };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 relative"
      style={{ background: "linear-gradient(135deg, #0A1030 0%, #0F1A45 40%, #1B2B6B 100%)" }}>
      <div className="absolute inset-0 opacity-[0.05] pointer-events-none"
        style={{ backgroundImage: "url('/images/pattern-smk.png')", backgroundSize: "160px 160px", backgroundRepeat: "repeat", filter: "invert(1)" }} />

      <Link href={backHref} className="absolute top-6 left-6 flex items-center gap-1.5 text-white/40 hover:text-white/70 text-xs transition print:hidden">
        <ArrowLeft size={13} /> Kembali
      </Link>

      <div className="relative flex items-center gap-2 text-emerald-400 text-xs font-semibold mb-6 bg-emerald-500/10 border border-emerald-400/20 px-4 py-2 rounded-full">
        <CheckCircle2 size={14} /> Stasiun Scan Aktif — jangan tutup halaman ini
      </div>

      <p className="relative font-heading font-bold text-white text-6xl sm:text-7xl tabular-nums tracking-tight">
        {now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
      </p>
      <p className="relative text-white/50 text-sm mt-2 mb-8">
        {now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
      </p>

      {/* Input scan — SENGAJA polos & selalu fokus (bukan disembunyikan total), scanner USB/laser
          "mengetik" ke sini lalu kirim Enter, sama pola dgn Perpustakaan. Boleh diketik manual
          juga (fallback kalau scanner tidak tersedia). */}
      <div className="relative w-full max-w-md mb-4 flex justify-center">
        <button type="button" onClick={() => setKamera(k => !k)}
          className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/20 bg-white/10 text-white/80 hover:bg-white/15 text-xs font-semibold">
          {kamera ? <><CameraOff size={14} /> Matikan Kamera</> : <><Camera size={14} /> Pakai Kamera HP</>}
        </button>
      </div>
      {kamera && (
        <div className="relative w-full max-w-md mb-6 rounded-2xl overflow-hidden bg-black aspect-video">
          <video ref={videoRef} muted playsInline className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-[15%] border-2 border-gold/80 rounded-2xl pointer-events-none" />
          {statusKamera !== "aktif" && (
            <div className="absolute inset-0 flex items-center justify-center text-white/70 text-sm text-center p-4">
              {statusKamera === "perlu-https" ? "Kamera hanya bisa dibuka lewat alamat HTTPS." : statusKamera === "ditolak" ? "Izin kamera ditolak." : statusKamera === "meminta-izin" ? "Membuka kamera…" : "Kamera tidak tersedia."}
            </div>
          )}
        </div>
      )}

      <div className="relative w-full max-w-md mb-6">
        <ScanLine size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
        <input
          ref={inputRef}
          value={code}
          onChange={e => setCode(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => setTimeout(() => inputRef.current?.focus(), 50)}
          disabled={loading}
          autoFocus
          placeholder="Arahkan scanner ke kartu, atau ketik NIS lalu Enter..."
          className="w-full bg-white/10 border border-white/20 rounded-2xl pl-11 pr-4 py-3.5 text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-gold/50 focus:bg-white/15 transition-colors font-mono"
        />
      </div>

      {/* Panel feedback — flash hijau/amber/merah tergantung hasil scan terakhir. */}
      <div className={`relative w-full max-w-md rounded-2xl border p-5 mb-8 transition-all duration-300 ${feedback ? `${feedbackStyle.bg} border-white/10 ring-2 ${feedbackStyle.ring}` : "bg-white/5 border-white/10"}`}>
        {feedback ? (
          <div className="flex items-center gap-4">
            {feedback.student?.avatar ? (
              <Image src={feedback.student.avatar} alt="" width={56} height={56} className="w-14 h-14 rounded-2xl object-cover shrink-0" />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center shrink-0"><User size={24} className="text-white/40" /></div>
            )}
            <div className="min-w-0 flex-1">
              <div className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide ${feedbackStyle.text}`}>
                <feedbackStyle.Icon size={14} /> {feedback.title}
              </div>
              <p className="text-white font-heading font-bold text-lg truncate">{feedback.student?.name ?? "—"}</p>
              <p className="text-white/50 text-xs">{feedback.sub}</p>
            </div>
          </div>
        ) : (
          <p className="text-white/30 text-sm text-center py-2.5">Menunggu scan…</p>
        )}
      </div>

      <div className="relative bg-white/5 border border-white/10 rounded-2xl p-5 max-w-md w-full">
        <p className="text-white/40 text-xs uppercase tracking-wide font-semibold mb-3">Riwayat Scan Hari Ini</p>
        {log.length === 0 ? (
          <p className="text-white/40 text-sm">Belum ada yang scan.</p>
        ) : (
          <div className="space-y-1.5 max-h-64 overflow-y-auto scrollbar-visible">
            {log.map(row => (
              <div key={row.id} className="flex items-center justify-between gap-3 text-sm px-2 py-1.5 rounded-lg">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${row.kind === "success" ? "bg-emerald-400" : row.kind === "info" ? "bg-amber-400" : "bg-red-400"}`} />
                <span className="text-white/70 flex-1 min-w-0 truncate">{row.name}</span>
                <span className="text-white/30 text-xs shrink-0">{row.className}</span>
                <span className="font-mono text-white/40 text-xs shrink-0">{row.time}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
