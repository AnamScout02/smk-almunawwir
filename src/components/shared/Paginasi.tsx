"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface HalPaginasi {
  halaman: number; totalHalaman: number; total: number; awal: number; akhir: number;
  setHalaman: (h: number) => void;
}

/** Nomor halaman ringkas: 1 … 4 5 6 … 20 (tetap semua bila ≤ 7 halaman). */
function daftarNomor(h: number, t: number): (number | "…")[] {
  if (t <= 7) return Array.from({ length: t }, (_, i) => i + 1);
  const inti = [...new Set([1, t, h - 1, h, h + 1].filter(x => x >= 1 && x <= t))].sort((a, b) => a - b);
  const hasil: (number | "…")[] = [];
  inti.forEach((n, i) => {
    if (i > 0 && n - inti[i - 1] > 1) hasil.push("…");
    hasil.push(n);
  });
  return hasil;
}

/** PAGINATION BERSAMA — pasangan `usePaginasi` (src/lib/use-paginasi.ts). Tidak tampil bila hanya satu halaman.
 * `idGulir`: id elemen awal daftar — setelah ganti halaman layar digulir ke sana (beri elemen itu `scroll-mt-*`
 * supaya tidak tertutup header yang menempel). Nomor halaman disembunyikan di HP, cukup Sebelumnya/Berikutnya. */
export default function Paginasi({ hal, satuan = "data", idGulir, className = "" }: {
  hal: HalPaginasi; satuan?: string; idGulir?: string; className?: string;
}) {
  if (hal.totalHalaman <= 1) return null;

  function ganti(h: number) {
    hal.setHalaman(Math.min(hal.totalHalaman, Math.max(1, h)));
    if (idGulir) requestAnimationFrame(() => document.getElementById(idGulir)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  const tombol = "sentuh inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold";

  return (
    <nav aria-label="Pindah halaman" className={`flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 text-sm print:hidden ${className}`}>
      <p className="text-gray-500 tabular-nums text-center sm:text-left">
        Menampilkan {hal.awal}–{hal.akhir} dari {hal.total} {satuan} · halaman {hal.halaman} dari {hal.totalHalaman}
      </p>
      <div className="flex items-center gap-1">
        <button type="button" disabled={hal.halaman <= 1} onClick={() => ganti(hal.halaman - 1)} className={tombol}>
          <ChevronLeft size={15} /> Sebelumnya
        </button>
        {daftarNomor(hal.halaman, hal.totalHalaman).map((n, i) => n === "…" ? (
          <span key={`jeda-${i}`} className="hidden sm:inline px-1 text-gray-300">…</span>
        ) : (
          <button key={n} type="button" onClick={() => ganti(n)} aria-current={n === hal.halaman ? "page" : undefined}
            className={`hidden sm:inline-flex min-w-[2.25rem] justify-center px-2 py-1.5 rounded-lg border tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold ${n === hal.halaman ? "border-primary-900 bg-primary-900 text-white font-semibold" : "border-gray-200 text-gray-700 hover:bg-gray-50"}`}>
            {n}
          </button>
        ))}
        <button type="button" disabled={hal.halaman >= hal.totalHalaman} onClick={() => ganti(hal.halaman + 1)} className={tombol}>
          Berikutnya <ChevronRight size={15} />
        </button>
      </div>
    </nav>
  );
}
