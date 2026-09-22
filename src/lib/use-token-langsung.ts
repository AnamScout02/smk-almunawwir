"use client";
import { useEffect, useRef, useState } from "react";

export interface TokenLangsung { token: string; tokenUjian: string; tokenBersama: boolean; tokenBerganti: string | null }

/** Token terkini untuk layar petugas (detail ujian, Daftar Ujian) — diperbarui tiap `jedaMs` dan segera saat tab
 * kembali dilihat, serta tepat setelah jam berganti token lewat. Satu sumber dengan papan pantau lewat
 * /api/teacher/exams/token. Mengembalikan peta id ujian → token; ujian yang belum termuat tidak ada di peta. */
export function useTokenLangsung(ids: string[], jedaMs = 10_000): Record<string, TokenLangsung> {
  const [peta, setPeta] = useState<Record<string, TokenLangsung>>({});
  const kunci = [...ids].sort().join(",");
  const petaRef = useRef(peta);
  useEffect(() => { petaRef.current = peta; }, [peta]);

  useEffect(() => {
    if (!kunci) return;
    let hidup = true;
    let pewaktu: ReturnType<typeof setTimeout> | null = null;
    const muat = () => {
      if (document.visibilityState === "hidden") { jadwalkan(); return; }
      fetch(`/api/teacher/exams/token?ids=${encodeURIComponent(kunci)}`, { cache: "no-store" })
        .then(r => (r.ok ? r.json() : null))
        .then(d => { if (hidup && d && typeof d === "object" && !d.error) setPeta(d); })
        .catch(() => {})
        .finally(() => { if (hidup) jadwalkan(); });
    };
    const jadwalkan = () => {
      if (pewaktu) clearTimeout(pewaktu);
      // Ambil tepat setelah token terdekat berganti (+1,5 dtk), selambat-lambatnya tiap `jedaMs`.
      const berikut = Object.values(petaRef.current).map(t => (t.tokenBerganti ? new Date(t.tokenBerganti).getTime() - Date.now() + 1500 : Infinity));
      const tunggu = Math.max(1500, Math.min(jedaMs, ...berikut));
      pewaktu = setTimeout(muat, tunggu);
    };
    const saatTerlihat = () => { if (document.visibilityState === "visible") muat(); };
    muat();
    document.addEventListener("visibilitychange", saatTerlihat);
    return () => { hidup = false; if (pewaktu) clearTimeout(pewaktu); document.removeEventListener("visibilitychange", saatTerlihat); };
  }, [kunci, jedaMs]);

  return peta;
}
