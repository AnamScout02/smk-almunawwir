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

  const btnRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

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
      width: rect.width < 288 ? 288 : rect.width,
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

  const displayText = selected
    ? `${selected.getDate()} ${MONTHS_FULL[selected.getMonth()]} ${selected.getFullYear()}`
    : "";

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
              <div key={d} className="py-1.5 text-center text-[11px] font-bold text-primary-400">{d}</div>
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
              className="text-xs text-primary-600 hover:text-primary-900 font-semibold transition-colors px-3 py-1 rounded-full hover:bg-primary-50">
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
      <button
        ref={btnRef}
        type="button"
        onClick={openPicker}
        disabled={disabled}
        className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm transition-colors text-left
          ${open
            ? "border-primary-500 ring-2 ring-primary-100 bg-white"
            : "border-gray-200 bg-white hover:border-primary-400"}
          ${disabled ? "opacity-50 cursor-not-allowed bg-gray-50" : "cursor-pointer"}
        `}
      >
        <CalendarDays size={15} className={open ? "text-primary-600" : "text-gray-400"} />
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
