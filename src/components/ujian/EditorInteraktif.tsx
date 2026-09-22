"use client";
import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Plus, SquareDashedMousePointer, Trash2 } from "lucide-react";
import type { AreaGambar, Opsi } from "@/lib/soal";

/** PENYUNTING SOAL INTERAKTIF (21 September 2026) — dipakai SoalEditor (bank soal & penyusun ujian).
 *   EditorGambarArea : unggah gambar, lalu TARIK KOTAK di atas gambar untuk menandai area jawaban.
 *                      TITIK_GAMBAR → tiap kotak = satu bagian yang harus diketuk siswa.
 *                      SERET_LEPAS  → tiap kotak = tempat satu label (kotak baru otomatis membuat label; `kode` label = kode area).
 *   EditorUrutkan    : langkah-langkah dalam URUTAN BENAR; siswa selalu melihatnya teracak (src/lib/ujian-acak.ts).
 * `terkunci` (perbaikan live): jumlah area/label/langkah tidak boleh berubah — jawaban peserta terikat pada kodenya.
 *   Letak area tetap bisa dibetulkan lewat "Gambar ulang" (kotak berikutnya menggantikan area itu). */

const r1 = (n: number) => Math.round(n * 10) / 10;

export function EditorGambarArea({ tipe, gambar, area, label, onChange, terkunci = false }: {
  tipe: "TITIK_GAMBAR" | "SERET_LEPAS";
  gambar: string; area: AreaGambar[]; label: Opsi[];
  onChange: (p: { gambar?: string; area?: AreaGambar[]; opsi?: Opsi[] }) => void;
  terkunci?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const berkasRef = useRef<HTMLInputElement>(null);
  const [mengunggah, setMengunggah] = useState(false);
  const [tarik, setTarik] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  /** Kode area yang sedang digambar ulang — kotak berikutnya menggantikan letaknya, kodenya tetap. */
  const [gantiKode, setGantiKode] = useState<string | null>(null);
  const seret = tipe === "SERET_LEPAS";
  const bolehTarik = !terkunci || gantiKode !== null;

  const pos = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)), y: Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100)) };
  };
  async function unggah(file: File) {
    setMengunggah(true);
    try {
      const fd = new FormData();
      fd.append("file", file); fd.append("folder", "soal");
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      const d = await r.json().catch(() => null);
      if (r.ok && d?.url) onChange({ gambar: d.url });
    } finally { setMengunggah(false); }
  }
  function selesaiTarik() {
    const t = tarik;
    setTarik(null);
    if (!t || !bolehTarik) return;
    const x = Math.min(t.x0, t.x1), y = Math.min(t.y0, t.y1), w = Math.abs(t.x1 - t.x0), h = Math.abs(t.y1 - t.y0);
    if (w < 2 || h < 2) return; // terlalu kecil = klik tak sengaja
    if (gantiKode !== null) {
      onChange({ area: area.map(a => (a.kode === gantiKode ? { ...a, x: r1(x), y: r1(y), w: r1(w), h: r1(h) } : a)) });
      setGantiKode(null);
      return;
    }
    const kodeBaru = String(Math.max(0, ...area.map(a => Number(a.kode) || 0), ...label.map(o => Number(o.kode) || 0)) + 1);
    const baru: AreaGambar = { kode: kodeBaru, x: r1(x), y: r1(y), w: r1(w), h: r1(h) };
    onChange(seret ? { area: [...area, baru], opsi: [...label, { kode: kodeBaru, teks: "" }] } : { area: [...area, baru] });
  }
  const hapus = (kode: string) => onChange(seret ? { area: area.filter(a => a.kode !== kode), opsi: label.filter(o => o.kode !== kode) } : { area: area.filter(a => a.kode !== kode) });
  const namai = (kode: string, teks: string) => seret
    ? onChange({ opsi: label.map(o => (o.kode === kode ? { ...o, teks } : o)) })
    : onChange({ area: area.map(a => (a.kode === kode ? { ...a, label: teks } : a)) });

  return (
    <div className="space-y-3 rounded-xl border border-gray-100 bg-gray-50/60 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <input ref={berkasRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) unggah(f); e.target.value = ""; }} />
        <button type="button" onClick={() => berkasRef.current?.click()} disabled={mengunggah} className="btn-modal-cancel btn-teks text-xs">
          {mengunggah ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />} {gambar ? "Ganti gambar" : "Unggah gambar"}
        </button>
        <span className="text-xs text-gray-500">
          {gambar ? (gantiKode !== null ? "Tarik kotak baru di atas gambar untuk menggantikan letak area yang dipilih."
            : terkunci ? "Jumlah area dikunci selama ujian berjalan — letaknya bisa dibetulkan lewat Gambar ulang." : `Tarik kotak di atas gambar untuk menandai ${seret ? "tempat tiap label" : "bagian yang benar"}.`)
            : "Gambar topologi, denah, rangkaian, bagian mesin/bangunan, dsb."}
        </span>
      </div>
      {gambar && (
        <div ref={ref} className={`relative inline-block max-w-full select-none touch-none ${bolehTarik ? "cursor-crosshair" : ""}`}
          onPointerDown={e => { if (!bolehTarik) return; e.currentTarget.setPointerCapture(e.pointerId); const p = pos(e); setTarik({ x0: p.x, y0: p.y, x1: p.x, y1: p.y }); }}
          onPointerMove={e => { if (tarik) { const p = pos(e); setTarik({ ...tarik, x1: p.x, y1: p.y }); } }}
          onPointerUp={selesaiTarik} onPointerCancel={() => setTarik(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={gambar} alt="Gambar soal" draggable={false} className="block h-auto max-w-full rounded-lg border border-gray-200" />
          {area.map((a, i) => (
            <div key={a.kode} className={`pointer-events-none absolute rounded-md border-2 border-dashed ${a.kode === gantiKode ? "border-amber-500 bg-amber-400/25" : "border-emerald-500 bg-emerald-400/20"}`}
              style={{ left: `${a.x}%`, top: `${a.y}%`, width: `${a.w}%`, height: `${a.h}%` }}>
              <span className="absolute -top-5 left-0 whitespace-nowrap rounded bg-emerald-600 px-1.5 text-xs font-semibold text-white">
                {seret ? (label.find(o => o.kode === a.kode)?.teks || `Label ${i + 1}`) : (a.label || `Area ${i + 1}`)}
              </span>
            </div>
          ))}
          {tarik && (
            <div className="pointer-events-none absolute border-2 border-primary-500 bg-primary-500/15"
              style={{ left: `${Math.min(tarik.x0, tarik.x1)}%`, top: `${Math.min(tarik.y0, tarik.y1)}%`, width: `${Math.abs(tarik.x1 - tarik.x0)}%`, height: `${Math.abs(tarik.y1 - tarik.y0)}%` }} />
          )}
        </div>
      )}
      {area.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-gray-600">{seret ? "Label & tempatnya" : `Area benar — siswa mengetuk ${area.length} titik`}</p>
          {area.map((a, i) => (
            <div key={a.kode} className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-xs text-gray-500">{seret ? `Label ${i + 1}` : `Area ${i + 1}`}</span>
              <input value={seret ? (label.find(o => o.kode === a.kode)?.teks ?? "") : (a.label ?? "")} onChange={e => namai(a.kode, e.target.value)}
                placeholder={seret ? "Nama label, mis. Router" : "Nama bagian (opsional, hanya untuk guru)"} className="input-field flex-1 py-1.5" />
              <button type="button" title={a.kode === gantiKode ? "Batal gambar ulang" : "Gambar ulang letak area ini"}
                onClick={() => setGantiKode(k => (k === a.kode ? null : a.kode))}
                className={`p-1.5 rounded-lg transition ${a.kode === gantiKode ? "bg-amber-100 text-amber-700" : "text-gray-400 hover:text-primary-700 hover:bg-primary-50"}`}>
                <SquareDashedMousePointer size={14} />
              </button>
              {!terkunci && (
                <button type="button" title="Hapus" onClick={() => hapus(a.kode)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"><Trash2 size={14} /></button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function EditorUrutkan({ langkah, onChange, terkunci = false }: {
  langkah: Opsi[]; onChange: (opsi: Opsi[]) => void; terkunci?: boolean;
}) {
  const geser = (i: number, arah: -1 | 1) => {
    const j = i + arah;
    if (j < 0 || j >= langkah.length) return;
    const baru = [...langkah];
    [baru[i], baru[j]] = [baru[j], baru[i]];
    onChange(baru);
  };
  const kodeBaru = () => String(Math.max(0, ...langkah.map(o => Number(o.kode) || 0)) + 1);
  return (
    <div className="space-y-2 rounded-xl border border-gray-100 bg-gray-50/60 p-3">
      <p className="text-xs text-gray-500">Tulis langkah dalam <strong>urutan yang benar</strong> — siswa melihatnya teracak.</p>
      {langkah.map((o, i) => (
        <div key={o.kode} className="flex items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary-700">{i + 1}</span>
          <input value={o.teks} onChange={e => onChange(langkah.map((x, k) => (k === i ? { ...x, teks: e.target.value } : x)))}
            placeholder={`Langkah ${i + 1}`} className="input-field flex-1 py-1.5" />
          <button type="button" aria-label="Naikkan" disabled={i === 0} onClick={() => geser(i, -1)} className="rounded-lg border border-gray-200 p-1.5 text-gray-600 hover:bg-white disabled:opacity-30"><ArrowUp size={14} /></button>
          <button type="button" aria-label="Turunkan" disabled={i === langkah.length - 1} onClick={() => geser(i, 1)} className="rounded-lg border border-gray-200 p-1.5 text-gray-600 hover:bg-white disabled:opacity-30"><ArrowDown size={14} /></button>
          {!terkunci && langkah.length > 2 && (
            <button type="button" title="Hapus" onClick={() => onChange(langkah.filter((_, k) => k !== i))} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"><Trash2 size={14} /></button>
          )}
        </div>
      ))}
      {!terkunci && (
        <button type="button" onClick={() => onChange([...langkah, { kode: kodeBaru(), teks: "" }])} className="btn-modal-cancel btn-teks text-xs"><Plus size={14} /> Tambah langkah</button>
      )}
    </div>
  );
}
