"use client";
import { useState } from "react";
import Image from "next/image";

/** Penggeser sebelum/sesudah (2 Oktober 2026). Geser garis tengah — dengan jari, tetikus, atau tombol
 *  panah papan ketik (memakai <input type="range"> asli supaya aksesibel tanpa kode tambahan).
 *  Foto "sesudah" di bawah, "sebelum" di atas dan dipotong `clip-path` sesuai posisi. */
export default function BandingGambar({ sebelum, sesudah, labelA, labelB, judul }: {
  sebelum: string; sesudah: string; labelA: string; labelB: string; judul: string;
}) {
  const [pos, setPos] = useState(50);
  return (
    <div className="relative aspect-[4/3] w-full select-none overflow-hidden rounded-2xl bg-gray-100">
      <Image src={sesudah} alt={`${judul} — ${labelB}`} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        <Image src={sebelum} alt={`${judul} — ${labelA}`} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
      </div>
      <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/55 px-3 py-1 text-xs font-semibold text-white">{labelA}</span>
      <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-gold px-3 py-1 text-xs font-semibold text-primary-900">{labelB}</span>
      <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-[0_0_0_1px_rgb(0_0_0/.15)]" style={{ left: `${pos}%` }}>
        <span className="absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-primary-900 shadow-lg">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="m9 6-6 6 6 6M15 6l6 6-6 6" /></svg>
        </span>
      </div>
      <input type="range" min={0} max={100} value={pos} onChange={e => setPos(Number(e.target.value))}
        aria-label={`Geser untuk membandingkan ${labelA} dan ${labelB}`}
        className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0" />
    </div>
  );
}
