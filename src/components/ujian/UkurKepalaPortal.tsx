"use client";
import { useEffect } from "react";

/** Mengukur tinggi kepala portal yang menempel (#kepala-portal: bar navy) lalu memasangnya sebagai CSS var
 * `--tinggi-kepala-portal` di <html>. PageHeader di dalam portal menempel tepat di bawahnya, pita menu tab di bawah
 * PageHeader (lihat PortalShell & PitaPortal). Tinggi
 * berubah menurut lebar layar (ukuran logo, baris tab), jadi diukur — bukan ditebak angka tetap. */
export default function UkurKepalaPortal() {
  useEffect(() => {
    const el = document.getElementById("kepala-portal");
    if (!el) return;
    const pasang = () => document.documentElement.style.setProperty("--tinggi-kepala-portal", `${Math.round(el.getBoundingClientRect().height)}px`);
    pasang();
    const ro = new ResizeObserver(pasang);
    ro.observe(el);
    return () => { ro.disconnect(); document.documentElement.style.removeProperty("--tinggi-kepala-portal"); };
  }, []);
  return null;
}
