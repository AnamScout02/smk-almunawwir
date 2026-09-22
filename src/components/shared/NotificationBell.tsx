"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Bell, ChevronRight } from "lucide-react";

export interface NotificationItem {
  label: string;
  count: number;
  href: string;
}

interface NotificationBellProps {
  items: NotificationItem[];
  /** Warna ikon untuk latar gelap (sidebar navy) vs terang. */
  variant?: "dark" | "light";
}

/** Lonceng notifikasi terpusat — merangkum badge yang sebelumnya cuma muncul terpisah di tiap menu sidebar
 * jadi satu dropdown ringkas, dipasang di header/topbar Admin & TAS.
 *
 * Dropdown-nya dirender lewat portal ke document.body (posisi fixed, dihitung dari lokasi tombol) —
 * bukan absolute di dalam sidebar — supaya tidak ikut terpotong oleh overflow-hidden sidebar yang sempit. */
export default function NotificationBell({ items, variant = "dark" }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({});
  const btnRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const total = items.reduce((sum, i) => sum + i.count, 0);
  const active = items.filter(i => i.count > 0);

  function calcPosition() {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const popupW = 288;
    const spaceRight = window.innerWidth - rect.left;
    const alignRight = spaceRight < popupW;
    setPopupStyle({
      position: "fixed",
      top: rect.bottom + 6,
      left: alignRight ? rect.right - popupW : rect.left,
      width: popupW,
      zIndex: 99999,
    });
  }

  function toggle() {
    if (!open) calcPosition();
    setOpen(o => !o);
  }

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (btnRef.current?.contains(e.target as Node) || popupRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    function onScroll() { calcPosition(); }
    document.addEventListener("mousedown", onDocClick);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  const iconClass = variant === "dark" ? "text-white/70 hover:text-white" : "text-gray-500 hover:text-gray-800";

  const popup = (
    <div ref={popupRef} style={popupStyle} className="bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-50 font-heading font-bold text-sm text-primary-900">
        Notifikasi {total > 0 && <span className="text-gray-400 font-normal">({total})</span>}
      </div>
      {active.length === 0 ? (
        <p className="p-5 text-sm text-gray-400 text-center">Tidak ada notifikasi baru.</p>
      ) : (
        <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
          {active.map(i => (
            <Link key={i.href} href={i.href} onClick={() => setOpen(false)}
              className="flex items-center justify-between gap-2 px-4 py-3 hover:bg-primary-50/40 transition-colors">
              <span className="text-sm text-gray-700">{i.label}</span>
              <span className="flex items-center gap-1.5 shrink-0">
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-500 text-white">{i.count}</span>
                <ChevronRight size={14} className="text-gray-300" />
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        className={`relative p-2 rounded-lg transition-colors ${variant === "dark" ? "hover:bg-white/10" : "hover:bg-gray-100"} ${iconClass}`}
        title="Notifikasi"
      >
        <Bell size={19} />
        {total > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center leading-none">
            {total > 99 ? "99+" : total}
          </span>
        )}
      </button>

      {open && typeof document !== "undefined" && createPortal(popup, document.body)}
    </div>
  );
}
