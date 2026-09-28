"use client";
import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, CalendarDays, X } from "lucide-react";

const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
const MONTHS_FULL = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

function parseYM(val: string): { y: number; m: number } | null {
  if (!val) return null;
  const [y, m] = val.split("-").map(Number);
  if (!y || !m) return null;
  return { y, m: m - 1 };
}
function toYM(y: number, m: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}`;
}

interface MonthPickerProps {
  value: string; // format "YYYY-MM"
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/** Versi khusus bulan (tanpa tanggal) dari DatePicker — dipakai utk filter "Filter bulan" (rekap
 * absensi, dsb) yang formatnya "YYYY-MM", pengganti `<input type="month">` bawaan browser (tampilan
 * generik, beda gaya di tiap OS/browser). Bahasa & gaya visual SENGAJA disamakan persis dgn
 * DatePicker.tsx (mode month/year-nya) — reuse styling, bukan komponen baru dari nol. */
export default function MonthPicker({ value, onChange, placeholder = "Pilih bulan", disabled, className = "" }: MonthPickerProps) {
  const selected = parseYM(value);
  const today = new Date();

  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(selected?.y ?? today.getFullYear());
  const [mode, setMode] = useState<"month" | "year">("month");
  const [yearBase, setYearBase] = useState(Math.floor((selected?.y ?? today.getFullYear()) / 12) * 12);
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({});

  const btnRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  function calcPosition() {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const popupH = 260;
    const spaceBelow = window.innerHeight - rect.bottom;
    const above = spaceBelow < popupH && rect.top > popupH;
    const lebar = 260;
    setPopupStyle({
      position: "fixed",
      // Ditahan di dalam layar seperti DatePicker/TimePicker (24 Sep 2026).
      left: Math.max(8, Math.min(rect.left, window.innerWidth - lebar - 8)),
      width: lebar,
      top: above ? rect.top - popupH - 4 : rect.bottom + 4,
      zIndex: 99999,
    });
  }

  function openPicker() {
    if (disabled) return;
    const base = selected ?? { y: today.getFullYear(), m: today.getMonth() };
    setViewYear(base.y);
    setYearBase(Math.floor(base.y / 12) * 12);
    setMode("month");
    calcPosition();
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (btnRef.current?.contains(e.target as Node) || popupRef.current?.contains(e.target as Node)) return;
      setOpen(false); setMode("month");
    }
    function onScroll() { calcPosition(); }
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  function pickMonth(m: number) { onChange(toYM(viewYear, m)); setOpen(false); setMode("month"); }
  function clear(e: React.MouseEvent) { e.stopPropagation(); onChange(""); }

  const displayText = selected ? `${MONTHS_FULL[selected.m]} ${selected.y}` : "";

  const popup = (
    <div ref={popupRef} style={popupStyle} className="rounded-2xl overflow-hidden shadow-2xl border border-primary-100 bg-white">
      {mode === "month" ? (
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
            {MONTHS_SHORT.map((mLabel, idx) => {
              const isSel = selected && selected.y === viewYear && selected.m === idx;
              const isCurrent = viewYear === today.getFullYear() && idx === today.getMonth();
              return (
                <button key={mLabel} type="button" onClick={() => pickMonth(idx)}
                  className={`py-2 rounded-xl text-sm font-medium transition-all
                    ${isSel
                      ? "bg-gold text-primary-900 font-bold shadow-sm"
                      : isCurrent
                      ? "ring-2 ring-gold text-primary-700"
                      : "text-gray-600 hover:bg-primary-100 hover:text-primary-700"}
                  `}>
                  {mLabel}
                </button>
              );
            })}
          </div>
        </>
      ) : (
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
              <button key={y} type="button" onClick={() => { setViewYear(y); setMode("month"); }}
                className={`py-2 rounded-xl text-sm font-medium transition-all
                  ${y === viewYear
                    ? "bg-gold text-primary-900 font-bold shadow-sm"
                    : y === today.getFullYear()
                    ? "ring-2 ring-gold text-primary-700"
                    : "text-gray-600 hover:bg-primary-100 hover:text-primary-700"}
                `}>
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
      <button ref={btnRef} type="button" onClick={openPicker} disabled={disabled}
        className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm transition-colors text-left
          ${open ? "border-primary-500 ring-2 ring-primary-100 bg-white" : "border-gray-200 bg-white hover:border-primary-500"}
          ${disabled ? "opacity-50 cursor-not-allowed bg-gray-50" : "cursor-pointer"}
        `}>
        <CalendarDays size={15} className={open ? "text-primary-700" : "text-gray-400"} />
        <span className={`flex-1 ${displayText ? "text-gray-800 font-medium" : "text-gray-400"}`}>
          {displayText || placeholder}
        </span>
        {displayText && !disabled && (
          <span onClick={clear} className="p-0.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600">
            <X size={12} />
          </span>
        )}
      </button>
      {open && typeof document !== "undefined" && createPortal(popup, document.body)}
    </div>
  );
}
