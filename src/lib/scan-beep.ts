// Nada feedback scan — disintesis client-side (Web Audio API), pola sama persis dgn
// bell-chime.ts (AudioContext singleton, unlock via interaksi user). Tidak butuh file audio.
let sharedCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedCtx) sharedCtx = new Ctor();
  return sharedCtx;
}

export function unlockScanAudio() {
  const ctx = getCtx();
  if (ctx && ctx.state === "suspended") ctx.resume();
}

function tone(freq: number, start: number, dur: number, ctx: AudioContext) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(0.3, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + dur + 0.05);
}

/** Bip pendek naik — dipakai saat scan berhasil (siswa ditandai hadir). */
export function playScanSuccess() {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume();
  tone(1046.5, ctx.currentTime, 0.18, ctx); // C6
}

/** Dua bip datar — dipakai saat siswa sudah pernah absen hari itu (bukan error, cuma info). */
export function playScanInfo() {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume();
  const now = ctx.currentTime;
  tone(783.99, now, 0.12, ctx); // G5
  tone(783.99, now + 0.16, 0.12, ctx);
}

/** Bip rendah — dipakai saat kartu tidak dikenali/error. */
export function playScanError() {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume();
  tone(220, ctx.currentTime, 0.35, ctx); // A3, lebih rendah & panjang = terasa "salah"
}
