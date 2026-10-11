"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** Mencatat halaman portal yang dibuka (untuk Statistik Pemakaian). Satu jalur dicatat paling sering sekali per 30 menit
 *  per tab, dikirim setelah halaman tenang supaya tidak bersaing dengan muatan utamanya. Halaman pengerjaan ujian dan
 *  layar dinding tidak dicatat. */
export default function PencatatPemakaian() {
  const jalur = usePathname() ?? "";
  useEffect(() => {
    if (!/^\/(dashboard\/|pusat-|perpustakaan|kartu-identitas|bantuan|ujian-online$)/.test(jalur)) return;
    const t = setTimeout(() => {
      try {
        const k = `pakai:${jalur}`, lalu = Number(sessionStorage.getItem(k) ?? 0);
        if (Date.now() - lalu < 30 * 60_000) return;
        sessionStorage.setItem(k, String(Date.now()));
      } catch { /* tetap kirim */ }
      fetch("/api/pemakaian", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jalur }), keepalive: true }).catch(() => {});
    }, 2500);
    return () => clearTimeout(t);
  }, [jalur]);
  return null;
}
