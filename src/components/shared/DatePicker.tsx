"use client";
import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, CalendarDays, X } from "lucide-react";

const DAYS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
const MONTHS_FULL = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

function parseISO(val: string): Date | null {
  if (!val) return null;
  const [y, m, d] = val.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}
function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
/** Format ringkas dd/mm/yyyy untuk buffer ketikan (`typed`) — trigger dulu tampil format panjang
 * "23 Oktober 2026" sebelum perbaikan ini menjadikannya input yang bisa diketik. */
function toShort(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}
/** Terima ketikan bebas "23/10/26", "23/10/2026", "23-10-26", dst — tahun 2 digit ditebak
 * pakai aturan umum (00-50 -> 2000-an, 51-99 -> 1900-an, wajar utk sekolah: tanggal lahir
 * ortu/staf umumnya 1900-an, tanggal lahir siswa/tahun ajaran umumnya 2000-an). Menolak
 * tanggal yang tidak benar-benar ada (mis. 31/02) — bukan cuma di luar rentang 1-31/1-12. */
function parseTyped(raw: string): Date | null {
  const m = raw.trim().match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2}|\d{4})$/);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  let year = parseInt(m[3], 10);
  if (m[3].length === 2) year = year <= 50 ? 2000 + year : 1900 + year;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(year, month - 1, day);
  // Date() diam-diam "menggeser" tanggal yang tidak valid (mis. 31 Feb -> 3 Mar) — cek balik
  // supaya tanggal semacam itu ditolak, bukan diam-diam diganti.
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return d;
}

