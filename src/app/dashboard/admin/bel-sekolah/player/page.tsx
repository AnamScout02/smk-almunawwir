"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, Play, ArrowLeft, Volume2, CheckCircle2 } from "lucide-react";
import { playBellAudio, unlockAudio } from "@/lib/bell-chime";

/** `berlaku` dari server: bel ini dipakai hari ini (profil Reguler / Ujian — src/lib/bel-profil.ts). */
interface BellItem { id: string; label: string; time: string; days: string; audioUrl: string | null; active: boolean; berlaku?: boolean }

const DAY_BY_JS_INDEX: Record<number, string> = { 1: "SENIN", 2: "SELASA", 3: "RABU", 4: "KAMIS", 5: "JUMAT", 6: "SABTU" };

function todayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD — dipakai reset dedup harian
}

/** Halaman Player Bel Sekolah — dibuka di PC TU/Piket yang tersambung ke speaker sekolah,
 * dibiarkan terbuka sepanjang jam sekolah (mode layar penuh). Cek tiap detik apakah waktu
 * sekarang cocok jadwal aktif hari ini, mainkan audio kalau cocok (sekali per jadwal per hari —
 * dedup pakai Set `firedToday`, di-reset otomatis saat tanggal berganti). Browser autoplay policy
 * mengharuskan interaksi user dulu (tombol "Aktifkan Bel") sebelum audio bisa diputar otomatis. */
export default function BelSekolahPlayerPage() {
  const [items, setItems] = useState<BellItem[]>([]);
  const [now, setNow] = useState(new Date());
  const [started, setStarted] = useState(false);
  const [log, setLog] = useState<{ label: string; time: string }[]>([]);
  const firedToday = useRef<Set<string>>(new Set());
  const dateKeyRef = useRef(todayKey());

  useEffect(() => {
    fetch("/api/admin/bell-schedule").then(r => r.json()).then(d => { if (Array.isArray(d)) setItems(d); }).catch(() => {});
  }, []);

  // Refresh daftar jadwal tiap 5 menit — kalau TU ubah jadwal sementara Player sudah kebuka, tidak perlu reload manual.
  useEffect(() => {
    const t = setInterval(() => {
      fetch("/api/admin/bell-schedule").then(r => r.json()).then(d => { if (Array.isArray(d)) setItems(d); }).catch(() => {});
    }, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!started) return;
    const t = setInterval(() => {
      const n = new Date();
      setNow(n);

      const key = todayKey();
      if (key !== dateKeyRef.current) { dateKeyRef.current = key; firedToday.current = new Set(); }

      const dayCode = DAY_BY_JS_INDEX[n.getDay()];
      if (!dayCode) return; // Minggu — sekolah libur
      const hhmm = `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;

      for (const item of items) {
        if (!item.active || item.berlaku === false) continue;
        if (item.time !== hhmm) continue;
        if (!item.days.split(",").includes(dayCode)) continue;
        const fireKey = `${item.id}-${key}`;
        if (firedToday.current.has(fireKey)) continue;
        firedToday.current.add(fireKey);
        playBellAudio(item.audioUrl);
        setLog(l => [{ label: item.label, time: hhmm }, ...l].slice(0, 8));
      }
    }, 1000);
    return () => clearInterval(t);
  }, [started, items]);

  function handleStart() {
    unlockAudio();
    setStarted(true);
  }

  const todayCode = DAY_BY_JS_INDEX[now.getDay()];
  const todaySchedule = items
    .filter(i => i.active && i.berlaku !== false && todayCode && i.days.split(",").includes(todayCode))
    .sort((a, b) => a.time.localeCompare(b.time));
  const nowStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const nextUp = todaySchedule.find(i => i.time > nowStr);

  if (!started) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-8"
        style={{ background: "linear-gradient(135deg, #0A1030 0%, #0F1A45 40%, #1B2B6B 100%)" }}>
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-3xl bg-gold/20 text-gold flex items-center justify-center mx-auto mb-6">
            <Bell size={40} />
          </div>
          <h1 className="font-heading text-2xl font-bold text-white mb-2">Bel Sekolah Otomatis</h1>
          <p className="text-white/60 text-sm mb-8">
            Klik tombol di bawah untuk mengaktifkan pemutaran otomatis. Browser mengharuskan interaksi ini sekali sebelum bel bisa berbunyi otomatis sepanjang hari. Biarkan halaman ini terbuka di layar penuh.
          </p>
          <button onClick={handleStart} className="btn-modal-save text-base mx-auto px-8 py-3.5">
            <Play size={18} /> Aktifkan Bel
          </button>
          <Link href="/dashboard/admin/bel-sekolah" className="flex items-center justify-center gap-1.5 text-white/40 hover:text-white/70 text-xs mt-8 transition">
            <ArrowLeft size={13} /> Kembali ke Kelola Jadwal
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-8 relative"
      style={{ background: "linear-gradient(135deg, #0A1030 0%, #0F1A45 40%, #1B2B6B 100%)" }}>
      <div className="absolute inset-0 opacity-[0.05] pointer-events-none"
        style={{ backgroundImage: "url('/images/pattern-smk-miring.png')", backgroundSize: "226.27px 226.27px", backgroundRepeat: "repeat", filter: "invert(1)" }} />

      <div className="relative flex items-center gap-2 text-emerald-400 text-xs font-semibold mb-6 bg-emerald-500/10 border border-emerald-400/20 px-4 py-2 rounded-full">
        <CheckCircle2 size={14} /> Bel Aktif — jangan tutup halaman ini
      </div>

      <p className="relative font-heading font-bold text-white text-7xl sm:text-8xl tabular-nums tracking-tight">
        {now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
      </p>
      <p className="relative text-white/50 text-sm mt-2 mb-10">
        {now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
      </p>

      {nextUp && (
        <div className="relative bg-white/5 border border-white/10 rounded-2xl px-6 py-4 mb-8 text-center">
          <p className="text-white/40 text-xs uppercase tracking-wide font-semibold mb-1">Bel Berikutnya</p>
          <p className="text-gold font-heading font-bold text-2xl">{nextUp.time}</p>
          <p className="text-white/70 text-sm">{nextUp.label}</p>
        </div>
      )}

      <div className="relative grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl w-full">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <p className="text-white/40 text-xs uppercase tracking-wide font-semibold mb-3">Jadwal Hari Ini</p>
          {todaySchedule.length === 0 ? (
            <p className="text-white/40 text-sm">Tidak ada jadwal bel hari ini.</p>
          ) : (
            <div className="space-y-1.5 max-h-52 overflow-y-auto">
              {todaySchedule.map(i => (
                <div key={i.id} className={`flex items-center justify-between text-sm px-2 py-1.5 rounded-lg ${i.time === nextUp?.time && i.label === nextUp?.label ? "bg-gold/10 text-gold" : "text-white/70"}`}>
                  <span>{i.label}</span>
                  <span className="font-mono">{i.time}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <p className="text-white/40 text-xs uppercase tracking-wide font-semibold mb-3 flex items-center gap-1.5"><Volume2 size={13} /> Baru Diputar</p>
          {log.length === 0 ? (
            <p className="text-white/40 text-sm">Belum ada bel yang berbunyi hari ini.</p>
          ) : (
            <div className="space-y-1.5 max-h-52 overflow-y-auto">
              {log.map((l, i) => (
                <div key={i} className="flex items-center justify-between text-sm text-white/70 px-2 py-1.5">
                  <span>{l.label}</span>
                  <span className="font-mono text-white/40">{l.time}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
