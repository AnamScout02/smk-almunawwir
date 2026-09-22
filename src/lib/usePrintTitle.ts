"use client";
import { useEffect } from "react";

/** Set `document.title` sementara (dikembalikan ke judul semula saat komponen unmount/pindah
 * halaman) — dipakai di halaman cetak yang berupa Client Component (banyak halaman cetak di app
 * ini fetch datanya di client, jadi `export const metadata`/`generateMetadata` Next.js tidak bisa
 * dipakai sama sekali di situ). Browser memakai `document.title` sbg nama file default saat
 * "Simpan sebagai PDF" — lihat src/lib/print-filename.ts untuk cara membangun judul yang bagus. */
export function usePrintTitle(title: string | null | undefined) {
  useEffect(() => {
    if (!title) return;
    const prev = document.title;
    document.title = title;
    return () => { document.title = prev; };
  }, [title]);
}
