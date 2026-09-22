"use client";
import { useEffect, useMemo, useState } from "react";

/** PAGINATION DI SISI KLIEN — untuk daftar yang sudah dimuat penuh lalu dicari/disaring di browser (pola umum
 * aplikasi ini, lihat DESIGN_SYSTEM §5.6). Yang dipotong hanya yang DIRENDER, jadi daftar ribuan baris tetap ringan.
 *
 *   const hal = usePaginasi(tersaring, 50, kataCari);   // kembali ke halaman 1 setiap kataCari berubah
 *   hal.potongan.map(...)                                // baris halaman aktif
 *   <Paginasi hal={hal} satuan="siswa" />
 */
export function usePaginasi<T>(items: T[], perHalaman = 25, kunciReset: unknown = null) {
  const [halaman, setHalaman] = useState(1);
  const total = items.length;
  const totalHalaman = Math.max(1, Math.ceil(total / perHalaman));

  useEffect(() => { setHalaman(1); }, [kunciReset]);

  // Data berkurang (dihapus/disaring) → jangan terjebak di halaman yang sudah tidak ada.
  const aktif = Math.min(halaman, totalHalaman);
  const potongan = useMemo(() => items.slice((aktif - 1) * perHalaman, aktif * perHalaman), [items, aktif, perHalaman]);

  return {
    halaman: aktif, setHalaman, totalHalaman, total, perHalaman, potongan,
    awal: total ? (aktif - 1) * perHalaman + 1 : 0,
    akhir: Math.min(aktif * perHalaman, total),
  };
}

export type HasilPaginasi = ReturnType<typeof usePaginasi<unknown>>;
