"use client";
import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, Check, MousePointerClick, RotateCcw } from "lucide-react";
import HtmlSoal from "@/components/ujian/HtmlSoal";

/** SOAL INTERAKTIF (21 September 2026) — tampilan siswa & tinjauan untuk tiga jenis soal kejuruan:
 *   TitikGambar  : ketuk N titik pada gambar (jawaban ["x,y", …] dalam persen)
 *   SeretLepas   : seret label ke tempatnya pada gambar — atau ketuk label lalu ketuk gambar (andal di HP layar kecil)
 *   Urutkan      : susun langkah dengan tombol naik/turun
 * Koordinat selalu PERSEN gambar, jadi posisi tetap tepat di layar selebar apa pun. Penilaiannya di src/lib/soal.ts. */

type Area = { kode: string; x: number; y: number; w: number; h: number; label?: string };
const posisi = (el: HTMLElement, clientX: number, clientY: number) => {
  const r = el.getBoundingClientRect();
  const x = Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100));
  const y = Math.min(100, Math.max(0, ((clientY - r.top) / r.height) * 100));
  return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
};
const titik = (t: string) => { const [x, y] = t.split(",").map(Number); return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null; };
const dalam = (p: { x: number; y: number }, a: Area) => p.x >= a.x - 1.5 && p.x <= a.x + a.w + 1.5 && p.y >= a.y - 1.5 && p.y <= a.y + a.h + 1.5;

function KotakArea({ a, warna = "emerald" }: { a: Area; warna?: "emerald" | "blue" }) {
  return (
    <div className={`pointer-events-none absolute rounded-md border-2 border-dashed ${warna === "emerald" ? "border-emerald-500 bg-emerald-400/15" : "border-blue-500 bg-blue-400/10"}`}
      style={{ left: `${a.x}%`, top: `${a.y}%`, width: `${a.w}%`, height: `${a.h}%` }}>
      {a.label && <span className="absolute -top-5 left-0 whitespace-nowrap rounded bg-emerald-600 px-1.5 text-xs font-semibold text-white">{a.label}</span>}
    </div>
  );
}

/* ================================ KLIK TITIK ================================ */
export function TitikGambar({ gambar, jumlah, jawaban, onJawab, area }: {
  gambar: string; jumlah: number; jawaban: string[]; onJawab?: (j: string[]) => void; area?: Area[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const daftar = jawaban.map(titik).filter((t): t is { x: number; y: number } => !!t);
  function ketuk(e: React.PointerEvent) {
    if (!onJawab || !ref.current) return;
    const p = posisi(ref.current, e.clientX, e.clientY);
    // Ketuk titik yang sudah ada = hapus titik itu; selain itu tambah (sampai batas).
    const dekat = daftar.findIndex(t => Math.hypot(t.x - p.x, t.y - p.y) < 4);
    if (dekat >= 0) return onJawab(jawaban.filter((_, i) => i !== dekat));
    if (daftar.length >= jumlah) return;
    onJawab([...jawaban, `${p.x},${p.y}`]);
  }
  return (
    <div className="space-y-2">
      {onJawab && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
          <MousePointerClick size={16} className="text-primary-700" />
          <span>Ketuk <strong>{jumlah}</strong> titik pada gambar ({daftar.length}/{jumlah}). Ketuk titik yang sudah dibuat untuk menghapusnya.</span>
          {daftar.length > 0 && <button type="button" onClick={() => onJawab([])} className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-red-600"><RotateCcw size={13} /> Ulangi</button>}
        </div>
      )}
      <div ref={ref} onPointerUp={ketuk} className={`relative inline-block max-w-full select-none touch-manipulation ${onJawab ? "cursor-crosshair" : ""}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={gambar} alt="Gambar soal" draggable={false} className="block h-auto max-w-full rounded-lg border border-gray-200" />
        {area?.map(a => <KotakArea key={a.kode} a={a} />)}
        {daftar.map((t, i) => {
          const kena = area ? area.some(a => dalam(t, a)) : null;
          return (
            <span key={i} className={`pointer-events-none absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-xs font-bold text-white shadow ${kena === null ? "bg-primary-700" : kena ? "bg-emerald-600" : "bg-red-600"}`}
              style={{ left: `${t.x}%`, top: `${t.y}%` }}>{i + 1}</span>
          );
        })}
      </div>
    </div>
  );
}

/* ================================ SERET-LEPAS ================================ */
export function SeretLepas({ gambar, label, jawaban, onJawab, area }: {
  gambar: string; label: { kode: string; teks: string }[]; jawaban: Record<string, string>; onJawab?: (j: Record<string, string>) => void; area?: Area[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pilih, setPilih] = useState<string | null>(null);
  const [seret, setSeret] = useState<{ kode: string; x: number; y: number; mulaiX: number; mulaiY: number } | null>(null);

  const taruh = (kode: string, clientX: number, clientY: number) => {
    if (!onJawab || !ref.current) return false;
    const r = ref.current.getBoundingClientRect();
    if (clientX < r.left || clientX > r.right || clientY < r.top || clientY > r.bottom) return false;
    const p = posisi(ref.current, clientX, clientY);
    onJawab({ ...jawaban, [kode]: `${p.x},${p.y}` });
    return true;
  };

  const dipasang = label.filter(l => jawaban[l.kode]);
  return (
    <div className="space-y-3">
      {onJawab && (
        <p className="text-sm text-gray-600">
          Seret tiap label ke tempatnya pada gambar — atau <strong>ketuk label</strong>, lalu <strong>ketuk gambar</strong>. Ketuk label di gambar untuk memindahkannya.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {label.map(l => {
          const sudah = !!jawaban[l.kode];
          return (
            <button key={l.kode} type="button" disabled={!onJawab}
              // Seret memakai pointer capture: gerak & lepas terus diterima label ini walau jari sudah di atas gambar.
              // Lepas di atas gambar = taruh; gerakan kecil = ketukan (pilih label, lalu ketuk gambar).
              onPointerDown={e => { if (!onJawab) return; e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); setSeret({ kode: l.kode, x: e.clientX, y: e.clientY, mulaiX: e.clientX, mulaiY: e.clientY }); }}
              onPointerMove={e => { if (seret?.kode === l.kode) setSeret({ ...seret, x: e.clientX, y: e.clientY }); }}
              onPointerUp={e => {
                const sr = seret;
                setSeret(null);
                if (!sr || sr.kode !== l.kode) return;
                if (Math.hypot(e.clientX - sr.mulaiX, e.clientY - sr.mulaiY) > 8) { taruh(sr.kode, e.clientX, e.clientY); setPilih(null); }
                else setPilih(p => (p === sr.kode ? null : sr.kode));
              }}
              onPointerCancel={() => setSeret(null)}
              className={`touch-none select-none rounded-full border px-3 py-1.5 text-sm font-semibold transition ${pilih === l.kode ? "border-primary-700 bg-primary-700 text-white" : sudah ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-gray-200 bg-white text-gray-700 hover:border-primary-300"}`}>
              {sudah && <Check size={13} className="mr-1 inline" />}<HtmlSoal as="span" html={l.teks} />
            </button>
          );
        })}
      </div>
      <div ref={ref}
        onPointerUp={e => { if (pilih && !seret) { if (taruh(pilih, e.clientX, e.clientY)) setPilih(null); } }}
        className={`relative inline-block max-w-full select-none touch-manipulation ${pilih ? "cursor-copy ring-2 ring-primary-300 rounded-lg" : ""}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={gambar} alt="Gambar soal" draggable={false} className="block h-auto max-w-full rounded-lg border border-gray-200" />
        {area?.map(a => <KotakArea key={a.kode} a={{ ...a, label: label.find(l => l.kode === a.kode)?.teks.replace(/<[^>]+>/g, "") }} />)}
        {dipasang.map(l => {
          const t = titik(jawaban[l.kode]);
          if (!t) return null;
          const a = area?.find(x => x.kode === l.kode);
          const benar = a ? dalam(t, a) : null;
          return (
            <button key={l.kode} type="button" disabled={!onJawab}
              onPointerUp={e => { e.stopPropagation(); if (!onJawab) return; const j = { ...jawaban }; delete j[l.kode]; onJawab(j); setPilih(l.kode); }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border-2 border-white px-2 py-0.5 text-xs font-semibold text-white shadow ${benar === null ? "bg-primary-700" : benar ? "bg-emerald-600" : "bg-red-600"}`}
              style={{ left: `${t.x}%`, top: `${t.y}%` }}>
              <HtmlSoal as="span" html={l.teks} />
            </button>
          );
        })}
      </div>
      {seret && (
        <span className="pointer-events-none fixed z-[80] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-700 px-3 py-1.5 text-sm font-semibold text-white shadow-lg"
          style={{ left: seret.x, top: seret.y }}>
          <HtmlSoal as="span" html={label.find(l => l.kode === seret.kode)?.teks ?? ""} />
        </span>
      )}
    </div>
  );
}

