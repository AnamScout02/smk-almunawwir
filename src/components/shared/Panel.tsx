import React from "react";
import Link from "next/link";
import TombolDibaca from "@/components/shared/TombolDibaca";

/** Panel berkepala seragam — Pola tampilan v2 (DESIGN_SYSTEM.md §17). Dipakai server maupun client component.
 * `isi={false}` untuk daftar baris penuh (divide-y) yang mengatur padding sendiri.
 * Panah tautan sengaja SVG polos, bukan ikon lucide: ikon lucide kembar di halaman server bisa membuat build produksi
 * gagal render (gotcha #35), dan panel ini dipakai berkali-kali dalam satu halaman. */
export default function Panel({
  judul, ikon, tautan, keterangan, children, className = "", isi = true, id,
}: {
  judul?: React.ReactNode;
  ikon?: React.ReactNode;
  tautan?: { label: string; href: string };
  keterangan?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  isi?: boolean;
  id?: string;
}) {
  return (
    <section id={id} className={`panel masuk-halus ${className}`}>
      {judul && (
        <header className="panel-kepala">
          <h2 className="panel-judul">
            {ikon && <span className="panel-ikon" aria-hidden="true">{ikon}</span>}
            <span className="min-w-0 truncate">{judul}</span>
          </h2>
          {(keterangan || tautan) && (
            // Keterangan panjang boleh turun ke bawah judul di HP (dulu `shrink-0` mendorongnya keluar layar — audit HP 21 Sep 2026).
            <div className="flex min-w-0 items-center gap-3 max-sm:basis-full max-sm:justify-between sm:shrink-0">
              {keterangan && <span className="min-w-0 text-xs text-gray-500">{keterangan}</span>}
              {tautan && (
                <Link href={tautan.href} className="panel-tautan">
                  {tautan.label}
                  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 8h10M9 4l4 4-4 4" />
                  </svg>
                </Link>
              )}
            </div>
          )}
        </header>
      )}
      {isi ? <div className="panel-isi">{children}</div> : children}
    </section>
  );
}

/** Keadaan kosong ringkas di dalam panel (bukan kartu besar setinggi 16rem seperti EmptyState halaman). */
export function PanelKosong({ ikon, teks, children }: { ikon: React.ReactNode; teks: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gray-50 text-gray-300 [&>svg]:h-5 [&>svg]:w-5" aria-hidden="true">
        {ikon}
      </span>
      <p className="text-sm text-gray-500">{teks}</p>
      {children}
    </div>
  );
}

/** Daftar pengumuman aktif (portal guru, siswa, orang tua) — satu gaya untuk semua portal. */
export function DaftarPengumuman({ ikon, pengumuman }: {
  ikon: React.ReactNode;
  pengumuman: { id: string; title: string; content: string; priority: string; wajibKonfirmasi?: boolean; dibaca?: boolean; pembuatNama?: string | null }[];
}) {
  if (!pengumuman.length) return null;
  return (
    <div className="masuk-halus space-y-2" role="region" aria-label="Pengumuman">
      {pengumuman.map(p => {
        const penting = p.priority === "URGENT";
        return (
          <div key={p.id} className={`flex items-start gap-3 rounded-2xl border px-4 py-3 ${penting ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"}`}>
            <span className={`mt-0.5 shrink-0 [&>svg]:h-4 [&>svg]:w-4 ${penting ? "text-red-600" : "text-amber-600"}`} aria-hidden="true">{ikon}</span>
            <div className="min-w-0">
              <p className={`text-sm font-semibold ${penting ? "text-red-800" : "text-amber-800"}`}>
                {penting && <span className="mr-1.5 rounded bg-red-600 px-1.5 py-0.5 text-xs font-bold text-white">Penting</span>}
                {p.title}
              </p>
              <p className={`mt-0.5 whitespace-pre-line text-sm leading-relaxed ${penting ? "text-red-700" : "text-amber-700"}`}>{p.content}</p>
              {p.pembuatNama && <p className={`mt-1 text-xs ${penting ? "text-red-600/80" : "text-amber-700/80"}`}>— {p.pembuatNama}</p>}
              {p.wajibKonfirmasi && <TombolDibaca id={p.id} dibaca={!!p.dibaca} />}
            </div>
          </div>
        );
      })}
    </div>
  );
}
