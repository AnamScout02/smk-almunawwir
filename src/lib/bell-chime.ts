// Nada bel bawaan — disintesis client-side pakai Web Audio API (2 nada "ding-dong" khas bel
// sekolah), dipakai kalau BellSchedule.audioUrl kosong (TU belum/tidak upload MP3 sendiri).
// TIDAK butuh file audio sama sekali, jadi fitur Bel Sekolah langsung bisa dipakai dari awal.
let sharedCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedCtx) sharedCtx = new Ctor();
  return sharedCtx;
}

/** Buka izin autoplay browser — WAJIB dipanggil dari dalam event klik user (mis. tombol "Aktifkan
 * Bel" di halaman Player) sebelum nada bisa diputar otomatis tanpa interaksi lagi setelahnya. */
export function unlockAudio() {
  const ctx = getCtx();
  if (ctx && ctx.state === "suspended") ctx.resume();
}

export function playChime() {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume();
  const now = ctx.currentTime;
  const notes = [880, 659.25, 880]; // A5 - E5 - A5, khas "ding-dong-ding"
  notes.forEach((freq, i) => {
    const start = now + i * 0.55;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.35, start + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 1.1);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 1.15);
  });
}

/** Nada bawaan berdurasi ±2,25 detik (tiga nada, yang terakhir mulai di 1,10 dan berhenti di 2,25). */
const DURASI_CHIME_MS = 2400;

/** Mainkan audio custom (URL upload TU) kalau ada, kalau tidak fallback ke nada bawaan.
 *
 * Mengembalikan Promise yang selesai saat SUARANYA HABIS — dipakai papan TV untuk mengembalikan volume TV ke
 * nilai semula tepat setelah bel berhenti (lihat src/lib/volume-bel.ts). Promise ini tidak pernah ditolak:
 * berkas rusak pun berakhir pada nada bawaan, sehingga pemanggilnya selalu mendapat isyarat "sudah selesai"
 * dan volume tidak pernah tertinggal keras. */
export function playBellAudio(audioUrl: string | null): Promise<void> {
  if (!audioUrl) return new Promise(res => setTimeout(res, DURASI_CHIME_MS));
  return new Promise(res => {
    const el = new Audio(audioUrl);
    let sudah = false;
    const selesai = () => { if (!sudah) { sudah = true; res(); } };
    el.addEventListener("ended", selesai);
    el.addEventListener("error", () => { playChime(); setTimeout(selesai, DURASI_CHIME_MS); });
    el.play().catch(() => { playChime(); setTimeout(selesai, DURASI_CHIME_MS); });
    // Jaring pengaman: berkas yang macet di tengah tidak boleh menahan volume TV selamanya.
    setTimeout(selesai, 5 * 60_000);
  });
}
