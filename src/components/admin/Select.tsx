"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check, Search } from "lucide-react";

interface Option {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** Override total className tombol trigger (default styling `.input-field`) — dipakai kalau
   * dropdown perlu tampilan khusus (mis. pewarnaan status per baris), bukan style form biasa. */
  buttonClassName?: string;
}

const SEARCHABLE_THRESHOLD = 8;

/** Dropdown custom — patokan tunggal utk semua select di app. Panel opsi dirender lewat portal
 * (document.body, position:fixed dihitung dari getBoundingClientRect trigger) — BUKAN absolute
 * biasa di dalam tree komponen. Tanpa ini, Select yang dipakai di dalam container scroll
 * (tabel lebar overflow-x-auto, kartu overflow-hidden, dll — mis. Buku Piket Kedisiplinan Guru)
 * ke-clip/kepotong oleh ancestor-nya, terutama di mobile. Pola sama persis DatePicker.tsx. */
export default function Select({ value, onChange, options, placeholder = "Pilih...", className = "", disabled = false, buttonClassName }: SelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({});
  const btnRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find(o => o.value === value);
  const searchable = options.length > SEARCHABLE_THRESHOLD;
  const visibleOptions = searchable && query.trim()
    ? options.filter(o => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  function calcPosition() {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const estimatedListHeight = Math.min(options.length, 6) * 40 + 16 + (searchable ? 40 : 0);
    const spaceBelow = window.innerHeight - rect.bottom;
    const above = spaceBelow < estimatedListHeight && rect.top > estimatedListHeight;
    setPopupStyle({
      position: "fixed",
      left: rect.left,
      width: rect.width,
      ...(above ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }),
      zIndex: 99999,
    });
  }

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (btnRef.current?.contains(e.target as Node) || popupRef.current?.contains(e.target as Node)) return;
      setOpen(false); setQuery("");
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { setOpen(false); setQuery(""); }
    }
    function onScrollOrResize() { if (open) calcPosition(); }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Navigasi keyboard (Arrow Up/Down + Enter) saat dropdown terbuka
  useEffect(() => {
    if (!open) return;
    function onKeyNav(e: KeyboardEvent) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIndex(i => Math.min(i + 1, visibleOptions.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIndex(i => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const opt = visibleOptions[highlightIndex];
        if (opt) { onChange(opt.value); setOpen(false); setQuery(""); }
      }
    }
    document.addEventListener("keydown", onKeyNav);
    return () => document.removeEventListener("keydown", onKeyNav);
  }, [open, visibleOptions, highlightIndex, onChange]);

  // Reset highlight ke atas setiap kali hasil pencarian berubah
  useEffect(() => { setHighlightIndex(0); }, [query]);

  // Auto-scroll opsi yang di-highlight supaya selalu terlihat
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector(`[data-idx="${highlightIndex}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: "nearest" });
  }, [highlightIndex, open]);

  function toggleOpen() {
    if (disabled) return;
    if (!open) {
      calcPosition();
      const initialIndex = options.findIndex(o => o.value === value);
      setHighlightIndex(initialIndex >= 0 ? initialIndex : 0);
      setTimeout(() => searchRef.current?.focus(), 0);
    } else {
      setQuery("");
    }
    setOpen(o => !o);
  }

  const panel = (
    <div
      ref={popupRef}
      style={popupStyle}
      className="bg-white border border-gray-100 rounded-xl shadow-2xl py-1.5"
    >
      {searchable && (
        <div className="px-2 pb-1.5 mb-1 border-b border-gray-100 flex items-center gap-1.5">
          <Search size={14} className="text-gray-400 shrink-0 ml-1.5" />
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onClick={e => e.stopPropagation()}
            placeholder="Cari..."
            className="w-full text-sm py-1 outline-none placeholder:text-gray-400"
          />
        </div>
      )}
      <div ref={listRef} className="max-h-60 overflow-y-auto scrollbar-hide [&::-webkit-scrollbar]:hidden">
        {visibleOptions.length === 0 && (
          <p className="px-3.5 py-2 text-sm text-gray-400">Tidak ada pilihan</p>
        )}
        {visibleOptions.map((o, i) => (
          <button
            key={o.value}
            data-idx={i}
            type="button"
            onClick={() => { onChange(o.value); setOpen(false); setQuery(""); }}
            onMouseEnter={() => setHighlightIndex(i)}
            className={`w-full flex items-center justify-between gap-2 text-left px-3.5 py-2 text-sm transition-colors ${
              o.value === value ? "bg-primary-50 text-primary-700 font-semibold"
                : i === highlightIndex ? "bg-gray-50 text-gray-700"
                : "text-gray-700 hover:bg-gray-50"
            }`}
          >
            <span className="truncate">{o.label}</span>
            {o.value === value && <Check size={14} className="shrink-0" />}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    // min-w-0: label pilihan yang panjang dipotong "…" di dalam kotak, bukan melebarkan kolom/halaman (temuan user 17 Sep 2026).
    <div className={`relative min-w-0 ${className}`}>
      <button
        ref={btnRef}
        type="button"
        onClick={toggleOpen}
        disabled={disabled}
        className={`${buttonClassName ?? `input-field flex items-center justify-between gap-2 text-left cursor-pointer disabled:cursor-not-allowed ${!selected ? "text-gray-400" : ""}`} focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1`}
      >
        <span className="min-w-0 truncate">{selected ? selected.label : placeholder}</span>
        <ChevronDown size={16} className={`shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && typeof document !== "undefined" && createPortal(panel, document.body)}
    </div>
  );
}
