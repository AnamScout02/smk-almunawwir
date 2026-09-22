"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, DoorOpen, Loader2, Maximize2, Play, ScanLine, User } from "lucide-react";
import { usePindaiKamera } from "@/lib/pindai-kamera";
import { unlockScanAudio, playScanError, playScanInfo, playScanSuccess } from "@/lib/scan-beep";

interface Rekap { hariIni: number; terakhir: { id: string; nama: string; kelas: string | null; jam: string }[] }
type Sambutan = { jenis: "baru" | "sudah" | "galat"; judul: string; isi: string } | null;

const NAVY = "linear-gradient(135deg, #0A1030 0%, #0F1A45 40%, #1B2B6B 100%)";

/** KIOSK KUNJUNGAN PERPUSTAKAAN — dibiarkan terbuka di pintu masuk. Pengunjung memindai kartu (scanner USB atau
 * kamera perangkat kiosk); nama disapa di layar dan kunjungan tercatat untuk laporan & papan peringkat. */
export default function KioskKunjungan() {
  const [mulai, setMulai] = useState(false);
  const [kamera, setKamera] = useState(false);
  const [kode, setKode] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [rekap, setRekap] = useState<Rekap | null>(null);
  const [sambutan, setSambutan] = useState<Sambutan>(null);
  const [jam, setJam] = useState(new Date());
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/perpustakaan/kunjungan-pindai").then(r => (r.ok ? r.json() : null)).then(d => d && setRekap(d)).catch(() => {});
    const t = setInterval(() => setJam(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!mulai) return;
    const fokus = () => inputRef.current?.focus();
    fokus();
    document.addEventListener("click", fokus);
    return () => document.removeEventListener("click", fokus);
  }, [mulai]);

  const kirim = useCallback(async (raw: string) => {
    const k = raw.trim();
    setKode("");
    if (!k || sibuk) return;
    setSibuk(true);
    try {
      const r = await fetch("/api/perpustakaan/kunjungan-pindai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kode: k }) });
      const d = await r.json();
      if (!r.ok) { playScanError(); setSambutan({ jenis: "galat", judul: "Kartu tidak dikenali", isi: d.error ?? "Coba pindai lagi atau lapor petugas." }); }
      else {
        setRekap({ hariIni: d.hariIni, terakhir: d.terakhir });
        const panggilan = d.anggota.nama;
        if (d.hasil === "TERCATAT") { playScanSuccess(); setSambutan({ jenis: "baru", judul: `Selamat datang, ${panggilan}!`, isi: d.anggota.kelas ? `${d.anggota.kelas} · selamat membaca` : "Selamat membaca" }); }
        else { playScanInfo(); setSambutan({ jenis: "sudah", judul: `Halo lagi, ${panggilan}`, isi: "Kunjungan Anda sudah tercatat dalam 30 menit terakhir." }); }
      }
    } catch {
      playScanError(); setSambutan({ jenis: "galat", judul: "Koneksi terputus", isi: "Periksa jaringan perangkat kiosk." });
    } finally {
      setSibuk(false);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setSambutan(null), 4500);
      inputRef.current?.focus();
    }
  }, [sibuk]);

  const { videoRef, status } = usePindaiKamera({ aktif: mulai && kamera, onKode: k => kirim(k) });

  if (!mulai) {
    return (
      <div className="flex min-h-[calc(100dvh-var(--tinggi-kepala-portal,111px))] items-center justify-center p-6" style={{ background: NAVY }}>
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-3xl bg-gold/20 text-gold flex items-center justify-center mx-auto mb-5"><DoorOpen size={40} /></div>
          <h1 className="font-heading text-2xl font-bold text-white mb-2">Kiosk Kunjungan Perpustakaan</h1>
          <p className="text-white/60 text-sm mb-6">Aktifkan lalu biarkan terbuka di pintu masuk. Pengunjung cukup memindai kartu pelajar/tanda atau kartu anggota digital di HP.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <button type="button" onClick={() => { unlockScanAudio(); setMulai(true); }} className="btn-modal-save px-6 py-3"><Play size={18} /> Aktifkan (scanner)</button>
            <button type="button" onClick={() => { unlockScanAudio(); setKamera(true); setMulai(true); }} className="btn-outline inline-flex items-center gap-2 px-6 py-3"><Camera size={18} /> Pakai kamera</button>
          </div>
          {rekap && <p className="text-white/40 text-xs mt-6">{rekap.hariIni} kunjungan tercatat hari ini</p>}
        </div>
      </div>
    );
  }

  const warna = sambutan?.jenis === "baru" ? "ring-emerald-400/50 bg-emerald-500/15" : sambutan?.jenis === "sudah" ? "ring-amber-400/50 bg-amber-500/15" : sambutan ? "ring-red-400/50 bg-red-500/15" : "ring-white/10 bg-white/5";

  return (
    <div className="relative flex min-h-[calc(100dvh-var(--tinggi-kepala-portal,111px))] flex-col items-center justify-center p-6" style={{ background: NAVY }}>
      <div className="absolute top-4 right-4 flex gap-3 text-xs">
        <button type="button" onClick={() => setKamera(k => !k)} className="flex items-center gap-1.5 text-white/50 hover:text-white">{kamera ? <><CameraOff size={13} /> Matikan kamera</> : <><Camera size={13} /> Kamera</>}</button>
        <button type="button" onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})} className="flex items-center gap-1.5 text-white/50 hover:text-white"><Maximize2 size={13} /> Layar penuh</button>
      </div>
      <p className="font-heading font-bold text-white text-6xl tabular-nums">{jam.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</p>
      <p className="text-white/50 text-sm mb-6">{jam.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>

      {kamera && (
        <div className="relative w-full max-w-md aspect-video rounded-2xl overflow-hidden bg-black mb-5">
          <video ref={videoRef} muted playsInline className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-[18%] border-2 border-gold/80 rounded-2xl pointer-events-none" />
          {status !== "aktif" && <div className="absolute inset-0 flex items-center justify-center text-white/70 text-sm">{status === "perlu-https" ? "Kamera hanya bisa dibuka lewat alamat HTTPS." : status === "ditolak" ? "Izin kamera ditolak." : "Membuka kamera…"}</div>}
        </div>
      )}

      <div className={`w-full max-w-md rounded-3xl ring-2 p-6 mb-5 text-center transition-all ${warna}`}>
        {sambutan ? (
          <>
            <div className="w-14 h-14 rounded-2xl bg-white/10 text-white flex items-center justify-center mx-auto mb-3"><User size={26} /></div>
            <p className="font-heading font-bold text-white text-2xl">{sambutan.judul}</p>
            <p className="text-white/60 text-sm mt-1">{sambutan.isi}</p>
          </>
        ) : (
          <p className="text-white/40 py-6 flex items-center justify-center gap-2">{sibuk ? <Loader2 size={18} className="animate-spin" /> : <ScanLine size={18} />} Silakan pindai kartu Anda</p>
        )}
      </div>

      <input ref={inputRef} value={kode} onChange={e => setKode(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); kirim(kode); } }}
        onBlur={() => setTimeout(() => inputRef.current?.focus(), 50)} aria-label="Kode kartu"
        className="w-full max-w-md bg-white/10 border border-white/20 rounded-2xl px-4 py-3 text-white placeholder:text-white/30 text-sm font-mono focus:outline-none focus:border-gold/50"
        placeholder="Arahkan scanner ke kartu, atau ketik NIS/NIP lalu Enter" />

      <div className="w-full max-w-md mt-5 rounded-2xl bg-white/5 border border-white/10 p-4">
        <p className="text-white/40 text-xs uppercase tracking-wide font-semibold mb-2">{rekap?.hariIni ?? 0} kunjungan hari ini</p>
        {!rekap?.terakhir.length ? <p className="text-white/40 text-sm">Belum ada pengunjung.</p> : (
          <ul className="space-y-1">
            {rekap.terakhir.map(v => (
              <li key={v.id} className="flex items-center gap-2 text-sm"><span className="text-white/80 flex-1 truncate">{v.nama}</span><span className="text-white/40 text-xs">{v.kelas ?? ""}</span><span className="text-white/40 text-xs font-mono">{v.jam}</span></li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
