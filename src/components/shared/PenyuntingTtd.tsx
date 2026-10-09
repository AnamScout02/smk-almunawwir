"use client";
import { useEffect, useRef, useState } from "react";
import { Eraser, Loader2, PenLine, Upload } from "lucide-react";

/** Penyunting TTD: GAMBAR langsung di layar (jari / pena / tetikus) atau UNGGAH foto/scan TTD di kertas putih.
 *  Mengirim ke `endpoint` (PUT) — server yang menjadikan latarnya transparan & merapikan (src/lib/ttd.ts).
 *  Dipakai kartu Profil (TTD sendiri) dan halaman Tanda Tangan Pegawai (TU untuk pegawai lain). */
export default function PenyuntingTtd({ endpoint, onSelesai, onBatal, ekstra, labelSimpan = "Simpan Tanda Tangan", siap = true }: {
  endpoint: string; onSelesai: () => void; onBatal?: () => void;
  /** Isian tambahan yang ikut terkirim (mis. nama & hubungan penanda tangan pakta SPMB). */
  ekstra?: Record<string, string>; labelSimpan?: string;
  /** false = tombol simpan/unggah dinonaktifkan (mis. isian ekstra belum lengkap). */
  siap?: boolean;
}) {
  const [mode, setMode] = useState<"gambar" | "unggah">("gambar");
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");
  const [adaGoresan, setAdaGoresan] = useState(false);
  const kanvas = useRef<HTMLCanvasElement>(null);
  const terakhir = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const c = kanvas.current;
    if (!c || mode !== "gambar") return;
    const skala = window.devicePixelRatio || 1;
    c.width = c.clientWidth * skala; c.height = c.clientHeight * skala;
    const ctx = c.getContext("2d")!;
    ctx.scale(skala, skala);
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.clientWidth, c.clientHeight);
    ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#0b1440"; ctx.lineWidth = 2.6;
    setAdaGoresan(false);
  }, [mode]);

  const titik = (e: React.PointerEvent) => {
    const r = kanvas.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const mulai = (e: React.PointerEvent) => { kanvas.current!.setPointerCapture(e.pointerId); terakhir.current = titik(e); };
  const gerak = (e: React.PointerEvent) => {
    if (!terakhir.current) return;
    const p = titik(e), ctx = kanvas.current!.getContext("2d")!;
    ctx.beginPath(); ctx.moveTo(terakhir.current.x, terakhir.current.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    terakhir.current = p; setAdaGoresan(true);
  };
  const henti = () => { terakhir.current = null; };
  const bersihkan = () => {
    const c = kanvas.current!, ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); setAdaGoresan(false);
  };

  async function kirim(badan: BodyInit, json: boolean) {
    setSibuk(true); setGalat("");
    const r = await fetch(endpoint, { method: "PUT", body: badan, headers: json ? { "Content-Type": "application/json" } : undefined }).catch(() => null);
    const d = await r?.json().catch(() => ({}));
    setSibuk(false);
    if (r?.ok) onSelesai(); else setGalat(d?.error ?? "Gagal menyimpan tanda tangan.");
  }

  function simpanGambar() {
    if (!adaGoresan) { setGalat("Goreskan tanda tangan dulu di kotak putih."); return; }
    kirim(JSON.stringify({ ...ekstra, gambar: kanvas.current!.toDataURL("image/png") }), true);
  }
  function unggah(f: File | undefined) {
    if (!f) return;
    const fd = new FormData(); fd.append("file", f);
    for (const [k, v] of Object.entries(ekstra ?? {})) fd.append(k, v);
    kirim(fd, false);
  }

  return (
    <div className="space-y-3">
      <div className="flex w-fit max-w-full flex-wrap gap-1 rounded-xl border border-gray-100 bg-white p-1">
        {([["gambar", "Gambar di layar", PenLine], ["unggah", "Unggah foto", Upload]] as const).map(([k, l, I]) => (
          <button key={k} type="button" onClick={() => { setMode(k); setGalat(""); }}
            className={`sentuh flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition ${mode === k ? "bg-primary-900 text-white" : "text-gray-500 hover:bg-gray-50"}`}>
            <I size={15} /> {l}
          </button>
        ))}
      </div>

      {mode === "gambar" ? (
        <>
          <canvas ref={kanvas} onPointerDown={mulai} onPointerMove={gerak} onPointerUp={henti} onPointerCancel={henti}
            className="h-44 w-full touch-none rounded-xl border-2 border-dashed border-gray-300 bg-white" style={{ cursor: "crosshair" }} />
          <p className="text-xs text-gray-500">Tanda tangani di dalam kotak. Di HP, putar layar mendatar supaya kotaknya lebih lebar.</p>
        </>
      ) : (
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center hover:border-primary-500">
          <Upload size={22} className="text-gray-400" />
          <span className="text-sm font-semibold text-primary-900">Pilih foto / scan tanda tangan</span>
          <span className="text-xs text-gray-500">Tanda tangan dengan tinta gelap di kertas putih polos, lalu foto lurus dari atas. Latar putih otomatis dihapus.</span>
          <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e => unggah(e.target.files?.[0])} disabled={sibuk || !siap} />
        </label>
      )}

      {galat && <p className="error-msg">{galat}</p>}

      <div className="flex flex-wrap justify-end gap-2">
        {onBatal && <button type="button" onClick={onBatal} className="btn-modal-cancel">Batal</button>}
        {mode === "gambar" && (
          <>
            <button type="button" onClick={bersihkan} className="btn-modal-cancel"><Eraser /> Ulangi</button>
            <button type="button" onClick={simpanGambar} disabled={sibuk || !siap} className="btn-modal-save">
              {sibuk ? <Loader2 className="animate-spin" /> : <PenLine />} {labelSimpan}
            </button>
          </>
        )}
        {mode === "unggah" && sibuk && <span className="flex items-center gap-2 text-sm text-gray-500"><Loader2 size={16} className="animate-spin" /> Memproses…</span>}
      </div>
    </div>
  );
}
