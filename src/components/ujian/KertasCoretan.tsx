"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Eraser, PencilLine, Trash2, Undo2, X } from "lucide-react";

/** KERTAS CORETAN DIGITAL — pengganti kertas buram di layar ujian. Coretan disimpan di perangkat
 * (localStorage) per ujian, jadi tidak hilang saat halaman dimuat ulang; TIDAK dikirim ke server
 * dan tidak dinilai. Bisa dipakai dengan mouse, pena, atau jari. */

type Coretan = { w: string; t: number; hapus: boolean; p: [number, number][] };

const LEBAR = 640, TINGGI = 400;
const WARNA = ["#0F1A45", "#1d4ed8", "#dc2626", "#059669"];

export default function KertasCoretan({ kunci, onTutup }: { kunci: string; onTutup: () => void }) {
  const kanvasRef = useRef<HTMLCanvasElement>(null);
  const coretanRef = useRef<Coretan[]>([]);
  const aktifRef = useRef<Coretan | null>(null);
  const [warna, setWarna] = useState(WARNA[0]);
  const [penghapus, setPenghapus] = useState(false);
  const [jumlah, setJumlah] = useState(0);

  const gambarUlang = useCallback(() => {
    const kanvas = kanvasRef.current;
    const ctx = kanvas?.getContext("2d");
    if (!kanvas || !ctx) return;
    ctx.clearRect(0, 0, LEBAR, TINGGI);
    for (const c of [...coretanRef.current, ...(aktifRef.current ? [aktifRef.current] : [])]) {
      if (c.p.length === 0) continue;
      ctx.globalCompositeOperation = c.hapus ? "destination-out" : "source-over";
      ctx.strokeStyle = c.w; ctx.lineWidth = c.t; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(c.p[0][0], c.p[0][1]);
      for (const [x, y] of c.p.slice(1)) ctx.lineTo(x, y);
      if (c.p.length === 1) ctx.lineTo(c.p[0][0] + 0.1, c.p[0][1]);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
  }, []);

  useEffect(() => {
    const kanvas = kanvasRef.current;
    if (!kanvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    kanvas.width = LEBAR * dpr; kanvas.height = TINGGI * dpr;
    kanvas.getContext("2d")?.setTransform(dpr, 0, 0, dpr, 0, 0);
    try { coretanRef.current = JSON.parse(localStorage.getItem(kunci) || "[]") as Coretan[]; } catch { coretanRef.current = []; }
    queueMicrotask(() => setJumlah(coretanRef.current.length));
    gambarUlang();
  }, [kunci, gambarUlang]);

  const simpan = () => {
    coretanRef.current = coretanRef.current.slice(-400);
    setJumlah(coretanRef.current.length);
    try { localStorage.setItem(kunci, JSON.stringify(coretanRef.current)); } catch { /* penyimpanan penuh */ }
  };

  const titik = (e: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect();
    return [Math.round(((e.clientX - r.left) / r.width) * LEBAR * 10) / 10, Math.round(((e.clientY - r.top) / r.height) * TINGGI * 10) / 10];
  };

  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-3 z-50 w-[min(44rem,96vw)] rounded-2xl border border-primary-100 bg-white shadow-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 text-white" style={{ background: "linear-gradient(135deg, #0A1030 0%, #0F1A45 40%, #1B2B6B 100%)" }}>
        <PencilLine size={15} className="text-gold" />
        <span className="font-heading font-semibold text-sm flex-1">Kertas Coretan <span className="font-normal text-white/50 text-xs">— tidak dinilai, tersimpan di perangkat ini</span></span>
        <button onClick={onTutup} className="p-1 rounded-md hover:bg-white/10" title="Tutup"><X size={15} /></button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 border-b border-gray-100">
        {WARNA.map(w => (
          <button key={w} onClick={() => { setWarna(w); setPenghapus(false); }} title="Pena"
            className={`w-7 h-7 rounded-full border-2 ${!penghapus && warna === w ? "border-gold scale-110" : "border-white ring-1 ring-gray-200"}`}
            style={{ backgroundColor: w }} />
        ))}
        <button onClick={() => setPenghapus(p => !p)} title="Penghapus"
          className={`ml-1 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border ${penghapus ? "bg-primary-700 text-white border-primary-700" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}>
          <Eraser size={13} /> Hapus bagian
        </button>
        <button onClick={() => { coretanRef.current.pop(); simpan(); gambarUlang(); }} disabled={jumlah === 0} title="Urungkan"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border bg-white text-gray-600 border-gray-200 hover:bg-gray-50 disabled:opacity-40">
          <Undo2 size={13} /> Urungkan
        </button>
        <button onClick={() => { coretanRef.current = []; simpan(); gambarUlang(); }} disabled={jumlah === 0} title="Bersihkan kertas"
          className="ml-auto flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border bg-red-50 text-red-600 border-red-200 hover:bg-red-100 disabled:opacity-40">
          <Trash2 size={13} /> Bersihkan
        </button>
      </div>
      <div className="p-2 bg-gray-50">
        <canvas ref={kanvasRef}
          className="w-full aspect-[8/5] rounded-xl bg-white border border-gray-200 cursor-crosshair"
          style={{ touchAction: "none", backgroundImage: "linear-gradient(#eef0f8 1px, transparent 1px), linear-gradient(90deg, #eef0f8 1px, transparent 1px)", backgroundSize: "24px 24px" }}
          onPointerDown={e => {
            e.currentTarget.setPointerCapture(e.pointerId);
            aktifRef.current = { w: warna, t: penghapus ? 22 : 2.5, hapus: penghapus, p: [titik(e)] };
            gambarUlang();
          }}
          onPointerMove={e => {
            if (!aktifRef.current) return;
            aktifRef.current.p.push(titik(e));
            gambarUlang();
          }}
          onPointerUp={() => {
            if (!aktifRef.current) return;
            coretanRef.current.push(aktifRef.current);
            aktifRef.current = null;
            simpan();
          }}
          onPointerCancel={() => { aktifRef.current = null; gambarUlang(); }}
        />
      </div>
    </div>
  );
}
