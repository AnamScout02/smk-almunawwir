"use client";
import { useEffect, useRef, useState } from "react";
import { School } from "lucide-react";

/** Kotak "Asal Sekolah" dengan SARAN nama yang sudah dikenal (6 Okt 2026) — mencegah satu sekolah ditulis 4 cara
 *  ("SMPN 1 Songgon", "SMP N 1 Songgon", …). Calon tetap BOLEH mengetik nama baru; saran hanya membantu. */
export default function IsianSekolahAsal({ value, onChange, placeholder, className, invalid, judulSaran }: {
  value: string; onChange: (v: string) => void; placeholder: string; className: string; invalid?: boolean; judulSaran: string;
}) {
  const [saran, setSaran] = useState<string[]>([]);
  const [buka, setBuka] = useState(false);
  const [aktif, setAktif] = useState(-1);
  const wadah = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = value.trim();
    if (q.length < 2) { queueMicrotask(() => setSaran([])); return; }
    const t = setTimeout(() => {
      fetch(`/api/public/sekolah-asal?q=${encodeURIComponent(q)}`).then(r => r.json())
        .then(d => setSaran(Array.isArray(d) ? d.filter((x: string) => x.toLowerCase() !== q.toLowerCase()) : []))
        .catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [value]);

  useEffect(() => {
    const tutup = (e: MouseEvent) => { if (!wadah.current?.contains(e.target as Node)) setBuka(false); };
    document.addEventListener("mousedown", tutup);
    return () => document.removeEventListener("mousedown", tutup);
  }, []);

  const pilih = (s: string) => { onChange(s); setBuka(false); setAktif(-1); };
  const tampil = buka && saran.length > 0;

  return (
    <div ref={wadah} className="relative">
      <input value={value} type="text" maxLength={120} placeholder={placeholder} autoComplete="off"
        aria-invalid={invalid} aria-autocomplete="list" aria-expanded={tampil} className={className}
        onChange={e => { onChange(e.target.value); setBuka(true); setAktif(-1); }}
        onFocus={() => setBuka(true)}
        onKeyDown={e => {
          if (!tampil) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setAktif(i => Math.min(saran.length - 1, i + 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setAktif(i => Math.max(0, i - 1)); }
          else if (e.key === "Enter" && aktif >= 0) { e.preventDefault(); pilih(saran[aktif]); }
          else if (e.key === "Escape") setBuka(false);
        }} />
      {tampil && (
        <ul role="listbox" className="absolute left-0 right-0 z-[60] mt-1 max-h-64 overflow-y-auto rounded-xl border border-gray-100 bg-white py-1 shadow-lg">
          <li className="px-3 py-1.5 text-xs text-gray-400">{judulSaran}</li>
          {saran.map((s, i) => (
            <li key={s} role="option" aria-selected={i === aktif}>
              <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => pilih(s)}
                className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-primary-50 ${i === aktif ? "bg-primary-50" : ""}`}>
                <School size={14} className="shrink-0 text-gray-400" /> {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
