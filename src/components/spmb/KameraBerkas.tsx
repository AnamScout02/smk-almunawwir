"use client";
import { useEffect, useRef, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { deteksiSudut, type Sudut } from "@/lib/pindai-dokumen";
import type { Lang } from "@/lib/lang";

const T = {
  id: {
    dokumen: "Pindai Dokumen", swafoto: "Ambil Foto", bebas: "Ambil Foto",
    bebasKet: "Arahkan kamera ke kegiatan yang sedang dikerjakan, lalu tekan tombol potret.",
    arahkan: "Arahkan kamera ke dokumen. Seluruh kertas terlihat, di atas alas yang warnanya berbeda.",
    tahan: "Tahan, jangan bergerak — memotret otomatis…",
    wajah: "Posisikan wajah di dalam garis. Latar polos dan cahaya dari depan memberi hasil terbaik.",
    memotret: "Memotret…", membuka: "Membuka kamera…", potret: "Potret", tutup: "Tutup",
    ditolak: "Kamera tidak bisa dibuka. Izinkan akses kamera untuk situs ini, atau tutup lalu pilih foto dari galeri.",
  },
  en: {
    dokumen: "Scan Document", swafoto: "Take Photo", bebas: "Take Photo",
    bebasKet: "Point the camera at the activity, then press the shutter.",
    arahkan: "Point the camera at the document. The whole sheet should be visible, on a surface of a different colour.",
    tahan: "Hold still — capturing automatically…",
    wajah: "Place your face inside the outline. A plain background and light from the front work best.",
    memotret: "Capturing…", membuka: "Opening camera…", potret: "Capture", tutup: "Close",
    ditolak: "The camera could not be opened. Allow camera access for this site, or close and choose a photo from the gallery.",
  },
};

/** Kamera bisa dipakai di halaman ini? Hanya di HTTPS (secure context) dan bila peramban menyediakannya. */
export function kameraTersedia(): boolean {
  return typeof window !== "undefined" && window.isSecureContext && !!navigator.mediaDevices?.getUserMedia;
}

const LUAS_MIN = 0.28;   // kertas minimal ±28% bingkai — lebih kecil dari itu hasilnya terlalu buram untuk dibaca
const BUTUH_STABIL = 4;  // 4 pemeriksaan berturut (±1 detik) tanpa bergeser
const JEDA_MS = 250;

/** KAMERA DI DALAM HALAMAN (9 Okt 2026). Mode `dokumen`: kamera belakang, tepi kertas dicari terus-menerus
 *  (deteksiSudut pada bingkai kecil) dan foto diambil SENDIRI begitu kertas terlihat utuh & diam ±1 detik.
 *  Mode `swafoto`: kamera depan dengan garis panduan wajah, dipotret manual.
 *  Mode `bebas`: kamera belakang tanpa panduan, dipotret manual (foto jurnal PKL).
 *  Hasilnya sebuah File yang diteruskan ke jalur unggah biasa — pemindai (sudut, luruskan) & pemeriksa mutu
 *  tetap berjalan di sana, jadi tidak ada jalur kedua. Tombol potret selalu ada bila deteksi tidak berhasil. */
export default function KameraBerkas({ mode, lang = "id", onFoto, onTutup }: {
  mode: "dokumen" | "swafoto" | "bebas"; lang?: Lang; onFoto: (file: File) => void; onTutup: () => void;
}) {
  const t = T[lang];
  const video = useRef<HTMLVideoElement>(null);
  const aliran = useRef<MediaStream | null>(null);
  const selesai = useRef(false);
  const [ukuran, setUkuran] = useState<{ w: number; h: number } | null>(null);
  const [sudut, setSudut] = useState<Sudut | null>(null);
  const [stabil, setStabil] = useState(0);
  const [memotret, setMemotret] = useState(false);
  const [galat, setGalat] = useState(false);

  useEffect(() => {
    let batal = false;
    navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: mode === "swafoto" ? "user" : { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
    }).then(s => {
      if (batal) { s.getTracks().forEach(x => x.stop()); return; }
      aliran.current = s;
      const v = video.current;
      if (!v) return;
      v.srcObject = s;
      v.onloadedmetadata = () => { setUkuran({ w: v.videoWidth, h: v.videoHeight }); v.play().catch(() => {}); };
    }).catch(() => { if (!batal) setGalat(true); });
    return () => { batal = true; aliran.current?.getTracks().forEach(x => x.stop()); aliran.current = null; };
  }, [mode]);

  async function tangkap() {
    const v = video.current, s = aliran.current;
    if (selesai.current || !v || !s || !v.videoWidth) return;
    selesai.current = true;
    setMemotret(true);
    let blob: Blob | null = null;
    // Foto resolusi penuh bila peramban mendukung (Chrome Android) — bingkai video hanya ±1080p.
    try {
      const IC = (window as unknown as { ImageCapture?: new (t: MediaStreamTrack) => { takePhoto: () => Promise<Blob> } }).ImageCapture;
      const trek = s.getVideoTracks()[0];
      if (IC && trek) blob = await Promise.race([new IC(trek).takePhoto(), new Promise<null>(r => setTimeout(() => r(null), 3000))]);
    } catch { blob = null; }
    if (!blob) {
      const c = document.createElement("canvas");
      c.width = v.videoWidth; c.height = v.videoHeight;
      c.getContext("2d")!.drawImage(v, 0, 0);
      blob = await new Promise<Blob | null>(r => c.toBlob(r, "image/jpeg", 0.92));
    }
    if (!blob) { selesai.current = false; setMemotret(false); return; }
    onFoto(new File([blob], `${mode === "dokumen" ? "pindai" : "foto"}-${Date.now()}.jpg`, { type: blob.type || "image/jpeg", lastModified: Date.now() }));
  }

  // Mode dokumen: cari tepi kertas tiap ±250 ms pada bingkai 320 px; diam & utuh ±1 detik → potret sendiri.
  useEffect(() => {
    if (mode !== "dokumen" || !ukuran) return;
    const k = 320 / Math.max(ukuran.w, ukuran.h);
    const w = Math.round(ukuran.w * k), h = Math.round(ukuran.h * k);
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    let lalu: Sudut | null = null, hitung = 0;
    const id = setInterval(() => {
      const v = video.current;
      if (!ctx || !v || v.readyState < 2 || selesai.current) return;
      ctx.drawImage(v, 0, 0, w, h);
      let s: Sudut | null = null;
      try { s = deteksiSudut({ data: ctx.getImageData(0, 0, w, h).data, w, h }); } catch { s = null; }
      if (s) {
        let luas = 0;
        for (let i = 0; i < 4; i++) { const p = s[i], q = s[(i + 1) % 4]; luas += p.x * q.y - q.x * p.y; }
        if (Math.abs(luas) / 2 < w * h * LUAS_MIN) s = null;
      }
      if (s && lalu) {
        const geser = Math.max(...s.map((p, i) => Math.hypot(p.x - lalu![i].x, p.y - lalu![i].y)));
        hitung = geser < Math.hypot(w, h) * 0.025 ? hitung + 1 : 0;
      } else hitung = 0;
      lalu = s;
      setSudut(s ? (s.map(p => ({ x: p.x / k, y: p.y / k })) as Sudut) : null);
      setStabil(hitung);
      if (hitung >= BUTUH_STABIL) tangkap();
    }, JEDA_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, ukuran]);

  const rasio = ukuran ? ukuran.w / ukuran.h : 4 / 3;
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black text-white" role="dialog" aria-label={t[mode]}>
      <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-3">
        <p className="font-heading font-semibold">{t[mode]}</p>
        <button type="button" onClick={onTutup} title={t.tutup} className="sentuh rounded-lg p-2 text-white/70 hover:text-white"><X size={22} /></button>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center px-2">
        {galat ? (
          <p className="max-w-sm px-4 text-center text-sm text-white/80">{t.ditolak}</p>
        ) : (
          <div className="relative overflow-hidden rounded-xl" style={{ width: `min(100%, calc((100dvh - 13rem) * ${rasio}))`, aspectRatio: `${rasio}` }}>
            <video ref={video} playsInline muted autoPlay className="h-full w-full object-cover"
              style={mode === "swafoto" ? { transform: "scaleX(-1)" } : undefined} />
            {!ukuran && <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-white/70"><Loader2 size={18} className="animate-spin" /> {t.membuka}</div>}
            {ukuran && (
              <svg viewBox={`0 0 ${ukuran.w} ${ukuran.h}`} preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
                {mode === "swafoto" ? (
                  <ellipse cx={ukuran.w / 2} cy={ukuran.h * 0.45} rx={Math.min(ukuran.w, ukuran.h) * 0.24} ry={Math.min(ukuran.w, ukuran.h) * 0.32}
                    fill="none" stroke="#fff" strokeOpacity={0.85} strokeWidth={ukuran.w * 0.005} strokeDasharray={`${ukuran.w * 0.02} ${ukuran.w * 0.012}`} />
                ) : mode === "bebas" ? null : sudut ? (
                  <polygon points={sudut.map(p => `${p.x},${p.y}`).join(" ")} fill="rgb(232 160 32 / 0.18)"
                    stroke={stabil >= 2 ? "#34d399" : "#E8A020"} strokeWidth={ukuran.w * 0.006} strokeLinejoin="round" />
                ) : (
                  <rect x={ukuran.w * 0.07} y={ukuran.h * 0.07} width={ukuran.w * 0.86} height={ukuran.h * 0.86} rx={ukuran.w * 0.015}
                    fill="none" stroke="#fff" strokeOpacity={0.6} strokeWidth={ukuran.w * 0.004} strokeDasharray={`${ukuran.w * 0.025} ${ukuran.w * 0.015}`} />
                )}
              </svg>
            )}
          </div>
        )}
      </div>

      <div className="shrink-0 px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3 text-center">
        <p className="mx-auto mb-3 min-h-[2.5rem] max-w-md text-sm text-white/80" role="status">
          {galat ? "" : memotret ? t.memotret : mode === "swafoto" ? t.wajah : mode === "bebas" ? t.bebasKet : sudut ? t.tahan : t.arahkan}
        </p>
        {!galat && (
          <button type="button" onClick={tangkap} disabled={!ukuran || memotret} title={t.potret} aria-label={t.potret}
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-4 border-white/40 bg-white text-primary-900 transition active:scale-95 disabled:opacity-50">
            {memotret ? <Loader2 size={24} className="animate-spin" /> : <span className="h-11 w-11 rounded-full border-2 border-primary-900/20" />}
          </button>
        )}
      </div>
    </div>
  );
}
