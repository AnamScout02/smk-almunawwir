"use client";
import { useMemo, useRef, useState } from "react";
import { Crop, Loader2, RotateCcw, Check, ImageIcon } from "lucide-react";
import Modal from "@/components/admin/Modal";
import { pindai, sudutPenuh, type Sudut } from "@/lib/pindai-dokumen";
import type { Lang } from "@/lib/lang";

const T = {
  id: {
    judul: "Rapikan Foto Dokumen",
    ketOtomatis: "Tepi kertas sudah diduga otomatis. Geser titik bila belum pas di keempat sudut kertas.",
    ketManual: "Geser keempat titik ke sudut kertas, lalu tekan Luruskan.",
    luruskan: "Luruskan", asli: "Pakai Foto Asli", pakai: "Pakai Hasil Ini", ulang: "Atur Ulang Sudut",
    jernih: "Jernihkan (ratakan cahaya, putihkan kertas)",
    hasil: "Hasil — periksa tulisannya terbaca sebelum dipakai.",
    gagal: "Keempat titik belum membentuk segi empat. Atur ulang letaknya.",
    memproses: "Meluruskan…",
  },
  en: {
    judul: "Tidy Up the Document Photo",
    ketOtomatis: "The paper edges were detected automatically. Drag the dots if they are not on the four corners.",
    ketManual: "Drag the four dots to the paper corners, then press Straighten.",
    luruskan: "Straighten", asli: "Use Original Photo", pakai: "Use This Result", ulang: "Adjust Corners",
    jernih: "Enhance (even out lighting, whiten paper)",
    hasil: "Result — check the text is readable before using it.",
    gagal: "The four dots do not form a quadrilateral. Please adjust them.",
    memproses: "Straightening…",
  },
};

/** PEMINDAI DOKUMEN (8 Okt 2026) — calon menggeser empat sudut kertas, hasilnya dipotong, diluruskan,
 *  dan dijernihkan di peramban (src/lib/pindai-dokumen.ts). Dugaan sudut otomatis hanyalah titik awal:
 *  hasil selalu diperlihatkan dulu, dan "Pakai Foto Asli" selalu tersedia.
 *
 *  `onTutup` dipanggil saat jendela ditutup tanpa memilih — pemanggil yang memutuskan artinya
 *  (saat terbuka otomatis: lanjut dengan foto asli, supaya unggahan tidak pernah menggantung). */
export default function PemindaiDokumen({ kanvas, sudutAwal, lang = "id", onPakai, onAsli, onTutup }: {
  kanvas: HTMLCanvasElement; sudutAwal: Sudut | null; lang?: Lang;
  onPakai: (hasil: HTMLCanvasElement) => void; onAsli: () => void; onTutup: () => void;
}) {
  const t = T[lang];
  const W = kanvas.width, H = kanvas.height;
  const [sudut, setSudut] = useState<Sudut>(() => sudutAwal ?? sudutPenuh(W, H));
  const [jernih, setJernih] = useState(true);
  const [hasil, setHasil] = useState<{ kanvas: HTMLCanvasElement; url: string } | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");
  const svg = useRef<SVGSVGElement>(null);
  const seret = useRef<number | null>(null);
  // Pratinjau dibuat sekali; kanvas aslinya tetap dipakai untuk hasil ukuran penuh.
  const gambar = useMemo(() => kanvas.toDataURL("image/jpeg", 0.7), [kanvas]);

  function titikDari(e: React.PointerEvent) {
    const r = svg.current!.getBoundingClientRect();
    return {
      x: Math.min(W, Math.max(0, ((e.clientX - r.left) / r.width) * W)),
      y: Math.min(H, Math.max(0, ((e.clientY - r.top) / r.height) * H)),
    };
  }
  function gerak(e: React.PointerEvent) {
    if (seret.current === null) return;
    const p = titikDari(e), i = seret.current;
    setSudut(s => s.map((q, j) => (j === i ? p : q)) as Sudut);
  }

  function luruskan(pakaiJernih = jernih) {
    setSibuk(true); setGalat("");
    // Diberi jeda satu bingkai supaya tulisan "Meluruskan…" sempat tampil sebelum hitungan berat.
    requestAnimationFrame(() => setTimeout(() => {
      const k = pindai(kanvas, sudut, pakaiJernih);
      setSibuk(false);
      if (!k) { setGalat(t.gagal); return; }
      setHasil({ kanvas: k, url: k.toDataURL("image/jpeg", 0.8) });
    }, 0));
  }

  const r = Math.max(W, H) * 0.028;
  return (
    <Modal open onClose={onTutup} title={t.judul} size="lg" scrollBody
      footer={hasil ? (
        <>
          <button type="button" className="btn-modal-cancel flex-1" onClick={() => setHasil(null)}><RotateCcw /> {t.ulang}</button>
          <button type="button" className="btn-modal-save flex-1" onClick={() => onPakai(hasil.kanvas)}><Check /> {t.pakai}</button>
        </>
      ) : (
        <>
          <button type="button" className="btn-modal-cancel flex-1" onClick={onAsli}><ImageIcon /> {t.asli}</button>
          <button type="button" className="btn-modal-save flex-1" disabled={sibuk} onClick={() => luruskan()}>
            {sibuk ? <Loader2 className="animate-spin" /> : <Crop />} {sibuk ? t.memproses : t.luruskan}
          </button>
        </>
      )}>
      <>
        <p className="text-sm text-gray-600">{hasil ? t.hasil : sudutAwal ? t.ketOtomatis : t.ketManual}</p>
        <div className="flex justify-center rounded-xl bg-gray-100 p-2">
          {hasil ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={hasil.url} alt="" className="max-h-[55vh] w-auto max-w-full rounded-lg shadow-panel" />
          ) : (
            <div className="relative inline-block max-w-full select-none">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={gambar} alt="" draggable={false} className="block max-h-[55vh] w-auto max-w-full rounded-lg" />
              <svg ref={svg} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full"
                style={{ touchAction: "none" }} onPointerMove={gerak}
                onPointerUp={() => { seret.current = null; }} onPointerCancel={() => { seret.current = null; }}>
                <polygon points={sudut.map(p => `${p.x},${p.y}`).join(" ")} fill="rgb(232 160 32 / 0.14)" stroke="#E8A020" strokeWidth={r * 0.22} strokeLinejoin="round" />
                {sudut.map((p, i) => (
                  <g key={i} style={{ cursor: "grab" }}
                    onPointerDown={e => { seret.current = i; (e.currentTarget as SVGGElement).setPointerCapture(e.pointerId); }}>
                    {/* Lingkaran luar tembus pandang = bidang sentuh yang lebar untuk jari. */}
                    <circle cx={p.x} cy={p.y} r={r * 2.2} fill="rgb(232 160 32 / 0.18)" />
                    <circle cx={p.x} cy={p.y} r={r * 0.8} fill="#fff" stroke="#B87D0E" strokeWidth={r * 0.25} />
                  </g>
                ))}
              </svg>
            </div>
          )}
        </div>
        <label className="sentuh flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={jernih} className="h-4 w-4 rounded border-gray-300"
            onChange={e => { setJernih(e.target.checked); if (hasil) luruskan(e.target.checked); }} />
          {t.jernih}
        </label>
        {galat && <p className="error-msg">{galat}</p>}
      </>
    </Modal>
  );
}
