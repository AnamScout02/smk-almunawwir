"use client";
import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Clock, X } from "lucide-react";

/** PEMILIH JAM 24 JAM (21 September 2026) — pengganti `<input type="time">` bawaan browser.
 *
 * Isian jam bawaan mengikuti bahasa perangkat: di HP/laptop berbahasa Inggris tampil "07:15 AM" dan harus memilih
 * AM/PM — membingungkan saat menyusun jadwal ujian (permintaan user: "waktu jangan dibuat AM PM, buat 24 jam saja").
 * Pola sama dengan DatePicker: bisa DIKETIK ("0715", "7.15", "7:15" → 07:15) maupun DIPILIH dari popup (kisi jam
 * 00–23 lalu menit). Nilai selalu "HH:MM" 24 jam — format yang sama dengan `<input type="time">`, jadi penggantiannya
 * tidak mengubah data. Ketikan baru disimpan saat blur/Enter supaya ketikan setengah jalan tidak dipaksa jadi jam. */

const JAM = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MENIT = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

function bagi(v: string): { j: string; m: string } | null {
  const x = /^(\d{2}):(\d{2})/.exec(v ?? "");
  return x ? { j: x[1], m: x[2] } : null;
}

/** Terima "7", "715", "0715", "7.15", "7:15", "07 15" → "07:15"; null bila bukan jam yang sah. */
export function uraiJam(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  let j: number, m: number;
  const pisah = /^(\d{1,2})\s*[:.,\s]\s*(\d{1,2})$/.exec(t);
  if (pisah) { j = Number(pisah[1]); m = Number(pisah[2]); }
  else if (/^\d{1,4}$/.test(t)) {
    if (t.length <= 2) { j = Number(t); m = 0; }
    else { j = Number(t.slice(0, t.length - 2)); m = Number(t.slice(-2)); }
  } else return null;
  if (j > 23 || m > 59) return null;
  return `${String(j).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

interface TimePickerProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  id?: string;
  title?: string;
  "aria-label"?: string;
  /** Untuk sel tabel/kolom sempit: tanpa ikon jam & tombol kosongkan, padding lebih rapat. */
  ringkas?: boolean;
}

export default function TimePicker({ value, onChange, placeholder = "jj:mm", disabled, required, className = "", id, title, "aria-label": ariaLabel, ringkas = false }: TimePickerProps) {
  const pilih = bagi(value);
  const [open, setOpen] = useState(false);
  const [ketik, setKetik] = useState(pilih ? `${pilih.j}:${pilih.m}` : "");
  const [jamSementara, setJamSementara] = useState<string | null>(null);
  const [gaya, setGaya] = useState<React.CSSProperties>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  // Nilai berubah dari LUAR (dipilih lewat popup, form di-reset) → tampilan ketikan ikut.
  useEffect(() => {
    const p = bagi(value);
    queueMicrotask(() => setKetik(p ? `${p.j}:${p.m}` : ""));
  }, [value]);

  function simpanKetikan() {
    if (!ketik.trim()) { if (value) onChange(""); return; }
    const jam = uraiJam(ketik);
    if (jam) { if (jam !== value) onChange(jam); setKetik(jam); }
    else setKetik(pilih ? `${pilih.j}:${pilih.m}` : ""); // tidak sah — kembali ke nilai terakhir yang sah
  }

  function hitungPosisi() {
    const el = inputRef.current?.parentElement;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const tinggi = 300, lebar = 272;
    const atas = window.innerHeight - r.bottom < tinggi && r.top > tinggi;
    setGaya({
      position: "fixed", width: lebar, zIndex: 99999,
      left: Math.max(8, Math.min(r.left, window.innerWidth - lebar - 8)),
      top: atas ? r.top - tinggi - 4 : r.bottom + 4,
    });
  }

  function buka() {
    if (disabled) return;
    setJamSementara(null);
    hitungPosisi();
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const luar = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (inputRef.current?.parentElement?.contains(t) || popupRef.current?.contains(t)) return;
      setOpen(false);
    };
    const gulir = () => hitungPosisi();
    document.addEventListener("mousedown", luar);
    document.addEventListener("touchstart", luar);
    window.addEventListener("scroll", gulir, true);
    window.addEventListener("resize", gulir);
    return () => {
      document.removeEventListener("mousedown", luar);
      document.removeEventListener("touchstart", luar);
      window.removeEventListener("scroll", gulir, true);
      window.removeEventListener("resize", gulir);
    };
  }, [open]);

  const jamAktif = jamSementara ?? pilih?.j ?? null;
  function pilihJam(j: string) {
    setJamSementara(j);
    onChange(`${j}:${pilih?.m ?? "00"}`);
  }
  function pilihMenit(m: string) {
    onChange(`${jamAktif ?? "07"}:${m}`);
    setOpen(false);
    inputRef.current?.blur();
  }

  const tombol = (aktif: boolean) =>
    `h-9 rounded-lg text-sm font-semibold angka transition-colors ${aktif ? "bg-gold text-primary-900 shadow-sm" : "text-gray-700 hover:bg-primary-100 hover:text-primary-700"}`;

  const popup = (
    <div ref={popupRef} style={gaya} className="rounded-2xl overflow-hidden shadow-2xl border border-primary-100 bg-white"
      onMouseDown={e => e.preventDefault() /* jangan curi fokus dari kotak ketik */}>
      <div className="bg-primary-700 px-4 py-2.5 flex items-center justify-between">
        <span className="text-sm font-bold text-white tracking-wide">Pilih jam (24 jam)</span>
        <span className="font-mono text-base font-bold text-gold angka">{jamAktif ?? "--"}:{pilih?.m ?? "--"}</span>
      </div>
      <div className="p-3 space-y-3">
        <div>
          <p className="label-kecil text-gray-400 mb-1.5">Jam</p>
          <div className="grid grid-cols-6 gap-1">
            {JAM.map(j => <button key={j} type="button" onClick={() => pilihJam(j)} className={tombol(j === jamAktif)}>{j}</button>)}
          </div>
        </div>
        <div>
          <p className="label-kecil text-gray-400 mb-1.5">Menit {pilih && !MENIT.includes(pilih.m) && <span className="normal-case tracking-normal">· {pilih.m} (diketik)</span>}</p>
          <div className="grid grid-cols-6 gap-1">
            {MENIT.map(m => <button key={m} type="button" onClick={() => pilihMenit(m)} className={tombol(m === pilih?.m)}>{m}</button>)}
          </div>
        </div>
        <p className="text-xs text-gray-400">Menit lain bisa diketik langsung, mis. <span className="font-mono">0717</span> → 07:17.</p>
      </div>
    </div>
  );

  return (
    <div className={`relative ${className}`} title={title}>
      <div className={`w-full flex items-center rounded-xl border transition-colors ${ringkas ? "gap-1 px-2 py-2" : "gap-2 px-3 py-2.5"}
        ${open ? "border-primary-500 ring-2 ring-primary-100 bg-white" : "border-gray-200 bg-white hover:border-primary-500"}
        ${disabled ? "opacity-50 cursor-not-allowed bg-gray-50" : ""}`}>
        {!ringkas && <Clock size={15} className={`shrink-0 ${open ? "text-primary-700" : "text-gray-400"}`} />}
        <input
          ref={inputRef} id={id} aria-label={ariaLabel} required={required}
          type="text" inputMode="numeric" autoComplete="off" disabled={disabled} maxLength={5}
          placeholder={placeholder} value={ketik}
          onChange={e => setKetik(e.target.value.replace(/[^\d:.\s]/g, ""))}
          onFocus={e => { buka(); e.target.select(); }}
          onBlur={simpanKetikan}
          onKeyDown={e => {
            if (e.key === "Enter") { e.preventDefault(); setOpen(false); e.currentTarget.blur(); }
            else if (e.key === "Escape") { setKetik(pilih ? `${pilih.j}:${pilih.m}` : ""); setOpen(false); e.currentTarget.blur(); }
          }}
          className={`flex-1 min-w-0 w-full outline-none bg-transparent font-mono angka text-base sm:text-sm ${ketik ? "text-gray-800 font-medium" : "text-gray-400"} ${disabled ? "cursor-not-allowed" : ""}`}
        />
        {ketik && !disabled && !required && !ringkas && (
          <button type="button" aria-label="Kosongkan jam" onMouseDown={e => e.preventDefault()} onClick={() => { setKetik(""); onChange(""); }}
            className="shrink-0 p-0.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600">
            <X size={12} />
          </button>
        )}
      </div>
      {open && typeof document !== "undefined" && createPortal(popup, document.body)}
    </div>
  );
}
