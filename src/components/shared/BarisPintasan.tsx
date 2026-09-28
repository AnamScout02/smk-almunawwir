"use client";
import React from "react";
import Link from "next/link";

/** BARIS PINTASAN — SATU komponen untuk seluruh aplikasi (27 September 2026).
 *
 * Sebelumnya markup enam baris yang sama disalin-tempel ke 13 berkas, jadi tinggi, padding, dan
 * ukuran ikonnya pelan-pelan berbeda satu sama lain — persis keluhan user "kartu pintasan bentuknya
 * berbeda-beda". Bentuknya sekarang ada di `.kisi-pintasan`/`.ubin-pintasan` (globals.css) dan
 * markupnya cuma di sini; halaman tinggal mengirim daftarnya.
 *
 * Letaknya SELALU setelah kartu angka (DESIGN_SYSTEM §19.5) — isinya halaman TETANGGA yang jadi
 * langkah berikutnya, bukan pengulangan menu atau tab di bawahnya. */
export interface ItemPintasan {
  href: string;
  label: string;
  /** Baris kedua (opsional). Ubin BERKETERANGAN otomatis memakai varian dua baris + panah;
   *  tanpa `ket`, ubinnya ringkas satu baris. Dua varian ini saja — jangan menambah varian ketiga. */
  ket?: string;
  /** Menandai pintasan yang perlu perhatian (chip ikon jadi amber + cincin). */
  sorot?: boolean;
  /** Komponen ikon lucide. Dari halaman SERVER jangan mengoper elemen (CLAUDE.md #35) — komponen ini
   *  "use client", jadi pemanggil klien aman mengirim komponennya langsung. */
  ikon: React.ComponentType<{ size?: number }>;
}

export default function BarisPintasan({ items, className = "" }: { items: ItemPintasan[]; className?: string }) {
  if (!items.length) return null;
  return (
    <div className={`kisi-pintasan ${className}`.trim()}>
      {items.map(t => (
        <Link key={`${t.href}|${t.label}`} href={t.href}
          className={`panel panel-interaktif ubin-pintasan${t.sorot ? " ring-2 ring-amber-300" : ""}`}>
          <span className={`ubin-pintasan-ikon${t.sorot ? " !bg-amber-500" : ""}`}><t.ikon size={16} /></span>
          {t.ket ? (
            <span className="min-w-0">
              <span className="ubin-pintasan-label block">{t.label}</span>
              <span className="block text-xs text-gray-500">{t.ket}</span>
            </span>
          ) : (
            <span className="ubin-pintasan-label">{t.label}</span>
          )}
          {t.ket && (
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"
              className="ml-auto shrink-0 text-gray-300" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </Link>
      ))}
    </div>
  );
}
