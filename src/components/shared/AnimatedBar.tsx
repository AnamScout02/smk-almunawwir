"use client";
import { useEffect, useState } from "react";

interface AnimatedBarProps {
  /** Persentase 0–100 (nilai di atas 100 otomatis di-clamp). */
  pct: number;
  /** Tinggi track, mis. "h-1.5" (default) atau "h-2". */
  heightClass?: string;
  /** Class track (background garis-garis + warna dasar) — default cocok dipakai di atas StatTile berwarna. */
  trackClassName?: string;
  /** Class warna isian — abaikan kalau pakai `fillColor` (warna dinamis per baris, mis. beda warna per ambang batas). */
  fillClassName?: string;
  /** Warna isian dinamis (style.background) — dipakai kalau warnanya dihitung per data (bukan class tetap). */
  fillColor?: string;
  className?: string;
}

/** Progress bar yang "tumbuh" dari 0% ke nilai akhir saat pertama muncul di layar — diadaptasi
 * dari `_animProgBar()` referensi eksternal (billing-technofix): render awal lebar 0%, lalu
 * sesaat kemudian (di luar render pertama) di-set ke nilai asli supaya transisi CSS
 * (`transition-all duration-700`, sudah ada di semua pemakaian bar sebelumnya) benar-benar
 * terpicu — CSS transition TIDAK jalan kalau elemen langsung muncul di lebar akhir pada render
 * pertama. Menggantikan pola manual `<div style={{width}}>` yang diulang di beberapa halaman
 * (JaringanManager, kesiswaan, kepala-sekolah, penjamin-mutu). */
export default function AnimatedBar({ pct, heightClass = "h-1.5", trackClassName = "bg-white/25", fillClassName = "bg-white", fillColor, className = "" }: AnimatedBarProps) {
  const [width, setWidth] = useState(0);
  const target = Math.min(Math.max(pct, 0), 100);

  useEffect(() => {
    const t = setTimeout(() => setWidth(target), 120);
    return () => clearTimeout(t);
  }, [target]);

  return (
    <div className={`${heightClass} ${trackClassName} rounded-full overflow-hidden segmented-bar ${className}`}>
      <div
        className={`h-full rounded-full transition-all duration-700 ${fillColor ? "" : fillClassName}`}
        style={{ width: `${width}%`, ...(fillColor ? { background: fillColor } : {}) }}
      />
    </div>
  );
}