interface DatePickerProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export default function DatePicker({ value, onChange, placeholder = "Pilih tanggal", disabled, className = "" }: DatePickerProps) {
  const selected = parseISO(value);
  const today = new Date();

  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(selected?.getFullYear() ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(selected?.getMonth() ?? today.getMonth());
  const [mode, setMode] = useState<"day" | "month" | "year">("day");
  const [yearBase, setYearBase] = useState(Math.floor((selected?.getFullYear() ?? today.getFullYear()) / 12) * 12);
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({});
  // Buffer ketikan bebas — terpisah dari `value` (ISO, controlled parent) supaya user bisa
  // mengetik setengah jalan ("23/1") tanpa tiap keystroke dipaksa jadi tanggal valid.
  const [typed, setTyped] = useState(selected ? toShort(selected) : "");

  const btnRef = useRef<HTMLInputElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  // Sinkron ulang buffer ketikan tiap kali `value` berubah dari LUAR (dipilih lewat kalender,
  // di-reset form, dst) — supaya tampilan teks selalu representasi valid dari `value` terkini
  // saat user TIDAK sedang aktif mengetik (fokus pindah/blur sudah commit atau revert duluan).
  useEffect(() => {
    setTyped(selected ? toShort(selected) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function commitTyped() {
    const trimmed = typed.trim();
    if (!trimmed) { onChange(""); return; }
    const parsed = parseTyped(trimmed);
    if (parsed) {
      onChange(toISO(parsed));
      setViewYear(parsed.getFullYear());
      setViewMonth(parsed.getMonth());
    } else {
      // Ketikan tidak valid — batalkan diam-diam ke nilai valid terakhir, jangan simpan sampah.
      setTyped(selected ? toShort(selected) : "");
    }
  }

  // Posisikan popup lewat portal
  function calcPosition() {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const popupH = 380; // estimasi tinggi popup
    const spaceBelow = window.innerHeight - rect.bottom;
    const above = spaceBelow < popupH && rect.top > popupH;

    setPopupStyle({
      position: "fixed",
      left: rect.left,
      width: 288, // ukuran tetap & kompak — jangan ikut lebar tombol pemicu (bisa sangat lebar di form lembar kerja)
      top: above ? rect.top - popupH - 4 : rect.bottom + 4,
      zIndex: 99999,
    });
  }

  function openPicker() {
    if (disabled) return;
    const base = selected ?? today;
    setViewYear(base.getFullYear());
    setViewMonth(base.getMonth());
    setYearBase(Math.floor(base.getFullYear() / 12) * 12);
    setMode("day");
    calcPosition();
    setOpen(true);
  }

  // Close on outside click or scroll
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (
        btnRef.current?.contains(e.target as Node) ||
        popupRef.current?.contains(e.target as Node)
      ) return;
      setOpen(false); setMode("day");
    }
    function onScroll() { calcPosition(); }
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onScroll, true);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Build calendar grid
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrev = new Date(viewYear, viewMonth, 0).getDate();
  const cells: { date: Date; current: boolean }[] = [];
  for (let i = firstDay - 1; i >= 0; i--)
    cells.push({ date: new Date(viewYear, viewMonth - 1, daysInPrev - i), current: false });
  for (let d = 1; d <= daysInMonth; d++)
    cells.push({ date: new Date(viewYear, viewMonth, d), current: true });
  for (let d = 1; d <= 42 - cells.length; d++)
    cells.push({ date: new Date(viewYear, viewMonth + 1, d), current: false });

  function prevMonth() { viewMonth === 0 ? (setViewMonth(11), setViewYear(y => y - 1)) : setViewMonth(m => m - 1); }
  function nextMonth() { viewMonth === 11 ? (setViewMonth(0), setViewYear(y => y + 1)) : setViewMonth(m => m + 1); }
  function pickDay(d: Date) { onChange(toISO(d)); setOpen(false); setMode("day"); }
  function clear(e: React.MouseEvent) { e.stopPropagation(); onChange(""); }

  const popup = (
    <div
      ref={popupRef}
      style={popupStyle}
      className="rounded-2xl overflow-hidden shadow-2xl border border-primary-100 bg-white"
    >
      {/* ── Day view ── */}
      {mode === "day" && (
        <>
          <div className="bg-primary-700 px-4 py-3 flex items-center justify-between">
            <button type="button" onClick={prevMonth}
              className="p-1 rounded-full text-white/60 hover:text-gold hover:bg-white/10 transition-colors">
              <ChevronLeft size={16} />
            </button>
            <button type="button" onClick={() => setMode("month")}
              className="text-sm font-bold text-white hover:text-gold transition-colors tracking-wide">
              {MONTHS_FULL[viewMonth]} {viewYear}
            </button>
            <button type="button" onClick={nextMonth}
              className="p-1 rounded-full text-white/60 hover:text-gold hover:bg-white/10 transition-colors">
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="grid grid-cols-7 bg-primary-50 border-b border-primary-100">
            {DAYS.map(d => (
              <div key={d} className="py-1.5 text-center text-xs font-bold text-primary-500">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 p-2 gap-0.5 bg-white">
            {cells.map((cell, i) => {
              const isSel = selected && sameDay(cell.date, selected);
              const isToday = sameDay(cell.date, today);
              return (
                <button key={i} type="button" onClick={() => pickDay(cell.date)}
                  className={`aspect-square rounded-full text-xs font-medium flex items-center justify-center transition-all
                    ${isSel
                      ? "bg-gold text-primary-900 font-bold shadow-sm scale-105"
                      : isToday
                      ? "ring-2 ring-gold text-primary-700 font-bold hover:bg-primary-50"
                      : cell.current
                      ? "text-gray-700 hover:bg-primary-100 hover:text-primary-700"
                      : "text-gray-300 hover:bg-gray-50"}
                  `}
                >
                  {cell.date.getDate()}
                </button>
              );
            })}
          </div>
          <div className="px-3 pb-3 flex justify-center">
            <button type="button" onClick={() => pickDay(today)}
              className="text-xs text-primary-700 hover:text-primary-900 font-semibold transition-colors px-3 py-1 rounded-full hover:bg-primary-50">
              Hari Ini
            </button>
          </div>
        </>
      )}

      {/* ── Month picker ── */}
      {mode === "month" && (
        <>
          <div className="bg-primary-700 px-4 py-3 flex items-center justify-between">
            <button type="button" onClick={() => setViewYear(y => y - 1)}
              className="p-1 rounded-full text-white/60 hover:text-gold hover:bg-white/10 transition-colors">
              <ChevronLeft size={16} />
            </button>
            <button type="button" onClick={() => setMode("year")}
              className="text-sm font-bold text-white hover:text-gold transition-colors">
              {viewYear}
            </button>
            <button type="button" onClick={() => setViewYear(y => y + 1)}
              className="p-1 rounded-full text-white/60 hover:text-gold hover:bg-white/10 transition-colors">
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2 p-4 bg-white">
            {MONTHS_SHORT.map((m, idx) => (
              <button key={m} type="button"
                onClick={() => { setViewMonth(idx); setMode("day"); }}
                className={`py-2 rounded-xl text-sm font-medium transition-all
                  ${idx === viewMonth
                    ? "bg-gold text-primary-900 font-bold shadow-sm"
                    : "text-gray-600 hover:bg-primary-100 hover:text-primary-700"}
                `}
              >
                {m}
              </button>
            ))}
          </div>
        </>
      )}

      {/* ── Year picker ── */}
      {mode === "year" && (
        <>
          <div className="bg-primary-700 px-4 py-3 flex items-center justify-between">
            <button type="button" onClick={() => setYearBase(b => b - 12)}
              className="p-1 rounded-full text-white/60 hover:text-gold hover:bg-white/10 transition-colors">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-bold text-white">{yearBase} – {yearBase + 11}</span>
            <button type="button" onClick={() => setYearBase(b => b + 12)}
              className="p-1 rounded-full text-white/60 hover:text-gold hover:bg-white/10 transition-colors">
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2 p-4 bg-white">
            {Array.from({ length: 12 }, (_, i) => yearBase + i).map(y => (
              <button key={y} type="button"
                onClick={() => { setViewYear(y); setMode("month"); }}
                className={`py-2 rounded-xl text-sm font-medium transition-all
                  ${y === viewYear
                    ? "bg-gold text-primary-900 font-bold shadow-sm"
                    : y === today.getFullYear()
                    ? "ring-2 ring-gold text-primary-700"
                    : "text-gray-600 hover:bg-primary-100 hover:text-primary-700"}
                `}
              >
                {y}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className={`relative ${className}`}>
      {/* Bisa diklik (buka kalender) MAUPUN diketik langsung "dd/mm/yy" atau "dd/mm/yyyy" —
          keduanya jalan bareng, bukan salah satu doang. Ketikan cuma di-commit (dipanggil
          onChange) saat blur/Enter, supaya ketikan setengah jalan tidak dipaksa jadi tanggal. */}
      <div
        className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm transition-colors
          ${open ? "border-primary-500 ring-2 ring-primary-100 bg-white" : "border-gray-200 bg-white hover:border-primary-500"}
          ${disabled ? "opacity-50 cursor-not-allowed bg-gray-50" : ""}
        `}
      >
        <CalendarDays size={15} className={`shrink-0 ${open ? "text-primary-700" : "text-gray-400"}`} />
        <input
          ref={btnRef}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          disabled={disabled}
          placeholder={`${placeholder} (dd/mm/yy)`}
          value={typed}
          onChange={e => setTyped(e.target.value)}
          onFocus={e => { openPicker(); e.target.select(); }}
          onBlur={commitTyped}
          onKeyDown={e => {
            if (e.key === "Enter") { e.currentTarget.blur(); }
            else if (e.key === "Escape") { setTyped(selected ? toShort(selected) : ""); e.currentTarget.blur(); }
          }}
          className={`flex-1 min-w-0 outline-none bg-transparent ${typed ? "text-gray-800 font-medium" : "text-gray-400"} ${disabled ? "cursor-not-allowed" : ""}`}
        />
        {typed && !disabled && (
          <button type="button" onMouseDown={e => e.preventDefault()} onClick={clear}
            className="shrink-0 p-0.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600">
            <X size={12} />
          </button>
        )}
      </div>

      {open && typeof document !== "undefined" && createPortal(popup, document.body)}
    </div>
  );
}