/* ================================ URUTKAN ================================ */
export function Urutkan({ langkah, jawaban, onJawab, urutanBenar }: {
  langkah: { kode: string; teks: string }[]; jawaban: string[] | null; onJawab?: (j: string[]) => void; urutanBenar?: string[];
}) {
  const kodeSah = new Set(langkah.map(l => l.kode));
  const urut = jawaban && jawaban.length === langkah.length && jawaban.every(k => kodeSah.has(k)) ? jawaban : langkah.map(l => l.kode);
  const peta = new Map(langkah.map(l => [l.kode, l]));
  const geser = (i: number, arah: -1 | 1) => {
    const j = i + arah;
    if (!onJawab || j < 0 || j >= urut.length) return;
    const baru = [...urut];
    [baru[i], baru[j]] = [baru[j], baru[i]];
    onJawab(baru);
  };
  return (
    <div className="space-y-2">
      {onJawab && <p className="text-sm text-gray-600">Susun langkah dari yang pertama sampai terakhir dengan tombol panah.</p>}
      <ol className="space-y-2">
        {urut.map((k, i) => {
          const benar = urutanBenar ? urutanBenar[i] === k : null;
          return (
            <li key={k} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm ${benar === null ? "border-gray-200 bg-white" : benar ? "border-emerald-300 bg-emerald-50" : "border-red-300 bg-red-50"}`}>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary-700">{i + 1}</span>
              <div className="min-w-0 flex-1"><HtmlSoal html={peta.get(k)?.teks ?? ""} /></div>
              {onJawab && (
                <span className="flex shrink-0 gap-1">
                  <button type="button" aria-label="Naikkan" disabled={i === 0} onClick={() => geser(i, -1)} className="rounded-lg border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-50 disabled:opacity-30"><ArrowUp size={16} /></button>
                  <button type="button" aria-label="Turunkan" disabled={i === urut.length - 1} onClick={() => geser(i, 1)} className="rounded-lg border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-50 disabled:opacity-30"><ArrowDown size={16} /></button>
                </span>
              )}
            </li>
          );
        })}
      </ol>
      {onJawab && !jawaban && (
        <button type="button" onClick={() => onJawab(urut)} className="btn-modal-cancel text-xs"><Check size={14} /> Urutan ini sudah benar</button>
      )}
    </div>
  );
}
